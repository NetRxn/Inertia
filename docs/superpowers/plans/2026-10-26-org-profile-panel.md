# Organization Profile Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a DAO page (feed-first member view, Members, Sources) and a "Why this exists" task tab to the Inertia Paperclip plugin, backed by an org store with founder/moderator/member roles, spam hiding that also stops agents from using hidden sources, and a source trail for tasks.

**Architecture:** A new `src/org/` module owns one migration, a PostgreSQL store, a pure role policy, a service, and a trail builder. `src/org/host.ts` registers everything as plugin **actions** (`ctx.actions.register`), because only actions receive the host-authenticated actor (`PluginPerformActionContext.actor.userId`); `ctx.data` handlers receive params only and cannot check roles. Two new UI slots (a `page` and an issue `detailTab`) call those actions through `usePluginAction`.

**Tech Stack:** TypeScript 5.9, `@paperclipai/plugin-sdk` 2026.1012.0, React 19, Vitest 4 (PGlite for SQL, jsdom for UI), esbuild via `scripts/build-member-ui.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-25-org-profile-panel-design.md`

## Global Constraints

- Node.js 24.11.0 or newer (`package.json` engines). The Homebrew `node` on this machine is broken (missing libsimdjson); use a working Node 24 install.
- Plugin DB namespace is `BRIDGE_NAMESPACE` (`plugin_netrxn_inertia_e936d62b87`) from `src/store/postgres.ts`; every store constructor throws `Unexpected plugin database namespace.` on any other namespace, and SQL failures surface as a fixed redacted message (pattern: `src/intake/store.ts`).
- Nothing is ever deleted through these features. Hiding sets a flag and appends a log entry; restore clears it.
- Copy fixed by the spec: `Sync source: not connected yet.` and `Will require a DAO vote` (shown next to add member, remove member, appoint/remove moderator), `Why this exists`, `No recorded source`.
- Membership/vote are placeholders: founder and moderators edit the member list directly; every change is logged with actor, time and reason.
- Roles: `founder`, `moderator`, `member`. Founder counts as a moderator for every check.
- Only verified members see the DAO page content; only founder/moderators see the Sources view and the Hidden filter.
- Agents must not read a hidden source.
- Ordinary v2 work approval is untouched.
- No deployment, permission change or submission as part of this work.

## Review Focus

1. **A signed-in Paperclip user who is not in `org_members`** calls any org action → `forbidden`, and no source titles, hidden items or member names come back. (Tests in Task 2 and Task 6.)
2. **A second `org.setup` after a founder exists** (including two concurrent first calls) → exactly one founder; the other gets `conflict`. (Task 2.)
3. **Removing or demoting the last founder/moderator** → refused with `conflict`, so the org never ends up with nobody who can moderate. (Task 2.)
4. **Share box input that is malformed:** a `javascript:`/`data:` URL, a file over 1 MiB, an empty title, control characters → rejected with `invalid`, nothing stored. (Task 3.)
5. **A task whose origin the plugin doesn't recognize, or whose source is hidden or outside the viewer's audience** → trail shows `No recorded source` (or the hidden/restricted step as "Source not available to you"), never a guessed source. (Task 5.)

---

### Task 1: Org migration and store

**Files:**
- Create: `migrations/009_org_profile.sql`
- Create: `src/org/contracts.ts`
- Create: `src/org/store.ts`
- Test: `test/org/store.test.ts`

**Interfaces:**
- Produces (`src/org/contracts.ts`):
  - `type OrgRole = 'founder'|'moderator'|'member'`
  - `interface OrgProfile {companyId:string; name:string; createdBy:string; createdAt:string}`
  - `interface OrgMember {companyId:string; userId:string; displayName:string; role:OrgRole; status:'active'|'removed'; joinedAt:string}`
  - `type SourceKind = 'link'|'file'|'note'|'objective'` (`objective` = an intake/meeting source from `objective_intake`, referenced not copied)
  - `interface OrgSource {companyId:string; sourceKey:string; kind:SourceKind; title:string; url:string|null; mediaType:string|null; byteLength:number|null; sha256:string|null; sharedBy:string; audience:'members'|'moderators'; hidden:null|{by:string; at:string; reason:string}; pins:number; createdAt:string}` — `sourceKey` is `share:<uuid>` for shared items, `objective:<mappingKey>` for intake sources.
  - `interface OrgLogEntry {companyId:string; seq:number; actor:string; action:'org.setup'|'member.add'|'member.remove'|'moderator.set'|'source.share'|'source.hide'|'source.restore'|'source.pin'; subject:string; reason:string; at:string}`
  - `class OrgError extends Error {kind:'forbidden'|'conflict'|'invalid'|'unavailable'}`
