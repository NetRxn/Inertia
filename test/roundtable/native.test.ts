import { expect, it } from "vitest";
import {
  runMeetingJob,
  type MeetingJobConfig,
  type MeetingState,
  type MeetingStore,
} from "../../src/roundtable/native.js";
import type {
  WebsiteOperation,
  WebsiteOutcome,
} from "../../src/roundtable/website.js";
const config: MeetingJobConfig = {
  enabled: true,
  admission: "admission-1",
  companyId: "co",
  meetingId: "meeting",
  folderId: "folder",
  fileId: "doc",
  artifact: "meet-transcript",
  transcriptName: "conferenceRecords/conf/transcripts/t",
  origin: "https://dao.example",
  principalId: "principal",
  meeting: {
    title: "Meeting",
    date: "2026-10-24",
    attendees: null,
    agenda: null,
    tags: [],
  },
  withdrawn: false,
};
function setup() {
  let saved: MeetingState | null = null;
  let held = false;
  let sourceReads = 0;
  let transforms = 0;
  let version = "1";
  let text = "We did not approve.";
  let cfg = structuredClone(config);
  let now = 1000;
  const published: WebsiteOperation[] = [];
  let outcome: WebsiteOutcome = { state: "pending", code: "readback_pending" };
  const store: MeetingStore = {
    async own(_scope, work) {
      if (held) return null;
      held = true;
      try {
        return await work();
      } finally {
        held = false;
      }
    },
    async read() {
      return structuredClone(saved);
    },
    async save(_scope, state) {
      saved = structuredClone(state);
    },
  };
  const deps = {
    store,
    loadConfig: async () => structuredClone(cfg),
    readSource: async () => {
      sourceReads++;
      return {
        state: "ready" as const,
        source: {
          meetingId: "meeting",
          sourceId: "drive:doc",
          revision: version,
          kind: "transcript" as const,
          ready: true,
          audience: "members",
          text,
        },
      };
    },
    transform: async () => {
      transforms++;
      return { notes: [{ text, line: 1 }], decisions: [], actions: [] };
    },
    publish: async (record: WebsiteOperation) => {
      expect(saved?.operation?.body).toBe(record.body);
      published.push(record);
      return outcome;
    },
    clock: () => now,
  };
  return {
    deps,
    published,
    get saved() {
      return saved;
    },
    set outcome(v: WebsiteOutcome) {
      outcome = v;
    },
    set config(v: MeetingJobConfig) {
      cfg = v;
    },
    set now(v: number) {
      now = v;
    },
    revise(v: string, t = text) {
      version = v;
      text = t;
    },
    counts: () => ({ sourceReads, transforms }),
    complete() {
      outcome = {
        state: "already-published",
        receipt: {
          current: true,
          currentOutputHash: JSON.parse(saved!.operation!.body).publication
            .outputHash,
        } as any,
      };
    },
  };
}
it("persists immutable operation before dispatch and reuses bytes after reconstruction without transforming twice", async () => {
  const f = setup();
  expect(await runMeetingJob(config, f.deps)).toMatchObject({
    state: "pending",
  });
  const body = f.saved!.operation!.body;
  expect(await runMeetingJob(config, { ...f.deps })).toMatchObject({
    state: "pending",
  });
  expect(f.published.map((x) => x.body)).toEqual([body, body]);
  expect(f.counts().transforms).toBe(1);
});
it("deduplicates verified success and prepares newer correction with previous hash", async () => {
  const f = setup();
  await runMeetingJob(config, f.deps);
  f.complete();
  await runMeetingJob(config, f.deps);
  expect((await runMeetingJob(config, f.deps)).state).toBe("unchanged");
  const prior = f.saved!.operation!;
  f.revise("2", "Corrected unchanged quotation.");
  await runMeetingJob(config, f.deps);
  expect(
    JSON.parse(f.saved!.operation!.body).publication.expectedPreviousOutputHash,
  ).toBe(JSON.parse(prior.body).publication.outputHash);
  expect(f.saved!.previous).toEqual(prior);
});
it("refuses stale revisions and same-revision different bytes", async () => {
  const f = setup();
  f.revise("10");
  await runMeetingJob(config, f.deps);
  f.complete();
  await runMeetingJob(config, f.deps);
  f.revise("9");
  expect(await runMeetingJob(config, f.deps)).toMatchObject({
    state: "blocked",
    code: "stale_source_revision",
  });
  f.revise("10", "Changed bytes under same revision");
  expect(await runMeetingJob(config, f.deps)).toMatchObject({
    state: "blocked",
    code: "source_revision_conflict",
  });
  expect(f.published).toHaveLength(2);
});
it("durably pauses auth until explicit new admission, including process reconstruction", async () => {
  const f = setup();
  f.outcome = { state: "blocked", code: "scope_denied" };
  await runMeetingJob(config, f.deps);
  expect(await runMeetingJob(config, { ...f.deps })).toMatchObject({
    state: "blocked",
    code: "scope_denied",
  });
  expect(f.published).toHaveLength(1);
  f.config = { ...config, admission: "admission-2" };
  f.outcome = { state: "pending", code: "readback_pending" };
  await runMeetingJob(config, f.deps);
  expect(f.published).toHaveLength(2);
});
it("persists retry-not-before across process reconstruction", async () => {
  const f = setup();
  f.outcome = { state: "deferred", code: "rate_limited", retryAt: 5000 };
  await runMeetingJob(config, f.deps);
  await runMeetingJob(config, { ...f.deps });
  expect(f.published).toHaveLength(1);
  f.now = 5000;
  await runMeetingJob(config, f.deps);
  expect(f.published).toHaveLength(2);
});
it("withdrawal is durable and cannot be resumed by reenable or new admission", async () => {
  const f = setup();
  await runMeetingJob(config, f.deps);
  f.config = { ...config, withdrawn: true };
  expect(await runMeetingJob(config, f.deps)).toMatchObject({
    state: "blocked",
    code: "withdrawn",
  });
  f.config = { ...config, admission: "new" };
  expect(await runMeetingJob(config, f.deps)).toMatchObject({
    state: "blocked",
    code: "withdrawn",
  });
  expect(f.published).toHaveLength(1);
});
it("website withdrawal or conflict prevents newer revisions from creating another operation", async () => {
  for (const outcome of [
    { state: "blocked", code: "withdrawn" },
    { state: "conflict", code: "stale_publication" },
  ] as const) {
    const f = setup();
    f.outcome = outcome;
    await runMeetingJob(config, f.deps);
    f.revise("2");
    expect(await runMeetingJob(config, f.deps)).toMatchObject(outcome);
    expect(f.published).toHaveLength(1);
  }
});
it("rechecks disabled config before source access and before HTTP dispatch", async () => {
  const f = setup();
  f.config = { ...config, enabled: false };
  expect(await runMeetingJob(config, f.deps)).toMatchObject({
    state: "disabled",
  });
  expect(f.counts().sourceReads).toBe(0);
  expect(f.published).toHaveLength(0);
  const g = setup();
  const transform = g.deps.transform;
  g.deps.transform = async () => {
    g.config = { ...config, enabled: false };
    return transform();
  };
  expect(await runMeetingJob(config, g.deps)).toMatchObject({
    state: "disabled",
  });
  expect(g.published).toHaveLength(0);
});
it("prevents duplicate simultaneous owners and never mutates publication scope from source text", async () => {
  const f = setup();
  await Promise.all(
    Array.from({ length: 5 }, () => runMeetingJob(config, f.deps)),
  );
  expect(f.published).toHaveLength(1);
  f.config = { ...config, principalId: "other" };
  expect(await runMeetingJob(config, f.deps)).toMatchObject({
    state: "blocked",
    code: "binding_changed",
  });
  expect(f.published).toHaveLength(1);
});
it("never retries prepared bytes if source auth or readiness fails", async () => {
  const f = setup();
  await runMeetingJob(config, f.deps);
  f.deps.readSource = async () =>
    ({ state: "blocked", code: "authentication_required" }) as any;
  expect(await runMeetingJob(config, f.deps)).toMatchObject({
    state: "blocked",
    code: "authentication_required",
  });
  expect(f.published).toHaveLength(1);
});
it("persists an initial source auth failure even before an operation exists", async () => {
  const f = setup();
  let reads = 0;
  f.deps.readSource = async () => {
    reads++;
    return { state: "blocked", code: "scope_denied" } as any;
  };
  await runMeetingJob(config, f.deps);
  await runMeetingJob(config, { ...f.deps });
  expect(reads).toBe(1);
  expect(f.saved?.outcome).toMatchObject({
    state: "blocked",
    code: "scope_denied",
  });
});
it("does not dispatch after admission changes while preparation is running", async () => {
  const f = setup();
  const transform = f.deps.transform;
  f.deps.transform = async () => {
    f.config = { ...config, admission: "changed" };
    return transform();
  };
  expect(await runMeetingJob(config, f.deps)).toMatchObject({
    state: "blocked",
    code: "admission_changed",
  });
  expect(f.published).toHaveLength(0);
});
it("retains a protected summary source reference and reports missing transcript without publication", async () => {
  const f = setup();
  f.deps.readSource = async () =>
    ({
      state: "summary-only",
      code: "transcript_required",
      sourceReference: {
        sourceId: "drive:doc",
        meetingId: "meeting",
        kind: "summary",
      },
    }) as any;
  expect(await runMeetingJob(config, f.deps)).toEqual({
    state: "summary-only",
    code: "transcript_required",
  });
  expect(f.saved?.sourceReference).toEqual({
    sourceId: "drive:doc",
    meetingId: "meeting",
    kind: "summary",
  });
  expect(f.published).toHaveLength(0);
});
it("retains publication result when native follow-up is temporarily unavailable", async () => {
  const f = setup();
  await runMeetingJob(config, f.deps);
  f.complete();
  const result = await runMeetingJob(config, {
    ...f.deps,
    onResult: async () => {
      throw Error("native unavailable");
    },
  });
  expect(result).toMatchObject({
    state: "already-published",
    nativeIntake: "pending",
  });
  expect(f.saved?.outcome?.state).toBe("already-published");
});
it("allows an explicitly re-admitted summary-only mapping to gain a transcript before any publication", async () => {
  const f = setup();
  f.deps.readSource = async () =>
    ({ state: "summary-only", code: "transcript_required" }) as any;
  await runMeetingJob(config, f.deps);
  f.config = { ...config, fileId: "transcript-doc", admission: "admission-2" };
  f.deps.readSource = async () =>
    ({
      state: "ready",
      source: {
        meetingId: "meeting",
        sourceId: "drive:transcript-doc",
        revision: "1",
        kind: "transcript",
        ready: true,
        audience: "members",
        text: "We did not approve.",
      },
    }) as any;
  expect(await runMeetingJob(config, f.deps)).toMatchObject({
    state: "pending",
  });
  expect(f.published).toHaveLength(1);
});
it("does not publish an extraction whose source changed while classification was in flight",async()=>{
 const f=setup(),transform=f.deps.transform;
 f.deps.transform=async()=>{const notes=await transform();f.revise("2","Corrected source.");return notes;};
 expect(await runMeetingJob(config,f.deps)).toMatchObject({state:"pending",code:"source_changed_during_extraction"});
 expect(f.published).toHaveLength(0);
 expect(f.saved?.operation??null).toBeNull();
});

