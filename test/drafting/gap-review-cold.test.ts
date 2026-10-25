/** Optional real private stdio proof. Native admissions are explicit synthetic host transitions, NOT autonomous scheduler evidence. */
import { expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPublicDraftingBridge } from "../../src/drafting/stdio.js";
import { fixture } from "./fixture.js";

const home = process.env.NATIVE_GAP_DFW_HOME;
const python = process.env.NATIVE_GAP_PYTHON;
it.skipIf(!home || !python)("cold optional gap tool rejects then admits exact public preparation without human acceptance or owner delivery claims", async () => {
  const root = mkdtempSync(join(tmpdir(), "gap-review-cold-"));
  const metadata = JSON.parse(execFileSync(python!, [join(home!, "tests/native_cycle_transport_fixture.py"), root,
    "--dependency-handoff", "--gap-plan-review"], {
    env: { ...process.env, PYTHONPATH: join(home!, "src") + ":" + join(home!, "tests") }, encoding: "utf8",
  }));
  const entrypoint = join(home!, "src/dfw_incentives/native_cycle_stdio.py");
  const configurationPath = metadata.configuration_path;
  const pins = [entrypoint, configurationPath, ...["native_cycle.py", "public_drafting_stdio.py", "public_drafting.py", "gap_actions.py"]
    .map(path => join(home!, "src/dfw_incentives", path))];
  const bridge = createPublicDraftingBridge({ executable: python!, args: [entrypoint, "--config", configurationPath],
    entrypoint, configurationPath, cwd: home!, timeoutMs: 10000, maxOutputBytes: 1048576,
    pins: pins.map(path => ({ path, sha256: createHash("sha256").update(readFileSync(path)).digest("hex") })),
  });
  const f = fixture({ nativeCaseProgression: true, nativeDependencyHandoff: true, nativeGapPlanReview: true });
  f.binding.applicantSlug = "codex-applicant"; f.binding.matchId = "initial-packet";
  f.bridge.call = bridge.call.bind(bridge);
  const subtree = f.ctx.issues.getSubtree;
  f.ctx.issues.getSubtree = async (...args: any[]) => ({ ...await subtree(...args), issueIds: [args[0]],
    relations: { [args[0]]: { blockedBy: args[0] === "producer" ? [{ id: "reviewer", status: f.rows.reviewer.status }] : [], blocks: [] } },
  });
  f.rows.reviewer.status = "done"; f.runs.reviewer = [];
  const outputs: unknown[] = [];
  const call = async (tool: string, args: unknown, run: unknown) => {
    const data = (await f.tools.get(tool)(args, run)).data; outputs.push(data); return data;
  };
  const admitNativeRun = (role: "producer" | "reviewer", runId: string) => {
    const agentId = role === "producer" ? "author" : "critic";
    f.rows[role].status = "in_progress";
    f.runs[role] = [{ id: runId, issueId: role, agentId, status: "running", finishedAt: null }];
    return { companyId: "company", projectId: "project", agentId, runId };
  };
  const reviewArtifact = (request: any, accepted: boolean) => ({
    workspace_hash: request.workspace_hash, progress_hash: request.progress_hash,
    requirement_id: request.progress.requirement_id, rubric_version: "actionable-gap-v1",
    agent_work_remaining: !accepted, preparation_sufficient: accepted,
    source_support_sufficient: accepted, decision_is_precise: true,
    findings: accepted ? [] : ["Prepare a second scoped option from the public evidence."],
    next_step: accepted ? "Ask the eligible owner for the precise missing record." : "Prepare the second scoped option.",
  });

  let producer = f.producer;
  const initial = await call("funding_drafting_workspace", {}, producer);
  const evidenceId = initial.context.evidence[0].id;
  const requirementId = initial.context.official_package.requirements[0].requirement_key;
  const progress = { requirement_id: requirementId,
    attempts: [{ id: "prepare-one", phase: "preparation", outcome: "complete", sources: [evidenceId], finding: "Prepared a synthetic public work outline." }],
    prepared_work: [{ label: "Work outline", content: "Proposed synthetic activities and measurable outcomes.", evidence_ids: [evidenceId] }],
    dependency: { kind: "access", owner: "dao_admin", detail: "The precise adopted record is unavailable in public evidence." },
    human_decision: "Provide the adopted record or decide whether scoped access is appropriate.",
  };
  const saved = await call("save_funding_gap_progress", { workspace_hash: initial.workspace_hash, progress }, producer);
  expect(saved.packet.pending_review_count).toBe(1);
  expect(saved.packet.remaining_work[0].owner).toBe("agent");
  const firstWait = await call("funding_drafting_checkpoint", {}, producer);
  expect(firstWait.disposition).toBe("awaiting_independent_review");
  expect(await call("funding_drafting_checkpoint", {}, producer)).toEqual(firstWait);

  let reviewer = admitNativeRun("reviewer", "run-critic");
  let context = await call("review_funding_gap_plan", { operation: "context" }, reviewer);
  expect(context.kind).toBe("gap_plan"); expect(context.requests).toHaveLength(1);
  let request = context.requests[0];
  expect(request.request_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(request.output_contract.properties.progress_hash).toBeDefined();
  const rejected = await call("review_funding_gap_plan", { operation: "admit", request_id: request.request_id,
    artifact: reviewArtifact(request, false) }, reviewer);
  expect(rejected.review_state).toBe("rework_required"); expect(rejected.pending_review_count).toBe(0);
  expect(f.rows.reviewer.status).toBe("done");
  f.rows.producer.status = "in_progress";
  await expect(call("funding_drafting_workspace", {}, producer)).rejects.toThrow();

  f.runs.reviewer = []; producer = admitNativeRun("producer", "run-author-gap-2");
  const rework = await call("funding_drafting_workspace", {}, producer);
  expect(rework.packet.remaining_work[0].owner).toBe("agent");
  expect(rework.packet.remaining_work[0].action).toBe("complete_review_findings");
  const revised = { ...progress, attempts: [...progress.attempts, { id: "prepare-two", phase: "preparation", outcome: "complete",
    sources: [evidenceId], finding: "Prepared the second synthetic scoped option." }],
    prepared_work: [...progress.prepared_work, { label: "Second option", content: "A second bounded synthetic option.", evidence_ids: [evidenceId] }],
  };
  await call("save_funding_gap_progress", { workspace_hash: rework.workspace_hash, progress: revised, previous_hash: saved.progress_hash }, producer);
  const nextWait = await call("funding_drafting_checkpoint", {}, producer);
  expect(nextWait.selection_id).toBe(firstWait.selection_id);
  reviewer = admitNativeRun("reviewer", "run-critic-gap-2");
  context = await call("review_funding_gap_plan", { operation: "context" }, reviewer);
  expect(context.requests).toHaveLength(1); expect(context.requests[0].request_id).not.toBe(request.request_id);
  request = context.requests[0];
  const accepted = await call("review_funding_gap_plan", { operation: "admit", request_id: request.request_id,
    artifact: reviewArtifact(request, true) }, reviewer);
  expect(accepted.review_state).toBe("handoff_ready");
  f.runs.reviewer = []; producer = admitNativeRun("producer", "run-author-gap-3");
  const prepared = await call("funding_drafting_workspace", {}, producer);
  expect(prepared.packet.pending_review_count).toBe(0);
  expect(prepared.packet.remaining_work[0].action).toBe("resolve_dependency");
  const ownerReady = await call("funding_drafting_checkpoint", {}, producer);
  expect(ownerReady.disposition).toBe("awaiting_owner_input");
  expect(ownerReady.human_acceptance).toBe("not_accepted"); expect(ownerReady.submission).toBe("not_submitted");
  expect(f.tools.size).toBe(7); expect([...f.wakeups.values()].every(w => w.id === "reviewer")).toBe(true);
  expect(JSON.stringify(outputs)).not.toContain("PRIVATE-");
  // An owner-ready receipt is not an eligible-human native interaction or a next-case scheduler proof.
}, 45000);
