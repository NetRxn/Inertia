# Ready by Wednesday Oct 28: checklist

Drafted 2026-10-27. Companion to the [demo plan](fwtx-demo-plan.md) and [concept](concept.md).

> **Superseded 2026-10-27:** the app is the member app (`apps/member`), built per [inertia-vision.md](inertia-vision.md). The current state, setup and rehearsal checklist are in the [Wednesday runbook](runbook-wednesday.md).

Two goals:
1. **Member view of a set-up FWTX DAO org:** John logs in and sees initiatives, projects, the snapshot and work open to members.
2. **Grant walkthrough:** a grant is found, becomes a project, gets split into agent and human tasks, and a member is asked a question whose answer goes into the draft.

Priority: **P0** = the demo breaks without it. **P1** = noticeably better. **P2** = nice to have, show as "next" if missing.
Owner: **K** Kyle, **J** John, **C** Claude (this repo).

## How Paperclip fits into the member app

**For Wednesday, Paperclip *is* the member app**, and Inertia is a plugin inside it. Members log in to Paperclip and see:

| Member sees | Comes from |
|---|---|
| Initiatives, projects, tasks, inbox, approvals | Paperclip native screens (goals, projects, issues) |
| **For you**: open human tasks to claim, my asks, why you | Inertia plugin **page** (new, P1; fallback is the native inbox plus a `human` label filter) |
| **Org snapshot** (Org Brief) | A native document on the initiative or company, written by an agent |
| **Packet** tab on a grant task | Inertia plugin detail tab (exists) |
| **Settings → Integrations** | Inertia plugin settings page (done) |
| The same tasks and asks in chat | Buzz bridge (exists) |

Later, a separate branded member app (the earlier design, once reworked for initiatives → projects → tasks) talks to Paperclip through its API and to Inertia's endpoints. It never forks or embeds the Paperclip UI, and there is never a second task list. Paperclip stays the one source of truth.

## Do we need an onboarding flow?

**Not a wizard for Wednesday.** One setup script ("seed") does what onboarding would do. The demo shows the result and the Integrations tab. The script:

1. Creates the *FWTX DAO* company, the 8 initiatives (demo plan section 1d) and a few projects under each.
2. Creates the agents (CEO/intake, researcher, drafter, critic) on GLM, and the labels `agent`, `human`, `governance`.
3. Invites the members (John; Kyle as admin).
4. Ingests the seed folder (transcripts, website, repos, Telegram export) into org memory.
5. Generates the Org Brief.

A real onboarding flow (create org → connect integrations → first ingest → review proposed initiatives) is the same steps behind a UI. That comes after the demo.

## Checklist

### A. Runtime and accounts
- [ ] **P0 J** John's shared runtime up, reachable by URL, Paperclip version 2026.1012.0 or compatible
- [ ] **P0 J/C** Install the Inertia plugin build from this branch (`npm pack`); approve the new `ui.page.register` permission
- [ ] **P0 J** Accounts: John as member, Kyle as admin; confirm a member (non-admin) view works
- [ ] **P0 K/J** GLM key into Paperclip company secrets; say which provider issued it (z.ai or bigmodel.cn)
- [ ] **P1 K** For cloud dev: `GLM_API_KEY` environment secret, and `api.z.ai` added to allowed domains
- [ ] **P1 J** Database for org memory: DAO PostgreSQL schema or a separate demo database; `pgvector` if available

### B. Model and chat
- [ ] **P0 C/J** Point the `claude_local` agents at GLM through the Z.ai Anthropic-compatible endpoint; one agent run succeeds
- [ ] **P0 C** Smoke test each chat surface: agent chat in Paperclip, Inertia extraction call, member answer to an ask
- [ ] **P1 J** Buzz relay up and paired with John; one reply round trip
- [ ] **P2 C** Fallback model configured in case GLM rate-limits during the demo

### C. Org setup (seed)
- [ ] **P0 C** Seed script: company, 8 initiatives (grant strategy as *proposed, not voted*), projects, agents, labels
- [ ] **P0 C** Initiative/project rule: no project under a cancelled initiative; projects under a proposed one are flagged "pending governance"
- [ ] **P0 C** CEO agent instructions: when decomposing a project, label every task `agent` or `human`; human tasks use the prepared-ask format (what, why you, context, minutes, deadline, done when)
- [ ] **P1 C** Update `src/ui/integrations.ts` statuses to match what is actually connected on the runtime

### D. Sources and org memory
- [ ] **P0 K** Seed folder: 2–3 meeting transcripts or notes, approved for demo use
- [ ] **P0 C** Org memory tables: sources, passages, knowledge items, links to initiative/project/person; keyword search
- [ ] **P0 C** Ingest: transcripts/notes (existing roundtable path), website pages and blog, FWTX GitHub READMEs
- [ ] **P0 C** Org Brief generated from memory, every line cited
- [ ] **P1 K** Telegram chat history export (JSON) for the main group
- [ ] **P1 C** Telegram export ingest
- [ ] **P2 C/K** **Telegram bot (live):** create via BotFather (K), add to group with privacy mode off (K), small listener saving messages as sources (C). About half a day; skip if short on time
- [ ] **P1 C** Audio upload path explained on one slide (local Whisper); no live transcription
- [ ] **P2 C** Semantic search (`pgvector` embeddings) on top of keyword search

### E. Grant walkthrough
- [ ] **P0 K/J** Pick the grant from the grant finder (and a backup)
- [ ] **P0 C** Grant finder → brief: run the discovery path on the chosen grant, or replay its JSON output
- [ ] **P0 C** Brief → project: create a project under *Pursue grant funding strategy* plus a parent task *Pursue: grant* assigned to the CEO agent, with the brief attached
- [ ] **P0 C/J** CEO agent decomposes into agent tasks (eligibility, research, narrative, budget, critique) and human tasks (lead story, confirm numbers, partner letter)
- [ ] **P0 C** Context pack: each agent task gets relevant org-memory passages with citations
- [ ] **P0 C** One human ask to John; his answer is incorporated into draft v2
- [ ] **P1 C** Independent critique of draft v1 by a separate agent
- [ ] **P1 C** Governance task shown on the initiative ("adopt grant strategy"), not blocking the walkthrough
- [ ] **P1 C** Packet tab shows the exact draft version; John confirms it
- [ ] **P2 C** Mark submitted shown on a synthetic record only

### F. Member experience
- [ ] **P0 J** Member login lands somewhere useful (company dashboard or the For you page)
- [ ] **P1 C** **For you** plugin page: open human tasks with why-you and minutes, a claim button, my asks
- [ ] **P1 C** Claim and completion record who, when and which task (append-only events)
- [ ] **P2 C** Sidebar link "For you"; dashboard widget with the counts "N tasks open to members"

### G. Rehearsal
- [ ] **P0 all** Full dry run on the runtime, end to end, with a timer
- [ ] **P0 K** Record a backup video of the dry run
- [ ] **P1 C** Run receipt: times, sources used, what's still pending
- [ ] **P1 K** Demo script: 8-minute run of show (demo plan section 2) with the Integrations tab opening

## Order of work today

1. A (runtime, plugin, GLM key) and C (seed) unblock everything.
2. D (memory + ingest + Org Brief) in parallel with the grant pick.
3. E (grant walkthrough).
4. F and G.

If time runs short, cut from the bottom of each section (P2, then P1). Never cut the dry run.
