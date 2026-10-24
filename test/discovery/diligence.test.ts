import { expect, it } from "vitest";
import { registerDiscoveryDiligence } from "../../src/discovery/diligence.js";
it("requires separate assigned checkout and exact captured-source query before source-bound review", async () => {
  const handlers = new Map<string, any>(),
    docs = new Map<string, any>();
  let reviews = 0;
  const ctx: any = {
    tools: { register: (k: string, _d: any, h: any) => handlers.set(k, h) },
    issues: {
      get: async () => ({
        id: "diligence",
        companyId: "company",
        projectId: "project",
        assigneeAgentId: "reviewer",
        status: "in_progress",
      }),
      assertCheckoutOwner: async () => ({}),
      documents: {
        list: async () => [...docs.values()],
        get: async (_i: string, k: string) => docs.get(k) ?? null,
        upsert: async (v: any) => {
          docs.set(v.key, v);
          return v;
        },
      },
    },
  };
  const bridge: any = {
    knowledge: {
      begin: async () => ({
        query_receipt_id: "q",
        items: [],
        evidence_gaps: [],
      }),
    },
    readCapture: async () => ({
      candidate: {
        captureId: "capture",
        sourceHash: "a".repeat(64),
        records: [{ recordId: "record" }],
      },
      preliminary: [],
    }),
    reviewCapture: async (i: any) => {
      reviews++;
      expect(i.queryReceiptId).toBe("q");
      expect(i.expectedSourceHash).toBe("a".repeat(64));
      return {
        admitted_claim: "official_program_name_only",
        captureId: i.captureId,
        eligibility: "unknown",
        fit: "unknown",
        nextAction: "Continue diligence",
        knowledge_receipt: {
          contract_version: "partner-graph-v1",
          run_id: i.runId,
          query_receipt_id: "q",
          projection_state: "pending",
        },
      };
    },
  };
  const binding: any = {
    key: "dao",
    enabled: true,
    companyId: "company",
    organizationId: "org",
    projectId: "project",
    issueId: "objective",
    agentId: "scout",
    capabilities: [],
    diligence: { issueId: "diligence", agentId: "reviewer", bridge },
  };
  registerDiscoveryDiligence(ctx, [binding], {
    own: async (_s: any, f: any) => f(),
  });
  const actor = {
    companyId: "company",
    projectId: "project",
    agentId: "reviewer",
    runId: "review-run",
  };
  await expect(
    handlers.get("funding-diligence-context")(
      { binding: "dao", captureId: "capture" },
      { ...actor, agentId: "scout" },
    ),
  ).rejects.toThrow();
  await expect(
    handlers.get("funding-diligence-submit")(
      {
        binding: "dao",
        captureId: "capture",
        recordId: "record",
        quote: "Official name",
      },
      actor,
    ),
  ).rejects.toThrow();
  await handlers.get("funding-diligence-context")(
    { binding: "dao", captureId: "capture" },
    actor,
  );
  await handlers.get("funding-diligence-submit")(
    {
      binding: "dao",
      captureId: "capture",
      recordId: "record",
      quote: "Official name",
    },
    actor,
  );
  expect(reviews).toBe(1);
});
it("offers independent source corroboration transition without granting a recurring adapter", async () => {
  const handlers = new Map<string, any>(),
    docs = new Map<string, any>();
  const h = "a".repeat(64),
    corroborating = "b".repeat(64);
  let reviews = 0;
  const ctx: any = {
    tools: { register: (k: string, _d: any, h: any) => handlers.set(k, h) },
    issues: {
      get: async () => ({
        id: "diligence",
        companyId: "company",
        projectId: "project",
        assigneeAgentId: "reviewer",
        status: "in_progress",
      }),
      assertCheckoutOwner: async () => ({}),
      documents: {
        list: async () => [...docs.values()],
        get: async (_i: string, k: string) => docs.get(k) ?? null,
        upsert: async (v: any) => {
          docs.set(v.key, v);
          return v;
        },
      },
    },
  };
  const bridge: any = {
    knowledge: {
      begin: async () => ({
        query_receipt_id: "q",
        items: [],
        evidence_gaps: [],
      }),
    },
    readCapture: async (id: string) => ({
      candidate: {
        captureId: id,
        sourceHash: id === "new" ? h : corroborating,
        status:
          id === "new"
            ? "awaiting_source_validation"
            : "captured_review_required",
        records: [],
      },
      preliminary: [],
    }),
    sourceReview: async (i: any) => {
      reviews++;
      expect(i.expectedCorroboratingHash).toBe(corroborating);
      return {
        state: "source_identity_admitted",
        scope: "exact_capture_only",
        captureId: i.captureId,
        sourceHash: h,
        sponsorName: i.sponsorName,
        corroboratingCaptureId: i.corroboratingCaptureId,
        corroboratingHash: corroborating,
        reviewReceiptId: "receipt",
        eligibility: "unknown",
        adapterActivated: false,
        nextAction: "Continue source-bound extraction",
      };
    },
  };
  const binding: any = {
    key: "dao",
    enabled: true,
    companyId: "company",
    organizationId: "org",
    projectId: "project",
    issueId: "objective",
    agentId: "scout",
    capabilities: [],
    diligence: { issueId: "diligence", agentId: "reviewer", bridge },
  };
  registerDiscoveryDiligence(ctx, [binding], {
    own: async (_s: any, f: any) => f(),
  });
  const actor = {
    companyId: "company",
    projectId: "project",
    agentId: "reviewer",
    runId: "review-run",
  };
  await handlers.get("funding-diligence-context")(
    { binding: "dao", captureId: "new" },
    actor,
  );
  const result = await handlers.get("funding-source-validation-submit")(
    {
      binding: "dao",
      captureId: "new",
      corroboratingCaptureId: "official",
      sponsorName: "New Sponsor",
      quote: "New Sponsor",
    },
    actor,
  );
  expect(reviews).toBe(1);
  expect(result.data.adapterActivated).toBe(false);
});
