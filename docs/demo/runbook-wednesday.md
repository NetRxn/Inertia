# Wednesday runbook: Inertia member app for FWTX DAO

Updated 2026-10-27. Branch `claude/demo-readiness-plan-a32n8v`. The app lives in `apps/member` (Next.js, Node 24). Vision: [inertia-vision.md](inertia-vision.md).

## What works now (verified end to end on 2026-10-27, live GLM)

| Step | Where | Verified |
|---|---|---|
| Founder signs in on a fresh install and gets the setup conversation | `/setup` | Yes |
| Website, description and uploads are read into org memory; the same file twice is one source | Setup, Org → Data | Yes |
| GLM drafts a cited profile: mission, initiatives, programs, people, recent activity | Setup, Org → Profile | Yes, about 20–50 s |
| Admin keeps or dismisses initiatives, adds *Pursue grant funding strategy* as proposed | Setup, Org → Profile | Yes |
| Admin adds members and roles; members sign in by email link | Org → Members | Yes |
| Anyone adds files, links or pasted notes; admins hide and restore | Org → Data | Yes |
| Integrations page with live status | Org → Integrations | Yes |
| Governance switch (initiatives need a vote) | Org → Settings | Yes |
| **Pursue** a grant: project under the grant initiative, GLM plans agent tasks and prepared human asks from org memory | Funding | Yes, 7 tasks (2 for people) in about 24 s |
| Status tracker: recap plus People and Agents lanes per initiative | Work → Status | Yes |
| Member claims a task ("I'll take it"), answers it, and the answer goes to the engine and org memory | Work → Needs you | Claim yes; answer covered by unit tests |
| Chat answers from org memory with source chips | Chat bar | Yes, about 30 s |
| Paperclip as the work engine | `PAPERCLIP_*` settings | Unit tests against a fake Paperclip; **live connection on Wednesday** |

## Run it (John's server or a laptop)

```sh
cd apps/member
npm ci
cp .env.example .env.local   # then set the values below
npm run build && npm start   # or: npm run dev
```

Minimum `.env.local` for FWTX:

```sh
MEMBER_APP_ADAPTERS=live
MEMBER_APP_FOUNDER_EMAIL=kyle@...              # first admin
MEMBER_APP_BASE_URL=https://<host>             # used in login links
DATABASE_URL=postgresql://...                  # or leave unset for local PGlite

MEMBER_APP_MODEL_PROVIDER=openai-compatible
MEMBER_APP_MODEL_BASE_URL=https://api.z.ai/api/coding/paas/v4   # Coding Plan key; paas/v4 for pay-as-you-go
MEMBER_APP_MODEL=glm-4.7
MEMBER_APP_MODEL_API_KEY=<z.ai key>
MEMBER_APP_MODEL_THINKING=off                  # faster background work

MEMBER_APP_FUNDING_FILE=/path/to/grant-finder-export.json

# Paperclip (from John):
PAPERCLIP_URL=https://<paperclip host>
PAPERCLIP_API_KEY=<board API key>
PAPERCLIP_COMPANY_ID=<FWTX company id>
PAPERCLIP_DEFAULT_AGENT_ID=<CEO agent id>      # optional: who picks up agent tasks
```

Login links: until a real mailer is wired, the development mailer writes each link to `data/dev-mail/<email>.txt` (or `MEMBER_APP_MAIL_DIR`). For the demo, open the link from that file.

## Connect Paperclip (Wednesday, with John)

1. In Paperclip, create a **board API key** for the FWTX company and note the company id.
2. Set `PAPERCLIP_URL`, `PAPERCLIP_API_KEY` and `PAPERCLIP_COMPANY_ID`, then restart. Org → Integrations shows Paperclip as connected.
3. In Org → Members, paste each member's **Paperclip user id**, so a claim assigns the issue to them. Without it, the claim still works: the issue gets a "Claimed in Inertia by …" comment and moves to in progress.
4. Re-accept initiatives (or pursue the grant again on a fresh org) so the goals exist in Paperclip. Goals are initiatives; `planned` means proposed.
5. Tell the CEO agent: issues for a person get the **`human`** label (Inertia creates it). Agents read member answers from the issue comments.

Mapping: initiative = company goal; grant = project under the goal; human task = issue labelled `human`; agent task = any other issue; claim = assign + comment; answer = comment + done.

## Seed FWTX without clicking (optional)

```sh
npx tsx scripts/setup-org.ts --name "FWTX DAO" --website https://fwtx.city \
  --founder kyle@... --description "..." --file notes.md --file transcript.vtt
```

Then sign in as the founder and finish the review in `/setup`.

## Demo script (8 minutes)

1. **Empty org → setup conversation** (2 min). Name, website, a sentence, drop in two meeting notes. "That's everything" → the profile appears with sources.
2. **Keep initiatives**; add *Pursue grant funding strategy* (shows as proposed, awaiting a vote).
3. **Org tab**: Members (add John), Data (everything Inertia knows, who added it), Integrations ("anything can plug in").
4. **A grant arrives** (Funding) → **Pursue this** → agent tasks and two prepared asks appear.
5. **Work → Status**: recap, then People and Agents lanes side by side for the grant initiative.
6. **Switch to John**: Home says something's waiting; Work → Needs you → **I'll take it** → answer → done.
7. **Chat**: "What's waiting for me and why?" → cited answer.

## Known limits (say them, don't hide them)

- Audio files aren't transcribed in the app yet; transcribe with local Whisper first (one slide).
- Live Telegram bot: Kyle's piece; chat exports (.json) work today.
- Funding comes from a grant finder export file until its live feed is connected.
- Without Paperclip configured, work lives in process memory and is lost on restart.
- The in-memory and Paperclip engines don't regenerate the application draft themselves; Paperclip agents do that from the answers in issue comments.
- Login email is a development mailer.

## Rehearsal checklist

- [ ] GLM key set; Org → Integrations shows the model as connected; ask the chat one question
- [ ] Founder can sign in; `/setup` opens
- [ ] Two real FWTX meeting notes or transcripts ready to upload
- [ ] Grant finder export file in place; Funding shows the opportunity
- [ ] Paperclip connected (or knowingly demo on the in-memory engine)
- [ ] John's account added, and his Paperclip user id linked
- [ ] Full run once, timed; backup screen recording