it("preserves a historical empty operation and supports a new source revision correction through existing previous-hash CAS",async()=>{
 const f=setup();
 const historical={...f.deps,transform:async()=>({notes:[],decisions:[],actions:[]})};
 await runMeetingJob(config,historical);f.complete();await runMeetingJob(config,historical);
 const previous=structuredClone(f.saved!.operation!);
 expect(JSON.parse(previous.body).publication.notes).toEqual({notes:[],decisions:[],actions:[]});
 expect((await runMeetingJob(config,f.deps)).state).toBe("unchanged");
 expect(f.saved!.operation).toEqual(previous);
 f.revise("2");f.outcome={state:"pending",code:"readback_pending"};
 await runMeetingJob(config,f.deps);
 const correction=JSON.parse(f.saved!.operation!.body).publication;
 expect(correction.revision).toBe("2");
 expect(correction.notes.notes).toEqual([{text:"We did not approve.",line:1,verification:"unverified"}]);
 expect(correction.sourceHash).toBe(JSON.parse(previous.body).publication.sourceHash);
 expect(correction.expectedPreviousOutputHash).toBe(JSON.parse(previous.body).publication.outputHash);
 expect(f.saved!.previous).toEqual(previous);
 expect(f.saved!.operation!.operationId).not.toBe(previous.operationId);
});
