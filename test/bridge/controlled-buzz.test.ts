import { expect, it } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { finalizeEvent, getPublicKey, verifyEvent } from "nostr-tools";
import type { PluginContext, PluginDatabaseClient } from "@paperclipai/plugin-sdk";
import { controlledHttps } from "../roundtable/controlled-https.js";
import { createBridgeStore, BRIDGE_NAMESPACE } from "../../src/store/postgres.js";
import { createBridge } from "../../src/bridge/service.js";
import { runtimeState } from "../../src/bridge/runtime.js";
import { createPaperclipAdapter } from "../../src/paperclip/adapter.js";
import { makeBuzzHttpClient } from "../../src/buzz/http.js";

it("recovers one signed member contribution and its exact durable receipt through isolated HTTPS readback", async () => {
  // Public deterministic fixture keys, controlled relay, native API double, real SQL/signatures/transport.
  // This does not claim official-relay or installed native-host qualification.
  const memberKey = new Uint8Array(32).fill(11), bridgeKey = new Uint8Array(32).fill(12);
  const outsiderKey = new Uint8Array(32).fill(13);
  const pg = new PGlite();
  let website: Awaited<ReturnType<typeof controlledHttps>> | undefined;
  try {
    await pg.exec(`CREATE SCHEMA ${BRIDGE_NAMESPACE}`);
    for (const name of (await readdir(new URL("../../migrations/", import.meta.url))).filter(n => n.endsWith(".sql")).sort()) {
      await pg.exec(await readFile(new URL("../../migrations/" + name, import.meta.url), "utf8"));
    }
    const db: PluginDatabaseClient = {
      namespace: BRIDGE_NAMESPACE,
      query: async <T>(sql: string, params?: unknown[]) => (await pg.query<T>(sql, params)).rows,
      execute: async (sql, params) => ({ rowCount: (await pg.query(sql, params)).affectedRows ?? 0 }),
    };
    const store = createBridgeStore(db), events = new Map<string, any>();
    const postBodies: string[] = [], queryBodies: any[] = [], nativeComments: any[] = [];
    let now = 1_800_000_000, loseAcknowledgement = true;
    website = await controlledHttps(async (url, init) => {
      const authorization = new Headers(init.headers).get("authorization")!;
      const auth = JSON.parse(Buffer.from(authorization.slice(6), "base64").toString("utf8"));
      expect(verifyEvent(auth)).toBe(true);
      expect(auth.kind).toBe(27235);
      expect(auth.tags).toContainEqual(["u", url]);
      expect(auth.tags).toContainEqual(["method", "POST"]);
      const body = String(init.body);
      const { createHash } = await import("node:crypto");
      expect(auth.tags).toContainEqual(["payload", createHash("sha256").update(body).digest("hex")]);
      if (url.endsWith("/query")) {
        const filters = JSON.parse(body); queryBodies.push(filters);
        return Response.json([...events.values()].filter(event => filters.some((filter: any) => filter.ids?.includes(event.id))));
      }
      expect(url.endsWith("/events")).toBe(true);
      const event = JSON.parse(body);
      expect(verifyEvent(event)).toBe(true);
      const persisted = (await store.getOutbox(event.tags.find((tag: string[]) => tag[0] === "inertia")[1]))!;
      expect(persisted.eventId).toBe(event.id);
      expect(persisted.eventBytes).toBe(body);
      expect(persisted.deliveryAttempted).toBe(true);
      postBodies.push(body); events.set(event.id, event);
      if (loseAcknowledgement) return new Response("", { status: 503 });
      return Response.json({ accepted: true, event_id: event.id });
    });
    const binding = { relay: website.origin, companyId: "co", issueId: "meeting-followup", channelId: "00000000-0000-4000-8000-000000000001", rootId: "a".repeat(64) };
    await store.putBinding(binding);
    await store.putPairing({ relay: binding.relay, companyId: "co", pubkey: getPublicKey(memberKey), actorUserId: "approved-member", kind: "human", active: true });
    const native = createPaperclipAdapter({ issues: {
      createComment: async (_issue: string, body: string, _company: string, options: any) => {
        const comment = { id: "source-linked-contribution", body, authorUserId: options.actorUserId };
        nativeComments.push(comment); return comment;
      },
      listComments: async () => nativeComments,
    } } as unknown as Pick<PluginContext, "issues">);
    const deps = {
      store, native, runtime: runtimeState(db, "co", binding.relay),
      loadConfig: () => store.loadConfig(binding.relay, getPublicKey(bridgeKey)),
      signer: (template: any) => finalizeEvent(template, bridgeKey), clock: () => now,
      buzz: makeBuzzHttpClient({ relayUrl: binding.relay, signer: template => finalizeEvent(template, bridgeKey), clock: () => now, sleep: async () => {}, fetch: website.fetch }),
    };
    const template = { kind: 9, created_at: now, tags: [["h", binding.channelId], ["e", binding.rootId, "", "root"], ["e", binding.rootId, "", "reply"]], content: "Meeting review: the accessibility test request is a candidate; no owner was adopted." };
    const incoming = finalizeEvent(structuredClone(template), memberKey);
    expect((await createBridge(deps).ingest(finalizeEvent(structuredClone(template), outsiderKey))).status).toBe("rejected");
    expect(nativeComments).toHaveLength(0);
    expect(await createBridge(deps).ingest(incoming)).toMatchObject({ status: "applied", nativeId: "source-linked-contribution" });
    expect(nativeComments).toHaveLength(1);
    expect(nativeComments[0]).toMatchObject({ authorUserId: "approved-member" });
    expect(nativeComments[0].body).toContain(incoming.content);
    expect(postBodies).toHaveLength(3);
    expect(new Set(postBodies).size).toBe(1);
    expect((await store.listOutbox())[0]!.state).toBe("pending");
    // The receipt may have committed. Reconstruct the bridge and age past relay freshness.
    // Exact signed-event readback must resolve it without creating a replacement identity.
    loseAcknowledgement = false; now += 1000;
    await createBridge(deps).reconcile();
    expect(queryBodies).toHaveLength(1);
    expect(postBodies).toHaveLength(3);
    expect((await store.listOutbox()).length).toBe(0);
    expect((await createBridge(deps).ingest(incoming)).status).toBe("replayed");
    expect(nativeComments).toHaveLength(1);
    const [receipt] = [...events.values()];
    expect(JSON.parse(receipt.content)).toMatchObject({ sourceEventId: incoming.id, issueId: binding.issueId, nativeId: "source-linked-contribution", status: "applied" });
  } finally {
    await website?.close(); await pg.close();
  }
}, 60000);
