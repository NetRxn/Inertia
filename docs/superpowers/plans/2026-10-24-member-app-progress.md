# Member app: build progress and handoff

Plan: [`2026-10-24-member-app.md`](2026-10-24-member-app.md) · Spec: [`../specs/2026-10-24-member-app-design.md`](../specs/2026-10-24-member-app-design.md) · Branch: `feat/member-app` (from `develop` at `00b9ebc`) · Updated 2026-10-24.

Execution method: subagent-driven development (`superpowers:subagent-driven-development`). Each task is built by a fresh implementer and then reviewed (spec + quality) before the next task starts. This file is the committed copy of the controller's progress ledger, so a new session can resume. A resuming controller should recreate its local ledger from this file.

## Status

| Task | State | Commits |
|---|---|---|
| 1 Scaffold app + database | Complete, review clean | `0ba513c..aac8b69` |
| 2 Adapters + synthetic DAO | Complete, review clean | `aac8b69..cf023dd` |
| 3 Member sync | Complete, review clean | `cf023dd..66ab12d` |
| 4 Email-link login | **Fix round 1 committed; re-review pending** | `66ab12d..80e8ad5` |
| 5–11 | Not started | |

## Resume here

1. **Re-review Task 4's fix round 1** (fix range `720d9f7..80e8ad5`). The implementer was stopped before writing its fix report. The controller has only verified unit tests (26/26) and typecheck. The re-review must also run `npm run e2e -- login` and `npm run build` and confirm the build prints no warnings. These are the findings it must verdict:
   1. Single-use not atomic: concurrent `consumeLoginToken` calls both succeeded. Needs a conditional `UPDATE … WHERE used_at IS NULL RETURNING`, plus a `Promise.all` test with exactly one `ok`. The 5-per-hour cap must also be safe under parallel requests.
   2. Every verify failure (missing, invalid, expired, used, inactive) renders one page: "This link has expired or was already used. Request a new one.", with no duplicated HTML and no deactivation reveal.
   3. Login confirmation is exactly "Check your email for a sign-in link." for every input.
   4. `request-login` must not leak membership through timing or status. Respond `{ ok: true }` immediately and do the work in `after()` with errors caught.
   5. Sign-out is POST-only with a 303 to `/login`, no duplicated logic, and the form uses `method="POST"`.
   6. Unique constraints on `loginTokens.tokenHash` and `sessions.tokenHash`, with the 0000 migration regenerated.
   7. The build has no Next.js prerender warnings about `new Date()`, fixed at the root cause per the bundled Next docs.
2. When the re-review passes, **open PR checkpoint 1 into `develop`**: "Member app: scaffold, fixtures, identity sync and login". Kyle asked for the PR only after this re-review passes.
3. Continue with **Task 5** (visual system, shell, home feed). Its Step 5 now uses Kyle's Inertia design system, copied into `apps/member/design/` (see `SOURCE.md` there), in place of a new frontend-design pass. The plan is otherwise unchanged.

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

## Deferred minor findings (for the final whole-branch review to triage)

- T1: `migrate.ts` keeps two `as any` casts to pass the union `Db` into driver-specific migrators.
- T3: the instrumentation guard flag is set before the interval starts, so a throw in between leaves sync disabled until restart.
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
