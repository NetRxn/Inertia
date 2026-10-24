import { fundingFactsParameters, validateFundingFactEvidence, validateFundingFactsReceipt, type FundingFactsRequest, type FundingFactsReceipt } from "./funding-facts.js";
import { readNativeDocument, writeNativeDocument } from "./documents.js";
import type {
  PluginContext,
  ToolRunContext,
  PluginToolDeclaration,
} from "@paperclipai/plugin-sdk";
import type { createRuntimeOwner } from "../bridge/ownership.js";
import type { DiscoveryBinding } from "./host.js";
import {
  discoveryHash,
  documentHash,
  type DiscoveryBridge,
} from "./service.js";
import type { DeltaReceipt } from "../partners/research.js";
export interface SourceReviewReceipt {
  state: "source_identity_admitted";
  scope: "exact_capture_only";
  captureId: string;
  sourceHash: string;
  sponsorName: string;
  corroboratingCaptureId: string;
  corroboratingHash: string;
  reviewReceiptId: string;
  eligibility: "unknown";
  adapterActivated: false;
  nextAction: string;
}
export interface DiligenceBridge extends DiscoveryBridge {
  assessFundingFacts?(input: FundingFactsRequest): Promise<FundingFactsReceipt>;
  sourceReview?(input: {
    captureId: string;
    expectedSourceHash: string;
    corroboratingCaptureId: string;
    expectedCorroboratingHash: string;
    sponsorName: string;
    quote: string;
    runId: string;
    queryReceiptId: string;
    idempotencyKey: string;
  }): Promise<SourceReviewReceipt>;
  reviewCapture(input: {
    captureId: string;
    expectedSourceHash: string;
    recordId: string;
    quote: string;
    runId: string;
    queryReceiptId: string;
    idempotencyKey: string;
  }): Promise<{
    admitted_claim: "official_program_name_only";
    eligibility: "unknown";
    fit: "unknown";
    captureId: string;
    knowledge_receipt: DeltaReceipt;
    nextAction: string;
  }>;
}
export interface DiligenceBinding {
  issueId: string;
  agentId: string;
  bridge: DiligenceBridge;
}
const quotedFactSchema = {
  type: "object", additionalProperties: false, required: ["quote", "span"],
  properties: { quote: { type: "string", minLength: 1, maxLength: 2000 }, span: {
    type: "object", additionalProperties: false, required: ["start", "end"],
    properties: { start: { type: "integer", minimum: 0 }, end: { type: "integer", minimum: 1 } },
  } },
};
export const diligenceTools: PluginToolDeclaration[] = [
  {
    name: "funding-facts-submit",
    displayName: "Assess exact captured funding facts",
    description: "Independent reviewer submits exact Unicode code-point spans from current fundingEvidence. Source identity is not eligibility or fit. Missing facts remain agent-owned diligence; no adapter or application authorization.",
    parametersSchema: { type: "object", additionalProperties: false,
      required: ["binding", "captureId", "facts"], properties: {
        binding: { type: "string" }, captureId: { type: "string" },
        facts: { type: "object", additionalProperties: false, required: ["programName"], properties: {
          programName: quotedFactSchema, deadline: quotedFactSchema, benefit: quotedFactSchema,
        } },
      },
    },
  },
  {
    name: "funding-source-validation-submit",
    displayName: "Validate a new sponsor identity",
    description:
      "Independent reviewer requests exact-capture source identity admission using a separately qualified official page's exact sponsor hyperlink. No recurring adapter, funding facts, fit or eligibility authority is granted.",
    parametersSchema: {
      type: "object",
      properties: {
        binding: { type: "string" },
        captureId: { type: "string" },
        corroboratingCaptureId: { type: "string" },
        sponsorName: { type: "string", maxLength: 128 },
        quote: { type: "string", maxLength: 2000 },
      },
      required: [
        "binding",
        "captureId",
        "corroboratingCaptureId",
        "sponsorName",
        "quote",
      ],
      additionalProperties: false,
    },
  },
  {
    name: "funding-diligence-context",
    displayName: "Inspect captured funding identity",
    description:
      "Independent assigned diligence agent reads current captured official evidence and queries saved knowledge. No eligibility inference.",
    parametersSchema: {
      type: "object",
      properties: {
        binding: { type: "string" },
        captureId: { type: "string" },
      },
      required: ["binding", "captureId"],
      additionalProperties: false,
    },
  },
  {
    name: "funding-diligence-submit",
    displayName: "Admit exact official funding identity",
    description:
      "Independent assigned agent requests narrowly source-validated identity admission. Server enforces exact source rule/hash and reviewer policy; no fit or eligibility claim.",
    parametersSchema: {
      type: "object",
      properties: {
        binding: { type: "string" },
        captureId: { type: "string" },
        recordId: { type: "string" },
        quote: { type: "string", maxLength: 2000 },
      },
      required: ["binding", "captureId", "recordId", "quote"],
      additionalProperties: false,
    },
  },
];
export function registerDiscoveryDiligence(
  ctx: Pick<PluginContext, "tools" | "issues">,
  bindings: DiscoveryBinding[],
  owner: Pick<ReturnType<typeof createRuntimeOwner>, "own">,
  completeFacts?: (binding: DiscoveryBinding, run: ToolRunContext, captureId: string) => Promise<void>,
  clock = Date.now,
) {
  function params(value: unknown, submit = false, source = false) {
    const keys = source
      ? [
          "binding",
          "captureId",
          "corroboratingCaptureId",
          "sponsorName",
          "quote",
        ]
      : submit
        ? ["binding", "captureId", "recordId", "quote"]
        : ["binding", "captureId"];
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.keys(value).some((k) => !keys.includes(k))
    )
      throw Error("Invalid diligence request");
    const p = value as Record<string, string>;
    if (
      keys.some(
        (k) =>
          typeof p[k] !== "string" ||
          !p[k]!.trim() ||
          p[k]!.length > (k === "quote" ? 2000 : 128),
      )
    )
      throw Error("Invalid diligence request");
    return p;
  }
  async function authorize(
    b: DiscoveryBinding | undefined,
    run: ToolRunContext,
  ) {
    if (
      !b?.diligence ||
      b.enabled !== true ||
      (b.authorize && !(await b.authorize())) ||
      b.agentId === b.diligence.agentId ||
      b.issueId === b.diligence.issueId ||
      run.companyId !== b.companyId ||
      run.projectId !== b.projectId ||
      !run.runId ||
      run.agentId !== b.diligence.agentId
    )
      throw Error("Independent diligence actor denied");
    const d = b.diligence,
      row = await ctx.issues.get(d.issueId, b.companyId);
    if (
      !row ||
      row.id !== d.issueId ||
      row.companyId !== b.companyId ||
      row.projectId !== b.projectId ||
      row.assigneeAgentId !== d.agentId ||
      ["done", "cancelled"].includes(row.status)
    )
      throw Error("Independent diligence issue unavailable");
    await ctx.issues.assertCheckoutOwner({
      issueId: d.issueId,
      companyId: b.companyId,
      actorAgentId: run.agentId,
      actorRunId: run.runId,
    });
    return b as DiscoveryBinding & { diligence: DiligenceBinding };
  }
  const key = (runId: string, captureId: string) =>
    "funding-diligence-query-" + documentHash([runId, captureId]);
  for (const declaration of diligenceTools)
    ctx.tools.register(declaration.name, declaration, async (value, run) => {
      const factsSubmission = declaration.name === "funding-facts-submit";
      const factsParams = factsSubmission ? fundingFactsParameters(value) : undefined;
      const source = declaration.name === "funding-source-validation-submit",
        submit = factsSubmission || source || declaration.name === "funding-diligence-submit",
        p = factsParams ? { binding: factsParams.binding, captureId: factsParams.captureId } : params(value, submit, source);
      const b = await authorize(
          bindings.find((b) => b.key === p.binding),
          run,
        ),
        d = b.diligence;
      const result = await owner.own(
        {
          companyId: b.companyId,
          namespaceScope: "inertia:funding-discovery",
          key: discoveryHash([b.organizationId, b.issueId]),
        },
        async () => {
          await authorize(b, run);
          if (!d.bridge.readCapture)
            throw Error("Current capture reader unavailable");
          const current = await d.bridge.readCapture(p.captureId!);
          if (!current || current.candidate.captureId !== p.captureId)
            throw Error("Capture stale or unavailable");
          const runId = discoveryHash([
            b.organizationId,
            b.issueId,
            run.runId,
            p.captureId,
            "independent",
          ]);
          if (!submit) {
            const saved = await d.bridge.knowledge.begin(runId, {
              capabilities: b.capabilities,
              project_id: b.projectId,
            });
            if (!saved.query_receipt_id)
              throw Error("Missing independent query receipt");
            await authorize(b, run);
            const budgetKey = "funding-review-budget-" + documentHash(run.runId);
            const budget = await readNativeDocument(ctx.issues.documents, d.issueId, budgetKey, b.companyId);
            const startedAt = budget ? JSON.parse(budget.body).startedAt : clock();
            if (!Number.isFinite(startedAt)) throw Error("Invalid independent run budget");
            await writeNativeDocument(ctx.issues.documents, {
              issueId: d.issueId, companyId: b.companyId, key: budgetKey,
              body: JSON.stringify({ runId: run.runId, startedAt }),
              format: "markdown", title: "Independent funding review run budget",
            });
            await writeNativeDocument(ctx.issues.documents, {
              issueId: d.issueId,
              companyId: b.companyId,
              key: key(run.runId, p.captureId!),
              body: JSON.stringify({
                runId,
                captureId: p.captureId,
                sourceHash: current.candidate.sourceHash,
                queryReceiptId: saved.query_receipt_id,
                startedAt,
              }),
              format: "markdown",
              title: "Independent funding diligence query",
            });
            return {
              current,
              saved,
              nextAction:
                "After source identity admission, use funding-facts-submit with exact fundingEvidence Unicode code-point half-open spans for program name and available deadline/benefit. For deadline and benefit, select the entire claimUnits span so qualifiers are not omitted. Unknown facts remain your diligence work, not a human-only queue. For awaiting_source_validation, corroborate using a separately captured qualified official hyperlink and funding-source-validation-submit. Otherwise verify explicit source-rule identity evidence against captured public text. Submit only the exact named-program quote through funding-diligence-submit. This narrow admission does not assess fit or eligibility; continue those separate evidence tasks with authorized tools.",
            };
          }
          const doc = await readNativeDocument(
            ctx.issues.documents,
            d.issueId,
            key(run.runId, p.captureId!),
            b.companyId,
          );
          if (!doc)
            throw Error("Query current captured knowledge before admission");
          const q = JSON.parse(doc.body);
          if (
            q.runId !== runId ||
            q.captureId !== p.captureId ||
            q.sourceHash !== current.candidate.sourceHash ||
            !q.queryReceiptId ||
            (!source && !factsSubmission &&
              !current.candidate.records.some((r) => r.recordId === p.recordId))
          )
            throw Error("Independent source binding changed");
          await authorize(b, run);
          if (factsParams) {
            if (!Number.isFinite(q.startedAt) || clock() >= q.startedAt + (b.runBudgetMs ?? 120_000))
              throw Error("Independent funding facts run budget exhausted");
            validateFundingFactEvidence(current.candidate, factsParams.facts);
            const bridge = d.bridge.withDeadline?.(q.startedAt + (b.runBudgetMs ?? 120_000)) as DiligenceBridge | undefined ?? d.bridge;
            if (!bridge.assessFundingFacts) throw Error("Funding facts assessment unavailable");
            const request: FundingFactsRequest = {
              captureId: p.captureId!, expectedSourceHash: q.sourceHash,
              sourceIdentityReceiptId: current.candidate.sourceIdentityReceiptId!,
              runId, queryReceiptId: q.queryReceiptId,
              idempotencyKey: discoveryHash([runId, p.captureId, q.sourceHash, current.candidate.sourceIdentityReceiptId, factsParams.facts]),
              facts: factsParams.facts,
            };
            const receipt = await bridge.assessFundingFacts(request);
            validateFundingFactsReceipt(receipt, request, current.candidate);
            await authorize(b, run);
            await writeNativeDocument(ctx.issues.documents, {
              issueId: d.issueId, companyId: b.companyId,
              key: "funding-facts-receipt-" + documentHash([runId, p.captureId, receipt.assessmentReceiptId]),
              body: JSON.stringify(receipt), title: "Exact-capture funding facts assessment", format: "markdown",
            });
            if (completeFacts) await completeFacts(b, run, p.captureId!);
            return receipt;
          }
          if (source) {
            if (!d.bridge.sourceReview)
              throw Error("Source validation unavailable");
            const corroborating = await d.bridge.readCapture(
              p.corroboratingCaptureId!,
            );
            if (
              !corroborating ||
              corroborating.candidate.captureId !== p.corroboratingCaptureId
            )
              throw Error("Corroborating capture unavailable");
            const receipt = await d.bridge.sourceReview({
              captureId: p.captureId!,
              expectedSourceHash: q.sourceHash,
              corroboratingCaptureId: p.corroboratingCaptureId!,
              expectedCorroboratingHash: corroborating.candidate.sourceHash,
              sponsorName: p.sponsorName!,
              quote: p.quote!,
              runId,
              queryReceiptId: q.queryReceiptId,
              idempotencyKey: discoveryHash([
                runId,
                p.captureId,
                q.sourceHash,
                p.corroboratingCaptureId,
                corroborating.candidate.sourceHash,
                p.sponsorName,
                p.quote,
              ]),
            });
            if (
              receipt.state !== "source_identity_admitted" ||
              receipt.scope !== "exact_capture_only" ||
              receipt.captureId !== p.captureId ||
              receipt.sourceHash !== q.sourceHash ||
              receipt.corroboratingCaptureId !== p.corroboratingCaptureId ||
              receipt.corroboratingHash !==
                corroborating.candidate.sourceHash ||
              receipt.sponsorName !== p.sponsorName ||
              receipt.eligibility !== "unknown" ||
              receipt.adapterActivated !== false ||
              !receipt.reviewReceiptId
            )
              throw Error("Source validation receipt mismatch");
            await authorize(b, run);
            await writeNativeDocument(ctx.issues.documents, {
              issueId: d.issueId,
              companyId: b.companyId,
              key:
                "funding-source-receipt-" + documentHash([runId, p.captureId]),
              body: JSON.stringify(receipt),
              title: "Exact-capture source identity receipt",
              format: "markdown",
            });
            return receipt;
          }
          const receipt = await d.bridge.reviewCapture({
            captureId: p.captureId!,
            expectedSourceHash: q.sourceHash,
            recordId: p.recordId!,
            quote: p.quote!,
            runId,
            queryReceiptId: q.queryReceiptId,
            idempotencyKey: discoveryHash([
              runId,
              p.recordId,
              q.sourceHash,
              p.quote,
            ]),
          });
          if (
            receipt.admitted_claim !== "official_program_name_only" ||
            receipt.captureId !== p.captureId ||
            receipt.eligibility !== "unknown" ||
            receipt.fit !== "unknown" ||
            receipt.knowledge_receipt?.run_id !== runId ||
            receipt.knowledge_receipt.query_receipt_id !== q.queryReceiptId
          )
            throw Error("Independent admission receipt mismatch");
          await authorize(b, run);
          await writeNativeDocument(ctx.issues.documents, {
            issueId: d.issueId,
            companyId: b.companyId,
            key:
              "funding-diligence-receipt-" + documentHash([runId, p.recordId]),
            body: JSON.stringify(receipt),
            title: "Official identity admission receipt",
            format: "markdown",
          });
          return receipt;
        },
      );
      if (result === null) throw Error("Funding objective already owned");
      return { data: result };
    });
}
