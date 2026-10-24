# Inertia member app: design

Date: 2026-10-24 · Author: Kyle (with Claude) · Status: draft for Kyle's approval · Base: `develop` at `00b9ebc`

This document reconciles Kyle's Inertia concept summary (Oct 11–24 brainstorm notes) with NetRxn's `NetRxn/Inertia` repository, lays out the order in which the missing parts get built, and specifies the first buildable project in enough detail to plan from: **identity sync and login**, then **member app v1**.

Like [`docs/proposals/2026-10-24-member-centered-loop.md`](../../proposals/2026-10-24-member-centered-loop.md), this is non-canonical. It changes none of NetRxn's spec, plan, decisions or testing artifacts. Mockups referenced below are in [`2026-10-24-member-app-mockups/`](2026-10-24-member-app-mockups/). They are content fragments from the brainstorm companion, so they render unstyled when opened directly.

## 1. Intent

Inertia is an open-source agentic framework for organizational operations, built first for FWTX DAO. Its goal is to "increase the inertia": keep a working group's momentum going between meetings and make every size of contribution feel valuable.

The core inversion: **the system informs the members instead of the members informing the system.** Agents hold the operational picture and do backend work: code, research, drafts, summaries. They ask people only for what needs a person: a decision, a creative idea, a photo, a relationship, a real-world action.

NetRxn's repo builds the agent-side machinery for one slice of that loop (meetings and grant funding) as a Paperclip plugin. **What's missing is the place where members actually see and touch Inertia.** The member app is that place: a simple login on web or phone where everything the DAO knows is aggregated, summarized and distilled, and where a context-aware chat is the main way to interact.

## 2. Reconciliation with the repo

### Already built (reuse, don't rebuild)

