import { readNativeDocument } from "../../src/discovery/documents.js";
import { expect, it } from "vitest";
import { preliminary } from "./fixtures.js";
import { registerFundingDiscovery } from "../../src/discovery/host.js";
function fixture(enabled = true) {
  const documents = new Map<string, any>();
  const tools = new Map<string, any>();
  const jobs = new Map<string, any>();
  const wakeups: any[] = [];
  let captures = 0;
  const ctx: any = {
    tools: { register: (k: string, _s: any, h: any) => tools.set(k, h) },
    jobs: { register: (k: string, h: any) => jobs.set(k, h) },
    issues: {
      get: async (id: string) => ({
        id,
        companyId: "company",
        projectId: "project",
        assigneeAgentId: "agent",
        status: "in_progress",
      }),
      assertCheckoutOwner: async () => ({}),
      documents: {
        list: async (id: string) =>
          [...documents.values()].filter((d) => d.issueId === id),
        get: async (i: string, k: string) => documents.get(i + ":" + k) ?? null,
        upsert: async (v: any) => {
          documents.set(v.issueId + ":" + v.key, { ...v });
          return v;
        },
      },
      requestWakeup: async (i: string, c: string, v: any) => {
        wakeups.push({ i, c, ...v });
        return { queued: true, runId: "wake" };
      },
    },
  };
  const bridge: any = {
    knowledge: {
      begin: async () => ({
        query_receipt_id: "q",
        items: ["scoped saved evidence"],
        evidence_gaps: [],
      }),
      commit: async (i: any) => ({
        contract_version: "partner-graph-v1",
        run_id: i.run_id,
        query_receipt_id: i.query_receipt_id,
        projection_state: "current",
        committed: [],
        reused: [],
        disputed: [],
        candidates: [],
        ignored: [],
        source_bindings: [],
        projection_sequence: 1,
        no_change_reason: i.no_change_reason,
        opportunity_outcome: null,
      }),
    },
    inspect: async () => {
      captures++;
      return {
        input: {
          answer: "Captured candidate",
          candidates: [],
          no_change_reason:
            "Official evidence captured for candidate review; no graph admission",
          opportunity_outcome: null,
        },
        opportunities: [],
      };
    },
    readBrief: async () => {
      throw Error("No admitted brief");
    },
  };
  const config: any = {
    key: "dao",
    enabled,
    companyId: "company",
    organizationId: "organization",
    projectId: "project",
    issueId: "objective",
    agentId: "agent",
    urgentIssueId: "triage",
    publicQueries: ["corporate education grants Texas"],
    capabilities: ["education"],
    maximumLeads: 2,
    retryAfterMs: 3600000,
    bridge,
  };
  const owner: any = { own: async (_s: any, f: any) => f() };
  registerFundingDiscovery(ctx, [config], owner, () =>
    Date.parse("2026-10-24T12:00:00.000Z"),
  );
  const run = {
    companyId: "company",
    agentId: "agent",
    runId: "run",
    projectId: "project",
  };
  return {
    tools,
    jobs,
    documents,
    wakeups,
    config,
    bridge,
    run,
    ctx,
    captures: () => captures,
  };
}
it("registers real native tool/job hooks but disabled config performs no I/O", async () => {
  const f = fixture(false);
  await expect(
    f.tools.get("funding-discovery-context")({ binding: "dao" }, f.run),
  ).rejects.toThrow();
  await f.jobs.get("funding-discovery-recheck")({ runId: "job" });
  expect(f.documents.size).toBe(0);
  expect(f.wakeups).toHaveLength(0);
});
it("persists public mandate, query-first context and incomplete continuation in native objective documents", async () => {
  const f = fixture();
  const context = await f.tools.get("funding-discovery-context")(
    { binding: "dao" },
    f.run,
  );
  expect(context.data.saved.items).toEqual(["scoped saved evidence"]);
  expect(context.data.publicQueries).toEqual(f.config.publicQueries);
  const r = await f.tools.get("funding-discovery-submit")(
    { binding: "dao", urls: ["https://sponsor.example/new"] },
    f.run,
  );
  expect(r.data.coverage).toBe("partial");
  expect(f.captures()).toBe(1);
  expect(
    await readNativeDocument(
      f.ctx.issues.documents,
      "objective",
      "funding-discovery-continuation",
      "company",
    ),
  ).not.toBeNull();
});
it("denies wrong native company or agent and submit without prior query", async () => {
  const f = fixture();
  await expect(
    f.tools.get("funding-discovery-context")(
      { binding: "dao" },
      { ...f.run, companyId: "other" },
    ),
  ).rejects.toThrow();
  await expect(
    f.tools.get("funding-discovery-submit")(
      { binding: "dao", urls: [] },
      f.run,
    ),
  ).rejects.toThrow();
  expect(f.captures()).toBe(0);
});
it("wakes assigned native agent with stable due-work key, never claims human notification", async () => {
  const f = fixture();
  await f.jobs.get("funding-discovery-recheck")({ runId: "one" });
  await f.jobs.get("funding-discovery-recheck")({ runId: "two" });
  expect(f.wakeups).toHaveLength(2);
  expect(f.wakeups[0].idempotencyKey).toBe(f.wakeups[1].idempotencyKey);
  expect(f.wakeups[0].i).toBe("objective");
  expect(
    (await readNativeDocument(
      f.ctx.issues.documents,
      "objective",
      "funding-discovery-mandate",
      "company",
    ))!.body,
  ).toContain("Do not send private");
});
it("does not wake before native persisted due time and does not use agent-provided tool configuration", async () => {
  const f = fixture();
  await f.tools.get("funding-discovery-context")({ binding: "dao" }, f.run);
  await f.tools.get("funding-discovery-submit")(
    { binding: "dao", urls: [] },
    f.run,
  );
  await f.jobs.get("funding-discovery-recheck")({});
  expect(f.wakeups).toHaveLength(0);
  await expect(
    f.tools.get("funding-discovery-context")(
      { binding: "dao", principal: "admin" },
      f.run,
    ),
  ).rejects.toThrow();
});

