# Native public drafting adapter

This default-disabled application adapter binds the existing three public DFW drafting operations to Paperclip's authenticated plugin tool path. It does not modify the Paperclip core gateway, expose the operator MCP, provision credentials, create connections, or submit/accept application content.

## Trusted composition

Enable `publicDrafting` only after separately admitting the connection, native tool policy, and database access. This release supports one enabled company binding in the plugin instance. Server configuration fixes the company (native config owner), project, applicant, match, producer issue/agent/principal, reviewer issue/agent/principal, and administrator-pinned process. In legacy mode the two issue IDs, native agents and mapped principals must each differ. The explicit native-attention mode below permits a shared issue while retaining independent agents and mapped principals. Both agents may use the same available model provider; independent principals and native runs are still mandatory.

The gateway provides `{agentId, runId, companyId, projectId}` separately from model arguments. It does not provide `issueId`. Every synchronous private context request therefore rechecks current configuration, configured issue company/project/assignee/status, the exact running run returned by `getSubtree(..., {includeActiveRuns:true, includeAssignees:true})`, and active assignee status before calling `assertCheckoutOwner`. That checkout operation can adopt stale ownership, so it is not used as authentication. Missing/truncated run membership fails closed.

Tools:

- `funding_drafting_workspace({})`
- `save_funding_proposals({workspace_hash, proposals})`
- `save_funding_gap_progress({workspace_hash, progress, previous_hash?})`
- `review_funding_candidate({request_id, artifact})`, only for the separately configured reviewer

No tool accepts company, database, applicant, match, native issue, principal, run, role, command, file path, or transport configuration. The private existing domain layer continues to check public evidence, requirement/evidence/candidate hashes, exact workspace freshness, and producer/reviewer independence. Outputs remain proposals, never accepted answers or submissions.

## Configuration shape

`publicDrafting` has `enabled` (defaults false), `projectId`, `applicantSlug`, `matchId`, `producer`, `reviewer`, and `process`. Each actor has exactly `issueId`, `agentId`, and `principalId`.

The process has `executable`, `args`, `cwd`, `entrypoint`, `configurationPath`, `pins`, `timeoutMs`, and `maxOutputBytes`. Paths are absolute. Both `entrypoint` and `configurationPath` must occur in `args` and have exact SHA-256 pins. Use the fixed Python environment and absolute private `public_drafting_stdio.py` entrypoint with `--config` and the pinned administrator JSON. The private config contains exactly `database_url`, `company_id`, `applicant_slug`, and `match_id`; its scope must agree with every fresh native callback. Do not mount the same DFW database under another company. Database schema/setup is an operator prerequisite, not performed by this adapter.

Pin the deployed Python package/dependencies and every relevant bootstrap/config file, not only the example entrypoint. A source checkout, mutable virtual environment, or caller-controlled PYTHONPATH is not a production trust boundary. The process inherits the trusted plugin worker's environment, never an agent-selected environment. Keep database credentials only in the authorized private configuration, outside repository/model-visible files.

## Native attention producer mode

`nativeAttention: true` is an administrator-only, optional literal opt-in; absence
retains legacy behavior. It is mutually exclusive with enabled
`nativeCaseProgression`, `nativeDependencyHandoff` and `nativeGapPlanReview`.
The configured producer and reviewer may share a native issue only in this mode;
agent IDs and mapped domain principals must still differ. Mode/configuration
changes revoke current calls rather than switching controllers mid-operation.

The four producer tools authenticate the current native assignee, active run,
company, project and exact execution ownership through read-only SDK reads. They
do not adopt checkout, change status/dependencies, freeze a producer run, reopen
review work or request any native wake. Trusted `fundingExecution` metadata is
mandatory, with the existing per-tool 120/160/170-second deadlines unchanged.
The paired native-role metadata resolver must therefore be installed before this
mode can operate; no absence fallback or model-supplied metadata is accepted.

A private candidate callback returns only its exact `PendingReview` acknowledgement
after fresh producer validation. The native producer must request attention using
`paperclip_finish`; native Paperclip then admits the independent reviewer and owns
correction/continuation. The two direct reviewer plugin handlers fail closed with
native-review guidance in this mode. The separate trusted review bridge must bind
the actual native participant/card/decision and admitted structured domain review;
this producer mode does not fabricate a verdict or human acceptance.

`funding_drafting_checkpoint` reads the existing public workspace/packet and saves
a bounded **business checkpoint** through the supported native document API. It
does not call the private case/freeze protocol or change native lifecycle. Existing
lease/write fencing and immutable domain/native history remain. Qualify the paired
composition and disable/reconcile legacy dispatch before admitting a replacement;
this source opt-in is not evidence of live activation or autonomous execution.

## Bounded protocol and continuation

One child serves one operation. The initial frame contains protocol version `dfw-public-drafting-v1`, operation and strict parameters only. The child may request sequential `context` frames (fresh native authorization) and `review` frames (native dispatch); the parent returns context or explicit pending, not a forged completed reviewer. The child ends with one result frame. There is no general RPC or persistent subprocess.

Limits: initial request 128 KiB; each frame at most 1 MiB; at most 1,024 callbacks; configured combined stdout limit 1 KiB–4 MiB; stderr capped at 64 KiB; process deadline 100 ms–120 seconds including pin verification. No shell interpolation. Invalid sequence, concurrent callbacks, trailing output, byte overflow, child failure or timeout fails closed. Timeout kills the child and marks any mutation outcome unconfirmed; retry the same domain operation, not a new guessed request. Child diagnostics are not returned to models. A deadline aborts future callback work, but cannot cancel an already-started native RPC. Durable ownership is retained until both the child has closed and the outstanding callback settles; a never-settling RPC remains fail-closed rather than releasing ownership on a timer.