| Repo capability | Where | Role for the member app |
|---|---|---|
| Paperclip as operational core: tasks, approvals, agents, budgets (D10, D12) | `src/paperclip`, `src/bridge` | Source of truth for tasks and asks shown on the Work tab |
| Signed Buzz bridge, native comments, confirmation cards | `src/bridge`, `src/buzz` | Buzz stays a peer channel; its messages feed the "From the chat" card |
| Meeting ingestion: Meet/Gemini/Drive → transcript + structured notes (decisions, tasks) | `src/roundtable` | Source for the "Last meeting" card and chat answers |
| Grant discovery, funding research, packet v2 exact-version approval | `src/discovery`, `src/grants` | Grant initiatives and asks surface in the feed and Work tab |
| DAO PlanetScale PostgreSQL storage contract (D05) and named SQL knowledge tools | `docs/development/dao-data-consolidation.md` | The app's own tables go here, in their own schema |
| Contribution candidate boundary, demo-evidence receipts (#54) | `src/contributions` | Groundwork for later credit and the weekly tracker |

### Where the concept and the repo disagree, and how this design resolves it

| Topic | Repo says | Concept says | Resolution here |
|---|---|---|---|
| Identity | Privy sessions and member tables in `FWTX-DAO/dao-platform`; Buzz key pairing | Robert's Rules email key is the identity anchor; Privy platform out for now; Inertia keeps its own profile store | Follow the concept. The app syncs members from Robert's Rules and logs in by email. Buzz pairing remains NetRxn's concern. |
| Member UI | "No bespoke dashboard" (D24, for operator health); "a second UI must never maintain a competing approval or task ledger" | A member app is one channel among several | Build the app, but it **never owns tasks or approvals**. It reads them from Paperclip and sends claims back through Paperclip. Ideas, profiles and chat history are new data with no existing owner and live in the app's schema. |
| Votes | Vocdoni only where governance actually requires it (D07, D33) | Robert's Rules app owns formal procedure and votes | Compatible. The app shows Robert's Rules proposals and tallies **read-only** and links out to vote. |
| Members-only portal | Meeting notes publish to `dao-platform` behind Privy login (D31) | — | Unchanged. The app reads meeting summaries from the same records; it doesn't replace that portal. |

### Missing entirely

Member app UI; Robert's Rules identity sync and login; context-aware chat across all sources; idea sharing; Telegram and Discord intake with opt-in account linking; player profiles and task matching; points, voting weight and the guild token; newcomer onboarding; the agent governance charter; the external hotlist and Y2 feed.

## 3. Roadmap

Each project gets its own design detail, plan and PRs into `develop` when its turn comes. **Only projects 1 and 2 are specified in this document.**

1. **Identity sync and login.** Member list from Robert's Rules, email-link login, the app's member record.
2. **Member app v1.** Home feed, floating menu, chat assistant, Work tab, Share. (Sections 5–9.)
3. **Chat intake.** Telegram and Discord adapters reusing the Buzz bridge patterns (verified author, idempotent ingest), with per-platform opt-in account linking and recorded consent.
4. **Contribution credit.** Attribution with evidence across code and non-code work; replaces the v1 weekly tracker's simple task count.
5. **Profiles, matching and onboarding.** Player profiles from behavior plus stated skills and availability; agent *suggests* work, never assigns; welcome and first-task brief when a new member appears.
6. **Points, voting weight and governance.** Agent-scored, member-ratifiable points; decay or caps against informal hierarchy; treasury-backed token exploration; the layered governance charter.

## 4. Goals, non-goals, anti-goals (projects 1–2)

**Goals**
- Any verified member, technical or not, logs in with just their email and within seconds sees what's happening in the DAO and what's waiting for them.
- The chat answers questions about anything the DAO knows, cites where each answer came from, and can find or draft documents.
- A member can see work that needs a person and claim it.
- A member can share a link, image or file with a description in a few taps.
- Everything runs locally against synthetic data, with each real source behind a swappable adapter, so the app can be built before partner access is granted.

**Non-goals for v1**
- Voting inside the app (Robert's Rules owns it).
- Creating, assigning or completing tasks in the app's own database (Paperclip owns them).
- Telegram/Discord, profiles, matching, points, onboarding (later projects).
- A native app-store app. v1 is a mobile-friendly web app that can be added to a phone's home screen.
- Production hosting. Deferred by Kyle's decision.

**Anti-goals: it fails even if it works if…**
- It becomes a second task list that drifts from Paperclip.
- The chat states things without sources, or treats chat/meeting text as instructions.
- It looks and feels like typical vibe-coded software instead of modern, human, inviting, alive and unthreatening.
- The weekly tracker turns into a pressure leaderboard that rewards busywork over careful work.
- Real member data, credentials or meeting content end up in the public repo.

## 5. Decisions Kyle made

- **Layout:** a scrolling home **feed of summary cards** with a **floating icon menu** pinned at the top and a **chat bar pinned at the bottom**. Chat is "front and foremost," the main way to interact. (Chosen over a dashboard and over a chat-centered three-column layout.)
- **Feed content:** big upcoming events; top priorities/initiatives; recent and upcoming Robert's Rules proposals with votes; last meeting summary; a weekly tracker of members who tackled the most tasks; open items.
- **Work tab:** initiatives and tasks that need human input and that a member could take on.
- **Share:** a clear, floating Share button on the Work tab opening a blank canvas: link, image, and a description. A shared idea is **saved to the Inertia database**, and nothing else happens automatically yet.
- **Stack:** Next.js with TypeScript; Postgres with Drizzle; email-link login against a member list synced from Robert's Rules; chat on the Vercel AI SDK so the model provider is swappable.
- **Build locally first** with synthetic data; decide hosting later.
- **Workflow:** feature branches with regular PRs into `develop`.

## 6. Member app v1: screens

Mobile-first; desktop shows the same feed as a centered column (about 640 px) with the same floating menu and chat bar.

### Floating menu
A translucent pill pinned near the top that stays put while the page scrolls. Sections: **Home, Votes, Work, Calendar, Docs, Profile**. *(Claude's call; Kyle saw it in the mockups without objecting.)*

### Home feed (`feed-v3.html`)
Greeting, then cards in this order *(order is Claude's call)*:

1. **Waiting for you**: asks this member has claimed or that are suggested for them; highlighted.
2. **Top priorities**: active initiatives with progress and a status word ("needs help", "drafting").
3. **Coming up**: next meetings, deadlines and vote openings.
4. **Robert's Rules**: open and recently closed proposals with tallies; tap links out to the Robert's Rules app.
5. **Last meeting**: date, headline decisions, open questions, number of action items.
6. **This week**: members with the most completed tasks this week, plus the open-item count. Shown as a celebration of the top few, with no full ranking of everyone and no bottom of the list. *(Claude's call, addressing the busywork risk; Kyle can override.)*
7. **From the chat**: busiest Buzz threads with a one-line summary.
8. **Recently shared**: newest Share posts.

Tapping any card opens the chat with a question about that card pre-filled and sent, so detail lives in the conversation rather than separate pages *(Claude's call)*.

### Chat
- A bar pinned at the bottom ("Ask the DAO anything…"). Tapping it slides the conversation up as a sheet over the feed; drag it down to dismiss.
- On first open of a session, the assistant greets with what changed since the member's last visit and anything waiting for them.
- Every factual answer lists its sources (meeting, thread, proposal, task, shared post) as tappable chips.
- "Get documents" means both **finding** existing ones (meeting notes, drafts, shared files) and **drafting** new ones on request (a one-pager, a newsletter blurb). Drafts are saved as documents the member can open, copy or download as Markdown *(Claude's call)*.
- Conversations are private to the member.
- The assistant never takes actions on the member's behalf in v1 (no claiming, posting, voting or sending).

### Work tab (`work-share-v4.html`)
Segmented control: **Needs a person** (default), **Initiatives**, **Ideas**.
- *Needs a person*: Paperclip tasks flagged as needing human input, each showing initiative, kind (creative, outreach, review, real-world), rough time, what agents have already prepared, and an **I'll take it** button. Claiming goes through the Paperclip adapter.
- *Initiatives*: active initiatives with progress and open tasks.
- *Ideas*: Share posts, newest first.
- **＋ Share** floats above the chat bar.

### Share
Full-screen composer: optional kind chip (**New idea, Resource, Event, Update**; Claude's call, default New idea); a canvas for a link with preview, an image or file, and a description. **Post** saves it. It appears under Ideas and in Recently shared. Visible to all logged-in members. Author can delete their own post.

### Votes, Calendar, Docs, Profile
Thin in v1: Votes lists proposals (same source as the card); Calendar lists upcoming events; Docs lists meeting notes, shared files and assistant drafts; Profile shows name, email, sign out.

## 7. Data and integration

### Principle
Each outside system sits behind a TypeScript interface with a **fixture implementation** used for local development and tests. Real implementations are added once partner access exists. Nothing in the UI or assistant knows which implementation is active.

| Adapter | Real source (later) | Provides |
|---|---|---|
| `MemberDirectory` | Robert's Rules member list | members: id, email, display name, active status |
| `ProposalSource` | Robert's Rules | proposals: title, status, opens/closes, tallies, link |
| `WorkSource` | Paperclip API | initiatives, tasks needing a person, completions per member per week, `claim(taskId, memberId)` |
| `MeetingSource` | Roundtable output / DAO Postgres | meetings: date, summary, decisions, open questions, action items, transcript reference |
| `ChatSource` | Buzz via NetRxn's bridge / DAO Postgres | threads: channel, recent messages, author, time |
| `EventSource` | calendar source TBD; fixture only in v1 | upcoming events |

`WorkSource.claim` must go through Paperclip. The app stores no task state of its own beyond short-lived caching.

### The app's own tables (Postgres schema `member_app`, Drizzle-owned)
- `members`: synced from `MemberDirectory`; id, external id, email, display name, status, last synced, last seen.
- `auth_tokens` / `sessions`: email-link login.
- `shares`: id, author, kind, description, link URL plus fetched preview fields, file reference, created, deleted.
- `files`: uploaded images/files stored on local disk in development behind a storage interface *(Claude's call)*.
- `conversations`, `messages`: per-member chat history, with source citations stored per assistant message.
- `documents`: assistant-drafted documents.

### Identity and login (project 1)
- A sync job pulls the member list from `MemberDirectory` on demand and on a schedule. Members who disappear or turn inactive lose access at next request.
- Login: member enters email → if it matches an active member, a single-use link expiring in 15 minutes is sent → clicking it creates a session cookie. Unknown emails get the same "check your email" response, so the form doesn't reveal who is a member. In development, the email is printed to the console instead of sent *(Claude's call)*.
- Robert's Rules' email-generated key stays the identity anchor. The app links its member record to the Robert's Rules member id. Wallet or key management is out of scope.

## 8. Chat assistant

- Built on the Vercel AI SDK with the model provider and model id set by environment variables. Provider choice is deferred.
- **Tool-calling over adapters**, not one giant prompt: tools such as `searchMeetings`, `listProposals`, `listWork`, `searchChat`, `searchShares`, `getDocument`, `draftDocument`. Each tool returns records with stable source references; the assistant must cite them.
- All source text (meetings, chats, shares) is passed as **data**, clearly delimited, never as instructions. The system prompt says so explicitly, following the repo's existing rule.
- Retrieval in v1 is keyword/structured search over the adapters. No vector database; the repo defers that too.
- Read-only: the assistant has no tools that change anything except `draftDocument`, which writes only to the member's own documents.

## 9. Local development

- Lives in this repository under `apps/member/` on a feature branch until NetRxn says whether it belongs in his repo or a separate one. It stays self-contained (its own `package.json`) so it can move without rework. It doesn't modify the plugin package, its manifest or its tests.
- Local Postgres via **PGlite** (already a dev dependency in the repo; no Docker needed), migrated with Drizzle *(Claude's call)*. A real Postgres URL can be swapped in by environment variable.
- A seed script loads a coherent synthetic DAO: about a dozen members, three initiatives, open tasks needing a person, two recent meetings, two proposals, a few chat threads and events. All names are invented, with no real member data.
- Tests: Vitest for adapters, sync, login and the assistant's tool layer (with a mocked model); Playwright for one end-to-end path (login → feed → claim a task → share an idea → ask the chat a question that cites a source).
- Design direction: modern, human, inviting, alive, unthreatening. Use the frontend-design skill during the build; the mockups set layout, not final styling.

## 10. Constraints

- No real member data, credentials, meeting content or runtime captures in the repo.
- No competing task or approval ledger; Paperclip owns tasks and approvals.
- Robert's Rules owns proposals and votes; the app is read-only for them.
- Source text is data, never instructions.
- Node 24.11+, TypeScript, matching the repo.
- PRs go into `develop`.

## 11. Questions for partners (don't block local build)

For NetRxn:
1. Should the member app live in `NetRxn/Inertia` (as `apps/member`) or in its own repo?
2. Which Paperclip API should the app use to read tasks needing a person and to record a claim?
3. Can the app have its own `member_app` schema and role on the DAO Postgres, and who provisions it?
4. Can the app read meeting summaries and Buzz messages through the SQL knowledge tools?

For the Robert's Rules builder:
5. How can Inertia read the member list, and should login verify the email itself or delegate to Robert's Rules?
6. Is there a way to read proposals and vote tallies?

## 12. Left to the builder

Component structure, styling details, exact card copy, how link previews are fetched, caching strategy for adapter reads, session length, and test layout, within the constraints above.
