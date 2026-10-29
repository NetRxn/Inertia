# Connecting Postgres, Paperclip, Buzz and meetings

Updated 2026-10-29. For the member app in `apps/member`, run in order. Every step ends with a check. Full reference: [integrations-setup.md](integrations-setup.md).

**What was verified overnight.** Everything below ran against a real Postgres 16, using a login role that can only CONNECT to the database and use a schema a DBA created. The checks covered migrations, founder sign-in, every section, ingest, live GLM profile drafting and Find work on a meeting transcript (7 tasks, 6 for people). Paperclip and Buzz ran against stand-ins only: this environment can't reach the real ones.

## 1. Postgres (about 10 minutes)

The app keeps everything in one schema, `member_app`, including its migration journal. It needs no other schema, no extensions and no superuser. `gen_random_uuid()` and full-text search are built into Postgres 13+.

**On a shared DAO database**, have whoever holds the owner role run:

```sql
CREATE ROLE inertia_app LOGIN PASSWORD '<openssl rand -hex 24>';
GRANT CONNECT ON DATABASE <dao database> TO inertia_app;
CREATE SCHEMA member_app AUTHORIZATION inertia_app;
-- Nothing else: no CREATE on the database, no access to other schemas.
```

Then set `DATABASE_URL=postgresql://inertia_app:<password>@<host>:5432/<db>`. Add `?sslmode=require` for a managed or remote server. A role that may create schemas works too; the app then creates `member_app` itself.

Check:

```sh
cd apps/member
npx tsx scripts/migrate.ts            # "Migrations complete!"; safe to rerun
npx tsx scripts/sign-in-link.ts you@example.org   # first admin on a fresh install
```

The server also migrates on start and every `MEMBER_SYNC_INTERVAL_MINUTES`.

Moving from the compose stack's own Postgres or from PGlite? The data does not move by itself. Run `pg_dump --schema=member_app` from the old database and restore it into the new one. Installs that already have `drizzle.__drizzle_migrations` keep using it.

**Open question:** is the morning database also where DAO data lives that Inertia should *read* (funding, meetings, members)? The member app reads funding from `MEMBER_APP_FUNDING_FILE` and meetings from what's shared in Data. It has no SQL reader for DAO tables yet. With the table names and a read-only role, that's an adapter of about half a day.

## 2. Paperclip (about 15 minutes, with John)

1. In Paperclip, create a **board API key** for the FWTX company (not an agent key) and note the company id. Keys expire after 30 days by default; put the date in the calendar.
2. Set `PAPERCLIP_URL`, `PAPERCLIP_API_KEY`, `PAPERCLIP_COMPANY_ID`, and optionally `PAPERCLIP_DEFAULT_AGENT_ID` (the CEO agent). When the app reaches Paperclip at an internal address (on the VPS, `http://host.docker.internal:3100`), also set `PAPERCLIP_PUBLIC_URL` to the address people open, so task links work.
3. **Decide the access mode.** The default is `PAPERCLIP_ACCESS=read`: Inertia shows Paperclip's goals and issues, and keeps claims in its own log. **Find work, Pursue and answers then write nothing**, and they now say so instead of "try again". Set `PAPERCLIP_ACCESS=write` once you're happy for Inertia to create goals, projects and issues and to assign claims. The key carries its issuer's permissions, so issue it from a user with no more access than that.
4. Restart, then run the check (below) or open Agents → Connections → **Check connections**. It lists goals, agents, the `human` label, where new agent tasks go, and the access mode.
5. Organization → Members: paste each member's Paperclip user id, so their claims assign the issue to them.
6. In write mode, re-accept initiatives (Organization → Overview) so each becomes a Paperclip goal.

## 3. Buzz (about 15 minutes)

Two separate connections. Either works without the other.

**a. Channel conversations into what Inertia knows** (member app connector):

```sh
BUZZ_RELAY_URL=https://<relay>
BUZZ_READER_SECRET_KEY=<64 hex>          # a reader identity that is a member of the channels
BUZZ_CHANNEL_IDS=<uuid>,<uuid>
BUZZ_NAMES={"<pubkey>":"Kyle"}           # optional
MEMBER_APP_INGEST_TOKEN=<openssl rand -hex 32>   # same value on the app and the connector
MEMBER_APP_BASE_URL=https://<app>
npx tsx scripts/connectors.ts --once     # read once and deliver; then run it without --once
```

