# Prepare the native funding and member-request rehearsals

Offline test preparation for existing requirements, not a new product feature, coordinator, dispatcher or runtime. This adds no network calls or dependencies. By default it renders two objective documents and native wake payloads; an explicit candidate stage renders only one selected original objective; Paperclip's existing coordinator owns decomposition, role/capacity assignment, eager acquisition, checkout, shared findings and convergence. Provider assignments stay configurable by role. John's Codex and Claude Code access belongs to one member; two agents do not establish two human members or actual teammate participation.

Source inspected: Inertia develop `00b9ebc5916eb00a617b3831c089a5a237793f66`; DFW main `27736cac6f91b7927a64c4f99b8c861676ccad84`, canonical skill v3.4.1; native CLI `paperclipai` 2026.1012.0. Recheck deployed versions, not just source. DFW's four SQL reads exist; its real current scoped resolver and selected PostgreSQL binding must be supplied by the authorized host. Nothing here installs a fixture resolver or widens access.

## Existing requirement/test mapping

- Funding objective: R-F01–04/R-F06–08, R-K01–08, R-C01–05, R-O01; T-K05/T-K10/T-K12 and T-C01–04. Substantial current research, all supported application sections, independent exact-version critique, actual saved suggestions, useful admitted knowledge and fresh-run reuse.
- General meeting/innovation/problem/bug-bounty request: R-I01–04, R-C01–05 and R-O01; existing objective/funding acceptance and T-C01–04. A bounded researched decision brief or proposed solution, not hello. General work need not involve funding.
- Both use the native CEO/hiring/work-discovery/delegation/checkout baseline already recorded in spec section 2. This package does not implement or qualify missing intake, Buzz, untrusted runner isolation, member confirmation or Mark submitted. A manually seeded request cannot prove website/meeting/Buzz ingestion.

Contributor PR60 owns the generic provenance/measurement validator. PR61 owns its rehearsal surface. Neither is copied, edited, invoked or assumed merged here. Once their owner-approved versions are adopted, use their documented validation separately. The optional checker below checks content coverage only; it never reports qualification.

## Stage selection: full rehearsal or preproduction candidate

`stage: "full"` (also the default when omitted) retains the complete two-provider, two-objective scenario below. Missing Codex/Claude adapters are reported explicitly; a one-provider roster is not a complete scenario.

For bounded single-provider preparation, set `stage: "candidate"` and `objective: "funding"` or `objective: "memberRequest"` in the same non-secret input file:

- Supply at least one actual available agent with its real existing provider, connection, model, workspace and roles. Remove unavailable roster entries rather than inventing credentials or reviewer identities. The existing `coordinatorAgentId` must be in this available roster; it may perform suitable candidate work directly through ordinary native work/checkout. Do not reassign or wake an unavailable coordinator.
- Supply the selected original native objective, all common runtime/member/source/tool/budget inputs, and (for funding only) the real funding profile/match/skill/scope binding. The other objective and its unrelated funding fields are not needed. All supplied source facts must still be fact-only, hashed and status-labeled; source access and actual tool authorization are never relaxed.
- `tools.knowledgeAdmission` and `tools.correctionReplayDenial` are not required for this stage because it stops at research/candidate preparation, with scoped proposal saves only where actually authorized. Preserve useful findings for later trusted admission. Admission/reuse/correction checks are pending outside this stage, not inherently blocked by Claude: single-provider work may exercise them separately when its real trusted admission/review path is available.
- Candidate output explicitly leaves independent review, incorporated collaboration and full two-provider acceptance pending. Do not mark the original objective accepted or make up review/admission/reuse receipts. The full `check` command is unchanged and cannot pass an incomplete candidate packet.

Preparation writes only the selected objective document and `tasks.json`, with `stage: "candidate"` metadata and distinct `candidate-` document/idempotency keys. Full rehearsal keeps its `rehearsal-` keys. These keys distinguish stages, not separate source objectives or duplicate native issues. No configuration choice performs a runtime or provider call.

## 1. Fill the one non-secret input file

Copy `runtime-inputs.example.json` to a protected runtime directory, not into the repository. Nulls are intentionally unresolved. For the default full rehearsal, fill actual existing values (apply the candidate-stage exceptions above only when selected):

