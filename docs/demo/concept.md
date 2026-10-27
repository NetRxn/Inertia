# What Inertia is (and what Paperclip already is)

Drafted 2026-10-27. Working explainer for the FWTX demo, not a canonical artifact. Companion to [the demo plan](fwtx-demo-plan.md).

## One paragraph

**Paperclip is the DAO's workforce and task board. Inertia is the DAO's memory and chief of staff.** Paperclip runs work once someone tells it what the work is. It doesn't know what was said in Wednesday's meeting, what's happening in Telegram, which member offered a venue last month, or that a new grant matches an initiative. Inertia listens to all of that, remembers it with sources, keeps a current picture of the organization, and **finds work**. It turns that picture into initiatives, projects and tasks in Paperclip, and points each human task at the member most likely to want it.

## Product shape: a blank-slate shell with connectors (direction, 2026-10-27)

Inertia starts empty. In **Settings → Sources**, an admin connects whatever the organization uses: Buzz, a Telegram bot, meeting uploads, Google Drive, GitHub, the website, socials, the grant finder. From then on it is a lightweight, secure shell that keeps growing:

- it gathers internal and external sources;
- it keeps org memory and the snapshot up to date;
- it surfaces work for members.

Nothing about FWTX is hard-coded. FWTX is just the first organization to connect its sources.

Every connector implements the same small contract, so adding one never touches the core:

