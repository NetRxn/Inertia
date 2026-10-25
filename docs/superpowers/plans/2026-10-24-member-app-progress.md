# Member app: build progress and handoff

Plan: [`2026-10-24-member-app.md`](2026-10-24-member-app.md) · Spec: [`../specs/2026-10-24-member-app-design.md`](../specs/2026-10-24-member-app-design.md) · Working branch: `feat/member-app-all` (all member work; see below) · Updated 2026-10-25 (after Task 11 and the final review).

Execution method: Tasks 1–7 used subagent-driven development (a fresh implementer and a reviewer per task). From Task 8 on, the plan runs inline with `superpowers:executing-plans` (TDD per task, one fresh whole-branch review at the end; R29). This file is the committed copy of the controller's progress ledger (the live ledger is git-ignored under `.superpowers/sdd/2026-10-24-member-app/`), so a new session can resume. A resuming controller should recreate its local ledger from this file.

## Status

| Task | State | Commits |
|---|---|---|
| 1 Scaffold app + database | Complete, review clean | `0ba513c..aac8b69` |
| 2 Adapters + synthetic DAO | Complete, review clean | `aac8b69..cf023dd` |
| 3 Member sync | Complete, review clean | `cf023dd..66ab12d` |
| 4 Email-link login | Complete, review clean (2 fix rounds) | `66ab12d..f697715` |
| 5 Visual system, shell, home feed | Complete, review clean | `97048b5..d00a094` |
| 6 Work tab and claiming | Complete, review clean (1 pre-review fix, 1 review fix round) | `1efbb27..8f75893` |
| 7 Share: posts, files and link previews | Complete; unit, build and e2e green (no separate reviewer pass) | `69997df` on `feat/member-app-all`; `1469b3d` on `feat/member-app-feed` |
| 8 Assistant tool layer | Complete (inline, TDD); 18 tests | `a5743ca` |
| 9 Chat: route, conversations, sheet | Complete (inline, TDD); unit 115/115 three runs, e2e 16/16, build clean | `bd8a2e7` |
| 10 Votes, Calendar, Docs, Profile | Complete (inline, TDD); unit 119/119, e2e 19/19, build clean | `a3bb684` |
| 11 Full journey, README, final checks | Complete (inline, TDD); app typecheck/unit/build/e2e 20/20 and root test/typecheck/test:package green | `a9af7ae` |
| Final whole-branch review | Complete: no Critical, 3 Important fixed in one TDD pass; unit 124/124, e2e 20/20, build clean | `76ac76a` |

PR checkpoint 1 (Tasks 1–4) is NetRxn/Inertia#70 into `develop`. PR checkpoint 2 (Tasks 5–7) is NetRxn/Inertia#74 from `feat/member-app-feed` into `feat/member-app`. PR checkpoint 3 (Tasks 8–11 plus the review fixes) is NetRxn/Inertia#75 from `feat/member-app-sections` into `feat/member-app-feed`.

## Where things are on GitHub

- `feat/member-app-all`: **the working branch.** Tasks 1–11, the final-review fixes, plus Kyle's `member-layer/` notes. All new work is committed here (R28, R29).
- `feat/member-app`: Tasks 1–4. PR checkpoint 1 is NetRxn/Inertia#70 into `develop`, with no CI checks configured.
- `feat/member-app-feed`: Tasks 5–7, stacked on `feat/member-app`. PR checkpoint 2 is NetRxn/Inertia#74 into `feat/member-app`.
- `feat/member-app-sections`: Tasks 8–11 and the final-review fixes, cherry-picked from `feat/member-app-all` and stacked on `feat/member-app-feed`. PR checkpoint 3 is NetRxn/Inertia#75 into `feat/member-app-feed`; retarget it to `feat/member-app` once #74 merges.
- `member-layer`: Kyle's member-layer notes only. Exploratory, with no PR until the scope in #40 is agreed. `member-layer/` files must never enter a checkpoint PR (`member-layer/CLAUDE.md`).
- Checkpoints are cut by cherry-picking the app commits from `feat/member-app-all` onto `feat/member-app-feed` (or a new branch stacked on it); the cherry-picks are clean because member-layer commits touch only `member-layer/` (R29).

## Coordination

