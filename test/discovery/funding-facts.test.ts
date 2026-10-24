import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { registerFundingDiscovery } from "../../src/discovery/host.js";
import { readNativeDocument } from "../../src/discovery/documents.js";
import { preliminary } from "./fixtures.js";
function fixture() {
  const tools = new Map<string, any>(), docs = new Map<string, any>();
  const wakes = new Set<string>(), alerts = new Set<string>();
  let now = Date.parse("2026-10-24T12:00:00.000Z"), calls = 0;
  const evidence = "🌱 Community awards. Applications close October 27, 2026. Total funding pool: $100,000.";
  const identity = {
    state: "source_identity_admitted",
    scope: "exact_capture_only",
    captureId: "capture",
    sourceHash: "a".repeat(64),
    sponsorName: "Sponsor",
    corroboratingCaptureId: "official",
    corroboratingHash: "c".repeat(64),
    reviewReceiptId: "identity",
    eligibility: "unknown",
    adapterActivated: false,
    nextAction: "Assess evidence"
  };
  const candidate: any = {
    captureId: "capture",
    sourceId: "source",
    sourceDocumentId: "doc",
    sourceHash: "a".repeat(64),
    sourceUrl: preliminary.source.url,
    observedAt: preliminary.source.observedAt,
    records: [],
    status: "source_identity_admitted",
    sourceIdentity: identity,
    sourceIdentityReceiptId: "identity",
    fundingEvidence: {
      text: evidence,
      sha256: createHash("sha256").update(evidence).digest("hex"),
      normalization: "bs4-html-text-space-strip-v1",
      spanUnits: "unicode_code_points",
      spanConvention: "half_open"
    }
  };
  let current: any = {
    candidate,
    preliminary: []
  };
  const assessed: any = {
    ...structuredClone(preliminary),
    status: "conditional_cycle_unverified",
    sponsor: "Sponsor",
    assessmentReceiptId: "assessment",
    benefit: {
      kind: "total_pool",
      quote: "Total funding pool: $100,000.",
      minimum: 100000,
      maximum: 100000,
      currency: null,
      amountBasis: "total pool; not per applicant"
    }
  };
  const ctx: any = {
    tools: {
      register: (k: string, _d: any, h: any) => tools.set(k, h)
    },
    jobs: {
      register: () => { }
    },
    issues: {
      get: async (id: string) => ({
        id,
        companyId: "company",
        projectId: "project",
        assigneeAgentId: id === "review" ? "reviewer" : "scout",
        status: "in_progress"
      }),
      assertCheckoutOwner: async (v: any) => {
        if (v.issueId !== (v.actorAgentId === "reviewer" ? "review" : "objective")) throw Error("Wrong checkout");
      },
      documents: {
        list: async (id: string) => [...docs.values()].filter(d => d.issueId === id),
        get: async (id: string, key: string) => docs.get(id + key) ?? null,
        upsert: async (v: any) => {
          if (docs.has(v.issueId + v.key)) throw Error("Immutable revision");
          docs.set(v.issueId + v.key, v);
          return v;
        }
      },
      requestWakeup: async (_id: string, _company: string, v: any) => {
        wakes.add(v.idempotencyKey);
        return {
          queued: true
        };
      }
    }
  };
  const bridge: any = {
    knowledge: {
      begin: async () => ({
        query_receipt_id: "query",
        items: [],
        evidence_gaps: []
      })
    },
    readCapture: async () => current,
    assessFundingFacts: async (input: any) => {
      calls++;
      assessed.deadlineAssessment = {
        date: assessed.deadline?.date ?? null,
        precision: assessed.deadline ? "date" : "unknown",
        timezone: null,
        cutoff: null,
        quote: input.facts.deadline?.quote ?? null,
        reason: "Verify source cutoff and current cycle"
      };
      assessed.benefit ??= {
        kind: "unknown",
        minimum: null,
        maximum: null,
        currency: null,
        amountBasis: "unknown"
      };
      assessed.benefit.quote = input.facts.benefit?.quote ?? null;
      current.preliminary = [assessed];
      return {
        state: "funding_facts_assessed",
        scope: "exact_capture_only",
        captureId: input.captureId,
        sourceHash: input.expectedSourceHash,
        sourceIdentityReceiptId: input.sourceIdentityReceiptId,
        corroboratingCaptureId: "official",
        corroboratingHash: "c".repeat(64),
        assessmentReceiptId: "assessment",
        materialEventKey: assessed.materialEventKey,
        knowledgeId: "knowledge",
        runId: input.runId,
        queryReceiptId: input.queryReceiptId,
        eligibility: "unknown",
        fit: "unknown",
        adapterActivated: false,
        preliminary: assessed
      };
    },
  };
  const binding: any = {
    key: "dao",
    enabled: true,
    companyId: "company",
    projectId: "project",
    organizationId: "org",
    issueId: "objective",
    agentId: "scout",
    urgentIssueId: "triage",
    publicQueries: ["public grants"],
    capabilities: [],
    maximumLeads: 2,
    retryAfterMs: 60000,
    runBudgetMs: 1000,
    bridge,
    diligence: {
      issueId: "review",
      agentId: "reviewer",
      bridge
    },
    humanAlerts: {
      deliver: async (v: any) => {
        alerts.add(v.eventKey);
        return {
          state: "accepted",
          eventId: v.eventKey
        };
      }
    }
  };
  const install = () => registerFundingDiscovery(ctx, [binding], {
    own: async (_s: any, f: any) => f()
  }, () => now);
  install();
  const run = {
    companyId: "company",
    projectId: "project",
    agentId: "reviewer",
    runId: "review-run"
  };
  const quoted = (quote: string) => {
    const start = [...evidence].join("").indexOf(quote);
    const cpStart = [...evidence.slice(0, start)].length;
    return {
      quote,
      span: {
        start: cpStart,
        end: cpStart + [...quote].length
      }
    };
  };
  const input = {
    binding: "dao",
    captureId: "capture",
    facts: {
      programName: quoted("Community awards"),
      deadline: quoted("Applications close October 27, 2026"),
      benefit: quoted("Total funding pool: $100,000.")
    }
  };
  const context = () => tools.get("funding-diligence-context")({
    binding: "dao",
    captureId: "capture"
  }, run);
  const submit = (value: any = input, actor: any = run) => tools.get("funding-facts-submit")(value, actor);
  return {
    tools,
    docs,
    wakes,
    alerts,
    candidate,
    assessed,
    bridge,
    binding,
    run,
    input,
    context,
    submit,
    install,
    ctx,
    calls: () => calls,
    setCurrent: (v: any) => current = v,
    advance: () => now += 1001
  };
}
it("registers a separate source-bound facts tool and composes conditional delivery without a canonical packet", async () => {
  const f = fixture();
  expect(f.tools.has("funding-facts-submit")).toBe(true);
  await f.context();
  const result = await f.submit();
  expect(result.data.state).toBe("funding_facts_assessed");
  expect(f.calls()).toBe(1);
  const continuation = await readNativeDocument(f.ctx.issues.documents, "objective", "funding-discovery-continuation", "company");
  expect(JSON.parse(continuation!.body).result.preliminary).toHaveLength(1);
  expect([...f.docs.values()].some(d => d.body.includes("total pool; not per applicant"))).toBe(true);
  expect(f.alerts.size).toBe(1);
  f.install();
  await f.submit();
  expect(f.alerts.size).toBe(1);
  expect([...f.wakes].filter(k => k.startsWith("funding-urgent:"))).toHaveLength(1);
});
it("rejects other actor, tenant, project, disabled runtime and caller-selected authority", async () => {
  const f = fixture();
  expect(f.tools.has("funding-facts-submit")).toBe(true);
  await f.context();
  for (const change of [{
    agentId: "scout"
  }, {
    companyId: "other"
  }, {
    projectId: "other"
  }, {
    runId: ""
  }]) await expect(f.submit(f.input, {
    ...f.run,
    ...change
  })).rejects.toThrow();
  await expect(f.submit({
    ...f.input,
    sourceIdentityReceiptId: "chosen"
  })).rejects.toThrow();
  f.binding.enabled = false;
  await expect(f.submit()).rejects.toThrow();
  expect(f.calls()).toBe(0);
});
it("requires query-first current capture, source receipt and valid exact Unicode spans", async () => {
  const f = fixture();
  expect(f.tools.has("funding-facts-submit")).toBe(true);
  await expect(f.submit()).rejects.toThrow();
  await f.context();
  for (const facts of [{}, {
    ...f.input.facts,
    eligibility: "yes"
  }, {
    programName: {
      quote: "Community awards",
      span: {
        start: 3,
        end: 19
      }
    }
  }, {
    programName: {
      quote: "Community awards",
      span: {
        start: 2,
        end: 18,
        extra: true
      }
    }
  }]) await expect(f.submit({
    ...f.input,
    facts
  })).rejects.toThrow();
  f.candidate.sourceHash = "d".repeat(64);
  await expect(f.submit()).rejects.toThrow();
  f.candidate.sourceHash = "a".repeat(64);
  delete f.candidate.sourceIdentityReceiptId;
  await expect(f.submit()).rejects.toThrow();
  f.setCurrent(null);
  await expect(f.submit()).rejects.toThrow();
  expect(f.calls()).toBe(0);
});
it("rejects tampered receipt bindings before native delivery", async () => {
  const f = fixture();
  expect(f.tools.has("funding-facts-submit")).toBe(true);
  await f.context();
  const original = f.bridge.assessFundingFacts;
  for (const bad of [{
    sourceIdentityReceiptId: "wrong"
  }, {
    corroboratingHash: "d".repeat(64)
  }, {
    runId: "other"
  }, {
    fit: "eligible"
  }, {
    adapterActivated: true
  }]) {
    f.bridge.assessFundingFacts = async (i: any) => ({
      ...await original(i),
      ...bad
    });
    await expect(f.submit()).rejects.toThrow();
  }
  expect(f.alerts.size).toBe(0);
});
it("keeps missing facts in agent diligence and cannot reset the same run time budget", async () => {
  const f = fixture();
  expect(f.tools.has("funding-facts-submit")).toBe(true);
  await f.context();
  f.assessed.urgent = null;
  f.assessed.deadline = null;
  f.assessed.benefit = null;
  await f.submit({
    ...f.input,
    facts: {
      programName: f.input.facts.programName
    }
  });
  expect(f.alerts.size).toBe(0);
  expect([...f.docs.values()].some(d => d.body.includes("Next agent action:"))).toBe(true);
  f.advance();
  await f.context();
  await expect(f.submit()).rejects.toThrow(/budget/);
});
it("supersedes prior facts in continuation without accumulating stale assessment rows", async () => {
  const f = fixture();
  await f.context();
  await f.submit();
  f.assessed.materialEventKey = "e".repeat(64);
  f.assessed.deadline = null;
  f.assessed.urgent = null;
  f.assessed.status = "historical_cycle";
  await f.submit();
  const c = JSON.parse((await readNativeDocument(f.ctx.issues.documents, "objective", "funding-discovery-continuation", "company"))!.body);
  expect(c.result.preliminary).toHaveLength(1);
  expect(c.result.preliminary[0].brief.materialEventKey).toBe("e".repeat(64));
  expect([...f.docs.values()].some(d => d.body.includes("prior deadline alert is no longer current"))).toBe(true);
});
it("binds assessed title and exact fact quotations before delivery", async () => {
  const f = fixture();
  await f.context();
  const original = f.bridge.assessFundingFacts;
  for (const change of [
    (p: any) => {
      p.title = "Unrelated award";
    },
    (p: any) => {
      p.sponsor = "Different sponsor";
    },
    (p: any) => {
      p.deadlineAssessment.quote = "Unrelated deadline";
    },
    (p: any) => {
      p.benefit.quote = "Unrelated benefit";
    },
    (p: any) => {
      p.benefit.kind = "per_award";
      p.benefit.minimum = 5000;
      p.benefit.maximum = 5000;
      p.value = {
        minimum: 5000,
        maximum: 50000,
        currency: null,
        quotes: [p.benefit.quote]
      };
    },
  ]) {
    f.bridge.assessFundingFacts = async (i: any) => {
      const result = structuredClone(await original(i));
      change(result.preliminary);
      return result;
    };
    await expect(f.submit()).rejects.toThrow();
  }
  expect(f.alerts.size).toBe(0);
});
it("does not deliver an assessment revoked between admission and host completion", async () => {
  const f = fixture();
  await f.context();
  const assess = f.bridge.assessFundingFacts;
  f.bridge.assessFundingFacts = async (i: any) => {
    const receipt = await assess(i);
    f.setCurrent(null);
    return receipt;
  };
  await expect(f.submit()).rejects.toThrow(/no longer current/);
  expect(f.alerts.size).toBe(0);
  expect([...f.docs.values()].some(d => d.title.startsWith("Preliminary funding opportunity"))).toBe(false);
});
it("reauthorizes a pending same-event alert from a fresh capture before retiring the old capture", async () => {
  const f = fixture();
  let suppressed = false, accepted = false;
  const attempted: string[] = [];
  f.binding.humanAlerts.deliver = async (v: any) => {
    attempted.push(v.sourceRef.captureId);
    if (v.sourceRef.captureId === "capture" && attempted.length > 1) suppressed = true;
    if (v.sourceRef.captureId === "fresh" && !suppressed) accepted = true;
    return {
      state: suppressed ? "suppressed" : accepted ? "accepted" : "pending"
    };
  };
  await f.context();
  await f.submit();
  const fresh = structuredClone(f.candidate);
  fresh.captureId = "fresh";
  fresh.sourceIdentity.captureId = "fresh";
  fresh.sourceIdentity.reviewReceiptId = "fresh-identity";
  fresh.sourceIdentityReceiptId = "fresh-identity";
  const current = {
    candidate: fresh,
    preliminary: [f.assessed]
  };
  f.setCurrent(current);
  f.bridge.readCapture = async (id: string) => id === "fresh" ? current : null;
  f.input.captureId = "fresh";
  await f.tools.get("funding-diligence-context")({
    binding: "dao",
    captureId: "fresh"
  }, f.run);
  await f.submit();
  expect(suppressed).toBe(false);
  expect(accepted).toBe(true);
  expect(attempted).toEqual(["capture", "fresh"]);
});
it("shares one reviewer run time budget across different captures", async () => {
  const f = fixture();
  await f.context();
  f.advance();
  f.candidate.captureId = "second";
  f.candidate.sourceIdentity.captureId = "second";
  f.input.captureId = "second";
  await f.tools.get("funding-diligence-context")({ binding: "dao", captureId: "second" }, f.run);
  await expect(f.submit()).rejects.toThrow(/budget/);
  expect(f.calls()).toBe(0);
});
