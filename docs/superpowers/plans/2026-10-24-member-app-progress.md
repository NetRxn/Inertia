# Member app: build progress and handoff

Plan: [`2026-10-24-member-app.md`](2026-10-24-member-app.md) · Spec: [`../specs/2026-10-24-member-app-design.md`](../specs/2026-10-24-member-app-design.md) · Branch: `feat/member-app` (from `develop` at `00b9ebc`) · Updated 2026-10-25.

Execution method: subagent-driven development (`superpowers:subagent-driven-development`). Each task is built by a fresh implementer and then reviewed (spec + quality) before the next task starts. This file is the committed copy of the controller's progress ledger, so a new session can resume. A resuming controller should recreate its local ledger from this file.

## Status

| Task | State | Commits |
|---|---|---|
| 1 Scaffold app + database | Complete, review clean | `0ba513c..aac8b69` |
| 2 Adapters + synthetic DAO | Complete, review clean | `aac8b69..cf023dd` |
| 3 Member sync | Complete, review clean | `cf023dd..66ab12d` |
| 4 Email-link login | Complete, review clean (2 fix rounds) | `66ab12d..f697715` |
| 5 Visual system, shell, home feed | Complete, review clean | `97048b5..d00a094` |
| 6 Work tab and claiming | Complete, review clean (1 pre-review fix, 1 review fix round) | `1efbb27..8f75893` |
| 7–11 | Not started | |

PR checkpoint 1 (Tasks 1–4) is open into `develop` as NetRxn/Inertia#70. Task 5 onward is committed on the local worktree branch and not pushed to `feat/member-app`, so it doesn't land in #70 (ruling R11). Checkpoint 2 (after Task 7) goes up as a separate branch.

## Where things are on GitHub

- `feat/member-app`: Tasks 1–4. PR checkpoint 1 is NetRxn/Inertia#70 into `develop`. It's mergeable, with no reviews yet and no CI checks configured.
- `feat/member-app-feed`: Tasks 5–6 plus this file, stacked on `feat/member-app`. It has no PR yet; checkpoint 2 opens after Task 7.
- `member-layer`: Kyle's member-layer notes (`member-layer/VISION.md`, `DASHBOARD.md`, `CLAUDE.md`). It's exploratory, with no PR until the scope in #40 is agreed.

## Coordination

- 2026-10-25 update: #60 and #61 are merged. On #40, NetRxn answered the interface questions. Don't wire `claim()` to agent checkout; keep the fixtures until #46 settles member→user/company/action mapping. Meetings and work still need a read-only member projection, which NetRxn hasn't built yet. Read the #40 thread before writing any real adapter.
- On 2026-10-25, NetRxn asked three interface questions on #40: who owns `apps/member` and which paths to track; whether `WorkSource` and packet actions reuse native Paperclip tasks and the exact-version acceptance path, mapped under #46; and which SQL/source interfaces are needed first. NetRxn also asked whether #54/#60 and #48/#61 are still in Kyle's queue. Kyle hasn't replied yet. Before building real adapters, read that thread: the answers decide how `WorkSource` and `MeetingSource` map onto Paperclip.

## Resume here

1. **Task 7** (sharing) was started and then stopped before its implementer reported back. Its brief is extracted and its rulings are made: R22 (https-only, no-referrer preview images), R23 (seed shares dated from process start, active authors, no financial text), R24 ("Recently shared" must be last), R25 (`MEMBER_APP_LINK_PREVIEWS=off` in e2e), R26 (checkpoint 2 PR based on `feat/member-app` while #70 is open) and R27 (http/https-only links at render). Restart Task 7 fresh, then open checkpoint 2. It fills the Work tab's Ideas segment, which is still a placeholder, carrying two items: the Task 4 note that seed shares are dated from `FIXTURE_NOW`, and the Task 5 note that `RecentlySharedCard` must allow only `http`/`https` links. After Task 7 comes PR checkpoint 2, "Member app: home feed, work tab and sharing".

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
- **R11:** Task 5 onward isn't pushed to `feat/member-app` while #70 is open. Checkpoint 2 goes up as its own branch.
- **R12:** Theming: `:root` carries Night, `prefers-color-scheme: light` switches to Day, and `[data-theme]` on `<html>` overrides both.
- **R13:** `npm run tokens` generates `src/styles/tokens.css` from `design/tokens.json`. `design/components/bundle.css` is imported as-is, and a test checks that every `var()` it uses is defined.
- **R14:** Fonts load through `next/font/google` and are exposed as `--font-display`, `--font-sans`, `--font-voice` and `--font-mono`.
- **R15:** Cards map to the design system's components: "Waiting for you" uses AgentAsk, "Top priorities" uses Initiative, and chat and shares use IdeaCard.
- **R16:** `e2e/work.spec.ts` claims as Casey, with Morgan as the second claimant. It never uses Ana or Rob, whose state other specs check. The spec needs a fresh server, because claims persist within a run.
- **R17:** The Work cards use "I'll take it" as a glass secondary button, which keeps the one tomato primary per view.
- **R19:** "Needs a person" shows open tasks plus this member's own claimed tasks. After a successful claim the card stays in place as "Yours" with "It's yours.", and failed claims don't refresh the page.
- **R20:** `HumanTask.prepared` is prose describing what agents already prepared. The fixtures now carry sentences instead of dates.
- **R10:** Fix round 2 went to a fresh implementer because the round-1 implementer's context was gone.

## Deferred minor findings (for the final whole-branch review to triage)

- T6: rough time appears twice on each Work card. The Ideas segment still fetches adapters. Open tasks under non-active initiatives are hidden without any note. The e2e check "main is visible" asserts nothing. `work.spec` depends on spec order.

- T5: `FromChatCard` quotes a member's words without their name (carry into Task 9). Adapter contracts are undocumented: `listMeetings` returns newest first, and a lower `priority` number means more important. `ThisWeekCard` keys rows on display name. `list-style: none` drops list semantics in Safari. The "This week" empty copy isn't a question. The latest-message logic is duplicated. The Priorities ring draws a dot at 0%.

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
