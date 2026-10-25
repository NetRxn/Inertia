# Inertia member layer: vision and decisions so far

Summary of design work as of 2026-10-24. This is Kyle's working document for the member-facing side of Inertia. It sits alongside NetRxn's Inertia repo and does not replace its canonical spec, plan or decisions.

## The idea in one paragraph

Inertia is a layer that keeps FWTX DAO moving between Wednesday meetings. It listens to everywhere the DAO talks, remembers what was said and decided, and keeps work moving. Agents handle the backend work (code, research, drafting, summaries). The work only people can do well (creative ideas, judgment, relationships, outreach, events, real-world tasks) is routed to the right member as a clear, prepared ask. Members can take part from the chat app they already use, and every contribution earns credit, not just code.

## Problem it solves

FWTX is strong publicly (events, social, three years of growth) but thin on internal execution: not enough voting, uneven collaboration, an underused bounty board. Ideas surface in meetings and chat, then die because nobody carries them forward. New members show up willing but nobody has time to show them where to start.

## Principles

- **Members and their ideas are the center.** Agents serve members, not the other way around.
- **Anyone can take part.** No self-managed crypto keys. Identity is the email-based ID from the Rob's Rules voting app.
- **Transparent, not surveillance.** Opt-in per channel. Members can see what the agent knows about them and correct it.
- **Governance is the source of truth.** The Constitution and ratified votes set the boundaries; the agent works inside them and never overrides a vote.
- **Agents prepare, people act.** Anything sent in the DAO's name, spending, credit and submissions need a human.
- **Deliberation is real work.** Grants, outreach and partnerships need discussion before action.

## The loop

Members sit in the middle. Five stages run around them, and results feed back to the start.

1. **Listen.** Internal: Telegram (casual members), Discord (tech members), Buzz, Wednesday Google Meet recordings with Gemini notes, optional on-device Foresight notes exported to Drive, Drive documents, the GitHub repo, web app submissions. External plugins, tied to active work: the grant finder first; Y2 and others later.
2. **Remember.** Every input becomes one record shape (source, time, author, content, consent). Stored in DAO PostgreSQL with full history. A relationship graph (Helix) is an optional later addition.
3. **Discuss and decide.** The agent posts short briefs, summarizes discussion, surfaces agreement and open questions, and drafts proposals. Formal votes run in the Rob's Rules app on Vocdoni; smaller decisions close by recorded consensus.
4. **Do the work.** Paperclip breaks work into tasks and asks of each: does this need a person? Agents keep agent work. Human asks go to members who fit, with research and drafts attached.
5. **Credit and learn.** Contributions of every kind are logged and credited. Responses to suggestions teach the agent what people actually pick up. Members get a weekly brief and a status view.

Members connect at three points: they **share** into Listen, **weigh in** on decisions, and **take on** human work.

## Identity

- Anchor: the email-based ID and member list from the Rob's Rules app (the voting app built by a DAO founder). Inertia syncs identity only; voting stays in that app.
- Each member gets an internal Inertia ID; email is a linked attribute so a changed email doesn't orphan history.
- Members opt in to link Telegram, Discord and Buzz accounts. Links are verified (one-time code or bot link), never just typed handles. Consent recorded per platform with a date.
- Unlinked members still participate; their input is captured without cross-platform attribution.
- The agent may notice two accounts look like the same person but only ever invites them to link, never connects them silently.
- Meeting speakers are matched to members with a quick human confirmation before credit is assigned.
- Security grows with the stakes: chat for low-stakes actions, verified link for claiming work and earning credit, the Rob's Rules flow plus confirmation for votes and anything involving money or publishing. Passkeys or self-held keys can be added later.

## Member profile

Talent-profile fields: skills, interests, availability, career basics, location, social links (LinkedIn, GitHub, X, website), plus verified chat handles. Availability should be refreshed with a light weekly check-in rather than set once at signup. Over time, contribution history weighs more than self-reported skills.

