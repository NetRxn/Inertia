import { vi, it, expect } from "vitest";
// PGlite initializes PostgreSQL WASM per fixture. Shared cloud CPU can make
// startup slow; this fixture-only budget does not change application deadlines.
vi.setConfig({ testTimeout: 60000, hookTimeout: 60000 });
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { finalizeEvent, getPublicKey } from "nostr-tools";
import type { PluginDatabaseClient } from "@paperclipai/plugin-sdk";
import {
  createBridgeStore,
  BRIDGE_NAMESPACE,
} from "../../src/store/postgres.js";
import { runtimeState } from "../../src/bridge/runtime.js";
import { createBridge } from "../../src/bridge/service.js";
import {
  makeBuzzHttpClient,
  BuzzDeliveryUnknown,
  BuzzRetryDeferred,
  BuzzRequestRejected,
} from "../../src/buzz/http.js";
import {
  createPaperclipAdapter,
  interactionDigest,
} from "../../src/paperclip/adapter.js";
import type { PluginContext } from "@paperclipai/plugin-sdk";
const human = new Uint8Array(32).fill(1),
  bridgeKey = new Uint8Array(32).fill(2);
const binding = {
  relay: "https://buzz.example",
  companyId: "co",
  issueId: "issue",
  channelId: "00000000-0000-4000-8000-000000000001",
  rootId: "a".repeat(64),
};
async function fixture() {
  const pg = new PGlite();
  await pg.exec(`CREATE SCHEMA ${BRIDGE_NAMESPACE}`);
  for (const file of (
    await readdir(new URL("../../migrations/", import.meta.url))
  )
    .filter((x) => x.endsWith(".sql"))
    .sort())
    await pg.exec(
      await readFile(
        new URL("../../migrations/" + file, import.meta.url),
        "utf8",
      ),
    );
  const db: PluginDatabaseClient = {
    namespace: BRIDGE_NAMESPACE,
    query: async <T>(s: string, p?: unknown[]) =>
      (await pg.query<T>(s, p)).rows,
    execute: async (s, p) => ({
      rowCount: (await pg.query(s, p)).affectedRows ?? 0,
    }),
  };
  const store = createBridgeStore(db);
  await store.putBinding(binding);
  await store.putPairing({
    relay: binding.relay,
    companyId: "co",
    pubkey: getPublicKey(human),
    actorUserId: "member",
    kind: "human",
    active: true,
  });
  let calls = 0;
  let loseMutation = false;
  let losePublish = false;
  const comments: any[] = [];
  const receipts: any[] = [];
  let interaction: any = {
    id: "decision",
    companyId: "co",
    issueId: "issue",
    kind: "request_confirmation",
    title: "Proceed?",
    summary: null,
    payload: { version: 1, prompt: "Publish draft?" },
    status: "pending",
  };
  const native = createPaperclipAdapter({
    issues: {
      createComment: async (
        _issue: string,
        body: string,
        _co: string,
        options: any,
      ) => {
        calls++;
        const comment = {
          id: "native-comment",
          body,
          authorUserId: options.actorUserId,
        };
        comments.push(comment);
        if (loseMutation) throw Error("secret failure");
        return comment;
      },
      listComments: async () => comments,
      listInteractions: async () => [interaction],
      respondInteraction: async () => ({ interaction, applied: false }),
    },
  } as unknown as Pick<PluginContext, "issues">);
  const deps = {
    runtime: runtimeState(db, binding.companyId, binding.relay),
    store,
    native,
    loadConfig: () => store.loadConfig(binding.relay, getPublicKey(bridgeKey)),
    buzz: makeBuzzHttpClient({
      relayUrl: binding.relay,
      signer: (t) => finalizeEvent(t, bridgeKey),
      clock: () => 1000,
      sleep: async () => {},
      fetch: (async (_url, init) => {
        const e = JSON.parse(String(init?.body));
        receipts.push(e);
        if (losePublish) throw Error("secret");
        return new Response(
          JSON.stringify({ accepted: true, event_id: e.id }),
          { status: 200 },
        );
      }) as typeof fetch,
    }),
    signer: (t: any) => finalizeEvent(t, bridgeKey),
    clock: () => 1000,
  };
  const event = finalizeEvent(
    {
      kind: 9,
      created_at: 999,
      tags: [
        ["h", binding.channelId],
        ["e", binding.rootId, "", "root"],
        ["e", binding.rootId, "", "reply"],
      ],
      content: "Hello native team",
    },
    human,
  );
  return {
    pg,
    db,
    store,
    deps,
    event,
    comments,
    receipts,
    interaction,
    setInteraction: (value: any) => {
      interaction = value;
    },
    calls: () => calls,
    loseMutation: () => {
      loseMutation = true;
    },
    losePublish: (v: boolean) => {
      losePublish = v;
    },
  };
}
it("applies signed reply once across duplicates and restart with same native and Buzz IDs", async () => {
  const f = await fixture();
  try {
    const a = createBridge(f.deps);
    const out = await a.ingest(f.event);
    expect(out.status).toBe("applied");
    expect(out.nativeId).toBe("native-comment");
    await Promise.all([
      a.ingest(f.event),
      createBridge(f.deps).ingest(f.event),
    ]);
    expect(f.calls()).toBe(1);
    expect(new Set(f.receipts.map((x) => x.id)).size).toBe(1);
    expect(f.receipts[0].content).toContain("native-comment");
    expect(f.receipts[0].tags).toContainEqual([
      "e",
      binding.rootId,
      "",
      "root",
    ]);
  } finally {
    await f.pg.close();
  }
});
it("reconciles lost native response without creating a second comment", async () => {
  const f = await fixture();
  try {
    f.loseMutation();
    expect((await createBridge(f.deps).ingest(f.event)).status).toBe(
      "uncertain",
    );
    await createBridge(f.deps).reconcile();
    expect(f.calls()).toBe(1);
    expect(
      (await f.store.get({ relay: binding.relay, eventId: f.event.id }))?.state,
    ).toBe("applied");
    expect(f.receipts).toHaveLength(1);
  } finally {
    await f.pg.close();
  }
});
it("retries only the persisted signed receipt after unknown publication", async () => {
  const f = await fixture();
  try {
    f.losePublish(true);
    await createBridge(f.deps).ingest(f.event);
    f.losePublish(false);
    await createBridge(f.deps).reconcile();
    expect(f.calls()).toBe(1);
    expect(f.receipts).toHaveLength(4);
    expect(new Set(f.receipts.map((x) => x.id)).size).toBe(1);
  } finally {
    await f.pg.close();
  }
});
it("suppresses signed bridge echoes and rejects corrupted signed data", async () => {
  const f = await fixture();
  try {
    const a = createBridge(f.deps);
    await a.ingest(f.event);
    expect((await a.ingest(f.receipts[0])).status).toBe("rejected");
    expect((await a.ingest({ ...f.event, content: "tampered" })).status).toBe(
      "rejected",
    );
    expect(f.calls()).toBe(1);
  } finally {
    await f.pg.close();
  }
});

