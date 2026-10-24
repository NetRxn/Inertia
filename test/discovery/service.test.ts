import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { runFundingDiscovery } from "../../src/discovery/service.js";
import type { OpportunityBrief } from "../../src/grants/brief.js";
const brief = JSON.parse(
  readFileSync(
    new URL("../fixtures/opportunity-brief-v1.json", import.meta.url),
    "utf8",
  ),
) as OpportunityBrief;
function fixture() {
  const order: string[] = [];
  const bridge: any = {
    knowledge: {
      begin: async () => {
        order.push("query");
        return {
          query_receipt_id: "q",
          items: ["saved partner"],
          evidence_gaps: [],
        };
      },
      commit: async (i: any) => {
        order.push("commit");
        return {
          contract_version: "partner-graph-v1",
          run_id: i.run_id,
          query_receipt_id: i.query_receipt_id,
          projection_state: "pending",
          committed: [],
          reused: ["source"],
          disputed: [],
          candidates: [],
          ignored: [],
          source_bindings: ["source"],
          projection_sequence: 1,
          no_change_reason: i.no_change_reason,
          opportunity_outcome: i.opportunity_outcome,
        };
      },
    },
    inspect: async (url: string, saved: any) => {
      order.push("capture");
      expect(saved.items).toEqual(["saved partner"]);
      return {
        input: {
          answer: "Useful source retained",
          candidates: [],
          no_change_reason: "Current admitted evidence reused",
          opportunity_outcome: "rejected",
        },
        opportunities: ["fund:1"],
      };
    },
    readBrief: async () => {
      order.push("brief");
      return {
        brief,
        officialSourceHash: "a".repeat(64),
        cycleId: "2026",
        materialRevision: "b".repeat(64),
        nextRecheckAt: "2026-10-25T12:00:00.000Z",
        urgent: false,
      };
    },
  };
  const work = {
    organizationId: "dao",
    objectiveId: "objective",
    projectId: "project-1",
    runId: "run",
    capabilities: ["education"],
    urls: ["https://sponsor.example/program"],
    maximumLeads: 3,
  };
  return { order, bridge, work };
}
it("queries before independent capture, commits through existing research core, then renders canonical brief", async () => {
  const { order, bridge, work } = fixture();
  const r = await runFundingDiscovery(work, bridge);
  expect(order).toEqual(["query", "capture", "commit", "brief"]);
  expect(r.findings[0]?.markdown).toContain("Application effort");
  expect(r.findings[0]?.graphRefreshPending).toBe(true);
  expect(r.failures).toEqual([]);
});
it("keeps official-page failure unknown while independently verified lead can surface", async () => {
  const { bridge, work } = fixture();
  const inspect = bridge.inspect;
  bridge.inspect = async (url: string, s: any) => {
    if (url.includes("failed")) throw Error("private diagnostic");
    return inspect(url, s);
  };
  const r = await runFundingDiscovery(
    { ...work, urls: ["https://failed.example/", ...work.urls] },
    bridge,
  );
  expect(r.findings).toHaveLength(1);
  expect(r.failures).toEqual([
    {
      url: "https://failed.example/",
      stage: "capture_or_writeback",
      code: "source_unresolved",
    },
  ]);
  expect(JSON.stringify(r)).not.toContain("private diagnostic");
});
it("does not render a brief after failed writeback, and retains unprocessed URLs", async () => {
  const { bridge, work, order } = fixture();
  bridge.knowledge.commit = async () => {
    throw Error("write failed");
  };
  const r = await runFundingDiscovery(
    {
      ...work,
      maximumLeads: 1,
      urls: [...work.urls, "https://second.example/"],
    },
    bridge,
  );
  expect(r.findings).toEqual([]);
  expect(order).not.toContain("brief");
  expect(r.remainingUrls).toEqual(["https://second.example/"]);
  expect(r.coverage).toBe("partial");
});
it("rejects cross-organization brief and unsupported urgency, retaining failure", async () => {
  const { bridge, work } = fixture();
  bridge.readBrief = async () => ({
    brief: { ...brief, organization_id: "other" },
    officialSourceHash: "a".repeat(64),
    cycleId: "2026",
    materialRevision: "b".repeat(64),
    nextRecheckAt: "2026-10-25T12:00:00.000Z",
    urgent: true,
  });
  const r = await runFundingDiscovery(work, bridge);
  expect(r.findings).toEqual([]);
  expect(r.failures[0]?.stage).toBe("brief");
});
it("rejects invalid URLs and bounded-work fields before source I/O", async () => {
  const { bridge, work, order } = fixture();
  const r = await runFundingDiscovery(
    { ...work, urls: ["http://127.0.0.1/"] },
    bridge,
  );
  expect(r.failures[0]?.stage).toBe("validation");
  expect(order).toEqual([]);
  const mixed = await runFundingDiscovery(
    { ...work, urls: ["http://127.0.0.1/", ...work.urls] },
    bridge,
  );
  expect(mixed.findings).toHaveLength(1);
});
