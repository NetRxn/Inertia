# Native trusted-central funding composition

This adapter is a separate, default-disabled native surface. It does not expand PublicAgentService, member MCP tools, public reviewer scope, final application acceptance or external submission. It composes existing SQL/domain services; it adds no identity database, grant ledger, vault, scheduler or grant engine.

## Authority and data

The host supplies the actual authenticated ToolRunContext. Inertia uses the shared native task validator to check current company, project, configured agent/issue, assignment, running run, active assignee and checkout before and after claiming checkout. The model supplies no identity, database, company, applicant, match or grants.

The administrator owns a pinned, credential-private configuration for one company/database/applicant/match/project and a list of exact central/reviewer grants. A grant is disabled unless enabled explicitly. It names principal, agent, issue, role, operation allowlist, field keys, question keys, exact document IDs, document classifications, audiences and verified relationship-owner entity IDs. Empty lists deny access; no wildcard or fallback authorizer exists. The stdio child reloads and hashes the original configuration on every grant lookup. Configuration edits, including revocation, invalidate the active process and require the host's updated pins on the next configured run.

The workspace starts with the existing public allowlist projection and adds only freshly allowed Phase2Repository fields/document facts/questions and source-linked KnowledgePrincipal selection. It never copies opaque packet narratives, accepted answers, document metadata or financial blobs. Source versions must be current, available, clean, unexpired and public-redacted when applicable. Fields/questions require explicit key grants; accepted answers additionally require allowed document references. Partner reads use FundingPartnerReads and fresh GraphPrincipal scope, including exact source-version IDs. Mid-read grant/source changes withhold the output.

GraphPrincipal adds one keyword-only optional source_version_ids tuple. None preserves existing callers; an explicit empty tuple denies every source. Central always supplies an explicit tuple. SQL filters evidence bindings by permitted source IDs, then checks the hydrated source scope and source-column/payload integrity before emitting any assertion. Mixed-source nodes do not inherit attributes from a forbidden source. Persisted research-query receipts cannot restore a revoked source set, including idempotent delta replay.

## Tools and existing durable data

- central_funding_workspace: no arguments. Returns permitted context and exact workspace hash.
- save_central_funding_proposals: workspace_hash and proposals. Reuses CodexAgentService validation/storage; suggestions remain suggested and human_acceptance is not_accepted. No review_suggestion acceptance route is exposed.
- central_funding_partners: operation partners, context, role_evidence or introduction, plus that existing read's bounded parameters. No model-supplied owners, scope or SQL.
- central_funding_knowledge: operation query, candidate, propose, admit, review or revoke, plus bounded operation parameters. All persistence uses OrganizationKnowledge and WorkbenchAuditEvent.
- import_central_financial_fixture: configured import_id only. No raw financial data, paths, accounts or credentials are model arguments.

Knowledge propose takes an exact source-linked KnowledgeRecord and always creates/deduplicates a candidate. Query returns only currently reusable records/conflicts. Candidate accepts either record_id or a pending review request_id; request lookup checks the full native company/project/applicant/match and reviewer before returning private source data.

For autonomous attributable facts/resources, a producer grant names reviewer_principal_id and review_policy_id. Admission first records a deterministic reference in the existing domain audit and dispatches a configured native reviewer. Native documents contain only server-computed request/evidence hashes and revision numbers, never producer-chosen identifiers, quotations, titles or values. The reviewer reads the protected candidate, evaluates exact quote, attribution, semantic kind and scope, and records its own authenticated, independently bound review. The producer retries admission; the existing admit_knowledge function consumes the exact current source/revision/hash and reviewer receipt once. Admission/retry rechecks all current grants, source fingerprint and scope. A rejected review gives the existing source-correction/adopted-decision path instead of manufacturing authority.

A source-policy review cannot admit proposed/negated statements or turn priorities, decisions and commitments into facts. Those require the existing configured authoritative adopted-decision/human admission mechanism. Optional exact administrator policies remain available for already evaluated authoritative evidence; the normal fact/resource loop does not require per-fact operator configuration. Revocation requires an exact current configured policy. Corrections use new source-linked proposals and existing supersedes_id semantics, preserving old records and invalidating dependent reuse. No new correction engine exists.

## Financial fixture boundary

Only explicitly synthetic administrator-pinned sanitized-quickbooks-profit-and-loss-v1 reports are accepted. This is not the QuickBooks API schema. The import verifies canonical report hash, explicit source-company mapping, accounting period/basis/currency and exact reconciliation using the existing normalizer. The original synthetic source and import receipt are retained in the existing audit, with existing restricted ApplicantDocument/Version/Fact rows and candidate knowledge. Repeated imports compare the normalized pinned source, durable result and current source facts; drift fails closed.

The import returns reported income/expenses/net income, explicitly not available cash, grant budget, match or spending authority. It performs no API call, OAuth flow, account access, purchase, acceptance or submission. Review/admission is separate. Financial values never enter native review documents or public/member workspace output.

## Configuration and qualification

Use trusted_central_stdio.py --config /absolute/admin-config.json through the existing bounded pinned child-process contract. The config contains database_url plus CentralConfiguration fields. Install the exact package/source revision and pin the entrypoint, configuration and complete imported application-code closure (or an immutable verified package deployment). Never expose this administrator file or database URL as a tool argument. Production deployment must retain the DFW-owned isolated PostgreSQL schema/search path and role; this adapter does not migrate or provision them.

Source/fixture qualification uses synthetic SQLite data, real separate Python processes and the shared Node/Python duplex bridge. Native host tests use synthetic authenticated host contexts to exercise denial/reassignment/revocation. These are not live-model qualification, production grants, PostgreSQL concurrency qualification or evidence of runtime activation. Native and domain stores are not a cross-store atomic transaction; the bounded runner keeps its durable caller owner until an already-started callback settles and reports uncertain outcomes rather than claiming cancellation.

Current central proposal targets are sponsor/draft answers, narratives, partner strategy and outcome metrics. Budget inputs require separately grounded, claim-specific approved operands; imported P&L observations do not supply them. Final applications remain unaccepted.
