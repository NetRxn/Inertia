/** No network: only the external Paperclip host and Buzz relay I/O are fixtures. */
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { finalizeEvent, getPublicKey } from "nostr-tools";
import type {
  PluginContext,
  PluginDatabaseClient,
} from "@paperclipai/plugin-sdk";
import { createBridgeStore, BRIDGE_NAMESPACE } from "../src/store/postgres.js";
import { createPaperclipAdapter } from "../src/paperclip/adapter.js";
import { makeBuzzHttpClient } from "../src/buzz/http.js";
import { runtimeState } from "../src/bridge/runtime.js";
import { createBridge } from "../src/bridge/service.js";
const pg = new PGlite();
try {
  await pg.exec(`CREATE SCHEMA ${BRIDGE_NAMESPACE}`);
  const migrationDir = new URL("../../migrations/", import.meta.url);
  for (const file of (await readdir(migrationDir))
    .filter((x) => x.endsWith(".sql"))
    .sort())
    await pg.exec(await readFile(new URL(file, migrationDir), "utf8"));
  const db: PluginDatabaseClient = {
    namespace: BRIDGE_NAMESPACE,
    query: async <T>(s: string, p?: unknown[]) =>
      (await pg.query<T>(s, p)).rows,
    execute: async (s, p) => ({
      rowCount: (await pg.query(s, p)).affectedRows ?? 0,
    }),
  };
  const store = createBridgeStore(db);
  const human = new Uint8Array(32).fill(1),
    key = new Uint8Array(32).fill(2);
  const binding = {
    relay: "https://fixture.invalid",
    companyId: "fixture-company",
    issueId: "fixture-issue",
    channelId: "00000000-0000-4000-8000-000000000001",
    rootId: "a".repeat(64),
  };
  await store.putBinding(binding);
  await store.putPairing({
    relay: binding.relay,
    companyId: binding.companyId,
    pubkey: getPublicKey(human),
    actorUserId: "fixture-member",
    kind: "human",
    active: true,
  });
  const comments: unknown[] = [];
  const publications: string[] = [];
  const native = createPaperclipAdapter({
    issues: {
      createComment: async (
        issueId: string,
        body: string,
        companyId: string,
        options: unknown,
      ) => {
        comments.push({ issueId, body, companyId, options });
        return { id: "fixture-native-comment" };
      },
      listComments: async () => [],
      listInteractions: async () => [],
    },
  } as unknown as Pick<PluginContext, "issues">);
  const signer = (t: Parameters<typeof finalizeEvent>[0]) =>
    finalizeEvent(t, key);
  const buzz = makeBuzzHttpClient({
    relayUrl: binding.relay,
    signer,
    clock: () => 1000,
    fetch: (async (_url, init) => {
      const event = JSON.parse(String(init?.body));
      publications.push(event.id);
      return new Response(
        JSON.stringify({ accepted: true, event_id: event.id }),
        { status: 200 },
      );
    }) as typeof fetch,
  });
  const deps = {
    runtime: runtimeState(db, binding.companyId, binding.relay),
    store,
    native,
    buzz,
    signer,
    clock: () => 1000,
    loadConfig: () => store.loadConfig(binding.relay, getPublicKey(key)),
  };
  const event = finalizeEvent(
    {
      kind: 9,
      created_at: 999,
      content: "I can help with the meeting notes.",
      tags: [
        ["h", binding.channelId],
        ["e", binding.rootId, "", "root"],
        ["e", binding.rootId, "", "reply"],
      ],
    },
    human,
  );
  const first = await createBridge(deps).ingest(event);
  const replay = await createBridge(deps).ingest(event);
  console.log(
    JSON.stringify(
      {
        mode: "fixture-only; no external services contacted",
        flow: "Signed Buzz reply → native Paperclip comment → signed Buzz receipt",
        sourceEventId: event.id,
        nativeId: first.nativeId,
        buzzReceiptEventId: publications[0],
        nativeWrites: comments.length,
        restartReplay: replay.status,
        health: await createBridge(deps).reconcile(),
      },
      null,
      2,
    ),
  );
  if (
    comments.length !== 1 ||
    publications.length !== 1 ||
    replay.status !== "replayed"
  )
    throw Error("Connected fixture failed.");
} finally {
  await pg.close();
}