The first run reads the last 24 hours. A 401 or 403 from the check means the reader key isn't a member of those channels. A backlog bigger than one relay page (500 events) is now paged through instead of skipped.

**b. Task threads ↔ Paperclip issues** (the Inertia Paperclip plugin's Buzz bridge). Configure `relayUrl`, `bridgePubkey`, `signingKeyRef`, `bindings` and `pairings` in the plugin's company settings, starting with `enabled: false`. See [operations.md](../operations.md).

## 4. Meetings: recording → transcript → tasks

```sh
# A transcript Meet or Zoom already made (.vtt, .srt, .txt, .md): no Whisper needed
python3 scripts/transcribe.py meet-transcript.vtt --title "Roundtable 2026-10-30" --post

# An audio or video recording: transcribed locally with Whisper, then sent
pip install faster-whisper     # once; ffmpeg must be installed
python3 scripts/transcribe.py recording.m4a --title "Roundtable 2026-10-30" --post
```

`--post` sends the transcript to the app with `MEMBER_APP_BASE_URL` and `MEMBER_APP_INGEST_TOKEN`. It appears in Organization → Data as a meeting. Then an admin clicks **Find work in this**. Find work is deliberately a person's click, because it creates tasks (in Paperclip, in write mode). Each task quotes the line it came from and lands under the initiative it fits.

Google Meet transcripts are Google Docs: File → Download → **Plain text (.txt)**. The app does not read `.docx`.

**Not yet run here:** the Whisper model itself. Model downloads are blocked in this environment, so the audio conversion, transcript file and sending were checked with the model stubbed. Run it once on a short clip first; the default `small` model downloads about 500 MB on first use.

## 5. Model: Anthropic for the chat and the data processing

One setting switches every model call: the chat, and the data processing (meeting transcripts and uploads, Find work, the profile, Pursue).

```sh
MEMBER_APP_MODEL_PROVIDER=anthropic
MEMBER_APP_MODEL=claude-opus-5-5          # the chat
MEMBER_APP_FAST_MODEL=claude-haiku-5-5    # the data processing
ANTHROPIC_API_KEY=<key>
```

Leave `MEMBER_APP_MODEL_BASE_URL` and `MEMBER_APP_MODEL_THINKING` unset with Anthropic; the base URL is only for a gateway that speaks the Anthropic Messages API. If the fast model can't answer, the data processing falls back to `MEMBER_APP_MODEL`, and the check shows a warning instead of a failure. Whisper transcription stays local and uses no model key.

Verified 2026-10-29 on the Anthropic code path: through an Anthropic-compatible gateway, a meeting transcript drafted the profile, and Find work made 7 tasks in 28 s. The connection check ran on the same path. A real Anthropic key wasn't available in the build environment, so run the check once with it.

GLM stays available: `MEMBER_APP_MODEL_PROVIDER=openai-compatible`, `MEMBER_APP_MODEL_BASE_URL=https://api.z.ai/api/coding/paas/v4` (Coding Plan) or `/api/paas/v4`. On 2026-10-29 `glm-4.7-flash` was answering "overloaded" while `glm-4.7` worked.

## Check everything

```sh
cd apps/member && npx tsx scripts/check-integrations.ts
```

It changes nothing. Expect `ok` or an explained `warning` for: language model, Paperclip, ingest endpoint, Telegram, Buzz.

## Known gaps after tomorrow

| Gap | Effect | Size |
|---|---|---|
| No SQL reader for DAO data (funding, meetings) | Funding comes from an exported JSON file | About half a day once the tables are known |
| Find work runs per source, by hand | Someone clicks it after each meeting | Deliberate; could be automatic for chosen sources |
| Whisper not run end to end here | First real run is the test | Try a short clip first |
| No mailer | Admins copy sign-in links from Organization → Members | Small, needs an SMTP or provider account |
| Paperclip board key expires in 30 days | Integrations check fails when it does | Calendar reminder |
| Real Buzz relay and real Paperclip not reachable from the build environment | First live connection is the test | Run the check first |
