import { expect, it } from "vitest";
import { fixture } from "./fixture.js";

const receipt = (overrides: Record<string, unknown> = {}) => ({
  version: "dfw-native-case-handoff-v1", selection_id: "selection-one", case_key: {applicant_id:"applicant",opportunity_namespace:"public",opportunity_external_id:"one"},
  semantic_hash: "b".repeat(64), native_run_id: "run-author", workspace_hash: "a".repeat(64),
  disposition: "awaiting_owner_input", human_acceptance: "not_accepted", submission: "not_submitted",
  packet_hash: "c".repeat(64), ...overrides,
});
function serial(value = receipt()) {
  const f = fixture(); f.binding.nativeCaseProgression = true;
  f.bridge.call = async (op: string, _params: unknown, callbacks: any) => {
    f.seen.push(op); await callbacks.context(); return structuredClone(value);
  };
  return f;
}
it("routes opted-in checkpoint privately, retaining exactly six public tools and no self-wake", async () => {
  const f = serial(); const result = await f.tools.get("funding_drafting_checkpoint")({}, f.producer);
  expect(result.data).toEqual(receipt()); expect(f.seen).toEqual(["checkpoint"]);
  expect(f.tools.size).toBe(6); expect(f.wakeups.size).toBe(0);
  expect(f.rows.producer.status).toBe("in_review"); expect(f.docs.size).toBe(1);
  expect([...f.docs.values()][0].body).toBe(JSON.stringify(receipt()));
});
it.each([
  ["remaining_agent_work", "in_progress"], ["awaiting_independent_review", "blocked"],
  ["awaiting_owner_input", "in_review"], ["awaiting_human_review", "in_review"],
])("maps authoritative %s without acceptance", async (disposition, status) => {
  const f = serial(receipt({disposition}));
  await f.tools.get("funding_drafting_checkpoint")({}, f.producer);
  expect(f.rows.producer.status).toBe(status);
});
it("replays same receipt after handoff and lost response without adding snapshots", async () => {
  const f = serial(); const update = f.ctx.issues.update; let lost = true;
  f.ctx.issues.update = async (...args: any[]) => {
    const out = await update(...args);
    if (args[1].status === "in_review" && lost) { lost = false; throw Error("response lost"); }
    return out;
  };
  await expect(f.tools.get("funding_drafting_checkpoint")({}, f.producer)).rejects.toThrow("response lost");
  await f.tools.get("funding_drafting_checkpoint")({}, f.producer);
  await f.tools.get("funding_drafting_checkpoint")({}, f.producer);
  expect(f.docs.size).toBe(1); expect(f.rows.producer.status).toBe("in_review");
});
it("rejects a conflicting immutable mirror", async () => {
  const f = serial(); await f.tools.get("funding_drafting_checkpoint")({}, f.producer);
  const first = [...f.docs.values()][0]; first.body = "edited untrusted document";
  await expect(f.tools.get("funding_drafting_checkpoint")({}, f.producer)).rejects.toThrow(/conflict/i);
  expect(f.docs.size).toBe(1);
});
it("rejects a conflicting mirror appearing during the helper's internal read", async () => {
  const f=serial(); const list=f.ctx.issues.documents.list; let reads=0;
  f.ctx.issues.documents.list=async (...args:any[])=>{
    if(++reads===2) {
      const {discoveryHash,documentHash}=await import("../../src/discovery/service.js");
      const r=receipt(); const logical="public-drafting-case:"+discoveryHash([r.selection_id,r.packet_hash,r.native_run_id]);
      const key="funding-"+documentHash(logical)+"-0000000001";
      f.docs.set("producer:"+key,{issueId:"producer",companyId:"company",key,body:"concurrent conflict"});
    }
    return list(...args);
  };
  await expect(f.tools.get("funding_drafting_checkpoint")({},f.producer)).rejects.toThrow(/conflict/i);
  expect(f.docs.size).toBe(1);
});
it("accepts domain external identifiers through 255 characters but not 256", async () => {
  for(const length of [255,256]) {
    const f=serial(receipt({case_key:{...receipt().case_key,opportunity_external_id:"x".repeat(length)}}));
    const result=f.tools.get("funding_drafting_checkpoint")({},f.producer);
    if(length===255)await expect(result).resolves.toBeDefined();
    else await expect(result).rejects.toThrow();
  }
});
it("retains both case histories when a genuinely different run has a new domain selection", async () => {
  const f = serial(); await f.tools.get("funding_drafting_checkpoint")({}, f.producer);
  const firstBody = [...f.docs.values()][0].body;
  f.runs.producer[0].id = "run-next";
  f.bridge.call = async (_op: string, _params: unknown, callbacks: any) => {
    await callbacks.context(); return receipt({selection_id:"selection-two",native_run_id:"run-next",packet_hash:"d".repeat(64)});
  };
  await f.tools.get("funding_drafting_checkpoint")({}, {...f.producer,runId:"run-next"});
  expect(f.docs.size).toBe(2); expect([...f.docs.values()][0].body).toBe(firstBody);
  expect([...f.docs.values()][1].body).toContain("selection-two");
});
it("rechecks native authority after reading an existing mirror", async () => {
  const f = serial(); await f.tools.get("funding_drafting_checkpoint")({}, f.producer);
  const get = f.ctx.issues.documents.get;
  f.ctx.issues.documents.get = async (...args: any[]) => {const result=await get(...args);f.revoke();return result;};
  await expect(f.tools.get("funding_drafting_checkpoint")({}, f.producer)).rejects.toThrow();
  expect(f.docs.size).toBe(1);
});
it.each([
  {native_run_id:"old-run"}, {human_acceptance:"accepted"}, {submission:"submitted"},
  {disposition:"done"}, {packet_hash:"invalid"}, {selection_id:""}, {case_key:""},
  {workspace_hash:"invalid"}, {semantic_hash:"invalid"}, {unexpected:"payload"},
])("rejects malformed or stale handoff %j before documents", async patch => {
  const f = serial(receipt(patch));
  await expect(f.tools.get("funding_drafting_checkpoint")({}, f.producer)).rejects.toThrow();
  expect(f.docs.size).toBe(0); expect(f.wakeups.size).toBe(0);
});
it("cannot opt into progression through model arguments or the reviewer", async () => {
  const f = serial();
  await expect(f.tools.get("funding_drafting_checkpoint")({nativeCaseProgression:true}, f.producer)).rejects.toThrow();
  await expect(f.tools.get("funding_drafting_checkpoint")({}, f.reviewer)).rejects.toThrow();
  expect(f.docs.size).toBe(0);
});
