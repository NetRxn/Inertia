import {
  renderPreliminaryBrief,
  type PreliminaryBrief,
} from "./preliminary.js";
import { createHash } from "node:crypto";
import { isIP } from "node:net";
import {
  renderOpportunityBrief,
  type OpportunityBrief,
} from "../grants/brief.js";
import {
  runPartnerResearch,
  type ResearchInput,
  type ResearchSource,
} from "../partners/research.js";
export const discoveryHash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
/** Native Paperclip document keys are limited to 64 characters. */
export const documentHash = (value: unknown) =>
  discoveryHash(value).slice(0, 32);
const hex = /^[a-f0-9]{64}$/;
export interface DiscoveryWork {
  organizationId: string;
  objectiveId: string;
  projectId: string;
  runId: string;
  capabilities: string[];
  urls: string[];
  maximumLeads: number;
  deadlineAt?: number;
  clock?: () => number;
}
export interface DiscoveryBrief {
  brief: OpportunityBrief;
  officialSourceHash: string;
  cycleId: string;
  materialRevision: string;
  nextRecheckAt: string;
  /** Trusted domain assessment, never inferred from date-only source by this adapter. */
  urgent: boolean;
  urgency?: { eventId: string; reason: string; asOf: string };
}
export interface DiscoveryCandidate {
  captureId: string;
  sourceId: string;
  sourceDocumentId: string;
  sourceHash: string;
  sourceUrl: string;
  observedAt: string;
  records: Array<{
    recordType: string;
    recordId: string;
    entityId: string | null;
    currentHash: string;
    reviewStatus: string;
    published: boolean;
  }>;
  status:
    | "captured_review_required"
    | "awaiting_source_validation"
    | "source_identity_admitted";
  authority?: "unqualified";
  untrustedEvidence?: { title: string; textExcerpt: string };
  nextAction?: string;
}
export interface DiscoveryBridge {
  withDeadline?(deadlineAt: number): DiscoveryBridge;
  /** Authenticated, organization/project-scoped DFW knowledge service. */
  knowledge: ResearchSource;
  /** URL is an untrusted lead, not official-source authority. Independently fetch, validate and
   * capture it using trusted source policy and existing candidate/enrichment/admission services.
   * Preserve reusable rejected-opportunity evidence. Never trust agent-supplied facts. */
  inspect(
    url: string,
    saved: Awaited<ReturnType<ResearchSource["begin"]>>,
    identity: { runId: string; idempotencyKey: string },
  ): Promise<{
    input: ResearchInput;
    opportunities: string[];
    candidate?: DiscoveryCandidate;
    preliminary?: PreliminaryBrief[];
  }>;
  readCapture?(captureId: string): Promise<{
    candidate: DiscoveryCandidate;
    preliminary: PreliminaryBrief[];
  } | null>;
  /** Current source/audience/packet checks are required on each read, including delivery retries. */
  readBrief(opportunityId: string): Promise<DiscoveryBrief>;
}
export function publicLead(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048)
    throw Error("Invalid public lead");
  const u = new URL(value);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.port ||
    isIP(u.hostname.replace(/^\[|\]$/g, "")) ||
    !u.hostname.includes(".") ||
    /(?:^|\.)(localhost|local|internal|invalid)$/.test(u.hostname)
  )
    throw Error("Invalid public lead");
  u.hash = "";
  return u.href;
}
export function validateDiscoveryBrief(
  value: DiscoveryBrief,
  work: Pick<DiscoveryWork, "organizationId" | "projectId">,
  opportunityId: string,
): string {
  const b = value.brief;
  if (
    b.organization_id !== work.organizationId ||
    b.opportunity_id !== opportunityId ||
    b.audience !== "public" ||
    !b.project_alignment.some((p) => p.project_id === work.projectId)
  )
    throw Error("Discovery brief scope mismatch");
  if (
    !hex.test(value.officialSourceHash) ||
    !hex.test(value.materialRevision) ||
    typeof value.cycleId !== "string" ||
    !value.cycleId.trim() ||
    value.cycleId.length > 255 ||
    !isInstant(value.nextRecheckAt) ||
    typeof value.urgent !== "boolean"
  )
    throw Error("Invalid official assessment");
  if (
    value.urgent &&
    (!value.urgency ||
      !value.urgency.eventId?.trim() ||
      value.urgency.eventId.length > 255 ||
      !value.urgency.reason?.trim() ||
      value.urgency.reason.length > 2000 ||
      !isInstant(value.urgency.asOf))
  )
    throw Error("Missing independently validated urgency");
  return renderOpportunityBrief(b);
}
export function isInstant(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}
export interface DiscoveryResult {
  coverage: "partial";
  candidates: DiscoveryCandidate[];
  preliminary: Array<{
    captureId: string;
    brief: PreliminaryBrief;
    markdown: string;
  }>;
  findings: Array<
    DiscoveryBrief & {
      markdown: string;
      graphRefreshPending: boolean;
      receiptRunId: string;
    }
  >;
  failures: Array<{
    url: string;
    stage: "validation" | "capture_or_writeback" | "brief";
    code: "source_unresolved";
  }>;
  remainingUrls: string[];
}
/** One bounded native work step. This does not claim broad search coverage or activate recurrence. */
export async function runFundingDiscovery(
  work: DiscoveryWork,
  bridge: DiscoveryBridge,
): Promise<DiscoveryResult> {
  for (const v of [
    work.organizationId,
    work.objectiveId,
    work.projectId,
    work.runId,
  ])
    if (typeof v !== "string" || !v.trim() || v.length > 128)
      throw Error("Invalid discovery binding");
  if (
    !Number.isInteger(work.maximumLeads) ||
    work.maximumLeads < 1 ||
    work.maximumLeads > 20 ||
    !Array.isArray(work.urls) ||
    work.urls.length > 100
  )
    throw Error("Unbounded discovery work");
  if (
    !Array.isArray(work.capabilities) ||
    work.capabilities.length > 20 ||
    work.capabilities.some(
      (v) => typeof v !== "string" || !v.trim() || v.length > 255,
    )
  )
    throw Error("Unbounded discovery scope");
  const urls: string[] = [];
  const result: DiscoveryResult = {
    coverage: "partial",
    candidates: [],
    preliminary: [],
    findings: [],
    failures: [],
    remainingUrls: [],
  };
  for (const value of work.urls) {
    try {
      const u = publicLead(value);
      if (!urls.includes(u)) urls.push(u);
    } catch {
      result.failures.push({
        url: "invalid-lead:" + discoveryHash(value),
        stage: "validation",
        code: "source_unresolved",
      });
    }
  }
  result.remainingUrls = urls.slice(work.maximumLeads);
  for (const [index, url] of urls.slice(0, work.maximumLeads).entries()) {
    if (
      work.deadlineAt !== undefined &&
      (work.clock ?? Date.now)() >= work.deadlineAt
    ) {
      result.remainingUrls = [...urls.slice(index)];
      break;
    }
    const key = discoveryHash([
      work.organizationId,
      work.objectiveId,
      work.runId,
      url,
    ]);
    let opportunities: string[] = [];
    let candidate: DiscoveryCandidate | undefined;
    let preliminary: PreliminaryBrief[] = [];
    let persisted: Awaited<ReturnType<typeof runPartnerResearch>>;
    try {
      persisted = await runPartnerResearch(
        bridge.knowledge,
        {
          run_id: key,
          idempotency_key: key,
          query: {
            capabilities: work.capabilities,
            project_id: work.projectId,
          },
        },
        async (saved) => {
          const inspected = await bridge.inspect(url, saved, {
            runId: key,
            idempotencyKey: key,
          });
          if (
            !Array.isArray(inspected.opportunities) ||
            inspected.opportunities.length > 20 ||
            inspected.opportunities.some(
              (id) => typeof id !== "string" || !id.trim() || id.length > 255,
            )
          )
            throw Error("Invalid opportunity binding");
          opportunities = [...new Set(inspected.opportunities)];
          candidate = inspected.candidate;
          preliminary = inspected.preliminary ?? [];
          if (
            !Array.isArray(preliminary) ||
            preliminary.length > 20 ||
            (preliminary.length && !candidate)
          )
            throw Error("Invalid preliminary capture");
          preliminary.forEach((p) => {
            if (
              p.source.sha256 !== candidate?.sourceHash ||
              p.source.documentId !== candidate?.sourceDocumentId
            )
              throw Error("Preliminary source mismatch");
            renderPreliminaryBrief(p);
          });
          return inspected.input;
        },
      );
    } catch {
      result.failures.push({
        url,
        stage: "capture_or_writeback",
        code: "source_unresolved",
      });
      continue;
    }
    if (candidate) {
      result.candidates.push(candidate);
      for (const p of preliminary)
        result.preliminary.push({
          captureId: candidate.captureId,
          brief: p,
          markdown: renderPreliminaryBrief(p),
        });
    }
    for (const id of opportunities) {
      try {
        const current = await bridge.readBrief(id);
        const markdown = validateDiscoveryBrief(current, work, id);
        if (
          !result.findings.some(
            (f) =>
              f.brief.opportunity_id === id &&
              f.materialRevision === current.materialRevision,
          )
        )
          result.findings.push({
            ...current,
            markdown,
            graphRefreshPending: persisted.graph_refresh_pending,
            receiptRunId: persisted.knowledge_receipt.run_id,
          });
      } catch {
        result.failures.push({
          url,
          stage: "brief",
          code: "source_unresolved",
        });
      }
    }
  }
  return result;
}
