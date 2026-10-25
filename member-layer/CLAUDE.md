# Working rules for the member-layer branch

This branch holds Kyle's member-facing work for Inertia: the vision, the member dashboard and related experiments. It lives inside NetRxn's Inertia repo but is not part of the Wednesday sprint.

Read first: `member-layer/VISION.md`, `member-layer/DASHBOARD.md`, then `docs/SPRINT-COORDINATION.md` and issue #40.

## Boundaries

- Work only inside `member-layer/` on this branch. Do not edit anything outside it.
- Never edit the canonical set: `spec.md`, `plan.md`, `decisions.md`, `testing.md`, `Needed-from-team.md`, the deck or the HTML overview.
- Decision D24 says no bespoke dashboard in the plugin. This work is exploratory and does not open a PR into `develop` until NetRxn agrees on #40.
- Never push to `main`, force-push, merge, or open or mark a PR ready without Kyle's explicit OK.
- Ask Kyle before posting any GitHub comment, and show the exact text first.
- No credentials, real member data, meeting contents or financial records anywhere. Fixtures are synthetic.
- No live integrations, deployments or external messages.

## Keeping in sync

- Periodically run `git fetch origin` and `git merge origin/develop` into this branch so it doesn't drift. Report conflicts instead of resolving them in files outside `member-layer/`.
- Before starting new work, re-read #40 and open PRs. If dot's work starts covering the same ground, stop and tell Kyle.
- Questions for NetRxn go on #40 as self-contained comments.

## How to work

- Plan before code: list files, tests and what won't be touched.
- Fixture-first: build against `member-layer/fixtures/` shaped like the real sources in DASHBOARD.md.
- Report test and check results honestly: passed, failed or never run.
