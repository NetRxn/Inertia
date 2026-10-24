# Join the Inertia sprint

Start with the [sprint index](https://github.com/NetRxn/Inertia/issues/40). It is the live map of priorities, claims, dependencies and contributor-ready work. GitHub issues track repository delivery; Paperclip remains the product's operational task and decision system. Do not build a second task ledger or scheduler.

## Read only what you need

1. Read [README](../README.md), [plan](../plan.md), [spec implementation status](../spec.md#implementation-status) and the [qualification record](../testing.md#qualification-record).
2. Read your issue's linked contract and tests. [Needed from team](../Needed-from-team.md) owns stable NTF input requirements; an input being received does not mean its integration is qualified.
3. Check the current `develop` commit, relevant merged/open PRs and any applicable `AGENTS.md` or repository-local skills before editing. Do not infer current runtime status from an older artifact revision. The sprint index records the checked baseline and the ongoing canonical-artifact sync.

## Claim a bounded slice

- Choose **ready + unclaimed** engineering work, not a blocked team-input request. Read the issue body, assignees and latest claim/status comments, then inspect [open PRs](https://github.com/NetRxn/Inertia/pulls) and their branches.
- Comment: `Claim: <contributor/agent identity> | slice: <exact outcome> | branch: <name> | files: <intended paths> | next checkpoint: <result or blocker>`. Set an assignee only when authorized.
- Re-read claims and PRs before implementation and again immediately before publishing. A claim comment is a coordination signal, **not an atomic lock**. If two claims overlap, resolve ownership with the active contributor before touching shared files.
- Create an isolated feature branch from current `develop`; target `develop`, never force-push or modify `main`. Reuse the existing native/domain contracts rather than introducing parallel models.
- Declare shared source/canonical-document edits in the claim. The index identifies active lanes, including the canonical spec/test/decision/plan/deck/HTML owner; coordinate instead of independently rewriting that set.
- Update only when status changes: **claimed**, **blocked**, **review**, **done**. A blocker names the dependency, exact missing action and next step. If stepping away, explicitly release the claim; do not silently take over a stale-looking claim.

## Implement and verify

Use Node.js **24.11.0+** and the committed lockfile. Read the linked acceptance criteria and repository test instructions first. For behavior changes, capture a failing test, implement, then verify.

From a source checkout:

```sh
npm ci
npm test -- --maxWorkers=1
npm run typecheck
npm run build
```

Run the affected demo (`npm run demo`, `npm run demo:roundtable` or `npm run demo:workflow`) and `npm run test:package` when runtime/package behavior changes. Host-specific work also needs its linked qualification commands, not just the root suite. [Cloud qualification](../scripts/cloud-rehearsal/README.md) documents pinned prerequisites and evidence limits; never replace a missing real-service check with a mock and report it as passed.

## Handoff without ceremony

- Open a draft PR to `develop` with the issue link, scope/non-goals, exact source/head, acceptance checklist, passed/failed/never-run checks and remaining gates. Add the PR link to the issue. Use a closing keyword only for an issue fully completed by that PR.
- Obtain independent review and resolve findings. Publishing, readiness, merging and deployment each follow their applicable authorization; a claim is not approval for those actions.
- At merge or an accepted non-code handoff, update the issue and sprint index. Keep feature completion separate from live qualification; preserve explicit blockers rather than closing a broader activation issue.

## Public and live boundaries

- Public issues contain role owners, stable NTF IDs and protected-reference placeholders only. Never paste credentials, private member/meeting/financial records, runtime captures or private implementation source. Share approved inputs through their protected channel.
- Fixture work does not authorize production routes, credentials/grants, permission changes, enrollment, deployment, migration/cutover, real-data transfer, recurring jobs, external communications, votes or grant submissions. Keep integrations default-disabled until separately qualified and authorized.
- Add a concrete implementation issue when its input contract is ready. Keep the queue small; do not mirror every NTF checklist line or turn GitHub coordination into a new product subsystem.