A saved candidate links to the existing suggestion before review dispatch. The reviewer gets an immutable native issue document containing only public work plus a wake with `idempotencyKey=request_id`. Pending returns promptly. Native document JSON is not reviewer identity proof. The reviewer completion tool authenticates its own current run and the private domain admits an authoritative `CandidateReviewRecord`. Only then does the host wake the configured producer using `dfw-public-review-completed:<request_id>`. Wake retries reuse these native keys; the existing candidate/suggestion/review rows provide domain idempotency. There is no new coordinator or task ledger. Optional gap-plan review and automatic repair remain disabled in this adapter.

Task setup must allow that review before producer completion. The reviewer can
retain the producer as its native parent, but must not have a `blockedBy`
completion dependency on that producer while the producer awaits review. That
cycle causes the native scheduler to reject review wakes as
`issue_dependencies_blocked`. Check fresh native issue readbacks with the existing
[offline task-binding preflight](../scripts/funding-native-run/README.md#independent-reviewer-dependency-prerequisite)
before waking review. An authorized operator may remove only that task-owned
edge through the supported task UI/API, preserving parent hierarchy, unrelated
dependencies and all security/recovery holds. No adapter code rewrites the graph,
marks the producer complete, or bypasses exact candidate/run/role authorization.

The domain record remains authoritative if a response or wake is lost. Retrying the original proposal consumes the stored review. An identical completion replay by the configured reviewer can recover the producer wake without rewriting the original review identity; changed artifacts, wrong principals and stale workspace evidence are rejected.

## Qualification boundary

Focused tests cover roles, forged parameters, current native assignment/run/config checks, ordering before checkout adoption, pending/retry keys, strict protocol bounds and child cleanup. The source qualification harness invokes the actual pinned gateway, plugin registry and SDK worker dispatch over isolated native database fixtures and real DFW service operations. Any model judgment and native wake scheduler used by those tests are explicitly fixtures. These tests are not a claim of live two-agent model execution, deployment, connection activation, or expanded access. A separately authorized preproduction run must still verify those live boundaries.

## Command-free native funding route

The pinned native `paperclip-self` MCP tools list assigned issues and return issue/plan metadata; they do not read issue-document bodies or mutate task state. Hardened Docker Codex command execution can fail at nested Bubblewrap. Do not weaken that sandbox, enable shell, or describe this bounded route as general command-based functionality.

After separately authorized deployment and plugin tool delivery, the complete bounded route is MCP-only:

1. Alpha calls `funding_drafting_workspace({})`, then `save_funding_proposals(...)` using the returned strict contract. The workspace now includes the authoritative current public `packet`, including saved candidates, review state and remaining gaps.
2. Beta calls `funding_review_context({})` to discover at most 100 pending current requests, or supplies one exact `request_id`. Each response reconstructs exact candidate/requirement/evidence hashes and the complete strict review contract from DFW rows. Editable issue document identity is never authority. Beta calls `review_funding_candidate(...)` with its judgment.
3. The host publishes the authoritative review receipt and idempotently wakes Alpha. Exhausted review work moves Beta's configured task to `in_review`; additional pending review work leaves it `in_progress`.
4. Alpha reloads `funding_drafting_workspace({})` to see the durable reviewed packet without shell, REST, a document reader, or remembered original proposal arguments. After the bounded preparation is ready for handoff, Alpha calls `funding_drafting_checkpoint({})`. The host publishes a canonical immutable checkpoint and sets its configured task to `blocked` while independent reviews remain pending, otherwise `in_review`. Remaining evidence gaps stay visible; `in_review` means preparation handed off, not an approved or submitted application.

Save and gap operations also automatically publish canonical result checkpoints. No tool accepts arbitrary issue IDs, status, document body, actor identity, or database scope. All native mutations derive from verified domain results and the current server-mapped task. Native snapshot bodies honor the pinned 524,288-character limit. They omit repeated raw evidence and include an exact full-packet digest; unusually large saved drafts use explicitly labeled bounded previews with exact full-value hashes and a pointer to the fresh workspace, never silent truncation. The existing task serialization owns snapshot publication and state transitions.

For exact completed review recovery, `funding_review_context({request_id})` also returns the authoritative `completed_review` artifact for the same configured reviewer; reuse those exact bytes. The host alone supplies the internal replay-only flag, never model arguments. New pending dispatch explicitly reactivates only the configured reviewer task before wake.

Read and strict completion replay may authenticate an `in_review` issue only through the same fresh binding, exact running-run, active-assignee and checkout checks. Ordinary proposal/gap writes stay disabled there; further preparation must be reactivated through the existing native task lifecycle. `done` and `cancelled` remain closed. Tool result/review replays do not create additional DFW effects or human acceptance.

The additional native SDK capability is `issues.update`; it is used only by the host for these canonical handoffs. Enabling or expanding live grants is a separate action. The public six-tool surface is workspace, save proposals, save gap progress, review context, review completion and preparation checkpoint. Web research can complement that route, but it does not provide arbitrary local command execution.

Pinned native status updates clear checkout/execution locks, and checkout admission only accepts `in_progress`. Within the existing task owner, this adapter first validates the exact active native run read-only, freezes any replay-only mode, reactivates only its configured current task through `issues.update`, then asserts checkout before DFW I/O. Pure workspace/context reads restore the prior `blocked`/`in_review` handoff state; completion sets its canonical final state. Failed operations attempt restoration only while current authority still validates, never after revocation/reassignment. This is bounded current-task continuation, not permission to write arbitrary task status.
