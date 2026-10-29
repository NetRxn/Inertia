import { beforeAll, afterAll, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import { manifest } from "../../src/manifest.js";
import { BRIDGE_NAMESPACE } from "../../src/store/postgres.js";
import { reconcileMeetingIntake, type MeetingIntakeBinding } from "../../src/roundtable/intake.js";
let pg: PGlite;
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`CREATE SCHEMA ${BRIDGE_NAMESPACE}`);
  await pg.exec(
    await readFile(
      new URL("../../migrations/007_objective_intake.sql", import.meta.url),
      "utf8",
    ),
  );
  await pg.exec(await readFile(new URL("../../migrations/004_runtime_state.sql", import.meta.url), "utf8"));
}, 60000);
afterAll(async () => pg.close());
function setup(id: string) {
  const h = createTestHarness({
    manifest: {
      ...manifest,
      capabilities: [
        ...manifest.capabilities,
        "issues.read",
        "issues.create",
        "issues.update",
      ],
    },
  });
  Object.assign(h.ctx.db, {
    namespace: BRIDGE_NAMESPACE,
    query: async (q: string, p: unknown[]) => (await pg.query(q, p)).rows,
    execute: async (q: string, p: unknown[]) => ({
      rowCount: (await pg.query(q, p)).affectedRows ?? 0,
    }),
  });
  const config: MeetingIntakeBinding = {
    companyId: "co",
    meetingId: id,
    origin: "https://dao.example",
    principalId: "principal",
    nativeIntake: {
      organizationId: "org",
      intakeAgentId: "agent",
      referenceOnly: true as const,
    },
  };
  let admitted = true;
  const current = async () => admitted;
  return {
    h,
    config,
    current,
    disable: () => {
      admitted = false;
    },
  };
}
it("creates one reference-only native source exception and deduplicates repetitions using existing intake store", async () => {
  const f = setup("summary");
  const result = { state: "summary-only", code: "transcript_required" };
  const first = await reconcileMeetingIntake(
    f.h.ctx,
    f.config,
    result,
    "summary-source",
    f.current,
  );
  const second = await reconcileMeetingIntake(
    f.h.ctx,
    f.config,
    result,
    "summary-source",
    f.current,
  );
  expect(first?.status).toBe("applied");
  expect(second?.status).toBe("replayed");
  expect(second?.nativeIssueId).toBe(first?.nativeIssueId);
  const row = await f.h.ctx.issues.get(first!.nativeIssueId!, "co");
  expect(row?.title).toBe("Meeting source follow-up");
  expect(row?.description).toContain("Add the missing transcript");
  expect(row?.description).not.toContain("summary-source");
  expect(row?.description).not.toContain("drive.google.com");
  expect(row?.description).toContain("Protected meeting reference:");
});
it("updates the same native work on corrected successful publication without copying quoted instructions", async () => {
  const f = setup("correction");
  const one = await reconcileMeetingIntake(
    f.h.ctx,
    f.config,
    { state: "published" },
    "operation-1",
    f.current,
  );
  const two = await reconcileMeetingIntake(
    f.h.ctx,
    f.config,
    { state: "published" },
    "operation-2",
    f.current,
  );
  expect(two?.nativeIssueId).toBe(one?.nativeIssueId);
  expect(two?.status).toBe("applied");
  const row = await f.h.ctx.issues.get(two!.nativeIssueId!, "co");
  expect(row?.description).toContain("Review the new or corrected meeting");
  expect(row?.description).toContain("not approved tasks");
});
it("reconciles lost native create acknowledgment instead of creating a duplicate after restart", async () => {
  const f = setup("ack-loss");
  const create = f.h.ctx.issues.create;
  let creates = 0;
  f.h.ctx.issues.create = async (input) => {
    creates++;
    await create(input);
    throw Error("ack lost");
  };
  expect(
    (
      await reconcileMeetingIntake(
        f.h.ctx,
        f.config,
        { state: "summary-only", code: "transcript_required" },
        "v1",
        f.current,
      )
    )?.status,
  ).toBe("pending");
  f.h.ctx.issues.create = create;
  expect(
    (
      await reconcileMeetingIntake(
        f.h.ctx,
        f.config,
        { state: "summary-only", code: "transcript_required" },
        "v1",
        f.current,
      )
    )?.status,
  ).toBe("replayed");
  expect(creates).toBe(1);
});
it("disabled admission performs no native calls and withdrawal cancels only mapped work", async () => {
  const f = setup("withdrawal");
  const first = await reconcileMeetingIntake(
    f.h.ctx,
    f.config,
    { state: "published" },
    "v1",
    f.current,
  );
  const last = await reconcileMeetingIntake(
    f.h.ctx,
    f.config,
    { state: "blocked", code: "withdrawn" },
    "v1",
    f.current,
  );
  expect(last?.nativeIssueId).toBe(first?.nativeIssueId);
  expect((await f.h.ctx.issues.get(first!.nativeIssueId!, "co"))?.status).toBe(
    "cancelled",
  );
  f.disable();
  f.h.ctx.issues.list = async () => {
    throw Error("must not read");
  };
  expect(
    await reconcileMeetingIntake(
      f.h.ctx,
      f.config,
      { state: "published" },
      "v2",
      f.current,
    ),
  ).toBeNull();
});