- Produces (`src/org/store.ts`): `createOrgStore(db: PluginDatabaseClient): OrgStore` with
  - `readProfile(companyId): Promise<OrgProfile|null>`
  - `createProfile(profile: OrgProfile, founder: OrgMember): Promise<boolean>` — single statement, false if a profile already exists
  - `readMember(companyId, userId): Promise<OrgMember|null>`, `listMembers(companyId): Promise<OrgMember[]>`
  - `upsertMember(member: OrgMember): Promise<void>`
  - `countModerators(companyId): Promise<number>` (active founder + moderator)
  - `insertSource(source: OrgSource, content: Uint8Array|null): Promise<void>`, `readSource(companyId, sourceKey)`, `listSources(companyId, opts:{includeHidden:boolean; kind?:SourceKind; limit:number}): Promise<OrgSource[]>`
  - `setHidden(companyId, sourceKey, hidden: OrgSource['hidden']): Promise<boolean>` — upserts a row for `objective:` keys that have no row yet
  - `isHidden(companyId, sourceKey): Promise<boolean>`
  - `addPin(companyId, sourceKey, userId): Promise<boolean>` (one pin per user per source)
  - `appendLog(entry: Omit<OrgLogEntry,'seq'|'at'>): Promise<OrgLogEntry>`, `listLog(companyId, limit): Promise<OrgLogEntry[]>` newest first
  - All failures → `OrgError('unavailable','Organization data unavailable.')`.

Tables (all in the namespace): `org_profile(company_id PK)`, `org_members(company_id,user_id PK)`, `org_sources(company_id,source_key PK, ..., content bytea NULL, hidden jsonb NULL)`, `org_source_pins(company_id,source_key,user_id PK)`, `org_log(company_id, seq bigserial, ...)` — `org_log` has no UPDATE/DELETE path in the store.

- [ ] **Step 1: Write failing tests** in `test/org/store.test.ts` using the PGlite setup from `test/intake/store.test.ts` (load `009_org_profile.sql`):
  - `createProfile twice for one company: first true, second false, one founder row`
  - `concurrent createProfile x8 yields exactly one true`
  - `setHidden on objective:abc with no row creates it; isHidden true; setHidden null → false`
  - `listSources includeHidden:false omits hidden rows`
  - `addPin same user twice → second false, pins === 1`
  - `listLog returns newest first with increasing seq`
  - `rejects namespace 'public'` and `redacts SQL errors to 'Organization data unavailable.'`
- [ ] **Step 2:** `npx vitest run test/org/store.test.ts` → FAIL (module not found).
- [ ] **Step 3:** Write the migration, contracts and store. JSON fields bind as `$n::jsonb` text, as in `src/intake/store.ts` (no raw arrays across host parameter binding).
- [ ] **Step 4:** `npx vitest run test/org/store.test.ts` → PASS; `npm run typecheck` → no errors.
- [ ] **Step 5:** Commit `feat(org): add org profile migration and store`.

### Task 2: Role policy and governance service

**Files:**
- Create: `src/org/policy.ts`
- Create: `src/org/service.ts`
- Test: `test/org/service.test.ts`

**Interfaces:**
- Consumes: `OrgStore`, contracts from Task 1.
- Produces (`src/org/policy.ts`): `type OrgAction = 'view'|'share'|'pin'|'members.edit'|'moderators.edit'|'sources.view'|'sources.moderate'`; `allowed(role: OrgRole|null, action: OrgAction): boolean` — `null` (not an active member) allows nothing; `member` allows `view`,`share`,`pin`; `moderator`/`founder` allow all.
- Produces (`src/org/service.ts`): `createOrgService(store: OrgStore, clock: () => Date, newId: () => string): OrgService` with
  - `actorRole(companyId, userId): Promise<OrgRole|null>` (removed → null)
  - `setup(companyId, userId, input:{name:string; displayName:string}): Promise<OrgProfile>` — `conflict` if a profile exists
  - `profile(companyId, userId): Promise<{profile:OrgProfile; role:OrgRole; memberCount:number; syncSource:null}>`
  - `members(companyId, userId): Promise<OrgMember[]>` (requires `view`)
  - `addMember(companyId, userId, input:{userId:string; displayName:string; reason:string})`
  - `removeMember(companyId, userId, input:{userId:string; reason:string})`
  - `setModerator(companyId, userId, input:{userId:string; moderator:boolean; reason:string})`
  - each mutating call appends one `OrgLogEntry`; every check failure throws `OrgError`.