- 2026-10-25 update: #60 and #61 are merged. On #40, NetRxn answered the interface questions. Don't wire `claim()` to agent checkout; keep the fixtures until #46 settles member→user/company/action mapping. Meetings and work still need a read-only member projection, which NetRxn hasn't built yet. Read the #40 thread before writing any real adapter.
- On 2026-10-25, NetRxn asked three interface questions on #40: who owns `apps/member` and which paths to track; whether `WorkSource` and packet actions reuse native Paperclip tasks and the exact-version acceptance path, mapped under #46; and which SQL/source interfaces are needed first. NetRxn also asked whether #54/#60 and #48/#61 are still in Kyle's queue. Kyle hasn't replied yet. Before building real adapters, read that thread: the answers decide how `WorkSource` and `MeetingSource` map onto Paperclip.

## Resume here

Tasks 1–11 and the final whole-branch review are done (2026-10-25, cloud session). What's left:

1. **PR checkpoints:** review and merge #70, #74 and #75 in order, retargeting each once its base merges. #75 was opened 2026-10-25 after a local rerun on Kyle's Mac (unit 124/124, e2e 20/20, build clean).
2. Triage the deferred minors below, including the final review's list.
3. Real adapters wait on #40/#46 (see Coordination).

## Environment

- Cloud sessions: the container's default Node is 22. Install 24 with `/opt/nvm` (`nvm install 24`) and prepend its `bin` to `PATH`. `npx playwright install` can't download (cdn.playwright.dev is blocked by the network policy), so e2e ran on the pre-installed Chromium (`/opt/pw-browsers/chromium`, rev 1243, while Playwright 1.64.1 expects 1248). That run used a scratchpad wrapper config that adds `launchOptions.executablePath`, with no repo change.
- Kyle's Mac: Homebrew's default `node` is broken, so local commands use `PATH=/opt/homebrew/opt/node@24/bin:$PATH`. Other environments (including cloud sessions) just need Node ≥ 24.11; the prepended path is harmless when it doesn't exist.
- Chat e2e runs with `MEMBER_APP_MODEL_PROVIDER=mock` (set in `playwright.config.ts`), a scripted model that is refused when `NODE_ENV=production`. A real model needs `MEMBER_APP_MODEL_PROVIDER`, `MEMBER_APP_MODEL` and the provider's key in `apps/member/.env.local` (see `.env.example`); no real model is needed for tests.
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

