# Organization profile panel and source traceability

Status: draft design, 2026-10-25. Nothing here is built.

## Intent

Each DAO needs one place that answers three questions:

1. **Who is this org and who is in it?** Name, identity, members and how membership stays in sync.
2. **What has the org shared, and where did it go?** Every document, link, chat, meeting note and transcript the platform has taken in, with its status and audience.
3. **Why does this task exist?** Each task explains, on demand, which sources it came from.

The third question matters most. Members should be able to trust why work was assigned to them. Today Inertia keeps links between a task and its sources (for example the protected source reference on native meeting follow-ups in `src/roundtable/native.ts`), but nothing shows them to members.

The panel is also where the org governs itself. The org's members hold authority. Moderators exist only to keep spam out, and everything beyond that goes to a vote.

## Goals

- A **DAO tab** (a main app destination) with a feed-first member view: a share box and an activity feed in the main column, with initiatives and key documents in a sidebar.
- A **share box** any verified member can use to share files and links with the DAO.
- An **admin/moderator Sources view** listing everything the DAO has taken in, with its processing status, audience and the tasks and drafts it feeds.
- A **task view** that shows task details prominently and has a collapsed, expandable **"Why this exists"** trail.
- A **governance model** where the DAO controls membership and moderators can hide spam but not delete it.
- A **Members** screen to manage the member list directly (add, remove, see who is in). Where the list comes from and syncs with is decided later.

## Non-goals

- Changing who approves ordinary work. The v2 policy stays as it is: any verified member with current application access contributes and approves.
- Member sync with an outside source, for now. The Members screen shows a placeholder: "Sync source: not connected yet."
- Running governed votes, for now. Actions that will eventually need a vote show a placeholder marker: "Will require a DAO vote."
- Building a new voting system. Governed decisions use the DAO's existing governance path (Vocdoni or whatever the real applicable policy requires).
- Permanent deletion through the UI.
- Helix/Y2 knowledge graph work (still deferred).

## Anti-goals (failure even if it "works")

- A single admin who can quietly rewrite membership, permissions or history. That contradicts decentralized governance.
- Hidden spam that still feeds agents. If moderators hide something, agents must stop using it too, or the hiding does nothing.
- A trail that claims a source the task didn't actually use. A trail that is missing is better than one that is invented.
- Showing members content they aren't allowed to see. Every source keeps its existing audience and access scope, and the trail and feed respect that.

## Governance and roles

| Who | Can do | Cannot do |
|---|---|---|
| **Founder** (creates the org) | Set up the org: name, identity, member sync, initial edit rights. Acts as the first moderator. | Stay moderator permanently once the DAO votes in its own moderators. *(Founder-as-first-moderator is the designer's call; the user didn't object.)* |
| **Member** (verified, current) | Share via the share box; see the DAO tab, key documents, feed and task trails within their access; contribute and approve under v2. | Moderate; change membership. |
| **Moderator** | Hide content as spam; restore hidden content. Every action is logged with who, when and why. | Delete anything; change membership; change edit rights; appoint moderators. |
| **The DAO (governed vote)** | Approve and remove members; appoint and remove moderators; change write/edit rights on initiatives and company docs; permanently remove content. | — |

**Hiding as spam** removes an item from the main org record: the feed, key documents, search, agent knowledge retrieval and task creation. Moderators still see it in a "Hidden" filter, with the reason, and can restore it. It is never deleted except by a governed decision.

## Interim rules until sync and voting exist

The user chose to leave the member sync and governed voting as placeholders for now.

*Designer’s call:* until voting exists, the founder and moderators can add and remove members directly on the Members screen. Every change goes to the same log as moderation actions (who, when, why), so a later governed process can review or redo it. When voting is added, these buttons become "propose" actions instead of direct edits. Nothing else about the screens has to change.

## Screens

Mockups for the screens below are in `.superpowers/brainstorm/` (gitignored): `dao-tab-layout-v2.html` (option B chosen), `sources-and-trace.html` (the Sources table) and `task-trail-v2.html` (the approved task view).

### 1. DAO tab: member view (feed-first)

- Header: org name and identity, member count, and links to Governance, Members and Sources (Sources only for moderators).
- Main column:
  - **Share box** at the top: paste a link or drop a file.
  - **Activity feed** below it: approvals, agent drafts (naming the source they cite), new tasks (naming the meeting or document they came from), shares and moderation actions. Newest first.
- Sidebar:
  - **Initiatives** with their open-task counts.
  - **Key documents**, ranked by significance. *Designer's call:* significance = how many tasks and drafts cite the document, plus member pins. The user only said "popularity or whatever is most significant."

### 2. Members (founder/moderators edit; members view)

- List of members with name, joined date and status (active/removed).
- Add member and remove member (with a reason), each logged. Each shows a "Will require a DAO vote" marker.
- Header placeholder: "Sync source: not connected yet."
- Moderators are marked in the list. Appointing a moderator follows the same interim rule and placeholder.

### 3. Sources view (moderators/founder)

A table of everything taken in, filterable by type (Documents, Links, Meetings, Transcripts, Chats, Hidden).

Columns: source, shared by (member, Drive sync or Buzz), status, who can see it, what it feeds (counts of tasks and drafts, each linking through).

Statuses follow the existing pipeline: *Processing → Published → In knowledge* (admitted through trusted knowledge admission), *Summarized, not admitted*, or *Hidden (by whom, why)*.

Row actions: open, change who can see it (only within what the source's access allows), hide as spam, restore.

### 4. Task view: details first, trail on demand

- Large title; initiative · status · due date.
- Cards: **Assigned to**, **Done when**, **Next step**.
- **"Why this exists"**, collapsed to one line, for example "from the Oct 14 Roundtable · uses 2 sources". Expanded, it shows numbered steps, such as the exact transcript excerpt with timestamp → the extracted meeting-notes action → this task (created by an agent after a duplicate check). Then "Also used: …" for any other cited sources.
- Task activity at the bottom.

## Constraints

- Paperclip owns native work; Buzz and the dashboard present the same records. These screens read from those records and don't create a second copy of tasks.
- The plugin SDK offers `page`, `sidebar`, `detailTab`, `taskDetailView` and `settingsPage` slots. The DAO tab fits `page`. The task trail fits `taskDetailView` or a `detailTab` on issues (the Packet tab already uses `detailTab`). The Sources view and governance can live under the DAO page or `settingsPage`.
- For now the Members screen is the member list. When the authoritative DAO membership/ACL source (Needed-from-team NTF02) is chosen, the panel syncs with it instead of competing with it. Keep membership reads behind one interface so that swap is local.
- Every source keeps its source version, audience and access scope (existing Inertia rule). Uploads go through the same intake path as other sources.
- No deployment, permission change, deletion or submission without separate authorization.

## Left to the builder

- Data model for shared items, moderation log entries and significance scores.
- How hidden status reaches agent retrieval and task creation (a filter at the knowledge/retrieval layer is the obvious place).
- How trail steps are assembled from existing source references and extraction records, and what to show when a task has no recorded source (say "No recorded source", never guess).
- File type and size limits for uploads (reuse existing upload buffering limits).
- Source reference shapes differ by type today (meetings use `sourceReference` in `src/roundtable/native.ts`). *Designer's call:* add one small adapter per source type that produces a common trail-step shape, rather than migrating existing records.

*Designer's call on sequencing:* build the share box against the merged intake path on `main`. Don't depend on the draft member PRs 70/74/75; their open upload issues are theirs to resolve.
- Feed pagination and ranking details.

## Open questions

- Where the member list syncs from (placeholder).
- How governed votes run (placeholder).
