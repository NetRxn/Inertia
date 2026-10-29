# Connecting Paperclip, Telegram and Buzz

Updated 2026-10-27. Step-by-step order for a first live connection: [connect-morning.md](connect-morning.md). For the member app in `apps/member`. Every setting goes in `apps/member/.env.local` (see `.env.example`); nothing secret goes in git.

**Test as you go:** `npx tsx scripts/check-integrations.ts` (or Agents → Connections → **Check connections**, admins only). It tests the model, Paperclip, the ingest endpoint, the Telegram bot and Buzz with the current settings, changes nothing, and says what to fix.

```
            ┌──────────── member app (Inertia) ────────────┐
Telegram ─┐ │                                              │
          ├─▶ connectors ──▶ /api/org/ingest ──▶ org memory │──▶ profile, Find work, chat
Buzz ─────┘ │ (scripts/connectors.ts)                       │
            │                       Work, Funding ◀────────▶│◀──▶ Paperclip (goals, projects, issues)
            └──────────────────────────────────────────────┘
Buzz task threads ◀────── Inertia Paperclip plugin (Buzz bridge) ──────▶ Paperclip issues
```

## 1. Paperclip (the work engine)

Verified on 2026-10-27 against a real local Paperclip 2026.1012.0: initiatives, projects, human and agent tasks, claim, release, answer and the recap all worked.

1. In Paperclip, open the company (e.g. FWTX DAO) and note its **company id**.
2. Create a **board API key** for that company (Board → API keys, or `POST /api/board-api-keys` with `{ "name": "inertia member app", "requestedCompanyId": "<company id>" }`). Copy the `pcp_board_…` token; it is shown once. Keys expire after 30 days by default.
   An agent key does **not** work: Paperclip answers "Agent token did not verify".
3. Set:
   ```sh
   PAPERCLIP_URL=https://<paperclip host>
   PAPERCLIP_API_KEY=pcp_board_…
   PAPERCLIP_COMPANY_ID=<company id>
   PAPERCLIP_DEFAULT_AGENT_ID=<CEO agent id>   # optional: who picks up new agent tasks
   ```
4. Restart the app and run the check: it lists goals, agents and whether the `human` label exists (created on the first human task).
5. **Link members:** Organization → Members → paste each member's Paperclip user id. Linked members are assigned the issue when they claim, and it moves to *in progress*. Unlinked members still claim: the issue gets a "Claimed in Inertia by …" comment and Inertia keeps the claim exclusive (Paperclip only allows *in progress* with an assignee).
6. **Tell the CEO agent** (its instructions): issues for a person get the `human` label; member answers arrive as issue comments.

Mapping: initiative → company goal (`planned` = proposed, `active` = adopted); grant → project under the goal; human task → issue labelled `human`; agent task → any other issue; claim → assign + comment; answer → comment + done.

Tips:
- Keep or add the initiatives (including *Pursue grant funding strategy*) **before** running Find work, so tasks land under the right goal.
- Without Paperclip settings the app uses an in-memory engine: fine for rehearsals, but tasks are lost on restart.

## Settings in the app

Admins can set the **language model** and the **Telegram bot** in Agents → Connections instead of this file. Saved settings override the matching variables. Keys and tokens are encrypted with `MEMBER_APP_SECRET_KEY` (at least 32 characters; `openssl rand -base64 48`), which must be set on the server, and never sent back to the page. The connectors read saved Telegram settings when the app uses a shared Postgres (`DATABASE_URL`) and restart themselves within a minute of a change.

## 2. Telegram bot

1. In Telegram, message **@BotFather** → `/newbot` → copy the token.
2. Still in @BotFather: `/setprivacy` → choose the bot → **Disable**, so it sees all group messages (not just commands).
3. Add the bot to the FWTX group. If you changed privacy after adding it, remove and re-add it.
4. Paste the token in Agents → Connections → Telegram (it is checked with Telegram before it is saved), or set:
   ```sh
   TELEGRAM_BOT_TOKEN=123456:ABC…
   TELEGRAM_CHAT_IDS=-100…      # optional: only these chats (the check shows what it reads)
   ```
5. Set up delivery and run the connectors (below). Messages become one digest per chat per day in Organization → Data; they show in the Agents feed under *Incoming data*, and the chat assistant and **Find work in this** use them.

No bot yet? Telegram Desktop → the group → ⋮ → **Export chat history** → JSON, then drop the file in Data.

## 3. Buzz

There are two Buzz paths; use either or both.

