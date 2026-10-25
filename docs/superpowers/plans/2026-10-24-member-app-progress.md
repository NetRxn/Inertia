# Member app: build progress and handoff

Plan: [`2026-10-24-member-app.md`](2026-10-24-member-app.md) · Spec: [`../specs/2026-10-24-member-app-design.md`](../specs/2026-10-24-member-app-design.md) · Branch: `feat/member-app` (from `develop` at `00b9ebc`) · Updated 2026-10-24.

Execution method: subagent-driven development (`superpowers:subagent-driven-development`). Each task is built by a fresh implementer and then reviewed (spec + quality) before the next task starts. This file is the committed copy of the controller's progress ledger, so a new session can resume. A resuming controller should recreate its local ledger from this file.

## Status

| Task | State | Commits |
|---|---|---|
| 1 Scaffold app + database | Complete, review clean | `0ba513c..aac8b69` |
| 2 Adapters + synthetic DAO | Complete, review clean | `aac8b69..cf023dd` |
| 3 Member sync | Complete, review clean | `cf023dd..66ab12d` |
| 4 Email-link login | Complete, review clean (2 fix rounds) | `66ab12d..f697715` |
| 5–11 | Not started | |

PR checkpoint 1 (Tasks 1–4) is open into `develop`.

## Resume here

1. Continue with **Task 5** (visual system, shell, home feed). Its Step 5 now uses Kyle's Inertia design system, copied into `apps/member/design/` (see `SOURCE.md` there), in place of a new frontend-design pass. The plan is otherwise unchanged.

## Environment

- Kyle's Mac: Homebrew's default `node` is broken, so local commands use `PATH=/opt/homebrew/opt/node@24/bin:$PATH`. Other environments just need Node ≥ 24.11.
- `apps/member/playwright.config.ts` currently hardcodes that Homebrew path in its web server command. It's a deferred minor; fix it if it gets in the way.
- Every command runs from `apps/member/`: `npm ci`, `npm test`, `npm run typecheck`, `npm run build`, `npm run e2e`. Chromium for Playwright: `npx playwright install chromium`.
- Imports in `apps/member` are extension-free (no `.js`).

## Controller rulings (binding on implementers)

- **R1:** `src/adapters/types.ts` was created in Task 1 with only `SourceRef`; Task 2 added the rest.
- **R2:** `defaultFixture(anchor = FIXTURE_NOW)` generates all dates relative to `anchor`. Tests pass `FIXTURE_NOW`; `getAdapters()` anchors at process start so the local app always looks current.
- **R3:** E2E seeding finishes before the dev server opens PGlite (the webServer command resets, seeds, then starts `next dev`). PGlite is memoized on `globalThis`.
- **R4:** Task 5's home e2e asserts the relative order of the cards present, with "Recently shared" last if present. Task 7 tightens it to require "Recently shared" last.
- **R5:** Playwright uses `workers: 1`, `fullyParallel: false` and one dev server, because the fixtures are in memory.
- **R6:** The controller (not implementers) pushes the feature branch and opens PRs into `develop` at the plan's checkpoints.
- **R7:** The email test pins both rules: mixed-case inserts are rejected by the check constraint, and duplicate lowercase emails are rejected by the unique constraint.
- **R8:** The `getAdapters()` singleton lives on `globalThis`, with a test-only reset, so all Next module graphs share one fixture state.
- **R9:** Task 4 fix round 1 had no implementer fix report, so the controller's own run of the covering suites served as its test evidence.
- **R10:** Fix round 2 went to a fresh implementer because the round-1 implementer's context was gone.

## Deferred minor findings (for the final whole-branch review to triage)

- T1: `migrate.ts` keeps two `as any` casts to pass the union `Db` into driver-specific migrators.
- T3: the instrumentation guard flag is set before the interval starts, so a throw in between leaves sync disabled until restart.
- T4: the `(member)` auth guard sits inside `<Suspense>`, so a signed-out GET `/` gets a 200 with a streamed meta redirect rather than a 307, and the dev log prints a `NEXT_REDIRECT` trace.
- T4: `request-login` calls `await request.json()` outside its try/catch, so a malformed body is an unhandled 500.
- T4: `consumeLoginToken` spends the token and inserts the session without a transaction.
- T4: since mail is now sent in `after()`, `waitForTimeout(500)` in `e2e/helpers.ts` is the only thing ordering the mail write before the e2e reads it (flake risk).
- T4: `requireMember` runs twice per request; wrap it in React `cache()`. The layout awaits the session at the top level.
- T4: `devMailer` is wired unconditionally; guard it before production.
- T4: redirects are built from `request.url` instead of `MEMBER_APP_BASE_URL`.
- T4: test gaps:
  - the token-not-stored test is weaker than the brief;
  - the tampered-token test uses an arbitrary string;
  - the unknown-email e2e doesn't assert that no mail file was written;
  - `helpers.ts` uses `waitForTimeout(500)`.
- T4: `playwright.config` hardcodes the Homebrew node path; the html reporter opens a server; `e2e/global-setup.ts` is empty.
- T4 (**carry into Task 7**): seed shares are dated from `FIXTURE_NOW`, so they drift under R2, and `limit(3)` picks share authors unordered, possibly including inactive members.
- T4: `Member` type lives in the Next-importing `session.ts`; the `Mailer` type lives in `auth.ts`; `generateToken` duplicates `hashToken`.