it("renders native decision then reflects the already resolved dashboard result", async () => {
  const f = await fixture();
  try {
    const a = createBridge(f.deps);
    const card = await a.renderInteraction(binding, "decision");
    f.setInteraction({ ...f.interaction, status: "rejected" });
    const reply = finalizeEvent(
      {
        kind: 9,
        created_at: 1000,
        tags: [
          ["h", binding.channelId],
          ["e", binding.rootId, "", "root"],
          ["e", binding.rootId, "", "reply"],
        ],
        content: "/inertia accept " + card.token,
      },
      human,
    );
    const result = await a.ingest(reply);
    expect(result.nativeId).toBe("decision");
    expect(f.receipts.at(-1).content).toContain("rejected");
  } finally {
    await f.pg.close();
  }
});

it("does not blindly retry unresolved mutations or accept forged marker evidence", async () => {
  const f = await fixture();
  try {
    f.loseMutation();
    await createBridge(f.deps).ingest(f.event);
    f.comments[0].authorUserId = "attacker";
    const health = await createBridge(f.deps).reconcile();
    expect(health.state).toBe("uncertain");
    expect(f.calls()).toBe(1);
    expect(f.receipts).toHaveLength(0);
  } finally {
    await f.pg.close();
  }
});
it("repairs a saved native outcome after a crash before outbox creation", async () => {
  const f = await fixture();
  try {
    const original = f.deps.signer;
    f.deps.signer = () => {
      throw Error("crash");
    };
    await expect(createBridge(f.deps).ingest(f.event)).rejects.toThrow("crash");
    f.deps.signer = original;
    await createBridge(f.deps).reconcile();
    expect(f.calls()).toBe(1);
    expect(f.receipts).toHaveLength(1);
  } finally {
    await f.pg.close();
  }
});