| Part of the contract | Meaning |
|---|---|
| `describe` | Name, icon, what it reads, and whether it can write (most are read-only) |
| `connect` | Credentials go into the secret vault (Paperclip's connections), never into config files or the database in plain text |
| `listen` / `pull` | Webhook or bot for live sources; scheduled pull or manual upload for others. A cursor makes replay safe |
| `normalize` | Turns anything into the one **source record** shape: raw content, hash, author, time, origin URL, audience |
| `audience` | Who may see what came in (a private channel stays private) |
| `health` | Last seen, error count, items ingested, shown on the settings card |
| `disconnect` | Stops intake; already-ingested records stay, with a clear removal option |

What makes it a *secure* shell:

- connectors are added and removed by admins only;
- each connector gets least-privilege, mostly read-only access;
- everything that comes in is treated as **data, never as instructions**;
- audience is carried from source to every derived fact;
- every write back to the outside world (a Buzz reply, a Telegram message) needs an explicit setting, and anything sent in the DAO's name needs a person.

## Who does what

| Job | Paperclip (exists) | Inertia (ours) |
|---|---|---|
| Goals, projects, issues, statuses | ✅ | Uses them; adds the initiative/project/task rules |
| Agents, runs, checkout, budgets, audit | ✅ | Uses them |
| Approvals and review stages | ✅ | Binds them to exact packet versions and to DAO governance |
| Inbox / assigned to me | ✅ | Feeds it with prepared asks |
| **Listen**: meetings, recordings, notes, Telegram, repos, website, socials, grant finder | ❌ | Ingest adapters with source, author, time and hash |
| **Remember**: searchable org memory with citations and audience | ❌ (only its own task data) | DAO PostgreSQL knowledge store |
| **Snapshot**: what the org is doing right now | ❌ (lists of tasks, not the story) | Org Brief per initiative, refreshed when a new source arrives |
| **Find work**: action items, gaps, stalled work, opportunities | ❌ | Producers that propose tasks with a reason and a source |
| **Match people**: who should be asked | ❌ | "Why you" built from what members said, committed to and did |
| **Govern**: initiatives adopted only by the DAO | ❌ | Rules plus governance receipts |

So it's fine, and intended, that Paperclip does a lot. We aren't rebuilding it. Everything in the right-hand column is the product.

## Why saving notes to the database helps the LLM

The LLM has **no memory** between runs and a **limited context window**. It can't read 40 transcripts, 6 months of Telegram and 10 repos every time it drafts a paragraph. Without a database, every agent run starts from zero and knows only what is pasted into its prompt.

The database turns the pile into something the system can **look up**:

1. **Ingest once.** Each source is stored raw (unchanged, hashed), then split into small passages (a few speaker turns, a section of a page), each with its exact location.
2. **Extract.** An LLM pass pulls out candidate facts, decisions, commitments, people and initiative mentions, each pointing at its passage (`src/roundtable/knowledge.ts` already does this for meetings). These are labelled *unverified* until a person or rule confirms them.
3. **Index.** Passages get keyword search (Postgres full-text) and semantic search (embeddings, `pgvector`), plus links to initiative, project and person.
4. **Retrieve per task.** When an agent picks up a task, Inertia builds a **context pack**: the initiative and project records, the 10–30 most relevant passages and facts, and recent decisions. Results are filtered to what that task's audience may see, and every item carries its citation. *That* is what goes into the prompt.
5. **Check.** The LLM must cite the passages it used. Inertia verifies the citations exist, so a claim with no source is flagged, not trusted.
6. **Write back.** Useful new findings (research results, member answers) are saved too, so the next run starts further ahead. This is the "query first, research the gap, write back, reuse" loop already in `src/partners/research.ts`.

Concrete example: the grant finder reports a digital-literacy grant for Tarrant County.
- *Without memory:* the agent writes a generic application.
- *With memory:* retrieval finds the meeting where members discussed a library workshop series (with timestamps), the repo for the HackFW project, and a Telegram message where a member offered a venue. The draft cites all three. A human task, *confirm the venue partner*, goes to the member who offered it, with that message attached.

The database isn't for the LLM to "learn". It makes the right 1% of the organization's history findable at the moment a task needs it, and keeps every claim traceable.

## How the organization's context gets built inside the app

Nothing counts as "known" until it is **saved in org memory** (DAO PostgreSQL). What a developer or an AI assistant reads while building is not org context. It only becomes context once it goes through the pipeline below.

```
Upload / connect          Save                     Understand                  Use
──────────────────        ──────────────────       ──────────────────          ──────────────────
audio or transcript  ─┐   source record            passages (chunks)           Org Brief / snapshot
notes, docs           ├─▶ (raw file, hash,    ─▶   facts, decisions,     ─▶    context pack per task
Telegram export       │    author, date,           commitments, people,        "why you" matching
repo, website, social │    audience)               initiative/project links    proposed tasks
chat (Buzz, comments) ┘                            search index                open-to-members pool
```

1. **Every input becomes a source record.** It holds the original, unchanged, plus who, when, where it came from and who may see it. Audio is transcribed first, offline and not in real time; uploading a transcript skips that step.
2. **Sources are split and understood.** The LLM extracts candidate facts, decisions, commitments, people and mentions of initiatives and projects. Each one points to the exact passage and is marked unverified.
3. **Links make it an organization, not a pile of documents.** Each item is linked to an initiative, a project or a person. This is what lets the app answer "what's happening in HackFW" or "what has this member offered to do".
4. **People confirm.** A member can confirm or correct an item (e.g. "yes, that was a decision"). Confirmed items carry more weight; corrections are kept as new revisions.
5. **It is used everywhere:** the snapshot is regenerated from memory, agent tasks get a context pack from memory, and the open pool is built from memory.
6. **Chat feeds back in.** Buzz messages, task comments and member answers to asks are sources too, so the context keeps growing from normal use, not only from uploads.

Example: the initiative list drafted in the demo plan (section 1d) was read from the website repo during planning. It is **not** in the app yet. In the app, the website repo would be ingested as a source, and the system would *propose* those initiatives with citations to the website pages. A member or governance step would then confirm them.

## Real-time snapshot

"Real time" here means **minutes after a source arrives**, not live streaming. Each new source triggers ingest → extract → refresh of the affected initiative's snapshot:

- what changed since last week
- open decisions
- commitments made and by whom
- stalled tasks
- open human asks
- new opportunities

The snapshot is an agent-written, fully cited document. Its numbers come straight from Paperclip.

## Finding things for members to do

Where member work comes from:

1. **Said out loud:** "someone should…", "I can help with…" in meetings or chat become a proposed task linked to the line.
2. **Project gaps:** decomposing a project (e.g. a grant) yields tasks only a person can do: judgment, relationships, outreach, signatures.
3. **Stalled work:** a task blocked on a person becomes a prepared ask to someone who can unblock it.
4. **Outside opportunities:** grant finder, partner requests.

Matching uses a lightweight member profile built from evidence: topics they talk about, commitments they made, repos they touch, and stated interests. Every suggestion says **why you**. Members accept or decline; silence is never a decline. A cap on asks per week keeps it from becoming spam.