- Verified Paperclip API base, company/project, John's authenticated member reference, existing coordinator and objective issue IDs. Keep the two native issues and each agent workspace/history distinct. If objective issues do not exist, the authorized native intake/coordinator must create them and return actual IDs; never invent them.
- At least two existing agents using the selected `codex_local` and `claude_local` adapters. Set their complementary role descriptions (research, partner discovery, assembly, review, member support, as appropriate); roles may share a provider. Include existing approved provider-connection references and actual selected models. `provider.apiBase` is the verified endpoint or the explicit value `adapter-managed` when that adapter owns it. No API keys, tokens, account files or credentials.
- Two original objective texts and origin/source context: a Wednesday meeting or existing objective for funding; a useful bounded member problem/innovation/bug-bounty request. Preserve original text, submitter, audience and source revision in the native intake record. Do not manufacture an intake event or a real member request.
- Existing DFW applicant/profile, exact initial opportunity match, deterministic first packet, canonical enabled skill and real current scope binding. Source facts are `{ref, kind: raw-capture|fact-document|profile, sha256, status: verified|self-published|synthetic|assumed|unknown}`. Reference existing authorized source records; do not copy finished NSF/Park Place narratives or answer keys. Keep those references outside all generation mounts/tool audiences, not merely out of the prompt.
- Actual authorized public search/read tools, current knowledge query, trusted admission action and approved disposable correction/replay/denial procedure. These values are descriptions/references to already-qualified native/domain actions, not new tool names or permissions. A missing private-knowledge admission binding is a real integration dependency; the four partner reads do not implement it. Public discovery `funding-discovery-context/submit` remains public-only and is not a private context/admission substitute.
- Approved wall-clock/cost bounds and up to two rework rounds. Native admission/runtime controls must enforce the bounds. Subscription cost can remain unknown; a configured dollar number cannot manufacture metering. No provider login, credential copy, install, network or permission change is performed here.

```sh
node --test scripts/funding-native-run/run-package.test.mjs
node scripts/funding-native-run/run-package.mjs prepare /protected/runtime-inputs.json /protected/NEW-prepared-directory
```

Exit 1 lists all missing runtime fields and writes nothing. Exit 2 is an invalid input/read/write error. A successful full prepare writes only `funding.md`, `memberRequest.md`, and `tasks.json` (candidate preparation writes only its selected document and `tasks.json`) into a new directory; it never contacts a host or starts a model. The example deliberately does not render until the actual values are supplied.

## 2. Verify the existing runtime before a model run

Run these only in the authorized Docker runtime, with its existing authenticated CLI context. `PAPERCLIP_CLI` is the installed `paperclipai` executable; the other shell variables are copied from the verified input values. Do not use `npx`, `connect`, `local-cli`, token commands, provider-login commands or another machine's hidden session. Those would install or create access, not smoke-check it.

```sh
pc() { "$PAPERCLIP_CLI" "$@" --api-base "$PAPERCLIP_API_URL" --json; }
pc company get "$COMPANY_ID"
pc agent get "$COORDINATOR_AGENT_ID"
pc agent get "$AGENT_ID"
pc agent skills "$AGENT_ID"
pc issue get "$FUNDING_ISSUE_ID"
pc issue get "$MEMBER_REQUEST_ISSUE_ID"
pc issue live-runs "$FUNDING_ISSUE_ID"
pc issue live-runs "$MEMBER_REQUEST_ISSUE_ID"
```

For candidate preparation, inspect only its selected objective and available roster; never smoke or wake an omitted provider. Repeat agent/skill inspection for each supplied agent. Verify actual company/project/assignee, provider adapters, separate workspaces, canonical skill enablement, real scoped MCP inventory and native budget limits. Treat API reachability or installed CLI packages as only that, not provider/tool execution. Preserve sanitized readbacks in protected native documents; do not publish raw configuration/credentials.

One authorized provider smoke for each adapter may verify its real native run/tool invocation. Use the existing native issue/agent UI or approved adapter test flow, not a new subprocess executor. Label the smoke as smoke. For a funding objective (including the full rehearsal), confirm all four funding SQL tool names and workspace/save tools are admitted; invoke only appropriate read calls with real scoped inputs. For a general-member candidate, verify only the tools actually needed by its selected objective, including its authorized knowledge-query and public search/read bindings; do not require unrelated funding workspace/save tools. Scope-unavailable is a blocker, not zero results. Calling the stock MCP may initialize state, so this is a runtime-authorized smoke, not a supposedly inert cloud read.