it("stops a pairing revoked between claim and native apply", async () => {
  const f = await fixture();
  try {
    let reads = 0;
    const load = f.deps.loadConfig;
    f.deps.loadConfig = async () => {
      const c = await load();
      if (++reads >= 2)
        return {
          ...c,
          pairings: c.pairings.map((p) => ({ ...p, active: false })),
        };
      return c;
    };
    expect((await createBridge(f.deps).ingest(f.event)).status).toBe(
      "rejected",
    );
    expect(f.calls()).toBe(0);
  } finally {
    await f.pg.close();
  }
});
it("does not attribute an uncertain decision to the requesting member", async () => {
  const f = await fixture();
  try {
    const a = createBridge(f.deps);
    const card = await a.renderInteraction(binding, "decision");
    f.deps.native.respond = async () => {
      throw Error("membership denied or lost response");
    };
    const event = finalizeEvent(
      {
        kind: 9,
        created_at: 1000,
        tags: [
          ["h", binding.channelId],
          ["e", binding.rootId, "", "root"],
          ["e", binding.rootId, "", "reply"],
        ],
        content: "/inertia accept " + card.token,
      },
      human,
    );
    expect((await a.ingest(event)).status).toBe("uncertain");
    f.setInteraction({ ...f.interaction, status: "accepted" });
    await a.reconcile();
    expect(
      (await f.store.get({ relay: binding.relay, eventId: event.id }))?.state,
    ).toBe("uncertain");
    expect(JSON.parse(f.receipts.at(-1).content)).toMatchObject({
      status: "observed",
    });
    expect(f.receipts.at(-1).content).toContain("no action is attributed");
  } finally {
    await f.pg.close();
  }
});

it("persists long Retry-After across bridge restart and reports waiting delivery", async () => {
  const f = await fixture();
  try {
    let attempts = 0;
    f.deps.buzz.publish = async (event) => {
      attempts++;
      throw new BuzzDeliveryUnknown(event.id, {
        cause: new BuzzRetryDeferred(60000),
      });
    };
    await createBridge(f.deps).ingest(f.event);
    const health = await createBridge(f.deps).reconcile();
    expect(attempts).toBe(1);
    expect(health).toMatchObject({ state: "retrying", pending: 1 });
  } finally {
    await f.pg.close();
  }
});
it("blocks permanent relay denial and resumes only through the explicit scoped recovery action", async () => {
  const f = await fixture();
  try {
    const publish = f.deps.buzz.publish;
    f.deps.buzz.publish = async () => {
      throw new BuzzRequestRejected("denied", 403);
    };
    await createBridge(f.deps).ingest(f.event);
    expect(await createBridge(f.deps).reconcile()).toMatchObject({
      state: "blocked",
      blocked: 1,
    });
    f.deps.buzz.publish = publish;
    await f.deps.runtime.resumeBlocked!([binding.issueId]);
    expect(await createBridge(f.deps).reconcile()).toMatchObject({
      state: "idle",
      blocked: 0,
    });
  } finally {
    await f.pg.close();
  }
});

