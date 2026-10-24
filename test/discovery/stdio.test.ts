import { expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createStdioDiscoveryBridge } from "../../src/discovery/stdio.js";
const executable = process.execPath;
function bridge(script: string) {
  const entrypoint = join(
    mkdtempSync(join(tmpdir(), "discovery-test-")),
    "bridge.cjs",
  );
  writeFileSync(entrypoint, script);
  return createStdioDiscoveryBridge({
    executable,
    args: [entrypoint],
    entrypoint,
    pins: [
      {
        path: entrypoint,
        sha256: createHash("sha256").update(script).digest("hex"),
      },
    ],
    cwd: process.cwd(),
    timeoutMs: 1000,
    maxOutputBytes: 2048,
  });
}
it("invokes actual subprocess with bounded newline JSON and passes no producer authority", async () => {
  const b = bridge(
    `process.stdin.on('data',b=>{const q=JSON.parse(b.toString());console.log(JSON.stringify({ok:true,result:{query_receipt_id:q.runId,items:[],evidence_gaps:[]}}));})`,
  );
  expect(await b.knowledge.begin("run", { capabilities: [] })).toEqual({
    query_receipt_id: "run",
    items: [],
    evidence_gaps: [],
  });
});
it("fails closed on multiple responses, oversized bytes, exit failure and timeout", async () => {
  for (const script of [
    `console.log('{}\\n{}')`,
    `console.log('x'.repeat(3000))`,
    `process.exit(2)`,
    `setTimeout(()=>{},5000)`,
  ])
    await expect(
      bridge(script).knowledge.begin("r", { capabilities: [] }),
    ).rejects.toThrow(/DFW bridge/);
});
it("does not leak subprocess diagnostic text and refuses null canonical brief", async () => {
  await expect(
    bridge(
      `console.log(JSON.stringify({ok:false,error:{code:'denied',private:'secret'}}))`,
    ).knowledge.begin("r", { capabilities: [] }),
  ).rejects.toThrow("DFW bridge rejected request");
  await expect(
    bridge(`console.log(JSON.stringify({ok:true,result:null}))`).readBrief(
      "id",
    ),
  ).rejects.toThrow("No current admitted opportunity brief");
});
it("cannot synthesize urgent assessment from an ordinary canonical brief", async () => {
  const b = bridge(
    `console.log(JSON.stringify({ok:true,result:{opportunity_id:'id'}}))`,
  );
  await expect(b.readBrief("id")).rejects.toThrow(/assessment/);
});

it("refuses changed pinned executable input before starting a process", async () => {
  const entrypoint = join(
    mkdtempSync(join(tmpdir(), "discovery-pin-")),
    "bridge.cjs",
  );
  writeFileSync(entrypoint, 'throw Error("must not execute")');
  const b = createStdioDiscoveryBridge({
    executable,
    args: [entrypoint],
    entrypoint,
    pins: [{ path: entrypoint, sha256: "a".repeat(64) }],
    cwd: process.cwd(),
    timeoutMs: 1000,
    maxOutputBytes: 2048,
  });
  await expect(b.knowledge.begin("r", { capabilities: [] })).rejects.toThrow(
    /pin/,
  );
});
it("serializes bounded exact funding spans without adding caller identity or policy", async () => {
  const b = bridge(`process.stdin.on('data',b=>{console.log(JSON.stringify({ok:true,result:JSON.parse(b.toString())}));})`);
  const input = { captureId: "capture", expectedSourceHash: "a".repeat(64), sourceIdentityReceiptId: "identity", runId: "run", queryReceiptId: "query", idempotencyKey: "key", facts: { programName: { quote: "🌱 Grant", span: { start: 0, end: 7 } } } };
  expect(await b.assessFundingFacts!(input)).toEqual({ op: "assess_funding_facts", ...input });
});