- [ ] **Step 1: Write failing tests** (PGlite-backed store, fixed clock):
  - `setup makes caller founder; second setup by another user → conflict`
  - `two concurrent setups → one profile, one conflict`
  - `non-member calling members/addMember → forbidden`
  - `member cannot addMember (forbidden); moderator can; log has member.add with actor and reason`
  - `removeMember sets status removed; removed user's actorRole is null and members() → forbidden`
  - `removing or demoting the last founder/moderator → conflict`
  - `reason is required (empty → invalid) for remove and moderator changes`
- [ ] **Step 2:** Run `npx vitest run test/org/service.test.ts` → FAIL.
- [ ] **Step 3:** Implement. The last-moderator check reads `countModerators` before writing. A concurrent race between two demotions is acceptable for v1; note it in a comment.
- [ ] **Step 4:** Run → PASS; typecheck clean.
- [ ] **Step 5:** Commit `feat(org): roles, setup and member management`.

### Task 3: Sources: share, list, hide, restore, significance, feed

**Files:**
- Modify: `src/org/service.ts`
- Create: `src/org/sources.ts` (input validation + significance)
- Test: `test/org/sources.test.ts`

**Interfaces:**
- Consumes: Task 1 store; Task 2 `actorRole`/`allowed`; `createIntakeStore` is **not** used. Intake sources are listed by a read-only query on `objective_intake` (`record->'snapshot'` title/audience/sourceSystem, `record->>'nativeIssueId'`).
- Produces (`src/org/sources.ts`):
  - `validateShare(input: unknown): {kind:'link'; title:string; url:string} | {kind:'note'; title:string; text:string} | {kind:'file'; title:string; mediaType:string; bytes:Uint8Array}` — url must parse with protocol `https:` or `http:`; title 1–200 chars, no control chars; file base64 decoded ≤ 1 048 576 bytes; note text ≤ 20 000 chars (stored as `content` UTF-8). Otherwise `OrgError('invalid', ...)`.
  - `significance(source: {citations:number; pins:number}): number` = `citations * 2 + pins` (spec: cited by tasks and drafts, plus pins; citations weighted higher as the designer's call).
- Produces (service additions):
  - `share(companyId, userId, input: unknown): Promise<OrgSource>` — requires `share`; audience `members`; logs `source.share`
  - `sources(companyId, userId, opts:{kind?:SourceKind; hidden:boolean}): Promise<Array<OrgSource & {feeds:{tasks:number}}>>` — requires `sources.view`; merges shared rows with `objective:` intake rows; `feeds.tasks` = 1 when the intake mapping has a `nativeIssueId`, else 0; shared items 0
  - `hide(companyId, userId, {sourceKey, reason})`, `restore(companyId, userId, {sourceKey, reason})` — require `sources.moderate`; log `source.hide`/`source.restore`
  - `pin(companyId, userId, {sourceKey})` — requires `pin`
  - `overview(companyId, userId): Promise<null | {profile; role; feed: OrgLogEntry[]; keyDocuments: Array<{sourceKey;title;score:number}>; initiatives: Array<{issueId:string; title:string; openTasks:number}>}>` — returns `null` when the company has no profile yet (any user, so the setup form can show); otherwise requires `view`; feed = last 50 log entries excluding entries whose subject is currently hidden (moderators still see `source.hide` entries); key documents = top 5 non-hidden by `significance`; `initiatives` is filled by the host (Task 6), the service returns `[]`.
  - `isHidden(companyId, sourceKey): Promise<boolean>` (no actor; used by agent tools).

- [ ] **Step 1: Write failing tests:**
  - `share link with https URL stores row, logs source.share, appears in overview feed`
  - `share rejects javascript: URL, data: URL, 1 048 577-byte file, empty title, title with \u0007 → invalid, no row`
  - `member calling sources() → forbidden`
  - `moderator hides a shared source: absent from overview keyDocuments and member feed, present in sources({hidden:true}) with by/at/reason`
  - `restore clears hidden and logs source.restore`
  - `overview before setup returns null for any user; after setup a non-member gets forbidden`
  - `hide objective:<key> for an intake mapping marks it hidden without touching objective_intake`
  - `keyDocuments ordering follows citations*2+pins; ties stable by createdAt`
- [ ] **Step 2:** Run `npx vitest run test/org/sources.test.ts` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS; typecheck clean.
- [ ] **Step 5:** Commit `feat(org): shared sources, moderation and overview`.

### Task 4: Hidden sources stop feeding agents

**Files:**
- Modify: `src/intake/host.ts` (the `objective_source_context` tool handler near line 87)
- Test: `test/intake/host.test.ts` (add cases)

**Interfaces:**
- Consumes: `createOrgStore(ctx.db).isHidden(companyId, 'objective:' + mappingKey)`.
- Produces: when hidden, the tool returns the same denial shape it already returns for an unauthorized source (no new error text that would reveal hiding to an agent).

- [ ] **Step 1: Write failing test** `objective_source_context denies a source hidden as spam and allows it again after restore`. Build on the existing harness in `test/intake/host.test.ts`; apply `009_org_profile.sql` to its database.
- [ ] **Step 2:** Run `npx vitest run test/intake/host.test.ts` → new test FAILS.
- [ ] **Step 3:** Add the `isHidden` check inside `authorizeSource`.
- [ ] **Step 4:** Run the whole file → PASS (existing cases unchanged).
- [ ] **Step 5:** Commit `feat(org): hidden sources are withheld from agent source context`.

### Task 5: Task trail builder

**Files:**
- Create: `src/org/trail.ts`
- Test: `test/org/trail.test.ts`

**Interfaces:**
- Consumes: an issue `{id; title; status; originKind?: string|null; originId?: string|null; description?: string|null; assigneeAgentId?: string|null; assigneeUserId?: string|null}`; the intake mapping (`IntakeMapping` from `src/intake/contracts.ts`) via a reader function; `isHidden`; viewer role.
- Produces:
  - `interface TrailStep {label:string; detail:string; available:boolean}`
  - `interface TaskTrail {summary:string; steps:TrailStep[]; alsoUsed:string[]}` — `summary` e.g. `from Meeting source follow-up · uses 1 source`; when nothing is known: `summary: 'No recorded source'`, `steps: []`
  - `interface TrailAdapter {originKind:string; build(issue, deps): Promise<TaskTrail|null>}`
  - `buildTrail(issue, adapters: TrailAdapter[], deps:{readMapping(key:string):Promise<IntakeMapping|null>; isHidden(sourceKey:string):Promise<boolean>; viewerRole:OrgRole}): Promise<TaskTrail>`
  - `objectiveTrailAdapter: TrailAdapter` for `originKind === 'plugin:netrxn.inertia:objective'`. Steps: ① source (snapshot title, `sourceSystem`, audience) → ② `Pulled into intake as "<title>"` → ③ `This task`. For a Roundtable mapping (`authorRef === 'configured-roundtable-integration'`) step ① reads `Meeting source (<sourceId>)`. Source text is **not** copied into the trail; audience `restricted` or hidden → step ① `available:false`, detail `Source not available to you` unless viewer is founder/moderator.
  - `parseTaskFields(description:string|null): {doneWhen:string|null; nextStep:string|null}` — reads lines starting `Done when:` and `Next step:` (designer's call: no native fields exist for these).

- [ ] **Step 1: Write failing tests:**
  - `issue with no originKind → summary 'No recorded source', no steps`
  - `unknown originKind 'plugin:other:x' → 'No recorded source'`
  - `objective origin with mapping → 3 steps, summary names the source title`
  - `mapping missing → 'No recorded source'`
  - `hidden source, member viewer → step 1 available:false 'Source not available to you'; moderator sees it with '(hidden)'`
  - `restricted audience, member viewer → step 1 not available`
  - `parseTaskFields extracts 'Done when:' and 'Next step:' lines; absent → null`
- [ ] **Step 2:** Run `npx vitest run test/org/trail.test.ts` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(org): task source trail`.

### Task 6: Host actions and manifest

**Files:**
- Create: `src/org/host.ts`
- Modify: `src/worker.ts` (call `registerOrgProfile(ctx)` in `setup`)
- Modify: `src/manifest.ts` (capabilities, slots)
- Test: `test/org/host.test.ts`; update `test/e2e/plugin.test.ts` if it asserts the slot/capability list

**Interfaces:**
- Consumes: Tasks 2, 3, 5.
- Produces: `registerOrgProfile(ctx: PluginContext): void` registering these `ctx.actions` keys. Every handler reads `context.actor`; `actor.type !== 'user'` or missing `userId`/`companyId` → `{ok:false, error:{kind:'forbidden'}}`. Results are `{ok:true, data}` or `{ok:false, error:{kind, message}}`. `OrgError` maps to its kind; anything else → `unavailable` with a fixed message.

| Action key | Params | Service call |
|---|---|---|
| `org.overview` | — | `overview` + `initiatives` from `ctx.issues.list({companyId, limit: 50})` grouped by parent, top-level issues with open child counts |
| `org.setup` | `{name, displayName}` | `setup` |
| `org.members` | — | `members` |
| `org.member.add` / `org.member.remove` | as Task 2 | |
| `org.moderator.set` | as Task 2 | |
| `org.source.share` | share input | `share` |
| `org.sources` | `{kind?, hidden}` | `sources` |
| `org.source.hide` / `org.source.restore` / `org.source.pin` | as Task 3 | |
| `org.task.trail` | `{issueId}` | `ctx.issues.get(issueId, companyId)` → `buildTrail` + `parseTaskFields`; returns `{title, status, assignee, doneWhen, nextStep, trail}` |

- Manifest: add capabilities `ui.page.register` and `issues.read` (already present). Add slots `{type:'page', id:'dao', displayName:'DAO', exportName:'OrgPage'}` and `{type:'detailTab', id:'task-trail', displayName:'Why this exists', exportName:'TaskTrailTab', entityTypes:['issue']}`. Keep the existing `member-packet` slot.

- [ ] **Step 1: Write failing tests** with `createTestHarness` from `@paperclipai/plugin-sdk/testing` (pattern: existing host tests in `test/intake/host.test.ts`):
  - `agent actor calling org.members → forbidden`
  - `user not in org calling org.overview → forbidden and response has no data field`
  - `setup then overview returns role founder and memberCount 1`
  - `org.task.trail for an issue in another company → forbidden/not found, no title leaked`
  - `unexpected thrown error maps to unavailable with fixed message`
  - `manifest has page slot 'dao' and detailTab 'task-trail' with the listed export names`
- [ ] **Step 2:** Run `npx vitest run test/org/host.test.ts` → FAIL.
- [ ] **Step 3:** Implement and wire into `src/worker.ts`.
- [ ] **Step 4:** Run `npx vitest run test/org test/e2e/plugin.test.ts` → PASS; typecheck clean.
- [ ] **Step 5:** Commit `feat(org): register org actions and UI slots`.

### Task 7: DAO page UI (feed-first, Members, Sources)

**Files:**
- Create: `src/ui/org-client.ts` (response parsing; shape-checks like `src/ui/member-packet-client.ts`)
- Create: `src/ui/OrgPage.tsx`
- Create: `src/ui/index.tsx` exporting `MemberPacketTab`, `OrgPage`, `TaskTrailTab`
- Modify: `scripts/build-member-ui.mjs` (`uiEntry: 'src/ui/index.tsx'`)
- Test: `test/org/org-page-ui.test.tsx` (`// @vitest-environment jsdom`, mount pattern from `test/grants/member-packet-ui.test.tsx`; mock `@paperclipai/plugin-sdk/ui` `usePluginAction` with `vi.mock`)

**Interfaces:**
- Consumes: Task 6 action keys and result shapes.
- Produces: `export function OrgPage({context}: PluginPageProps)`, with three views switched by in-page tabs `Overview | Members | Sources` (Sources tab rendered only when role is founder/moderator).
  - **No org yet:** a setup form (org name, your display name) → `org.setup`.
  - **Overview (feed-first):** header with org name and member count; main column: share box (`aria-label="Share with the DAO"`: link/note text input, file input, title input, Share button) above the activity feed; sidebar: Initiatives (title + open-task count), Key documents (top 5).
  - **Members:** banner `Sync source: not connected yet.`; table of name, role, joined, status; for founder/moderator: Add member, Remove (requires reason), Make/Remove moderator (requires reason). Each control carries the text `Will require a DAO vote`.
  - **Sources:** filter chips All/Links/Files/Notes/Meetings and Hidden; table columns Source, Shared by, Status, Who can see, Feeds; row actions Hide as spam (reason prompt) / Restore.
  - `forbidden` from `org.overview` → `You're not a member of this DAO yet.`

- [ ] **Step 1: Write failing tests:**
  - `renders setup form when org.overview returns {ok:true,data:null}`
  - `feed-first: share box appears before the activity feed in DOM order; sidebar lists initiatives and key documents`
  - `member role: no Sources tab, no member edit controls`
  - `moderator: Members shows 'Sync source: not connected yet.' and each edit control shows 'Will require a DAO vote'`
  - `Remove member without reason does not call the action`
  - `Hide as spam calls org.source.hide with sourceKey and reason, then reloads sources`
  - `forbidden overview shows "You're not a member of this DAO yet."`
  - `org-client rejects a response with unexpected keys`
- [ ] **Step 2:** Run `npx vitest run test/org/org-page-ui.test.tsx` → FAIL.
- [ ] **Step 3:** Implement. Read the file in the browser with `FileReader.readAsDataURL`, strip the prefix and send base64. Block files over 1 MiB client-side with a message, as well as server-side.
- [ ] **Step 4:** Run → PASS; `npm run build` succeeds and `dist/ui/index.js` exports all three components.
- [ ] **Step 5:** Commit `feat(ui): DAO page with feed, members and sources`.

### Task 8: "Why this exists" task tab and package check

**Files:**
- Create: `src/ui/TaskTrailTab.tsx`
- Test: `test/org/task-trail-ui.test.tsx`

**Interfaces:**
- Consumes: `org.task.trail` (Task 6); `parseTaskTrailResponse` added to `src/ui/org-client.ts`.
- Produces: `export function TaskTrailTab({context}: PluginDetailTabProps)`. Returns `null` unless `context.entityType === 'issue'`. Layout per the approved mockup: large title; `status · due`; cards **Assigned to**, **Done when**, **Next step** (cards hidden when null); then a `<details>` collapsed by default whose `<summary>` reads `Why this exists · <trail.summary>`; expanded shows numbered steps (unavailable steps in muted text) and `Also used: …` when `alsoUsed` is non-empty.

- [ ] **Step 1: Write failing tests:**
  - `details element is closed on first render; summary text starts with 'Why this exists'`
  - `'No recorded source' summary renders with no step list`
  - `unavailable step renders 'Source not available to you'`
  - `Done when / Next step cards omitted when null`
  - `non-issue entity renders nothing`
- [ ] **Step 2:** Run `npx vitest run test/org/task-trail-ui.test.tsx` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run full verification:
  - `npm test` → all pass
  - `npm run typecheck` → clean
  - `npm run test:package` → passes (new migration included via `migrations/*.sql`; new UI in `dist/ui/`)
- [ ] **Step 5:** Commit `feat(ui): Why this exists task tab`.

---

## Decisions this plan makes (beyond the spec)

- All org reads and writes are actions, not data handlers, because only actions carry the authenticated actor.
- Shared files are stored in the plugin database (`bytea`) with a 1 MiB cap. Larger files and real object storage are later work.
- Significance = `citations × 2 + pins`. A citation is currently the single intake → task link. Shared uploads gain citations only once drafts and tasks record which shared sources they used, which is future work.
- `Done when` and `Next step` are read from `Done when:` / `Next step:` lines in the issue description, since Paperclip issues have no such fields.
- Only the intake/meeting origin has a trail adapter in v1. Funding discovery and drafting origins show `No recorded source` until each gets an adapter.
- Hiding is enforced for agents in `objective_source_context`. Meeting extraction tools resolve through the same intake mapping; extending the check to `meeting_source_context` is a follow-up if hiding a meeting must also stop extraction.
