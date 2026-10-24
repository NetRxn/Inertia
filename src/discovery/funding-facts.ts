import { createHash } from "node:crypto";
import type { DiscoveryCandidate } from "./service.js";
import { renderPreliminaryBrief, type PreliminaryBrief } from "./preliminary.js";
export interface QuotedFundingFact {
  quote: string;
  span: { start: number; end: number };
}
export interface FundingFacts {
  programName: QuotedFundingFact;
  deadline?: QuotedFundingFact;
  benefit?: QuotedFundingFact;
}
export interface FundingFactsRequest {
  captureId: string;
  expectedSourceHash: string;
  sourceIdentityReceiptId: string;
  runId: string;
  queryReceiptId: string;
  idempotencyKey: string;
  facts: FundingFacts;
}
export interface FundingFactsReceipt {
  state: "funding_facts_assessed";
  scope: "exact_capture_only";
  captureId: string;
  sourceHash: string;
  sourceIdentityReceiptId: string;
  corroboratingCaptureId: string;
  corroboratingHash: string;
  assessmentReceiptId: string;
  materialEventKey: string;
  knowledgeId: string;
  runId: string;
  queryReceiptId: string;
  eligibility: "unknown";
  fit: "unknown";
  adapterActivated: false;
  preliminary: PreliminaryBrief;
}
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
    Object.keys(value).some(k => !keys.includes(k)))
    throw Error("Invalid funding facts request");
  return value as Record<string, unknown>;
}
export function fundingFactsParameters(value: unknown): {
  binding: string; captureId: string; facts: FundingFacts;
} {
  const p = object(value, ["binding", "captureId", "facts"]);
  for (const k of ["binding", "captureId"])
    if (typeof p[k] !== "string" || !p[k].trim() || p[k].length > 128)
      throw Error("Invalid funding facts request");
  const facts = object(p.facts, ["programName", "deadline", "benefit"]);
  if (!facts.programName) throw Error("Program name evidence required");
  for (const v of Object.values(facts)) {
    const fact = object(v, ["quote", "span"]), span = object(fact.span, ["start", "end"]);
    if (typeof fact.quote !== "string" || !fact.quote.trim() || fact.quote.length > 2000 ||
      !Number.isSafeInteger(span.start) || !Number.isSafeInteger(span.end) ||
      (span.start as number) < 0 || (span.end as number) <= (span.start as number))
      throw Error("Invalid funding fact span");
  }
  return p as unknown as { binding: string; captureId: string; facts: FundingFacts };
}
export function validateFundingFactEvidence(candidate: DiscoveryCandidate, facts: FundingFacts): void {
  const evidence = candidate.fundingEvidence, identity = candidate.sourceIdentity;
  if (!candidate.sourceIdentityReceiptId || !identity ||
    identity.reviewReceiptId !== candidate.sourceIdentityReceiptId ||
    identity.captureId !== candidate.captureId || identity.sourceHash !== candidate.sourceHash ||
    identity.state !== "source_identity_admitted" || identity.scope !== "exact_capture_only" ||
    identity.eligibility !== "unknown" || identity.adapterActivated !== false ||
    !evidence || typeof evidence.text !== "string" ||
    evidence.normalization !== "bs4-html-text-space-strip-v1" ||
    evidence.spanUnits !== "unicode_code_points" || evidence.spanConvention !== "half_open" ||
    createHash("sha256").update(evidence.text).digest("hex") !== evidence.sha256)
    throw Error("Current funding identity or evidence unavailable");
  const codePoints = [...evidence.text];
  for (const fact of Object.values(facts)) {
    if (fact.span.end > codePoints.length || codePoints.slice(fact.span.start, fact.span.end).join("") !== fact.quote)
      throw Error("Funding fact does not match exact captured span");
  }
}
export function validateFundingFactsReceipt(receipt: FundingFactsReceipt, request: FundingFactsRequest, candidate: DiscoveryCandidate): void {
  const p = receipt.preliminary;
  if (receipt.state !== "funding_facts_assessed" || receipt.scope !== "exact_capture_only" ||
    receipt.captureId !== request.captureId || receipt.sourceHash !== request.expectedSourceHash ||
    receipt.sourceIdentityReceiptId !== request.sourceIdentityReceiptId ||
    receipt.corroboratingCaptureId !== candidate.sourceIdentity?.corroboratingCaptureId ||
    receipt.corroboratingHash !== candidate.sourceIdentity?.corroboratingHash ||
    receipt.runId !== request.runId || receipt.queryReceiptId !== request.queryReceiptId ||
    receipt.eligibility !== "unknown" || receipt.fit !== "unknown" || receipt.adapterActivated !== false ||
    typeof receipt.assessmentReceiptId !== "string" || !receipt.assessmentReceiptId.trim() ||
    typeof receipt.knowledgeId !== "string" || !receipt.knowledgeId.trim() ||
    !/^[a-f0-9]{64}$/.test(receipt.materialEventKey) ||
    !p || p.title !== request.facts.programName.quote ||
    p.sponsor !== candidate.sourceIdentity?.sponsorName ||
    !p.deadlineAssessment || p.deadlineAssessment.quote !== (request.facts.deadline?.quote ?? null) ||
    !p.benefit || p.benefit.quote !== (request.facts.benefit?.quote ?? null) ||
    (p.deadline && p.deadline.quote !== request.facts.deadline?.quote) ||
    p.assessmentReceiptId !== receipt.assessmentReceiptId ||
    p.materialEventKey !== receipt.materialEventKey || p.source.sha256 !== candidate.sourceHash ||
    p.source.documentId !== candidate.sourceDocumentId || p.source.url !== candidate.sourceUrl)
    throw Error("Funding facts receipt mismatch");
  const benefit = p.benefit!;
  if (benefit.kind.startsWith("per_award")) {
    if (!p.value || p.value.minimum !== benefit.minimum || p.value.maximum !== benefit.maximum ||
      p.value.quotes.length !== 1 || p.value.quotes[0] !== benefit.quote)
      throw Error("Funding facts benefit/value mismatch");
  } else if (p.value !== null) throw Error("Non-award benefit cannot become award value");
  renderPreliminaryBrief(p);
}