- **R28:** One umbrella branch, `feat/member-app-all`, holds all member work (app line plus `member-layer/`). Checkpoint PRs still come from `feat/member-app-feed` so their diffs carry app commits only.
- **R29:** From Task 8 the plan runs inline (`superpowers:executing-plans`) directly on `feat/member-app-all`. Checkpoints cherry-pick the app commits onto the PR branch.
- **T8 rulings:** `ai` 7 and `zod` 4 added. Source blocks are capped at 4000 characters including the `<source>` tags, so a capped block always ends with its real closing tag. `draftDocument` stores the sources the tool set read before it. `listWork` returns open tasks (claimants omitted, so no other member's identity reaches the model) then initiatives by priority. The `getDocument` tool returns `{ results: [] }` for another member's or a missing document.
- **T9 rulings:** The chat stays on the Vercel AI SDK (`@ai-sdk/anthropic`, `@ai-sdk/openai-compatible`), per spec §8; `.env.example` suggests `claude-opus-5-5`. `searchMeetings` with an empty query returns the latest meetings (otherwise no tool can answer "the Oct 21 meeting"). The greeting covers the past 7 days because the session lookup refreshes `lastSeenAt` before any route runs. The greeting context rides as a leading text part of the first user message; only the member's own words are stored. The `mock` provider is a hand-written model in `src/assistant/mock-model.ts` so the dev server never imports `ai/test`. The chat route answers 401 (not a redirect) without a member. Source chips: meeting → `/docs#meeting-<id>`, proposal → its Robert's Rules `url`, task/initiative → `/work`, share → `/work?tab=ideas`, document → `/docs#doc-<id>`, event → `/calendar`, chat → plain chip. Vitest `hookTimeout` is 30 s because PGlite migrations in `beforeAll` intermittently passed 10 s under parallel load. Feed cards ask through a client `AskCard` wrapper (links and buttons inside are ignored) with a visually hidden "Ask: …" button for keyboards.

- **T10 rulings:** The download logic lives in `src/documents/download.ts` (`createDocumentDownloadHandler`, `documentFilename`); the route is a thin wrapper. It answers 401 without a member, and 404 for another member's or a missing document. Slugs are ASCII `[a-z0-9-]` capped at 80 characters (`document.md` if empty), served with `nosniff` and `private, no-store`. `listShares` gained `withFile`, so Shared files lists every share that has an upload. Sign out moved from the layout footer to Profile only, and `login.spec` signs out via `/profile`. Meeting notes and drafts are `<details>` (`HashDetails`) that open when the hash names them. Drafts show as plain pre-wrapped text with a visible "Download Markdown" button. Votes groups Open now / Coming up / Closed, with empty states; upcoming proposals show no tally. Action-item owners show by first name ("a member" if unknown, "no one yet" if null). `sections.spec` asserts through role queries scoped to regions, because Next keeps the previous page hidden in the DOM.
- **T11 rulings:** Every active member and both open tasks were already taken by other specs. So the fixture gained a 13th member (Lee Okafor, `lee@example.org`, `m-lee`) and a third open task (`task-8` "Photograph the first coding night"), both used only by `journey.spec`. As a result, the sync tests expect 13 members and the feed test expects 3 open items. `journey.spec` also follows the source chip to `/docs#meeting-meeting-1`. E2E member map: ana (home, login), rob (login), sam and jordan (chat), casey and morgan (work), riley, quinn, taylor and drew (share), alex (sections), lee (journey). pat is inactive.
- **Final-review rulings:** `/api/files/[id]` builds Content-Disposition with `contentDisposition()` (an ASCII `filename` fallback plus RFC 5987 `filename*`); before this, a non-Latin-1 name made the route answer 500. The chat stores no empty assistant reply and drops empty messages when replaying history, because the provider rejects empty content. `searchMeetings` and `searchChat` resolve owners and authors to display names, so no member external id reaches the model.
- **Optional work fields (2026-10-25, per the #40 answer):** `Initiative.progress`, `statusLabel` and `priority` and `HumanTask.kind` are optional. `byPriority` (`src/work/initiatives.ts`) ranks known priorities first and keeps source order for the rest; `taskKind()` defaults to `review`. PrioritiesCard drops the progress arc, the "% along" chip and the status line when they're unknown, and `listWork` leaves those lines out.

## Deferred minor findings

- Final review (2026-10-25): `og:image` is filtered to https only on the client, so a share can make members' browsers fetch any https host. The proposal source chip uses the adapter's `url` without an http(s) check. Conversation history is ordered by `createdAt` alone, so a tie would put messages in an undefined order. Only the final step's text is stored, so text written before a tool call is lost from history. A sync where the directory returns `[]` would deactivate every member. GET `/auth/verify` spends the token, so mail link scanners will burn links once a real mailer exists. File responses are cached `private, max-age=3600` after sign-out. Share DELETE answers 403 vs 404, which reveals that a share exists. `.gitignore`'s `.env*` also matches the tracked `.env.example` (add `!.env.example`). `e2e/global-setup.ts` isn't referenced. `request-login` lowercases the email but doesn't trim it. The reviewer upgraded none of the earlier deferred items.

- T9: the greeting can't say "since your last visit" until auth keeps the previous `lastSeenAt`. Chat messages are stored only when the stream finishes, so an aborted reply leaves no record of the question. The chat sheet doesn't trap focus. Card taps use a window event rather than shared state.

- T7: link previews check DNS and then let `fetch` resolve again, so a host that rebinds between the two lookups could reach a private address. Pinning the checked address needs a custom undici dispatcher. Uploads are read fully into memory before the 10 MB check. `DeleteShareButton` gives no message when a delete fails. The composer's chat-bar offset assumes Task 9's bar.

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
- T4 (resolved in Task 7): seed shares are dated from `FIXTURE_NOW`, so they drift under R2, and `limit(3)` picks share authors unordered, possibly including inactive members.
- T4: `Member` type lives in the Next-importing `session.ts`; the `Mailer` type lives in `auth.ts`; `generateToken` duplicates `hashToken`.