it("runs the actual SDK worker job through real SQL, signing, native adapter and HTTP transport", async () => {
  const f = await fixture();
  try {
    const { createTestHarness } = await import(
      "@paperclipai/plugin-sdk/testing"
    );
    const { manifest } = await import("../../src/manifest.js");
    const { createPlugin } = await import("../../src/worker.js");
    const cfg = await f.deps.loadConfig();
    const harness = createTestHarness({
      manifest,
      config: {
        enabled: true,
        relayUrl: binding.relay,
        bridgePubkey: cfg.bridgePubkey,
        signingKeyRef: { type: "secret_ref", secretId: "fixture-key" },
        bindings: cfg.bindings,
        pairings: cfg.pairings,
        cards: [],
      },
    });
    harness.seed({ companies: [{ id: "co" } as any] });
    harness.ctx.db = f.db;
    harness.ctx.secrets.resolve = async () =>
      Buffer.from(bridgeKey).toString("hex");
    const comments: any[] = [];
    const receipts: any[] = [];
    harness.ctx.issues.createComment = async (_id, body, _company, options) => {
      comments.push({ body, options });
      return { id: "worker-comment" } as any;
    };
    harness.ctx.issues.listInteractions = async () => [];
    harness.ctx.http.fetch = async (url, init) => {
      if (url.endsWith("/query"))
        return new Response(
          JSON.stringify([
            finalizeEvent(
              { ...f.event, created_at: Math.floor(Date.now() / 1000) + 86400 },
              new Uint8Array(32).fill(3),
            ),
            f.event,
          ]),
        );
      const event = JSON.parse(String(init?.body));
      receipts.push(event);
      return new Response(
        JSON.stringify({ accepted: true, event_id: event.id }),
      );
    };
    const plugin = createPlugin();
    await plugin.definition.setup(harness.ctx);
    await harness.runJob("reconcile");
    expect(comments).toHaveLength(1);
    expect(receipts).toHaveLength(1);
    expect(receipts[0].content).toContain("worker-comment");
    expect((await plugin.definition.onHealth!()).status).toBe("ok");
    const listCompanies = harness.ctx.companies.list;
    const getConfig = harness.ctx.config.get;
    harness.ctx.companies.list = async () =>
      [{ id: "broken" }, { id: "co" }] as any;
    harness.ctx.config.get = async (id) =>
      id === "broken" ? { enabled: true } : getConfig(id);
    await harness.runJob("reconcile");
    expect((await plugin.definition.onHealth!()).status).toBe("degraded");
    expect(comments).toHaveLength(1);
    harness.ctx.companies.list = listCompanies;
    harness.ctx.config.get = getConfig;
    await harness.runJob("backfill-conversations");
    await harness.runJob("reconcile");
    expect(comments).toHaveLength(1);
    expect(receipts).toHaveLength(1);
  } finally {
    await f.pg.close();
  }
});

it("keeps user-addressed native decisions out of shared Buzz threads", async () => {
  const f = await fixture();
  try {
    f.setInteraction({ ...f.interaction, addresseeUserId: "private-member" });
    await expect(
      createBridge(f.deps).renderInteraction(binding, "decision"),
    ).rejects.toThrow("native");
    expect(f.receipts).toHaveLength(0);
  } finally {
    await f.pg.close();
  }
});

it("returns durable same-thread guidance for a paired malformed command without native mutation", async () => {
  const f = await fixture();
  try {
    const event = finalizeEvent(
      { ...f.event, content: "/inertia accept" },
      human,
    );
    const a = createBridge(f.deps);
    expect((await a.ingest(event)).status).toBe("rejected");
    expect(f.calls()).toBe(0);
    expect(f.receipts).toHaveLength(1);
    expect(f.receipts[0].content).toContain("Use /inertia");
    await a.ingest(event);
    await a.reconcile();
    expect(f.receipts).toHaveLength(1);
  } finally {
    await f.pg.close();
  }
});

it("reports all scoped unknown mutations even when a different company fills the recovery batch", async () => {
  const f = await fixture();
  try {
    for (let i = 0; i < 101; i++) {
      const b = { ...binding, companyId: "foreign", issueId: "foreign" };
      await f.store.claim(
        { relay: b.relay, eventId: "foreign-" + i },
        {
          destination: b,
          command: { kind: "comment", binding: b, body: "x" },
          receiptKey: "foreign-" + i,
        },
      );
    }
    f.loseMutation();
    await createBridge(f.deps).ingest(f.event);
    f.comments.length = 0;
    const health = await createBridge(f.deps).reconcile();
    expect(health).toMatchObject({ state: "uncertain", uncertain: 1 });
  } finally {
    await f.pg.close();
  }
});
