# Inertia member app

The place where FWTX DAO members see and touch Inertia. A verified member logs in with their email and gets a feed of what's happening in the DAO, the work that needs a person, a place to share ideas, and an assistant that answers questions about anything the DAO knows and cites where each answer came from.

It's a self-contained Next.js app. Every outside system sits behind a TypeScript adapter, and v1 runs entirely on synthetic fixture data, so it can be built and tried before partner access exists. The app never keeps its own task or approval ledger, and Robert's Rules proposals are read-only.

Design: [`docs/superpowers/specs/2026-10-24-member-app-design.md`](../../docs/superpowers/specs/2026-10-24-member-app-design.md). Plan: [`docs/superpowers/plans/2026-10-24-member-app.md`](../../docs/superpowers/plans/2026-10-24-member-app.md).

## Setup

Requires Node 24.11 or later. Run everything from `apps/member/`:

```bash
npm ci
cp .env.example .env.local   # optional: every variable has a working default
npm run seed                 # migrates the local PGlite database, syncs fixture members, adds sample shares
npm run dev                  # http://localhost:3000
```

The database lives in `data/pglite` (git-ignored). No Docker is needed. Set `DATABASE_URL` to use a real Postgres instead; the app's tables live in the `member_app` schema.

## Logging in

1. Open http://localhost:3000 and enter a fixture email, such as `ana@example.org`. Every fixture member is invented; the list is in `src/adapters/fixtures/dao.ts` (`pat@example.org` is the inactive one and can't log in).
2. In development no mail is sent. The login link is printed in the dev server's console and written to `data/dev-mail/<email>.txt`.
3. Open that link. It works once and expires after 15 minutes. Unknown emails get the same "check your email" response, and no link.

## The chat assistant

The chat runs on the Vercel AI SDK, so the provider is a setting. Put these in `.env.local`:

```bash
MEMBER_APP_MODEL_PROVIDER=anthropic
MEMBER_APP_MODEL=claude-opus-5-5
ANTHROPIC_API_KEY=...
```

Any OpenAI-compatible server (a local model, for example) works with `MEMBER_APP_MODEL_PROVIDER=openai-compatible`, `MEMBER_APP_MODEL_BASE_URL` and `MEMBER_APP_MODEL_API_KEY`. Without a provider, the rest of the app works and the chat says it isn't configured yet.

The assistant reads through tools over the adapters and treats all meeting, chat and share text as data, never as instructions. `listFunding` reads the grant finder's opportunities and applications; members confirm or submit applications in the funding system, never through the app or the assistant. Its only tool that writes anything is `draftDocument`, which saves to the member's own drafts (Docs → My drafts, downloadable as Markdown).

## Tests

```bash
npm run typecheck
npm test          # Vitest
npm run build
npm run e2e       # Playwright; needs Chromium: npx playwright install chromium
```

E2E starts its own dev server on port 3100 with a fresh database, link previews off and a scripted mock model (`MEMBER_APP_MODEL_PROVIDER=mock`), so it needs no API key. Each spec logs in as members no other spec uses, because claims and shares persist for the run.

## Adapters

| Adapter | Real source (later) | Provides | Status |
|---|---|---|---|
| `MemberDirectory` | Robert's Rules member list | members: id, email, display name, active | Fixture only |
| `ProposalSource` | Robert's Rules | proposals: title, status, dates, tallies, link | Fixture only |
| `WorkSource` | Paperclip | initiatives, tasks needing a person, weekly completions, `claim` | Fixture only |
| `MeetingSource` | Roundtable output / DAO Postgres | meetings: summary, decisions, open questions, action items | Fixture only |
| `ChatSource` | Buzz via the bridge / DAO Postgres | threads and recent messages | Fixture only |
| `EventSource` | To be decided | upcoming events | Fixture only |
| `FundingSource` | The grant finder (DFW funding domain via Paperclip) | opportunities: sponsor, program, route, deadline, benefit, next step, official source; applications: stage, readiness, decisions members still need to make | Fixture only |

The interfaces are in `src/adapters/types.ts`, and `MEMBER_APP_ADAPTERS` selects the set (only `fixture` exists). Nothing in the UI or the assistant knows which implementation is active.

## Questions for partners

These don't block the local build. For NetRxn:

1. Should the member app live in `NetRxn/Inertia` (as `apps/member`) or in its own repo?
2. Which Paperclip API should the app use to read tasks needing a person and to record a claim?
3. Can the app have its own `member_app` schema and role on the DAO Postgres, and who provisions it?
4. Can the app read meeting summaries and Buzz messages through the SQL knowledge tools?

For the Robert's Rules builder:

5. How can Inertia read the member list, and should login verify the email itself or delegate to Robert's Rules?
6. Is there a way to read proposals and vote tallies?
