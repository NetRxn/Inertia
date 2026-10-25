# Member dashboard: starter spec

A simple, member-friendly view of what the DAO is doing and how to help. It reads from Paperclip and the Rob's Rules app; it never replaces them. Casual members should be able to use it without knowing what Paperclip is.

## Who it's for

Any verified DAO member, technical or not. Operators keep using Paperclip's own app for managing agents.

## Screens

1. **Home**
    - This week's brief: a few sentences on what moved, what's stuck and what needs people.
    - Four numbers: open loops, claimed this week, open votes, active members.
    - "Asks for you": up to three suggested human asks, each with why it was suggested and Accept / Not for me.
2. **Initiatives**
    - Ratified initiatives in priority order, each with its projects and their state: moving, stuck, open to claim.
    - Claim button on open items.
3. **Votes**
    - Open and recent votes with status and a link to the Rob's Rules app. Voting itself happens there.
4. **Me**
    - Profile (skills, interests, availability, social links), linked chat accounts and consent per platform.
    - Contribution history and credit, including non-code work.
    - Preferences: how often to hear from the agent and on which channel.
5. **How the agent works**
    - Current rules with the vote each came from, recent agent actions with reasons, and a "suggest a change" button.

Plus a box on every page: "Share a link or ask Inertia something," going to the same agent as chat.

## Data contract

Build against fixtures first. Each fixture mirrors the shape the real source will return, so swapping in live calls later changes no UI code.

| Dashboard data | Real source | Fixture |
| --- | --- | --- |
| Initiatives and projects | Paperclip goals and projects | `fixtures/initiatives.json` |
| Open tasks and asks | Paperclip tasks, filtered to human work | `fixtures/asks.json` |
| Votes | Rob's Rules app (Vocdoni) | `fixtures/votes.json` |
| Members, identity | Rob's Rules member list (email ID) plus Inertia identity links | `fixtures/members.json` |
| Contributions, credit | Inertia contribution log | `fixtures/contributions.json` |
| Weekly brief | Agent output stored in Paperclip | `fixtures/brief.json` |
| Agent rules and actions | Ratified rule set plus Paperclip run history | `fixtures/governance.json` |

Open questions for NetRxn (ask on #40): which Paperclip read endpoints and auth the dashboard should use, and how a member's dashboard login maps to their Rob's Rules identity.

## Sign-in

Email-based, matching the Rob's Rules member list: a one-time link or code, no passwords, no wallets. Only listed members get personal views.

## Build phases

1. **Static with fixtures.** All five screens rendering sample data. No backend.
2. **Read-only live data.** Paperclip and vote status through agreed endpoints. Still no writes.
3. **Member actions.** Claim, accept or decline an ask, edit profile and preferences, link chat accounts. Each action goes through Paperclip or the identity service, never directly to a database.
4. **Agent box and governance page.**

## Suggested stack

Next.js, TypeScript and Tailwind, deployable on Vercel. Keep it a thin client: no business logic that duplicates Paperclip or the Rob's Rules app.

## Not in scope

Running votes, approving grant packets, managing agents, or storing anything that already has an owner elsewhere.
