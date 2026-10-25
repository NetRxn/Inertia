# Experimental fixed-pair native review handoff

This source-only opt-in qualifies the **review/redraft slice**, not an autonomous
funding application, owner escalation or next-case scheduler. It retains exactly
the existing six model tools and their independent issue/agent/principal/run
bindings. Native `done` below means review processing finished, including a
rejection. It never means candidate supported, human accepted or submitted.

## Initial native setup

The existing native CEO/task owner must establish the two configured tasks with
the producer blocked by the reviewer. The reviewer must **not** depend on producer
completion. Parent hierarchy is independent. Keep unrelated dependencies and
security holds. Before any pending work, an idle reviewer can be `done`; that is
an empty review workload, not approval of a candidate. The adapter validates this
graph but never rewrites it. It never removes a hold or manufactures run admission.

Enable both public administrator configuration flags:

```json
{"nativeCaseProgression": true, "nativeDependencyHandoff": true}
```

The pinned private native-cycle configuration also requires
`cycle.native_dependency_handoff: true`. Both dependency flags default to false.
Update the existing administrator-selected source/configuration pins together.
Do not enable only the public flag against an old domain process: its checkpoint
response is rejected, not interpreted as proof of a frozen producer run.

## Normal source flow

1. A natively admitted producer saves exact evidence-backed candidates. Only
   committed pending review requests reach the existing reviewer callback.
2. An idle/done reviewer is reopened only after fresh native identity and explicit
   empty active-run readback. `done` alone is never proof of executor termination.
   An already active, correctly bound reviewer may process further pending
   requests; each exact request keeps its existing idempotency key.
3. The dependency checkpoint freezes the **existing** private producer run-binding
   with its exact handoff and bounded pending request IDs, then dispatches pending
   committed requests outside the domain transaction. It does not create a new
   queue, table or workflow store.
4. The host mirrors the first authoritative handoff and sets the producer blocked.
   The old run cannot save or select work again, even after native re-checkout or
   a later configuration toggle. Exact checkpoint replay remains available.
5. Each independent exact review is admitted through the existing domain review
   service. The reviewer stays active while reviews remain; at zero pending
   reviews its task becomes done. The opt-in branch emits **no generic producer
   wake**. Native dependency readiness/finalization owns the successor run.
6. A genuinely new, natively admitted producer run selects the same unconsumed
   case, reads rejection and redrafts. The next review cycle uses new exact
   candidate bytes; old run replay cannot dispatch that newer generation.

The protected checkpoint transport accepts host-only `replay_only`. Public model
arguments remain `{}`. The private response is
`dfw-native-dependency-checkpoint-v1` with `handoff`, `replayed` and
`producer_run_frozen`; the model receives the existing exact handoff object.
Blocked/in-review replay neither reacquires checkout nor dispatches/writes native
state. In-progress retry can recover original pending dispatch after a lost wake
acknowledgement. An immutable replay never creates a second blocked cycle.

## Explicit limits; do not declare autonomous closure

- Domain freeze and the native blocked update are not one transaction. If freeze
  commits but the first native transition is undelivered, replay can recover
  pending review dispatch but intentionally cannot manufacture a new blocked
  cycle. Native task-owner recovery remains to be observed. Do not work around
  this with a root wake or a new poller and label the run autonomous.
- Pinned Paperclip dependency readiness uses its own workspace-finalization
  rules. A reviewer without recorded workspace operations may be done while its
  old executor is still active. The host refuses to reopen it, but that denial
  does not itself promise another automatic producer wake. Live native ordering,
  pause/budget holds, finalization and cycle dedup still require runtime proof.
- Existing native CEO task/heartbeat recovery can potentially own a failed or
  blocked task using its current task permissions and saved receipts; this slice
  neither adds such a loop nor proves its recovery behavior. Candidate admission
  remains the domain's responsibility, never the CEO's interpretation of prose.
- Independent gap-plan review is not yet native-transport qualified. Owner-ready
  escalation requires the authoritative reviewed preparation and an actual
  native owner/request. `in_review` plus a document is not proof of escalation.
  An `ask_user_questions` interaction defaults to an agent-resolvable `anyone`
  policy; human escalation must use an explicit currently eligible human
  addressee or effective `human_only` resolver policy. Verify the actual native
  interaction fields and current eligibility, not the title or prose.
- A parked case does not self-schedule the next case. No acceptance, submission,
  provider call, production data migration or 10–15-organization rollout is
  implied by these source tests.

## Evidence and reproduction

This public source stack carries the adapter prerequisites from PR84
`5f2bf6228cc0f6db6d995f51f3cc873461eef5bd` onto develop
`eceeac8eb83e3b480d68f3b0dd0d21a3b0b0a569`, preserving the current fast-CI
files. It does not modify PR84's branch or include private domain implementation
or operational data. Pinned native source is Paperclip 2026.1012.0 /
`bba6a45f0d364cfd962ac59b3bdf2426a8222adb`.

```sh
npx --no-install vitest run test/drafting test/paperclip/context.test.ts --maxWorkers=1
npx --no-install tsc --noEmit
# Optional: an isolated installed private package, synthetic SQLite and real cold stdio.
NATIVE_DEPENDENCY_DFW_HOME=/path/to/government-funding-dfw \
NATIVE_DEPENDENCY_PYTHON=/path/to/isolated/python \
  npx --no-install vitest run test/drafting/dependency-cold.test.ts --maxWorkers=1
```

The cold test invokes the candidate drafting/review paths through real subprocesses and
checks rejected draft → correction → independent support, old-run freeze, exact
replay and unchanged no-acceptance/submission boundaries. **Native admissions in
that test are explicit host-fixture transitions**, not real scheduler/provider
evidence. Never present its pass as the required root-observer-only live proof.