function autonomous(id: string) {
 const f=setup(id);f.config.nativeIntake={...f.config.nativeIntake,autoStart:true,sourceAccess:true,projectId:"meeting-project"};const wakes:any[]=[];
 f.h.ctx.issues.requestWakeup=async(id,companyId,options)=>{wakes.push({id,companyId,options});return {queued:true,runId:"native-run"};};return {...f,wakes};
}
it("explicit source-approved autoStart creates one todo and initial wake across correction and restart",async()=>{
 const f=autonomous("auto-start");const first=await reconcileMeetingIntake(f.h.ctx,f.config,{state:"published"},"v1",f.current);
 expect(first?.status).toBe("applied");expect(await f.h.ctx.issues.get(first!.nativeIssueId!,"co")).toMatchObject({status:"todo",projectId:"meeting-project",assigneeAgentId:"agent"});expect(f.wakes).toHaveLength(1);expect(f.wakes[0].options.contextSource).toBe("inertia.roundtable.intake");
 const correction=await reconcileMeetingIntake(f.h.ctx,structuredClone(f.config),{state:"published"},"v2",f.current);const restart=await reconcileMeetingIntake(f.h.ctx,structuredClone(f.config),{state:"published"},"v2",f.current);
 expect(correction?.nativeIssueId).toBe(first?.nativeIssueId);expect(restart?.status).toBe("replayed");expect(f.wakes).toHaveLength(1);
});
it("autoStart fails closed without approved source access; default intake remains backlog",async()=>{
 const f=autonomous("invalid-auto");delete f.config.nativeIntake.sourceAccess;expect(await reconcileMeetingIntake(f.h.ctx,f.config,{state:"published"},"v1",f.current)).toBeNull();expect(f.wakes).toHaveLength(0);expect(await f.h.ctx.issues.list({companyId:"co",includePluginOperations:true})).toHaveLength(0);
 const baseline=setup("default-backlog");const result=await reconcileMeetingIntake(baseline.h.ctx,baseline.config,{state:"published"},"v1",baseline.current);expect((await baseline.h.ctx.issues.get(result!.nativeIssueId!,"co"))?.status).toBe("backlog");
});
it("uncertain initial wake is never sent twice after acknowledgement loss or correction",async()=>{
 const f=autonomous("wake-loss");let attempts=0;f.h.ctx.issues.requestWakeup=async()=>{attempts++;throw Error("ack lost");};for(const version of ["v1","v1","v2"])expect((await reconcileMeetingIntake(f.h.ctx,structuredClone(f.config),{state:"published"},version,f.current))?.status).toBe("pending");expect(attempts).toBe(1);
});
it("reassignment after mapping never wakes another actor",async()=>{
 const f=autonomous("reassigned-before-wake");const create=f.h.ctx.issues.create;f.h.ctx.issues.create=async(input)=>{const row=await create(input);await f.h.ctx.issues.update(row.id,{assigneeAgentId:"other"},"co");return row;};expect((await reconcileMeetingIntake(f.h.ctx,f.config,{state:"published"},"v1",f.current))?.status).toBe("pending");expect(f.wakes).toHaveLength(0);
});
it("withdrawal never wakes and autoStart never promotes existing backlog",async()=>{
 const f=setup("preserve-backlog");const old=await reconcileMeetingIntake(f.h.ctx,f.config,{state:"published"},"v1",f.current);f.config.nativeIntake={...f.config.nativeIntake,autoStart:true,sourceAccess:true,projectId:"meeting-project"};let wakes=0;f.h.ctx.issues.requestWakeup=async()=>{wakes++;return {queued:true,runId:"test-run"};};expect((await reconcileMeetingIntake(f.h.ctx,f.config,{state:"published"},"v2",f.current))?.status).toBe("pending");expect((await f.h.ctx.issues.get(old!.nativeIssueId!,"co"))?.status).toBe("backlog");expect(wakes).toBe(0);
 const withdrawn=autonomous("auto-withdrawn");expect((await reconcileMeetingIntake(withdrawn.h.ctx,withdrawn.config,{state:"blocked",code:"withdrawn"},"v1",withdrawn.current))?.status).toBe("applied");expect(withdrawn.wakes).toHaveLength(0);
});

it("autoStart waits for accepted publication before creating the Coordinator task",async()=>{
 const f=autonomous("wait-for-publication");expect((await reconcileMeetingIntake(f.h.ctx,f.config,{state:"pending",code:"extraction_pending"},"v0",f.current))?.status).toBe("pending");expect(await f.h.ctx.issues.list({companyId:"co",includePluginOperations:true})).toHaveLength(0);expect(f.wakes).toHaveLength(0);
 expect((await reconcileMeetingIntake(f.h.ctx,f.config,{state:"published"},"v1",f.current))?.status).toBe("applied");expect(f.wakes).toHaveLength(1);
});

it("autoStart reconciles a lost native create acknowledgement then wakes only the recovered task",async()=>{
 const f=autonomous("auto-create-loss");const create=f.h.ctx.issues.create;let creates=0;f.h.ctx.issues.create=async input=>{creates++;await create(input);throw Error("ack lost");};expect((await reconcileMeetingIntake(f.h.ctx,f.config,{state:"published"},"v1",f.current))?.status).toBe("pending");expect(f.wakes).toHaveLength(0);f.h.ctx.issues.create=create;
 expect((await reconcileMeetingIntake(f.h.ctx,f.config,{state:"published"},"v1",f.current))?.status).toBe("replayed");expect(creates).toBe(1);expect(f.wakes).toHaveLength(1);
});
it("revocation after the durable wake claim prevents dispatch and does not erase uncertainty",async()=>{
 const f=autonomous("auto-claim-revocation"),execute=f.h.ctx.db.execute;f.h.ctx.db.execute=async(q,p)=>{const result=await execute(q,p);if(q.includes("bridge_runtime")&&q.includes("DO NOTHING"))f.disable();return result;};expect((await reconcileMeetingIntake(f.h.ctx,f.config,{state:"published"},"v1",f.current))?.status).toBe("pending");expect(f.wakes).toHaveLength(0);
});
