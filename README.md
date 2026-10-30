# Inertia

Inertia turns organization knowledge and objectives into accountable agent work. Paperclip coordinates native tasks and independent review; the member app provides organization knowledge and work views. Funding is the current MVP workflow.

**Start with the [MVP guide](https://github.com/NetRxn/Inertia/blob/develop/docs/guide/README.md): use, architecture, install, release and recovery.**

## Find the right branch

- **Integrated member app:** [`develop` → `apps/member`](https://github.com/NetRxn/Inertia/tree/develop/apps/member), integrated by peer-owned [PR #148](https://github.com/NetRxn/Inertia/pull/148). The peer's ongoing branch is [`claude/member-app-feed-redesign-cf004e`](https://github.com/NetRxn/Inertia/tree/claude/member-app-feed-redesign-cf004e), tracked in [PR #141](https://github.com/NetRxn/Inertia/pull/141).
- **Integrated plugin, funding and native source:** [`develop`](https://github.com/NetRxn/Inertia/tree/develop). Plugin code is in `src/`; native overlays are in `host-composition/paperclip-durable-funding-review/`.
- **Funding domain:** [DFW-Gov-Fund `main` → `government-funding-dfw`](https://github.com/NetRxn/DFW-Gov-Fund/tree/main/government-funding-dfw).

On GitHub, open the direct link or choose the exact branch in the branch dropdown above the file list. On an existing local checkout, `git fetch origin` and `git log --oneline -5 origin/develop` inspect integrated history without switching or resetting teammate work. See the [source integration status](docs/development/source-integration-20261029.md) for ownership and validation.

## MVP scope

Saved Alpha candidates reached thirteen Beta case tasks; four case providers ran concurrently. Scoped organization search fed into actual saved writing and artifact readback. The human accepted the FUTO draft sample quality for tomorrow. Charlie accepted FUTO source393f; this does not approve an application or final packet.

The immediate result is a Coordinator-ranked handful of strongest active saved opportunities and readable real proposed drafts. Full 1,475-record coverage is not an MVP gate. Real Paperclip-Buzz, Gemini-note ingestion/triage and durable exhaustion/revisit are deferred. Current submission is manual.

## Develop and qualify

Node.js 24.11+. From a clean reviewed source checkout:

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run test:package
```

Public fixtures use controlled external I/O. Cross-repository DFW qualification requires its reviewed checkout and locked Python paths; see the source guide. Building, merging or tagging source does not deploy the VPS. Release tags are created only on exact verified integrated commits under the release owner's accepted scope.

## Evidence and contributing

[Source integration](https://github.com/NetRxn/Inertia/blob/develop/docs/development/source-integration-20261029.md) · [Sprint coordination](https://github.com/NetRxn/Inertia/issues/40) · [Original product overview](https://github.com/NetRxn/Inertia/blob/develop/docs/reference/Inertia-beta-product-overview.pdf)

Historical qualification, architecture and delivery snapshots remain in docs/. They retain dated limits and are not product acceptance certificates. Preserve peer work, exact source provenance, independent review and protected configuration.
