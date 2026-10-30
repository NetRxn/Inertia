# Sprint: working app to show John on Wednesday Oct 28

> **Superseded 2026-10-27 by [inertia-vision.md](inertia-vision.md):** the app is the member app (`apps/member`), not plugin pages inside Paperclip.

Drafted 2026-10-27, branch `claude/demo-readiness-plan-a32n8v` (based on the latest `develop`, `a8c707f`). Wednesday night is for final hits; submission is Friday Oct 30, 11:00am CDT.

## Vision this sprint serves

Inertia is an **organizational autopilot**, agnostic to the work engine, that brings **human tasks to parity with agent tasks**. See [concept.md](concept.md#vision-kyle-2026-10-27). For Wednesday it runs hosted in Paperclip, with Paperclip as the first engine.

## The decision: one app, inside Paperclip

We are **not** building a separate app. The "organization app" (create org → describe it → profile → members → integrations → data) is **Paperclip plus the Inertia plugin**:

| Section | Where it lives | State |
|---|---|---|
| Create organization | Paperclip "new company" (native, like Buzz creates an org) | Exists |
| **Set up** (website, description, uploads) | Inertia plugin page | **Build** |
| **Overview / Profile** (generated, cited) | Inertia plugin page | **Build** |
| Members, invites, access | Paperclip company settings (native) | Exists |
| Governance (optional) | Initiative status + governance task; Rob's Rules later | Light |
| Integrations | Inertia company settings page | **Done** |
| **Data** (what was uploaded or connected) | Inertia plugin page | **Build** |
| Work (initiatives → projects → tasks) | Paperclip goals, projects, issues (native) | Exists; seed + rules |
| **For you** (open human tasks, claim) | Inertia plugin page | **Build** |

A standalone lightweight app (own server, SQLite, Docker) stays a possible later direction. It is out of scope for this sprint.

## Left out on purpose (long or tedious)

`pgvector`/semantic search (keyword search only), live transcription (one slide), live Telegram bot (Kyle), real Rob's Rules/Vocdoni votes, Buzz polish, Packet confirmation hardening, run receipts and measurements, a separate member app, and production membership ACL.

## Sprint board

Owner: **C** Claude, **K** Kyle, **J** John. Order is the build order.

### Tuesday (today)

| # | Item | Owner | Done when |
|---|---|---|---|
| 1 | **Org memory tables** (migration 009): `sources`, `passages`, `profile`, keyword search | C | Migration applies on PGlite in tests |
| 2 | **Model client** for GLM (OpenAI-compatible) via the secret reference, with a fake model for tests | C | Unit tests pass; real call verified once the key is available |
| 3 | **Set up page:** org description, website URL, paste or upload text/Markdown/transcript files | C | Saving creates source records with hash and author; re-uploading the same file is a no-op |
| 4 | **Data page:** list of sources (type, date, size, who added it) with delete | C | Shows what the org knows and where it came from |
| 5 | **Profile generation:** mission, programs, proposed initiatives, people and recent activity from sources, each line cited | C | Profile saved, with citations that resolve to passages |
| 6 | **Overview page:** profile + initiatives with status + counts (open tasks, open human asks, sources) | C | Renders on a seeded org |
| 7 | Runtime up, plugin installed from this branch, John and Kyle accounts | J | Kyle can open the plugin pages on the runtime |
| 8 | GLM key into Paperclip secrets; provider (z.ai or bigmodel.cn) | K/J | One model call succeeds from the runtime |
| 9 | Seed material: 2–3 meeting transcripts/notes, website URL, blurb | K | Files ready to upload |
| 10 | Telegram: bot or chat export | K | Messages available as a source (export JSON is enough) |

### Wednesday morning (before John)

| # | Item | Owner | Done when |
|---|---|---|---|
| 11 | **Initiatives from profile:** "Adopt" creates a Paperclip goal (proposed or active); grant strategy left proposed | C | 8 FWTX initiatives visible as goals |
| 12 | **Grant → project:** paste or import a grant-finder result; brief generated with org-memory citations; project + parent task *Pursue: grant* created under the grant initiative | C | Grant project visible with brief |
| 13 | **Task suggestions:** model proposes tasks labelled `agent` or `human` (human ones in prepared-ask format); admin accepts and they become issues | C | 4–6 tasks on the grant project, both kinds |
| 13b | **Work-engine interface:** small `WorkEngine` interface (create task, assign, comment, status, list) with the Paperclip implementation; all new code calls it, not Paperclip directly | C | Interface + Paperclip adapter + fake engine in tests |
| 14 | **For you page (human parity):** open `human` tasks with why-you, minutes, deadline and the **context pack** attached; **Claim** (exclusive, releasable); contribution events recorded; "waiting on a person" status visible on the project | C | John claims a task and sees everything needed to do it without asking |
| 14b | **Nudge:** when a human task is suggested or assigned, post a short message to the member's channel (Buzz now; Telegram once Kyle's bot is up) | C/K | John gets a nudge with a link |
| 15 | **Answer → draft:** member answers the ask in a comment; "Update draft" regenerates the draft section citing the answer | C | Draft v2 shows John's answer |
| 16 | Integrations statuses match what is actually connected | C | No card overclaims |
| 17 | Dry run on the runtime, end to end | K/C | Walkthrough completes without hand fixes |

### Wednesday night (final hits, with John's feedback)

Fixes from the meeting, copy and polish, backup video, README section for the submission.

## Demo flow this sprint targets

1. Create *FWTX DAO* in Paperclip → open **Set up**, paste the website and description, upload meetings.
2. **Overview** shows the generated profile and proposed initiatives with sources → adopt them.
3. **Settings → Members** (native) and **Integrations** (ours).
4. **Data** shows everything the org knows.
5. A grant arrives → brief with citations → project under *Pursue grant funding strategy* → suggested agent and human tasks.
6. John opens **For you**, claims the human task, answers → draft updates with his answer.

## Risks

- **GLM access:** the cloud dev environment blocks `api.z.ai`, so real model calls get tested on the runtime. Everything is built and tested against a fake model first.
- **Runtime availability:** if John's runtime slips, the fallback is local Paperclip in Docker on Kyle's laptop.
- **Paperclip project creation:** plugins can create goals and issues directly, but only plugin-managed projects. If that limits us, the grant "project" becomes a parent issue under the initiative goal for Wednesday.