## 3. Attach objective instructions and launch through native work

Do this only after runtime access and the bounded model run are authorized. For one objective, copy `ISSUE_ID`, `DOCUMENT_KEY`, coordinator `AGENT_ID`, and `IDEMPOTENCY_KEY` from `tasks.json`; `TASK_FILE` is the corresponding prepared Markdown file. These are ordinary existing native commands, not an execution script:

```sh
pc issue documents "$ISSUE_ID"
pc issue document:put "$ISSUE_ID" "$DOCUMENT_KEY" --title "Objective rehearsal inputs" --body-file "$TASK_FILE" --change-summary "Fact-only bounded test inputs"
pc issue document:get "$ISSUE_ID" "$DOCUMENT_KEY"
```

A document key already present must be read and reconciled first. Use the returned exact `--base-revision-id` for an intended update; do not overwrite another revision or repeat an uncertain write blindly. The existing native issue description/intake should instruct its coordinator to read this document before acting. Confirm that via `issue get`; changing assignment/description can wake work, so do not do it as an unapproved setup side effect.

```sh
pc agent wake "$AGENT_ID" --source on_demand --trigger manual --reason "objective rehearsal" --payload "$ISSUE_PAYLOAD_JSON" --idempotency-key "$IDEMPOTENCY_KEY" --force-fresh-session
pc issue runs "$ISSUE_ID"
pc issue live-runs "$ISSUE_ID"
pc issue documents "$ISSUE_ID"
```

`ISSUE_PAYLOAD_JSON` is the exact `tasks.json` `wake.payload` object, e.g. a real issueId supplied by the host, not a fixture value. Do not invoke `heartbeat run` as an alternate unbound launch. In full mode, repeat for the other objective when the existing coordinator/capacity policy admits it; the helper deliberately does not schedule either or manually script every child handoff. Native delegation/claims determine work. On lost wake acknowledgement, inspect native runs/issue state before retry using the same idempotency key. Do not create another issue/run to mask uncertainty.

Observe actual native parent/child issues, checkout claims, separate agent/provider runs, source/tool calls and incorporated outputs before calling the coordination test successful. A two-agent roster or provider smoke alone does not meet that bar. No fixed Codex-writer/Claude-reviewer allocation is required: assign by the configured roles and actual capacity, while ensuring review is independent of the output's author.

## 4. Content check and useful deliverables

Funding deliverables are system-produced current research, complete supported candidate sections, unsent partner preparation, factual/source/gap map, native saved suggestions, independent exact-version critique and fresh admitted-knowledge reuse. Keep original output and corrections separately in native document revisions. Do not replace the system's work with a manually polished reference narrative.

Export the actual `funding_drafting_workspace` result, actual `save_funding_proposals` response and the generated protected packet checklist (fields described in the prepared objective) through the authorized runtime. Feed the inner tool result objects, not an MCP transport envelope. The checklist is local content-review input, not a public receipt or new persistent schema.

```sh
node scripts/funding-native-run/run-package.mjs check /protected/workspace.json /protected/save-response.json /protected/packet-checklist.json
```

Exit 0 means the small coverage/consistency check found no missing supported target/section, unsupported citation, stale/self-approved suggestion, missing exact-version independent critique or missing admission/reuse/correction-test reference. It still sets `qualified: false`. Review actual prose and source passages for entailment, completeness, numeric truth, eligibility and currentness; matching evidence IDs does not prove claim support. Missing admission/reuse evidence can be reported honestly as partial, not converted to a pass. A justified unsupported target stays an explicit gap, not invented prose.

General-member deliverable: a researched decision brief or proposed solution responsive to the original request, sources/options/tradeoffs, incorporated multi-agent contribution, independent review, remaining decisions and scoped next actions. Inspect native claims/dependencies/recovery and actual work; this funding-specific checker is not a general collaboration validator.

Final report distinguishes actual provider/tool execution, deterministic prerequisites, fixtures, source coverage, pending human confirmation and any missing runtime integration. Preserve actual elapsed time, unknown/measured active human time, observed usage/cost and corrections in the existing native records and adopted PR60 receipt format. No automatic submission or human-approval claim.
