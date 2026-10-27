# What Inertia is (and what Paperclip already is)

Drafted 2026-10-27. Working explainer for the FWTX demo, not a canonical artifact. Companion to [the demo plan](fwtx-demo-plan.md).

## One paragraph

**Paperclip is the DAO's workforce and task board. Inertia is the DAO's memory and chief of staff.** Paperclip runs work once someone tells it what the work is. It doesn't know what was said in Wednesday's meeting, what's happening in Telegram, which member offered a venue last month, or that a new grant matches an initiative. Inertia listens to all of that, remembers it with sources, keeps a current picture of the organization, and **finds work**. It turns that picture into initiatives, projects and tasks in Paperclip, and points each human task at the member most likely to want it.

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