it("persists preliminary deadline alert before a packet and recovers lost native wakeup without duplicate event identity", async () => {
  const f = fixture();
  const candidate = {
    captureId: "capture",
    sourceId: "source",
    sourceDocumentId: "doc",
    sourceHash: "a".repeat(64),
    sourceUrl: preliminary.source.url,
    observedAt: preliminary.source.observedAt,
    records: [],
    status: "captured_review_required",
  };
  const inspect = f.bridge.inspect;
  f.bridge.inspect = async () => ({
    ...(await inspect()),
    candidate,
    preliminary: [preliminary],
  });
  f.bridge.readCapture = async () => ({
    candidate,
    preliminary: [preliminary],
  });
  await f.tools.get("funding-discovery-context")({ binding: "dao" }, f.run);
  const wake = f.ctx.issues.requestWakeup;
  let lost = true;
  f.ctx.issues.requestWakeup = async (...args: any[]) => {
    const r = await wake(...args);
    if (lost) {
      lost = false;
      throw Error("lost response");
    }
    return r;
  };
  const pending = await f.tools.get("funding-discovery-submit")(
    { binding: "dao", urls: [preliminary.source.url] },
    f.run,
  );
  expect(pending.data.deliveryPending).toBe(true);
  expect(
    [...f.documents.values()].some(
      (d) =>
        d.issueId === "objective" &&
        d.title.startsWith("Preliminary funding opportunity"),
    ),
  ).toBe(true);
  expect([...f.documents.values()].some((d) => d.issueId === "triage")).toBe(
    true,
  );
  await f.jobs.get("funding-discovery-recheck")({});
  expect(f.wakeups[0].idempotencyKey).toBe(f.wakeups[1].idempotencyKey);
  expect(f.captures()).toBe(1);
});
it("allows repair after revoked pending capture and preserves unprocessed URLs across submissions", async () => {
  const f = fixture();
  f.config.maximumLeads = 1;
  await f.tools.get("funding-discovery-context")({ binding: "dao" }, f.run);
  await f.tools.get("funding-discovery-submit")(
    { binding: "dao", urls: ["https://one.example/", "https://two.example/"] },
    f.run,
  );
  const next = { ...f.run, runId: "next" };
  await f.tools.get("funding-discovery-context")({ binding: "dao" }, next);
  const r = await f.tools.get("funding-discovery-submit")(
    { binding: "dao", urls: ["https://three.example/"] },
    next,
  );
  expect(r.data.remainingUrls).toEqual(["https://three.example/"]);
});
it("does not reset native-run budget on repeated context or submit calls", async () => {
  const f = fixture();
  f.config.maximumLeads = 1;
  await f.tools.get("funding-discovery-context")({ binding: "dao" }, f.run);
  await f.tools.get("funding-discovery-submit")(
    { binding: "dao", urls: ["https://one.example/"] },
    f.run,
  );
  await f.tools.get("funding-discovery-context")({ binding: "dao" }, f.run);
  const r = await f.tools.get("funding-discovery-submit")(
    { binding: "dao", urls: ["https://two.example/"] },
    f.run,
  );
  expect(f.captures()).toBe(1);
  expect(r.data.remainingUrls).toContain("https://two.example/");
});
it("suppresses a revoked pending preliminary snapshot without blocking fresh agent context", async () => {
  const f = fixture();
  const candidate = {
    captureId: "capture",
    sourceId: "source",
    sourceDocumentId: "doc",
    sourceHash: "a".repeat(64),
    sourceUrl: preliminary.source.url,
    observedAt: preliminary.source.observedAt,
    records: [],
    status: "captured_review_required",
  };
  const inspect = f.bridge.inspect;
  f.bridge.inspect = async () => ({
    ...(await inspect()),
    candidate,
    preliminary: [preliminary],
  });
  f.bridge.readCapture = async () => ({
    candidate,
    preliminary: [preliminary],
  });
  await f.tools.get("funding-discovery-context")({ binding: "dao" }, f.run);
  await f.tools.get("funding-discovery-submit")(
    { binding: "dao", urls: [preliminary.source.url] },
    f.run,
  );
  f.bridge.readCapture = async () => null;
  const r = await f.tools.get("funding-discovery-context")(
    { binding: "dao" },
    { ...f.run, runId: "repair" },
  );
  expect(r.data.saved).toBeDefined();
  expect(
    [...f.documents.values()].some((d: any) =>
      d.body.includes("no longer current"),
    ),
  ).toBe(true);
});
it("reasserts native checkout after capture before any native write", async () => {
  const f = fixture();
  await f.tools.get("funding-discovery-context")({ binding: "dao" }, f.run);
  const inspect = f.bridge.inspect;
  f.bridge.inspect = async () => {
    const r = await inspect();
    f.ctx.issues.assertCheckoutOwner = async () => {
      throw Error("superseded");
    };
    return r;
  };
  await expect(
    f.tools.get("funding-discovery-submit")(
      { binding: "dao", urls: ["https://one.example/"] },
      f.run,
    ),
  ).rejects.toThrow("superseded");
  expect(
    JSON.parse(
      (await readNativeDocument(
        f.ctx.issues.documents,
        "objective",
        "funding-discovery-continuation",
        "company",
      ))!.body,
    ).result.findings,
  ).toEqual([]);
});
it("rotates persistent failed rechecks so a new valid urgent lead is not starved at one-lead budget", async () => {
  const f = fixture();
  f.config.maximumLeads = 1;
  const inspect = f.bridge.inspect;
  f.bridge.inspect = async (url: string, ...args: any[]) => {
    if (url.includes("failed")) throw Error("source failed");
    return inspect(url, ...args);
  };
  await f.tools.get("funding-discovery-context")({ binding: "dao" }, f.run);
  await f.tools.get("funding-discovery-submit")(
    { binding: "dao", urls: ["https://failed.example/"] },
    f.run,
  );
  const next = { ...f.run, runId: "next" };
  await f.tools.get("funding-discovery-context")({ binding: "dao" }, next);
  const r = await f.tools.get("funding-discovery-submit")(
    { binding: "dao", urls: ["https://valid.example/"] },
    next,
  );
  expect(f.captures()).toBe(1);
  expect(r.data.remainingUrls).toContain("https://failed.example/");
});
it("canonicalizes Python observation timestamps before sending public urgent transport and reports acceptance separately", async () => {
  const f = fixture();
  const p = {
    ...preliminary,
    source: {
      ...preliminary.source,
      observedAt: "2026-10-24T01:33:58.576788+00:00",
    },
  };
  const candidate = {
    captureId: "capture",
    sourceId: "source",
    sourceDocumentId: "doc",
    sourceHash: "a".repeat(64),
    sourceUrl: p.source.url,
    observedAt: p.source.observedAt,
    records: [],
    status: "captured_review_required",
  };
  const inspect = f.bridge.inspect;
  f.bridge.inspect = async () => ({
    ...(await inspect()),
    candidate,
    preliminary: [p],
  });
  f.bridge.readCapture = async () => ({ candidate, preliminary: [p] });
  f.config.humanAlerts = {
    deliver: async (i: any) => {
      expect(i.observedAt).toBe("2026-10-24T01:33:58.576Z");
      return { state: "accepted", eventId: "e".repeat(64) };
    },
  };
  await f.tools.get("funding-discovery-context")({ binding: "dao" }, f.run);
  const result = await f.tools.get("funding-discovery-submit")(
    { binding: "dao", urls: [p.source.url] },
    f.run,
  );
  expect(result.data.humanDeliveryConfigured).toBe(true);
  expect(result.data.humanDeliveryReceipts[0].state).toBe("accepted");
});
it("native portfolio discovery follows fresh child ancestry without taking lifecycle ownership",async()=>{
 const f=fixture();f.config.portfolioRootIssueId="objective";f.config.rootProjectId="funding-project";
 const root:any={id:"objective",companyId:"company",projectId:"funding-project",status:"in_progress",assigneeAgentId:"coordinator"};
 const child:any={id:"research-one",parentId:"objective",companyId:"company",projectId:"project",status:"in_progress",assigneeAgentId:"agent",executionRunId:"run"};
 f.ctx.issues.get=async(id:string)=>id===root.id?root:child;
 f.ctx.issues.getSubtree=async(id:string,companyId:string)=>({rootIssueId:id,companyId,issueIds:[root.id,child.id],issues:[root,child],activeRuns:{[child.id]:[{id:f.run.runId,issueId:child.id,agentId:"agent",status:"running",finishedAt:null}]},assignees:{agent:{id:"agent",status:"running"}}});
 f.ctx.issues.assertCheckoutOwner=async()=>{throw Error("No portfolio checkout mutation");};
 await f.tools.get("funding-discovery-context")({binding:"dao"},f.run);
 await f.tools.get("funding-discovery-submit")({binding:"dao",urls:["https://example.org/program"]},f.run);
 expect(f.wakeups).toEqual([]);expect([...f.documents.values()].some(d=>d.issueId==="research-one")).toBe(true);
 child.id="research-two";f.run.runId="run-two";child.executionRunId="run-two";
 await f.tools.get("funding-discovery-context")({binding:"dao"},f.run);
 root.hiddenAt=new Date();await expect(f.tools.get("funding-discovery-context")({binding:"dao"},f.run)).rejects.toThrow();delete root.hiddenAt;
 child.parentId="foreign";await expect(f.tools.get("funding-discovery-context")({binding:"dao"},f.run)).rejects.toThrow();
});