**a. Channel conversations as context (member app connectors).**
1. Create (or reuse) a Buzz identity for Inertia to read with, and make it a member of the channels to read. Keep its 64-character hex secret key safe.
2. Set:
   ```sh
   BUZZ_RELAY_URL=https://<buzz relay>
   BUZZ_READER_SECRET_KEY=<64 hex>
   BUZZ_CHANNEL_IDS=<channel uuid>[,<channel uuid>]
   BUZZ_NAMES={"<member pubkey>":"Kyle","<member pubkey>":"John"}     # optional, shows names instead of keys
   BUZZ_CHANNEL_NAMES={"<channel uuid>":"general"}                    # optional
   ```
3. Run the check: it queries the last week. A 401/403 means the reader key isn't allowed in those channels.
4. Run the connectors (below). The relay is read with signed NIP-98 requests, and only signature-verified kind 9 messages from those channels are kept.

**b. Task threads ↔ Paperclip issues (Inertia Paperclip plugin).** The Buzz bridge in the root Inertia plugin mirrors a Buzz thread with a Paperclip issue (replies become comments, confirmation cards appear in the thread). In Paperclip's plugin settings for the company set `relayUrl`, `bridgePubkey`, `signingKeyRef` (a Paperclip secret), `bindings` (`channelId`, thread `rootId` → `companyId`, `issueId`) and `pairings` (member pubkey → Paperclip user). Start with `enabled: false`, check the mappings, then enable. Full details: [docs/operations.md](../operations.md).

## 4. Grant finder → Funding, Home and Agents

1. The member app reads grant finder opportunities from a JSON file: `MEMBER_APP_FUNDING_FILE=/path/to/funding.json`. Either shape works: `{ "opportunities": [...], "applications": [...] }`, or one page of the native catalog (`"schema": "inertia.member-funding-opportunities.v1"`, see `docs/member-funding-read.md`). Unassessed fields (route, sponsor, summary, next step) may be null; they show as *Not assessed yet*.
2. Organization → Funding lists them. An admin clicks **Pursue this**: the model plans the work, and Inertia creates a project under the grant initiative (*Pursue grant funding strategy*, or an accepted initiative with "grant" or "funding" in its title) with agent tasks and 2–3 prepared asks for people.
3. The asks show on **Home** under *You could help with*; the agent tasks show on **Agents** (lined up, working, stuck, done), both under the grant initiative.

Needs: a model (Pursue plans with it) and a writable work engine: no Paperclip (in-memory) or `PAPERCLIP_ACCESS=write`. With Paperclip read-only, Pursue says how to turn writing on.

Not yet connected: the app does not call the native catalog's HTTP route; that needs the member-app-to-native identity binding in `docs/member-funding-read.md`. Applications from the native workflow are not readable yet (the route answers 503 by design).

Rehearsal without a model key: in development, `MEMBER_APP_MODEL_PROVIDER=mock` answers **Pursue this** with a fixed plan.

## Running the connectors

```sh
# in apps/member/.env.local, or the connector's own environment
MEMBER_APP_BASE_URL=https://<member app host>
MEMBER_APP_INGEST_TOKEN=<long random string>   # same value the app has; e.g. openssl rand -hex 32
CONNECTOR_FLUSH_MINUTES=15                     # how often digests are delivered

npx tsx scripts/connectors.ts --once   # read once and deliver: good for testing
npx tsx scripts/connectors.ts          # keep running (systemd, pm2 or a second terminal)
```

The connector keeps its read position in `data/connectors.json` (`CONNECTOR_STATE_FILE`), so a restart doesn't re-read, and digests that fail to deliver are retried on the next flush. Any other integration can post to the same endpoint:

```sh
curl -X POST "$MEMBER_APP_BASE_URL/api/org/ingest" -H "Authorization: Bearer $MEMBER_APP_INGEST_TOKEN" \
  -H "Content-Type: application/json" -d '{"kind":"note","title":"…","text":"…","origin":"…"}'
```

## Database

Use Postgres (`DATABASE_URL`) for anything you keep. The default local PGlite folder is single-process and does not survive being killed mid-write; it's for quick local tries only.

Everything lives in the `member_app` schema, including the migration journal. On a shared database the app's role needs only CONNECT and ownership of a `member_app` schema a DBA created; see [connect-morning.md](connect-morning.md#1-postgres-about-10-minutes).

## Verified in the build environment (2026-10-27)

| Integration | How it was verified |
|---|---|
| Paperclip | Real Paperclip 2026.1012.0 locally (disposable Postgres), app driven in a browser: goals, project, 15 issues with labels, claim, answer, recap |
| Telegram | Connector against a local stand-in for the Bot API (`TELEGRAM_API_BASE`), delivered to the running app; unit tests for privacy, bots and offsets |
| Buzz | Connector against a local stand-in relay serving real signed events, delivered to the running app; tests reject tampered and off-channel events and check NIP-98 auth |
| Real Telegram, real Buzz relay | **Not yet**: the build environment can't reach them. Run the check with your credentials first. |
