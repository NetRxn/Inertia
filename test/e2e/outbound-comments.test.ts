import { it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { finalizeEvent, getPublicKey } from "nostr-tools";
import type { PluginDatabaseClient, PluginContext } from "@paperclipai/plugin-sdk";
import { createBridgeStore, BRIDGE_NAMESPACE } from "../../src/store/postgres.js";
import { runtimeState } from "../../src/bridge/runtime.js";
import { createBridge } from "../../src/bridge/service.js";
import { createPaperclipAdapter, sourceMarker } from "../../src/paperclip/adapter.js";
import { BuzzDeliveryUnknown } from "../../src/buzz/http.js";
vi.setConfig({ testTimeout: 60000 });
const key = new Uint8Array(32).fill(3);
const binding = { relay: "https://buzz.example", companyId: "co", issueId: "issue", channelId: "00000000-0000-4000-8000-000000000001", rootId: "a".repeat(64), outboundComments: { enabled: true, audienceAcknowledged: true, notBefore: "2026-10-23T00:00:00.000Z" } };
function comment(id = "comment", patch: Record<string, unknown> = {}) { return { id, companyId: "co", issueId: "issue", body: "Here is the answer.", authorType: "agent", authorAgentId: "ceo", authorUserId: null, createdAt: new Date("2026-10-23T01:00:00.000Z"), updatedAt: new Date("2026-10-23T01:00:00.000Z"), metadata: { secret: "never-export" }, ...patch }; }
async function fixture() {
  const pg = new PGlite();
  await pg.exec(`CREATE SCHEMA ${BRIDGE_NAMESPACE}`);
  for (const file of (await readdir(new URL("../../migrations/", import.meta.url))).filter(x => x.endsWith(".sql")).sort()) await pg.exec(await readFile(new URL("../../migrations/" + file, import.meta.url), "utf8"));
  const db: PluginDatabaseClient = { namespace: BRIDGE_NAMESPACE, query: async <T>(sql: string, p?: unknown[]) => (await pg.query<T>(sql,p)).rows, execute: async (sql,p) => ({ rowCount: (await pg.query(sql,p)).affectedRows ?? 0 }) };
  const store = createBridgeStore(db), runtime = runtimeState(db,"co",binding.relay);
  const config: any = { relay: binding.relay, bridgePubkey: getPublicKey(key), bindings: [structuredClone(binding)], cards: [], pairings: [] };
  const comments: any[] = [comment()]; const sent: any[] = []; let fail = false; let readFail = false;
  const native = createPaperclipAdapter({ issues: { listComments: async () => { if (readFail) throw Error("private native error"); return comments; } } } as unknown as Pick<PluginContext,"issues">);
  const deps = { store, runtime, native, loadConfig: async () => structuredClone(config), signer: async (t: any) => finalizeEvent(t,key), clock: () => 1792717200, buzz: { publish: async (event: any) => { sent.push(event); if(fail) throw new BuzzDeliveryUnknown(event.id, { cause: Error("lost") }); return { eventId: event.id }; }, query: async () => [] } };
  return { pg, db, config, comments, sent, store, runtime, deps, bridge: () => createBridge(deps), fail: (v: boolean) => { fail = v; }, readFail: (v: boolean) => { readFail = v; } };
}
it("mirrors a minimal native reply once across scans and reconstruction", async () => {
 const f = await fixture(); try {
  await f.bridge().reconcile(); await f.bridge().reconcile();
  expect(f.sent).toHaveLength(1);
  const p = JSON.parse(f.sent[0].content); expect(p.type).toBe("inertia.paperclip.comment.v1"); expect(p.body).toBe("Here is the answer."); expect(p.author).toBe("Paperclip agent");
  expect(JSON.stringify(f.sent)).not.toContain("never-export"); expect(JSON.stringify(f.sent)).not.toContain("ceo");
 } finally { await f.pg.close(); }
});
it("fails closed for default off, missing audience consent, invalid provenance and old history", async () => {
 const f = await fixture(); try {
  delete f.config.bindings[0].outboundComments; await f.bridge().reconcile(); expect(f.sent).toHaveLength(0);
  f.config.bindings = [structuredClone(binding)]; f.config.bindings[0].outboundComments.audienceAcknowledged = false; await f.bridge().reconcile(); expect(f.sent).toHaveLength(0);
  f.config.bindings = [structuredClone(binding)];
  f.comments.splice(0,1,...[ { authorType: "system" }, { authorType: "user", authorAgentId: null, authorUserId: null }, { createdAt: null }, { createdAt: "nonsense" }, { createdAt: "2026-10-22T00:00:00.000Z" }, { deletedAt: new Date() }, { companyId: "foreign" }, { authorUserId: "conflicting" } ].map((p,i) => comment(String(i),p)));
  await f.bridge().reconcile(); expect(f.sent).toHaveLength(0);
 } finally { await f.pg.close(); }
});
it("retries the identical signed event after an ambiguous publish", async () => {
 const f = await fixture(); try {
  f.fail(true); await f.bridge().reconcile(); f.fail(false); await f.bridge().reconcile();
  expect(f.sent).toHaveLength(2); expect(f.sent[1]).toEqual(f.sent[0]);
 } finally { await f.pg.close(); }
});
it.each(["edit", "delete", "revoke", "rebind"])("suppresses queued snapshots after %s and never resurrects them", async (change) => {
 const f = await fixture(); try {
  f.fail(true); await f.bridge().reconcile(); expect(f.sent).toHaveLength(1); f.fail(false);
  if(change === "edit") f.comments[0].body = "changed private text";
  if(change === "delete") f.comments[0].deletedAt = new Date();
  if(change === "revoke") f.config.bindings[0].outboundComments.enabled = false;
  if(change === "rebind") f.config.bindings[0].rootId = "b".repeat(64);
  await f.bridge().reconcile(); expect(f.sent).toHaveLength(change === "rebind" ? 2 : 1);
  // Rebinding can legitimately authorize a new destination, but never sends the old event again.
  if(change === "rebind") expect(f.sent[1].id).not.toBe(f.sent[0].id);
  f.config.bindings = [structuredClone(binding)]; f.comments[0] = comment();
  await f.runtime.resumeBlocked(["issue"]); await f.bridge().reconcile();
  expect(f.sent.filter(e => e.id === f.sent[0].id)).toHaveLength(1);
 } finally { await f.pg.close(); }
});
it("defers failed native revalidation without suppressing a pending event", async () => {
 const f = await fixture(); try {
  f.fail(true); await f.bridge().reconcile(); f.fail(false); f.readFail(true);
  const event = await f.deps.signer({ kind: 9, created_at: 1792717200, tags: [["h",binding.channelId],["e",binding.rootId,"","root"],["e",binding.rootId,"","reply"]], content: JSON.stringify({issueId:"issue",message:"independent receipt"}) });
  await f.store.putOutbox({ receiptKey:"independent", relay:binding.relay, eventId:event.id, event });
  await f.runtime.scopeReceipt("independent","issue");
  expect((await f.bridge().reconcile()).state).toBe("retrying"); expect(f.sent).toHaveLength(2);
  expect(f.sent[1].id).toBe(event.id);
  f.readFail(false); await f.bridge().reconcile(); expect(f.sent).toHaveLength(3); expect(f.sent[2]).toEqual(f.sent[0]);
 } finally { await f.pg.close(); }
});
it("suppresses only correlated ingress echoes, not marker-looking ordinary text", async () => {
 const f = await fixture(); try {
  const eventId = "d".repeat(64), body = "human reply", author = "member";
  const inbound = { kind: "comment", binding, body, actorUserId: author, sourceEventId: eventId, authorPubkey: "e".repeat(64) };
  await f.store.claim({ relay: binding.relay, eventId }, { destination: binding, command: inbound, receiptKey: "inbound" });
  f.comments[0] = comment("imported",{ body: body + "\n\n" + sourceMarker(binding,eventId), authorType: "user", authorUserId: author, authorAgentId: null });
  f.comments.push(comment("forged",{ body: "not an import\n\n" + sourceMarker(binding,eventId) }));
  await f.bridge().reconcile();
  expect(f.sent.filter(e => JSON.parse(e.content).type === "inertia.paperclip.comment.v1")).toHaveLength(1);
  expect(JSON.parse(f.sent[0].content).commentId).toBe("forged");
 } finally { await f.pg.close(); }
});
it("drains tied-timestamp backlogs beyond one bounded batch without duplicates", async () => {
 const f = await fixture(); try {
  f.comments.splice(0,1,...Array.from({length:105},(_,i) => comment(String(i).padStart(3,"0"))));
  await f.bridge().reconcile(); expect(f.sent.length).toBeGreaterThan(0); expect(f.sent.length).toBeLessThan(105);
  await f.bridge().reconcile(); await f.bridge().reconcile(); expect(new Set(f.sent.map(e=>e.id)).size).toBe(105); expect(f.sent).toHaveLength(105);
 } finally { await f.pg.close(); }
});
it("does not deliver or suppress another company's queued comment", async () => {
 const f = await fixture(); try {
  f.fail(true); await f.bridge().reconcile(); f.fail(false);
  f.config.companyId = "other"; f.config.bindings = [];
  await f.bridge().reconcile(); expect(f.sent).toHaveLength(1);
  f.config.companyId = "co"; f.config.bindings = [structuredClone(binding)];
  await f.bridge().reconcile(); expect(f.sent).toHaveLength(2); expect(f.sent[1]).toEqual(f.sent[0]);
 } finally { await f.pg.close(); }
});
it("fails closed when the binding is removed immediately before delivery", async () => {
 const f = await fixture(); try {
  f.config.companyId = "co";
  const original = f.deps.signer;
  f.deps.signer = async t => { const event = await original(t); f.config.bindings = []; return event; };
  await f.bridge().reconcile(); expect(f.sent).toHaveLength(0);
  const rows = await f.db.query<{state:string}>(`SELECT state FROM ${BRIDGE_NAMESPACE}.bridge_outbox`);
  expect(rows).toEqual([{state:"suppressed"}]);
 } finally { await f.pg.close(); }
});
it("honors current not-before even for queued snapshots", async () => {
 const f = await fixture(); try {
  f.fail(true); await f.bridge().reconcile(); f.fail(false);
  f.config.bindings[0].outboundComments.notBefore = "2026-10-24T00:00:00.000Z";
  await f.bridge().reconcile(); expect(f.sent).toHaveLength(1);
 } finally { await f.pg.close(); }
});
it("reports retrying rather than healthy when an initial native scan fails before enqueue", async () => {
 const f = await fixture(); try {
  f.readFail(true); const health = await f.bridge().reconcile();
  expect(health.state).toBe("retrying"); expect(health.pending).toBe(0); expect(f.sent).toHaveLength(0);
 } finally { await f.pg.close(); }
});
it("never publishes a stale delivery snapshot after another worker terminally suppresses it", async () => {
 const f = await fixture(); try {
  f.fail(true); await f.bridge().reconcile(); f.fail(false);
  let release!: () => void, reached!: () => void, snapshotted = false;
  const paused = new Promise<void>(r=>{reached=r;}), resume = new Promise<void>(r=>{release=r;});
  const a = createBridge({ ...f.deps,
   store: { ...f.store, listOutbox: async (...args) => { const rows = await f.store.listOutbox(...args); snapshotted = true; return rows; } },
   native: { ...f.deps.native, listComments: async b => { if(snapshotted) { snapshotted=false; reached(); await resume; } return structuredClone(await f.deps.native.listComments(b)); } }
  });
  const running = a.reconcile(); await paused;
  f.comments[0].body = "edited"; await f.bridge().reconcile();
  expect((await f.db.query<{state:string}>(`SELECT state FROM ${BRIDGE_NAMESPACE}.bridge_outbox`))[0]!.state).toBe("suppressed");
  f.comments[0] = comment(); release(); await running;
  expect(f.sent).toHaveLength(1);
 } finally { await f.pg.close(); }
});
it.each(["blocked", "deferred", "removed"])("invalidates %s snapshots before ordinary delivery eligibility returns", async mode => {
 const f = await fixture(); try {
  f.config.companyId = "co"; f.fail(true); await f.bridge().reconcile(); f.fail(false);
  const row = (await f.store.listOutbox())[0]!;
  if(mode === "blocked") await f.store.markBlocked(row.receiptKey);
  if(mode === "deferred") await f.store.markDeferred(row.receiptKey,600000);
  if(mode === "removed") f.config.bindings=[]; else f.comments[0].body="edited";
  await f.bridge().reconcile(); expect((await f.store.getOutbox(row.receiptKey))!.state).toBe("suppressed");
  f.comments[0]=comment(); f.config.bindings=[structuredClone(binding)]; await f.runtime.resumeBlocked(["issue"]); await f.bridge().reconcile();
  expect(f.sent).toHaveLength(1);
 } finally { await f.pg.close(); }
});
it.each(["edit","remove","relay"])("records suppression requested while claimed I/O is in flight after %s, without allowing a second publisher", async mode => {
 const f = await fixture(); try {
  let release!: () => void, reached!: () => void;
  const paused = new Promise<void>(r=>{reached=r;}), resume = new Promise<void>(r=>{release=r;});
  const a=createBridge({ ...f.deps, buzz: {...f.deps.buzz,publish:async event=>{reached(); await resume; throw new BuzzDeliveryUnknown(event.id);}} });
  const running=a.reconcile(); await paused;
  f.config.companyId="co";
  if(mode === "remove") f.config.bindings=[];
  else if(mode === "relay") { f.config.relay="https://new.example"; f.config.bindings[0].relay=f.config.relay; f.config.bindings[0].outboundComments.enabled=false; }
  else f.comments[0].body="edited";
  const health=await createBridge({...f.deps,runtime:runtimeState(f.db,"co",f.config.relay)}).reconcile();
  const row=(await f.db.query<{state:string,suppression_requested:boolean}>(`SELECT * FROM ${BRIDGE_NAMESPACE}.bridge_outbox`))[0]!;
  expect(row.state).toBe("publishing"); expect(row.suppression_requested).toBe(true); expect(health.state).toBe("uncertain");
  release(); await running;
  expect((await f.store.getOutbox((await f.db.query<{receipt_key:string}>(`SELECT receipt_key FROM ${BRIDGE_NAMESPACE}.bridge_outbox`))[0]!.receipt_key))!.state).toBe("suppressed");
  expect(f.sent).toHaveLength(0);
 } finally { await f.pg.close(); }
});
it.each([false,true])("keeps abandoned claims uncertain until targeted stopped-worker recovery (revoked=%s)", async revoked => {
 const f=await fixture(); try {
  f.fail(true); await f.bridge().reconcile(); f.fail(false);
  const row=(await f.store.listOutbox())[0]!;
  expect(await f.store.claimCommentDelivery(row.receiptKey,"stopped-owner")).toBe(true);
  expect(await f.store.claimCommentDelivery(row.receiptKey,"competitor")).toBe(false);
  if(revoked) f.comments[0].body="changed";
  const health=await f.bridge().reconcile(); expect(health.state).toBe("uncertain"); expect(health.inFlightPublications).toBe(1);
  await f.runtime.resumeBlocked(["issue"]); expect((await f.store.getOutbox(row.receiptKey))!.state).toBe("publishing");
  expect(await f.store.recoverCommentDelivery(row.receiptKey,"wrong-owner")).toBe(false);
  // Fixture has no running owner. In production the operator must first verify termination.
  expect(await f.store.recoverCommentDelivery(row.receiptKey,"stopped-owner")).toBe(true);
  f.comments[0]=comment(); await f.bridge().reconcile();
  expect(f.sent).toHaveLength(revoked ? 1 : 2);
  if(!revoked) expect(f.sent[1]).toEqual(f.sent[0]);
 } finally { await f.pg.close(); }
});
it("rotates validation fairly across blocked rows, including items excluded from delivery", async()=>{
 const f=await fixture(); try {
  for(let i=0;i<105;i++) {
   const receiptKey="comment:"+i;
   await f.store.putOutbox({receiptKey,relay:binding.relay,eventId:String(i),event:{}});
   await f.runtime.scopeReceipt(receiptKey,"issue"); await f.store.markBlocked(receiptKey);
  }
  const a=await f.store.listCommentValidation("co");
  const b=await f.store.listCommentValidation("co");
  expect(a).toHaveLength(100); expect(new Set([...a,...b].map(r=>r.receiptKey)).size).toBe(105);
  expect(await f.store.listCommentValidation("foreign")).toEqual([]);
 }finally{await f.pg.close();}
});
it("durably requests suppression of company claims when the whole connection is disabled", async()=>{
 const f=await fixture(); try {
  f.fail(true); await f.bridge().reconcile();
  const row=(await f.store.listOutbox())[0]!; await f.store.claimCommentDelivery(row.receiptKey,"old-worker");
  const {createPlugin}=await import("../../src/worker.js"); const jobs=new Map<string,()=>Promise<void>>();
  const ctx={tools:{register:()=>{}},db:f.db,companies:{list:async()=>[{id:"co"}]},config:{get:async()=>({enabled:false})},jobs:{register:(key:string,fn:()=>Promise<void>)=>jobs.set(key,fn)}} as unknown as PluginContext;
  const plugin=createPlugin(); await plugin.definition.setup(ctx); await jobs.get("reconcile")!();
  expect((await f.store.getOutbox(row.receiptKey))!.suppressionRequested).toBe(true);
  expect((await plugin.definition.onHealth!()).details?.inFlightPublications).toBe(1);
 }finally{await f.pg.close();}
});
