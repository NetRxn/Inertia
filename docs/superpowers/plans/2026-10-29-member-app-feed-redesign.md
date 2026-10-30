# Member App Feed Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the member app one simple, consistent picture of the organization: the initiatives approved in onboarding show everywhere, the menu shrinks to Agents · Home · Organization, Home is a scrolling member feed and Agents is a scrolling agent feed.

**Architecture:** One shared initiatives read model (organization profile + work engine) and one shared activity timeline feed every screen. Home renders the timeline; Work keeps only what needs action. Org, Calendar and Docs get targeted redesigns. New persistent state (library documents, integration settings, extracted dates) goes in `member_app` tables through drizzle migrations.

**Tech Stack:** Next.js (repo's pinned version: read `node_modules/next/dist/docs/` before writing code, per `apps/member/AGENTS.md`), React 19, TypeScript, drizzle + Postgres (`member_app` schema), vitest (`apps/member/test/`), Playwright (`apps/member/e2e/`).

**Purpose (Kyle, 2026-10-29):** distill the organization's current status, initiatives and open items down to the member level, so anyone, however technical, can get up to speed. Home is that member view. Agents is the technical view. Organization is the reference.

**Spec:** Kyle's walkthrough of 2026-10-29 (summarised under "Requirements" below) plus `member-layer/DASHBOARD.md`.

**Branch:** The app is not on `develop` or `main` yet; it lives on the stacked PRs #70 → #74 → #75 → #118 → #120 → #125. This branch (`claude/member-app-feed-redesign-cf004e`) is reset to `origin/claude/hero-page-mockup-frnw61` (#125). Each phase below is one PR stacked on the previous one; retarget after #125 merges. All paths are relative to `apps/member/`.

## Requirements (from the walkthrough)

| # | Area | Ask |
|---|------|-----|
| R1 | Initiatives | Initiatives approved in onboarding must appear on Home and Work, the same as on Organization. |
| R2 | Home | Replace "Top priorities" with the organization's initiatives (the bigger goals), and make Home a scrolling timeline of what's happening. |
| R3 | Governance | Rename Votes → Governance; placeholder until Vocdoni is integrated. |
| R4 | Work recap | Separate agent numbers (from Paperclip) from member task numbers. |
| R5 | Work status | "Turn DAO priorities into evidenced, reviewed work" is unclear; fix it. Show people and agent completions as one timeline, not side-by-side lanes. |
| R6 | Menu | Consolidate: if tabs repeat the same information, merge them. Simple and easy. |
| R7 | Organization | Merge "People" (profile) into Members. Move "Add to Inertia" to Home. Center the tab bar and match the app's tab styling. |
| R8 | Integrations | Real settings for working integrations: add Telegram now, and the language model switcher. Placeholders for the rest. |
| R9 | Settings | Nothing crucial; add what's relevant. |
| R10 | Funding | Pull in grant-finder projects. **Out of scope here:** Kyle is messaging John. |
| R11 | Calendar | Month calendar with tagged dates found in the data. |
| R12 | Docs | A browser of key company documents (one-pagers etc.) that admins add, visible to the whole organization. |
| R13 | Profile | Simple for now; no new profile features. |
| R15 | Profile (follow-up) | Profile lives under Organization → People: admins edit the member list, each member edits their own row. |
| R16 | Agents (follow-up) | Agents shows the incoming data feed (Buzz and other connectors) beside Paperclip work. |
| R14 | Menu (follow-up) | Three items: Agents · **Home** (center) · Organization. Agents holds Paperclip, Buzz and all integrations; Organization holds Funding, Governance, Calendar and Docs. Consolidate anything not wired up yet. |

## Findings that shape the plan

1. **Why approved initiatives are missing (R1).** Organization reads `organization.profile.initiatives` from Postgres (`src/app/(member)/org/page.tsx:74`). Home and Work read `adapters.work.listInitiatives()`, which in live mode is Paperclip company goals (`src/adapters/paperclip.ts:197`). Paperclip runs read-only by default (`PAPERCLIP_ACCESS` ≠ `write`, `paperclip.ts:33`), and read-only strips `createInitiative` (`paperclip.ts:342`). So `decideInitiative` (`src/org/actions.ts:115`) saves `workId: null` and nothing reaches Paperclip. Even in write mode, governance-on initiatives are created `planned` → mapped to `paused` → dropped by Home's `status === 'active'` filter (`src/feed/build-feed.ts:85`).
2. **"Turn DAO priorities into evidenced, reviewed work" is data, not copy.** It isn't in the source. It is almost certainly the Paperclip company's root company-level goal (the agents' mission), shown by Work → Status as if it were an initiative. Task 1 confirms this against the live Paperclip and keeps root goals out of the initiative list.
3. **Calendar is empty because live mode has no event source.** `src/adapters/live.ts:69` returns `[]`.
4. **Docs today are private.** `documents` rows are per member (`src/documents/documents.ts:25`); there is no organization-wide library.
5. **Integrations are all environment variables.** `src/org/integrations.ts` only describes env state; nothing is editable in the app.

## Information architecture (R6, agreed 2026-10-29)

The menu goes from 8 items to **3**, with Home in the middle:

```
   [ Agents ]      [ Home ]      [ Organization ]
```

| Menu | Audience | Sub-tabs (same centered tab bar everywhere) | Replaces |
|------|----------|----------|----------|
| **Agents** (left) | Anyone curious what the agents are doing; admins connecting things | **Activity** (default): agent recap + scrolling feed of what agents finished, started or are stuck on, by initiative, plus incoming data (Buzz digests, Telegram, meetings and uploads as they're read) · **Connections**: Paperclip and Buzz status up top, then every other integration, with settings for the working ones (language model, Telegram) | Work → Status (agent lane), Org → Integrations |
| **Home** (center) | Every member | One scrolling feed: initiatives strip · "Waiting on you" · Add to Inertia · member timeline (tasks open to claim, what members did, decisions and action items from meeting notes, shares, votes, funding, upcoming dates). Paperclip tasks that need a person land here, not on Agents. | Home cards, Work → Needs you / Initiatives / Ideas, Org → Data → Add to Inertia |
| **Organization** (right) | Every member | **Overview** (profile, initiatives, lately) · **People** (member list, editable by admins; your own row opens your profile to edit; people mentioned in sources) · **Funding** · **Governance** (placeholder) · **Calendar** · **Docs** · **Data** · **Settings** (admin) | Organization, Funding, Votes, Calendar, Docs |

**Profile** leaves the menu and becomes part of **Organization → People**: you edit your own profile from your row in the member list (sign-out lives there too), and admins edit anyone's. No menu slot for one setting.

**Rule for what goes where:** related things live together, and anything not wired up yet (Governance, Funding until John's link, planned integrations) sits inside a parent tab rather than taking a menu slot. A sub-tab earns its own menu item only once it is used daily.

Both feeds are built by one timeline engine (Task 3) filtered by actor: members and organization items on Home, agent items on Agents. Initiatives show on both, from the one shared list (Task 1), so they can't drift apart.

## Global Constraints

- Thin client: no business logic duplicating Paperclip or Robert's Rules (`member-layer/DASHBOARD.md`). Writes go through Paperclip or Inertia's own tables.
- Never serialise other members' `externalId`s to the client (existing rule, `src/app/(member)/work/page.tsx:61`).
- Every page keeps the `Suspense` + `requireMember()` pattern so Cache Components can prerender the shell.
- Copy follows the app's voice: short, plain, second person, no jargon ("agents", not "Paperclip issues").
- Design system: `in-glass`, `in-chip--*`, `in-label`, tokens from `design/tokens.json`; tab bars use the shared `src/components/Tabs.module.css` `.tabs`/`.tab` (created in Task 7 from `work.module.css`; until then Task 5 imports from its current place).
- Fixture mode (`MEMBER_APP_ADAPTERS=fixture`) must keep working for every screen; fixtures gain whatever new shapes the live sources return.
- Secrets entered in Settings are encrypted at rest and never sent back to the browser.

## Review Focus

1. **Paperclip read-only with governance on** (the live setup today): an accepted initiative with `workId: null` must still show on Home, Agents and Organization as "Awaiting vote". Test in Task 1.
2. **Same initiative in both sources**: an accepted profile initiative whose `workId` matches a Paperclip goal appears once, with Paperclip's progress. Test in Task 1.
3. **Agent tasks with no initiative or under the root goal** appear in the Agents feed under "General", never as an initiative named after the agents' mission. Test in Task 1 and Task 3.
4. **Old links and bookmarks** (`/work`, `/votes`, `/funding`, `/calendar`, `/docs`, chat answers that cite them) land on the new tab, never a 404. Test in Task 6.
5. **Empty organization** (fresh install, no sources, no Paperclip): Home shows the composer and an empty-state line, not a blank page. Test in Task 4.
6. **Non-admin on Docs and Agents → Connections**: can read the library and see integration status; cannot add documents or see/edit secrets. Tests in Tasks 10 and 8.

---

## Phase A — One picture of the organization (PR 1)

### Task 1: Shared initiatives read model — done

**Files:** `src/work/org-initiatives.ts`, `src/adapters/types.ts` (`Initiative.source?`, `Initiative.awaitingVote?`), `test/org-initiatives.test.ts`

**Interfaces:** `mergeInitiatives(org: { governanceEnabled; profile } | null, engine: Initiative[]): Initiative[]` (pure) and `listOrgInitiatives(db: Db, work: Pick<WorkSource, 'listInitiatives'>): Promise<Initiative[]>`.

**Rule as built:** initiatives accepted in onboarding come first, in onboarding order (`priority = index`). An engine goal joins one by `workId` or case-insensitive title and lends its id, status and progress. Governance on and not adopted → `status: 'active'`, `statusLabel: 'Awaiting vote'`, `awaitingVote: true`. Engine goals no accepted initiative claims are left out once onboarding accepted anything, so the agents' root goal ("Turn DAO priorities into evidenced, reviewed work") never shows as an initiative and its work groups as not tied to an initiative. With nothing accepted, the engine's goals are the list.

Not confirmed against the live Paperclip (no credentials in this environment); the rule doesn't depend on how Paperclip marks a root goal.

### Task 2: Every screen reads the shared list — done

**Files:**
- Modify: `src/feed/build-feed.ts:70-88`, `src/work/status.ts:46`, `src/app/(member)/work/page.tsx:46-58`, `src/app/(member)/org/page.tsx:74`, `src/assistant/source-data.ts` (wherever the assistant lists initiatives), `src/adapters/fixtures/*` (fixture org profile with accepted initiatives)
- Test: `test/feed.test.ts`, `test/work-status.test.ts`

**Interfaces:**
- Consumes: `listOrgInitiatives` (Task 1). `buildFeed` and `buildWorkStatus` take `initiatives: Initiative[]` as a new parameter instead of calling `adapters.work.listInitiatives()`.

- [ ] **Step 1: Failing tests.** `feed.test.ts`: `initiatives awaiting a vote are included in the initiatives card`. `work-status.test.ts`: `agent tasks under the root goal group under General`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Pages call `listOrgInitiatives(getDb(), adapters.work)` once and pass it down. Org page keeps the admin-only proposed/dismissed rows from the profile but marks accepted ones from the shared list.
- [ ] **Step 4: Run** `npm test` → PASS; `npm run typecheck && npm run lint` → clean.
- [ ] **Step 5: Manual check** in fixture mode (`npm run dev`): the same initiatives, in the same order, on Home, Work and Organization (Work becomes Agents in Task 5).
- [ ] **Step 6: Commit** `fix(member-app): approved initiatives show on Home and Work`.

## Phase B — Home, Agents and the three-item menu (PR 2)

### Task 3: Activity timeline model

**Files:**
- Create: `src/feed/timeline.ts`
- Test: `test/timeline.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type TimelineActor = { kind: 'member'; name: string } | { kind: 'agent'; name: string | null } | { kind: 'connector'; name: string /* 'Buzz', 'Telegram', 'Upload'… */ } | { kind: 'organization' };
  type TimelineItem = {
    id: string;              // `${kind}:${sourceId}`, stable for React keys and dedupe
    kind: 'task-done' | 'task-claimed' | 'agent-done' | 'agent-blocked' | 'meeting' | 'share' | 'proposal' | 'funding' | 'initiative' | 'event' | 'incoming';
    at: string;              // ISO
    actor: TimelineActor;
    title: string;
    detail: string | null;
    initiative: { id: string; title: string } | null;  // null renders as "General"
    href: string | null;
    source: SourceRef;       // so tapping asks the chat about it, like AskCard today
  };
  buildTimeline(input: { adapters: Adapters; db: Db; initiatives: Initiative[]; shares: ShareSummary[]; now: Date; before?: string; limit: number }): Promise<{ items: TimelineItem[]; nextBefore: string | null }>;
  ```
- Data sources: member completions/claims from `work_events` (`src/work/events.ts`, already recorded in Inertia), agent tasks from `adapters.work.listAgentTasks()` (`done`/`blocked`, by `updatedAt`), meetings, shares, proposals (opened/closed), funding highlights, initiatives accepted (profile), upcoming events within 7 days, and `incoming` items from `org_sources` (one per source read: Buzz digest, Telegram digest, meeting, upload, website, GitHub) with a `connector` actor.

- [ ] **Step 1: Failing tests:** `items are newest first across sources`; `a member's completion and an agent's completion of the same day both appear, with their actor kinds`; `paging with before returns the next page with no duplicates`; `agent task under the root goal has initiative null`; `other members' externalIds never appear in items`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `buildTimeline`. Over-fetch each source by `limit`, merge, sort by `at` desc, slice; `nextBefore` = last item's `at`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(member-app): organization activity timeline`.

### Task 4: Home becomes the timeline

**Files:**
- Create: `src/components/Timeline.tsx`, `src/components/Timeline.module.css`, `src/components/InitiativesStrip.tsx`, `src/app/api/timeline/route.ts` (GET `?before=` for infinite scroll)
- Modify: `src/app/(member)/page.tsx`, `src/components/cards/PrioritiesCard.tsx` (retitle "Initiatives", reused by the strip), `src/feed/build-feed.ts` (keep only `waiting` as a pinned "Waiting on you" card)
- Move: `ShareComposer` (now also "Add to Inertia" upload: reuse the Data tab's add form component) to the top of Home
- Test: `test/timeline-route.test.ts`, `e2e/home.spec.ts`

**Layout, top to bottom:** greeting → Initiatives strip (horizontal scroll of planets, tap filters the feed to that initiative) → "Waiting on you" (only when non-empty) → Add to Inertia composer → filter chips `All · Open to claim · Meetings · Shared` → member timeline (`buildTimeline` with `actors: ['member', 'organization']`) grouped by day ("Today", "Yesterday", date) → "Load more" sentinel (IntersectionObserver, plain button without JS).

**Open to claim** items are the human tasks from Paperclip (and Inertia), with the existing claim/complete actions from `WorkList`. **Meeting action items** show as "From the meeting on {date}" with a "Make this a task" button (admins; uses `createTask` when the engine allows it, otherwise an Inertia-held task).

`buildTimeline` (Task 3) gains `actors?: TimelineActor['kind'][]` so Home and Agents share it.

- [ ] **Step 1: Failing tests.** Route: `401 without a session`; `returns 20 items and nextBefore`. E2E: `home shows initiatives approved in setup`; `home timeline loads more on scroll`; `empty organization shows the composer and "Nothing has happened yet. Add a meeting, link or note to get started."`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Agent items use the tide accent and an agent glyph, member items moss with initials; each item keeps `AskCard` behaviour (tap asks the chat).
- [ ] **Step 4: Run** `npm test && npm run e2e -- home` → PASS.
- [ ] **Step 5: Commit** `feat(member-app): Home is a scrolling timeline of the organization`.

### Task 5: Agents screen (replaces Work)

**Files:**
- Create: `src/app/(member)/agents/page.tsx` (sub-tabs `activity` default, `connections`), `src/components/AgentRecap.tsx`
- Modify: `src/work/status.ts` (recap becomes `{ members, agents }`; only `agents` is used here, `members` feeds Home's "Waiting on you"), `next.config.ts` (permanent redirects `/work` → `/agents`, `/work?tab=needs-person|initiatives|ideas` → `/`)
- Delete: `src/app/(member)/work/page.tsx`, `src/components/WorkStatusView.tsx` (lanes go away; `WorkList` moves to Home in Task 4)
- Test: `test/work-status.test.ts`, `e2e/agents.spec.ts` (replaces `e2e/work.spec.ts`)

**Activity tab:** recap tiles `{agentsWorking} working now` · `{agentsBlocked} stuck` · `{agentsDoneThisWeek} done this week` · "Open Paperclip ↗"; then the initiatives strip (same component as Home); then `buildTimeline({ actors: ['agent', 'connector'] })` grouped by day, with chips `All · Agent work · Incoming data`. An agent item that asks for a person links to its Home item ("A member is needed: see Home").
**Connections tab:** built in Task 8.
Header: "Agents" · subtitle "What your agents are working on."

- [ ] **Step 1: Failing tests:** `recap returns members and agents separately, agents counting blocked`; e2e `agents activity shows only agent items`; `/work redirects to /agents`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(member-app): Agents screen with its own recap and feed`.

### Task 6: Three-item menu; sections move under Organization

**Files:**
- Modify: `src/components/FloatingMenu.tsx` (`SECTIONS` = Agents `/agents`, Home `/`, Organization `/org`, in that order, Home centered and slightly larger), `src/app/(member)/org/page.tsx` (`Tab` = `overview | people | funding | governance | calendar | docs | data | settings`), `next.config.ts` (permanent redirects `/funding` → `/org?tab=funding`, `/votes` → `/org?tab=governance`, `/calendar` → `/org?tab=calendar`, `/docs` → `/org?tab=docs`, `/profile` → `/org?tab=people#me`, `/org?tab=members` → `/org?tab=people`), `src/feed/card-question.ts`, `src/assistant/system-prompt.ts` and any links that point at the old paths
- Move: the bodies of `funding/page.tsx`, `calendar/page.tsx`, `docs/page.tsx` into `src/app/(member)/org/tabs/{Funding,Calendar,Docs}Tab.tsx`; delete `votes/page.tsx` (keep `ProposalsCard` for the timeline)
- Create: `src/app/(member)/org/tabs/GovernanceTab.tsx`
- Test: `e2e/sections.spec.ts`

**Governance tab (placeholder):** one line "Proposals, votes and the rules your agents follow will live here once Vocdoni is connected."; when `adapters.proposals.connected` the existing proposal list renders below; a link to Robert's Rules if `ROBERTS_RULES_URL` is set.

- [ ] **Step 1: Failing e2e:** `menu has exactly Agents, Home, Organization, with Home in the middle`; `/profile opens your row in People`; each old path redirects to its new tab; `organization tabs include Funding, Governance, Calendar and Docs`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(member-app): three-item menu; Funding, Governance, Calendar and Docs live under Organization`.

## Phase C — Organization cleanup and Agents → Connections (PR 3)

### Task 7: Overview, People (with your profile) and the tab bar

**Files:**
- Modify: `src/app/(member)/org/page.tsx` (Overview tab: drop `Lines title="People"`; Data tab loses "Add to Inertia" and links to Home instead; Integrations tab removed, it moved to Agents → Connections), `src/app/(member)/org/org.module.css` (`.scrollTabs`)
- Modify: People tab (was Members): your own row first, expanded, with the Profile page's content and edit form (move `src/app/(member)/profile/page.tsx` body into `src/app/(member)/org/tabs/MyProfile.tsx`, anchor `#me`) and sign-out; then the member list, each row editable by admins (name, role, active); then "Mentioned in your sources" with the profile's `people` lines not matched to a member by name, each with an admin "Invite" action prefilled into "Add someone"
- Delete: `src/app/(member)/profile/page.tsx` (redirected in Task 6)
- Test: `e2e/sections.spec.ts`

- [ ] **Step 1: Failing e2e:** `org overview has no People section`; `people tab lists people mentioned in sources`; `a member can edit their own row but not another's`; `an admin can edit any row`; `org tab bar is centered` (assert the nav's bounding box center is within 2px of the column center at 390px and 1280px widths).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Tab bar: move `.tabs`/`.tab` out of `work.module.css` (deleted in Task 5) into `src/components/Tabs.module.css`, use it unchanged with `justify-content: center`, and keep horizontal scroll only when it overflows (`.scrollTabs { justify-content: safe center; }`), so Organization, Agents and any other sub-tabs share one tab bar. With eight Organization tabs the bar scrolls on phones; the active tab scrolls into view on load.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(member-app): Organization overview; People holds the member list and your profile`.

### Task 8: Integration settings (Telegram, language model)

**Files:**
- Create: `drizzle/0002_integration_settings.sql` (via `npx drizzle-kit generate`), `src/org/settings-store.ts`, `src/org/secrets.ts`, `src/components/IntegrationSettings.tsx`, `src/app/(member)/agents/ConnectionsTab.tsx`
- Modify: `src/db/schema.ts` (table `integration_settings`: `id text pk` — `'model' | 'telegram'`, `config jsonb not null`, `secret text` (encrypted), `updated_by uuid`, `updated_at`), `src/assistant/model.ts` (DB setting overrides env), `src/org/integrations.ts` (cards read DB state; add `editable: boolean`), `src/app/(member)/org/page.tsx` (move the IntegrationsTab body and "Test the connections" into Agents → Connections)
- Test: `test/settings-store.test.ts`, `test/model.test.ts`

**Interfaces:**
- `getIntegrationSetting<T>(db, id): Promise<{ config: T; hasSecret: boolean } | null>`; `saveIntegrationSetting(db, id, config, secret?: string | null, by: string): Promise<void>`; `readSecret(db, id): Promise<string | null>` (server only).
- `secrets.ts`: AES-256-GCM with key from `MEMBER_APP_SECRET_KEY` (32-byte base64); saving a secret without the key fails with "Set MEMBER_APP_SECRET_KEY to store keys in the app."

**Language model:** provider (`anthropic` | `openai-compatible`), model, fast model, base URL, API key. Saving runs the existing connection check (`src/connectors/check.ts`) and reports the result. Env stays the fallback.
**Telegram:** bot token, allowed chat IDs, digest time. Saving calls `getMe` to verify the token. Digests keep using `/api/org/ingest`.
**Connections layout:** Paperclip and Buzz first, as large status cards (connected or not, read or write, last sync, link out); then "Settings" (language model, Telegram) for admins; then everything else.
**Others** (GitHub, Grant finder, Robert's Rules, Drive, Discord): read-only cards as today, labelled "Set up by your host" or "Coming next".

- [ ] **Step 1: Failing tests:** `secret round-trips encrypted and the stored value is not the plaintext`; `getIntegrationSetting never returns the secret`; `model config from the DB overrides env`; `non-admin save is refused`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npm test` → PASS; `npm run migrate` on a scratch DB → applies.
- [ ] **Step 5: Commit** `feat(member-app): Agents → Connections with model and Telegram settings`.

### Task 9: Settings tab

**Files:** Modify `src/app/(member)/org/page.tsx` `SettingsTab`.

Add, beside Governance and Setup: organization name and website (edit), time zone (used by Calendar and timeline day groups; currently implied), "Who can add documents to the library" (admins only / any member), and "Export organization data" (existing sources as JSON). Each is a small form using the existing `actions.ts` pattern.

- [ ] **Step 1: Failing test** `org-settings.test.ts`: `saving the time zone changes formatDay output`. **Step 2–4:** run → FAIL, implement, run → PASS.
- [ ] **Step 5: Commit** `feat(member-app): organization settings`.

## Phase D — Calendar and Docs inside Organization (PR 4)

### Task 10: Docs library

**Files:**
- Create: `drizzle/0003_library.sql`, `src/documents/library.ts`, `src/app/(member)/org/tabs/LibraryGrid.tsx`, `src/app/api/library/route.ts`
- Modify: `src/db/schema.ts` (table `library_documents`: `id uuid`, `title`, `description`, `category text` (`'one-pager' | 'policy' | 'brand' | 'finance' | 'other'`), `file_id uuid null → files`, `link_url text null`, `pinned bool`, `added_by uuid`, `created_at`, `updated_at`; check exactly one of file/link), `src/app/(member)/org/tabs/DocsTab.tsx`
- Test: `test/library.test.ts`, `e2e/sections.spec.ts`

Page order: **Library** (grid of cards by category, pinned first, search box, admin "Add document" upload/link) → **Meeting notes** (existing) → **My documents** (existing private docs, collapsed). Library files are readable by every signed-in member through the existing `/api/files/[id]` with a library check.

- [ ] **Step 1: Failing tests:** `any member lists library documents`; `non-admin cannot add (unless the Task 9 setting allows it)`; `a library file downloads for any member, a private document still doesn't`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(member-app): organization document library`.

### Task 11: Calendar month view with dates from the data

**Files:**
- Create: `src/calendar/dated-items.ts`, `src/components/MonthGrid.tsx`, `src/components/MonthGrid.module.css`, `drizzle/0004_org_dates.sql`
- Modify: `src/db/schema.ts` (table `org_dates`: `id`, `source_id → org_sources`, `date date`, `time text null`, `title`, `kind` (`'meeting' | 'deadline' | 'event' | 'other'`)), `src/org/ingest.ts` (ask the fast model for dated items when reading a source; store them), `src/app/(member)/org/tabs/CalendarTab.tsx`
- Test: `test/dated-items.test.ts`, `test/org-ingest.test.ts`

**Interfaces:** `listDatedItems(input: { adapters; db; initiatives; month: { year: number; month: number } }): Promise<DatedItem[]>` where `DatedItem = { id; date: string /* YYYY-MM-DD */; title; tag: 'Meeting' | 'Deadline' | 'Vote' | 'Funding' | 'Task due' | 'From your data'; href: string | null }`.

Sources: `events.listUpcoming`, meeting dates, proposal `closesAt`, funding `deadline`, human task `due`, `org_dates`. Tab: month grid (`/org?tab=calendar&month=2026-11`, prev/next), each day shows up to 3 coloured tag dots + "+n", selecting a day lists its items below; on phones the grid collapses to a week strip plus the list.

- [ ] **Step 1: Failing tests:** `items from every source land on the right day in the org time zone`; `a date-only funding deadline is not shifted by time zone`; `ingest stores dated items the model returns and ignores invalid dates`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(member-app): month calendar with dates from the organization's data`.

## Out of scope / follow-ups

- **Funding ↔ grant finder projects (R10):** Kyle is raising it with John. Once agreed, funding opportunities link to initiatives via `initiativeId` and appear in the timeline automatically (Task 3 already reads funding).
- **Vocdoni integration:** Governance stays a placeholder (Task 6).
- **Paperclip write mode:** turning on `PAPERCLIP_ACCESS=write` would create accepted initiatives as Paperclip goals; Task 1 makes the app correct either way.
