# Inertia: the app (vision v2, built on the member app)

Drafted 2026-10-27. Supersedes the "plugin pages inside Paperclip" approach in [sprint-wednesday.md](sprint-wednesday.md). Builds on the existing member app design, [`2026-10-24-member-app-design.md`](https://github.com/NetRxn/Inertia/blob/feat/member-app-sections/docs/superpowers/specs/2026-10-24-member-app-design.md) in `apps/member` (PRs #70, #74, #75). The app already has:

- the home feed, floating menu and chat assistant;
- the Work tab with "Needs a person" and "I'll take it";
- Share, Votes, Calendar, Docs, Profile and a read-only Funding view;
- **swappable adapters** (`WorkSource`, `MeetingSource`, `FundingSource`, …).

## What Inertia is

**An organizational autopilot.** You open it, tell it about your organization in a casual conversation, and it builds a picture of the org that keeps itself current. Then it keeps work moving. It is **agnostic to what runs the work**: Paperclip agents today, any engine behind an adapter later. It gives **human work the same standing as agent work**.

The member app is that app. Paperclip is the first work engine behind `WorkSource`. NetRxn's meeting, grant and Buzz machinery are sources and engines behind adapters.

Principles, kept from the member app design:
- simple, light, organic, inviting;
- chat first;
- the app **never owns tasks or approvals**: it reads them from the engine and writes claims back;
- every answer cites its source.

## The shape

```
First open ─▶ "Tell me about your organization" (chat)
                 name · website · what you do · drop in meetings/docs
                        │
                        ▼
              Organization profile (drafted, cited, editable)
                        │
   ┌────────────────────┼─────────────────────────────┐
   ▼                    ▼                             ▼
 Home feed            Work                           Org (admins; some parts for everyone)
 (existing)    ┌──────────────────────┐       Profile · Members · Data · Integrations · Governance (optional)
               │ Recap: this week      │
               │ People  │  Agents     │
               │ Initiatives · Ideas   │
               └──────────────────────┘
```

### 1. Onboarding: "Tell me about your organization"
- The first admin to sign in gets the chat sheet in **setup mode**. It's a friendly conversation, not a form: *What's your organization called? Do you have a website? In a few sentences, what do you do? Got any meeting notes or recordings? Drop them here.*
- Behind the scenes: the website and uploads become **Data**; the model drafts the **Organization profile** (mission, programs, proposed initiatives, people, recent activity), every line linked to its source.
- The admin reviews the profile in place: keep, edit, or remove lines, and accept the initiatives. Re-running setup later just adds data; it never starts over.

### 2. Data: anyone can add, everything gets ingested
- One **Add to Inertia** action, the existing Share composer extended. It takes a link, a file (transcript, notes, doc, PDF; audio explained, not live) or a note, with an optional "this is a meeting" toggle.
- Each item is saved and hashed, split into passages and read by the model: facts, decisions, commitments, people, initiative mentions. All of it is **searchable by the assistant** and **cited** in answers.
- **Data** lists everything the org knows: who added it, when, what it fed (profile lines, tasks). Admins can hide an item; nothing is silently deleted. This follows the moderation idea in PR #105.

### 3. Org section
- **Profile:** the generated, cited org profile; edit and confirm.
- **Members:** add by email, remove, and set roles (admin, member). Members are the core. Sync from Robert's Rules stays an adapter for later. Follows #105's members/moderator idea.
- **Integrations:** Buzz, Telegram, Paperclip, grant finder, GitHub, website, Robert's Rules, and the model provider, each with its status and how it connects. The catalog already exists (`src/ui/integrations.ts`) and moves here.
- **Governance (optional):** off by default. When on, initiatives need a vote (Robert's Rules) before they're active; until then they show as *proposed*.

### 4. Work: one status tracker, two lanes, at parity
The top of the Work tab is a **recap** in plain language: *"This week agents finished 9 tasks and members finished 4. 3 things are waiting on a person."*

Then two lanes, side by side on desktop and stacked on mobile:

| **People** (human tasks) | **Agents** (Paperclip tasks) |
|---|---|
| Open to claim → claimed → done | Queued → running → done |
| Why you, about N minutes, what agents already prepared | Which agent, what it's doing, latest result |
| **I'll take it** / release | View in Paperclip |
| Recap: who did what this week (celebratory, no leaderboard) | Recap: what agents produced this week |

Both lanes are grouped by **initiative** and filterable by project. The existing *Initiatives* and *Ideas* segments stay.

### 5. Sync with Paperclip
`WorkSource` gets a real **Paperclip adapter**:

| Inertia | Paperclip |
|---|---|
| Initiative | Goal (company level). Proposed → `planned`; adopted → `active` |
| Project (e.g. a grant) | Project under that goal |
| Human task | Issue labelled `human`, assigned to the member's Paperclip user on claim |
| Agent task | Issue assigned to an agent |
| Claim | Assign plus a comment *claimed in Inertia by …* |
| Recap counts | Issue status changes in the period |

Accepting an initiative in the app creates the goal. Paperclip agents propose human tasks by labelling them `human` (CEO agent instructions). Inertia's model can also suggest tasks, which an admin accepts.

## The Wednesday walkthrough
1. Kyle opens a fresh Inertia, has the setup conversation for **FWTX DAO** (website, description, 2–3 meetings), and gets a cited profile with 8 proposed initiatives. He accepts them, and *Pursue grant funding strategy* stays **proposed**.
2. **Org → Members:** add John. **Integrations:** Paperclip connected, the others listed.
3. **Data:** anyone uploads a transcript, and the assistant can answer from it within a minute.
4. A grant appears (Funding, from the grant finder) → **Pursue** → a project under the grant initiative, with suggested tasks: agent tasks go to Paperclip, human tasks to People.
5. John signs in. **Home** says one thing is waiting for him. **Work → People**: he claims *Pick the lead community story*, sees what agents prepared, answers, and the draft updates. **Agents** shows the drafting task running.
6. The recap shows both sides moving.

## Status (2026-10-27)

Built and verified end to end with live GLM in `apps/member`; see the [Wednesday runbook](runbook-wednesday.md). The Paperclip adapter is tested against a fake Paperclip and connects live on Wednesday.

## What we need to decide or get
- **Base branch:** the member app isn't in `develop` yet (PRs #70 → #74 → #75, stacked, clean). Merge them into `develop`, or work on a branch on top of them.
- **PR #105** (org panel inside Paperclip): fold its members/moderation/source ideas into the app; keep its "why this task exists" tab in Paperclip.
- **Paperclip API access** on John's runtime: URL plus a key that can read goals and issues and assign them.
- **Model:** the GLM key authenticates, but the account has no paid balance; only free `glm-4.7-flash` answers. Fix the plan/key, or use flash for the demo.