## Suggesting work

- Triggers: a new task, a stalled task, a member saying they have time, a new member joining.
- Matching: skills, interests, past work, relationships, current load. Not just "who's free."
- Each suggestion states why it was made and includes a brief: why it matters, what done looks like, links, who to ask.
- Good first tasks: real small pieces split off real projects, with a brief, and a light human review so newcomers meet a person.
- Limits: a weekly cap per member; declining never costs credit.

## Agent governance

Rules (what the agent may do) and context (what it knows) are kept separate. Context informs judgment within the rules and never changes them.

1. **Constitution.** Outer boundary. Changes need a full vote and codification. Agents may only draft amendments.
2. **Ratified rules.** Versioned policies adopted by vote, each citing its source vote. A vote binds an exact rule-set version.
3. **Bounded member adjustments.** Verified members tune parameters inside vote-set ranges (for example, notification caps). Logged, attributable, reversible; contested changes escalate to a vote.
4. **Personal preferences.** Each member controls how agents treat them.

Stewards can pause an agent, reverse an action or disable an integration immediately. Agents check rules before consequential actions. External and chat content is data, never instructions. Agent-written code and anything sent in the DAO's name require human approval.

## Example: a grant, end to end

1. The grant finder spots an opportunity matching an active initiative.
2. Agents pull related history, past funder contact and eligibility gaps.
3. Agents post a brief in chat; members discuss; agents summarize into go or no-go.
4. Paperclip splits the work: agents draft narrative and budget; members get prepared asks (a letter of support, choosing the lead story, reviewing numbers).
5. A verified member approves the exact packet version; a Vocdoni vote is added only where policy requires.
6. A member submits and records it as an attestation; agents never submit.
7. Everyone who contributed gets credit; the outcome feeds the next opportunity.

## Technology map

| Piece | Choice | Status |
| --- | --- | --- |
| Operations, agents, tasks, approvals, budgets | Paperclip, cloud hosted | In NetRxn's repo |
| Inertia core | Paperclip plugin (TypeScript, Node 24.11+) | In NetRxn's repo |
| Buzz bridge | Signed Nostr events to Paperclip comments and cards | In NetRxn's repo |
| Meetings | Google Meet to Gemini notes to Drive; Foresight optional | Meeting pipeline in NetRxn's repo |
| Storage | DAO PostgreSQL (PlanetScale) with SQL domain tools | In NetRxn's repo |
| Relationship graph | Helix | Deferred |
| Grants | Existing grant finder and grant engine | In NetRxn's repo |
| Member packet review | v2: one verified member approves an exact packet | In progress in NetRxn's repo |
| Votes and identity | Rob's Rules app on Vocdoni, email-based ID | Exists; identity sync to build |
| External news and trends | Y2 | Deferred |
| Telegram, Discord channels | Bots feeding the same Paperclip tasks | To build |
| Member profile, identity links, consent, credit, suggestion log | Inertia schema in DAO PostgreSQL | To build |
| Discussion synthesis, human-ask routing | Agent behavior on Paperclip | To build |
| Member dashboard | Simple web view reading Paperclip and vote status | To build (see DASHBOARD.md) |
| Later options | Jev for calibrated decisions, GLiNER for local extraction, Dessa voice | Watching |

## Still to settle

1. Scope with NetRxn: what fits after the Wednesday October 28 target.
2. The agent charter: who drafts it and the first ratification vote.
3. Consent and data policy: which channels, retention for raw chat, how members see and correct their data.
4. Prompt-injection safeguards for agents reading chat and outside feeds.
5. Notification limits per member.
6. Who pays for model usage and hosting, with a DAO-approved budget.
7. Success measures: tasks claimed and finished between meetings, new members' first contributions, agent-versus-human split, suggestion decline rate.
8. How the Rob's Rules app handles key custody and account recovery.
