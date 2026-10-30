# Inertia

**Turn organization knowledge into coordinated, evidence-based work.**

Inertia connects shared knowledge, organizational objectives and AI agents in one accountable workflow. A general Coordinator delegates work, agents research and draft in parallel, and independent reviewers return corrections before people make final decisions. Funding research and application preparation are the first demonstrated use case.

**HackFW MADE Challenge · Open Forum track**

[Watch the demo](https://youtu.be/s5NHieVPrN4) · [Explore the architecture](docs/guide/architecture.svg) · [Read the user guide](docs/guide/user-guide.md)

## Problem and solution

Organizations often have useful knowledge spread across documents and conversations, while turning that knowledge into completed work requires repeated research, coordination and review. AI-generated text alone does not resolve ownership, evidence quality or approval.

Inertia connects those steps. The member app provides access to organization knowledge and work views. Paperclip manages agent tasks and review. Scoped knowledge access supplies source citations, while durable case records retain drafts, corrections and the next action. People remain responsible for commitments and external submission.

## What the MVP demonstrates

The funding workflow follows a practical path:

1. **Discover and prioritize:** pass saved opportunities to the Coordinator and organize work into distinct cases.
2. **Research and draft:** run case agents in parallel, using organization knowledge and source evidence to produce proposed work.
3. **Review and correct:** independently review source proposals and return corrections to the same case.
4. **Read and decide:** inspect saved drafts and human-readable Markdown/DOCX artifacts, resolve missing facts and make the final decision.

The demonstrated pilot created thirteen distinct case tasks, ran four case providers concurrently, and used scoped organization search in saved writing and artifact readback. A FUTO draft sample met the team's MVP quality bar. Independent source review was demonstrated; **source approval does not establish approval of an application, budget or final packet**.

[Watch the recorded demo](https://youtu.be/s5NHieVPrN4) for the product walkthrough. See the [MVP guide](docs/guide/README.md) for scope and the [source integration record](docs/development/source-integration-20261029.md) for technical validation and provenance.

## Documentation

| Review question | Documentation |
| --- | --- |
| What can users do, and what does the MVP demonstrate? | [MVP overview](docs/guide/README.md) · [User guide](docs/guide/user-guide.md) |
| How are agents, review and durable stores connected? | [Architecture diagram](docs/guide/architecture.svg) · [Printable PDF](docs/guide/architecture.pdf) · [HTML source](docs/guide/architecture.html) |
| How do I install dependencies and validate the source? | [Installation and qualification](docs/guide/install.md) |
| How are deployment, recovery and source releases managed? | [Release and recovery](docs/guide/release.md) · [Release notes](docs/releases/20261029/RELEASE_NOTES.md) |
| Which commits and components were qualified? | [Source inputs](docs/releases/20261029/source-inputs.json) · [Integration evidence](docs/development/source-integration-20261029.md) |

The [0.1.1 P0 release record](docs/releases/0.1.1/RELEASE_NOTES.md) documents the qualified deployment, exact image/source pins and provenance limits.

## Source and local validation

GitHub's default branch, `develop`, contains the integrated source. The [Inertia v0.1.0](https://github.com/NetRxn/Inertia/tree/v0.1.0) and [DFW v3.4.1](https://github.com/NetRxn/DFW-Gov-Fund/tree/v3.4.1) tags preserve the qualified source release; documentation may advance on `develop`.

| Component | Source |
| --- | --- |
| Member app | [`apps/member`](apps/member) |
| Paperclip plugin, task bridge and UI | [`src`](src) |
| Pinned native composition and overlays | [`host-composition/paperclip-durable-funding-review`](host-composition/paperclip-durable-funding-review) |
| Funding domain | [DFW-Gov-Fund](https://github.com/NetRxn/DFW-Gov-Fund/tree/main/government-funding-dfw) |

With Node.js 24.11 or newer, validate the plugin source from a clean checkout:

```sh
git clone --branch develop https://github.com/NetRxn/Inertia.git
cd Inertia
npm ci
npm run typecheck
npm test
npm run build
npm run test:package
```

These commands validate and package the plugin; they do not start the complete member/native/domain deployment. The [installation guide](docs/guide/install.md) explains component setup, the pinned runtime and optional cross-repository qualification. Production access, credentials and activation remain operator-managed.

## Current limits

This MVP supports a prioritized shortlist and readable proposed drafts. It does not claim exhaustive funding coverage, final whole-application approval or autonomous submission. External submission remains manual. Paperclip–Buzz participation, Gemini-note ingestion/action triage and durable exhausted-case revisit are deferred. A Git merge or source tag does not establish which image is deployed; see the [release guide](docs/guide/release.md) for deployment boundaries and the known dependency follow-up.

## HackFW submission

- **Track:** Open Forum.
- **Repository:** [NetRxn/Inertia](https://github.com/NetRxn/Inertia), with `develop` as the default branch.
- **Video demo:** [Watch on YouTube](https://youtu.be/s5NHieVPrN4).
- **Talent registration:** the team has confirmed member registration in the [Fort Worth Talent Database](https://talent.fwtx.city).

For technical collaboration, use the [sprint coordination issue](https://github.com/NetRxn/Inertia/issues/40). The [original product overview](docs/reference/Inertia-beta-product-overview.pdf) and dated delivery snapshots remain available as historical context.
