# Connected rehearsal and live handoffs

Run `npm run demo:workflow` from a development checkout (Node >=24.11, `npm ci`). It builds once, prints the journey, and writes one deterministic receipt to `runs/workflow-receipt.json`. The ignored `runs` directory is local output. The runtime package excludes the rehearsal and its PGlite dependency.

The rehearsal uses the actual Roundtable validation/hash core, Postgres bridge migrations and durable inbox/outbox, Paperclip adapter, signed Buzz transport, and grant snapshot/governance evaluation. External I/O is synthetic. Each fresh run produces the same manifest; within the run a reconstructed bridge replays the signed reply without a second native mutation.

The fixture orchestrator seeds one initiative/issue from an unverified action candidate and attaches the meeting output hash/revision and frozen packet ID/version/hash. That seeding is the integration seam to replace with native Paperclip work creation. The ordinary paired acknowledgment references the exact packet, but the separate governance evaluator supplies the grant authority receipt. Publication stays pending on unknown readback. No live service is contacted.

Cloud is the default development and verification environment. Laptop Docker checks are optional, used only for a specific cloud blocker or platform check; they do not gate this rehearsal.

## Adapter acceptance checklist

Each live adapter needs a configured owner, a least-privilege identity, and an integration test against the named instance. Keep shared credentials on the trusted server, outside agent task inputs.

- **Drive capture:** Input: authorized organization folder and stable file/revision identifiers. Output: `Source` envelope with meeting ID, readiness, audience, original transcript bytes and revision. Validate the actual Gemini artifact format; summary-only captures must remain a visible exception. A repeated notification must preserve identity and avoid duplicate work.
- **DAO publisher:** Input: authenticated `Publication` including transcript, source/output hashes, operation ID, audience and expected previous output hash. Output: authoritative lookup/readback of that publication. Implement atomic idempotency and compare-and-swap correction on the DAO server; preserve member/public access boundaries. The existing Next.js server action requires an explicit machine-ingestion contract before connecting it.
- **Native work:** Input: source evidence plus a trusted policy selecting company, initiative and issue. Output: actual native IDs and durable source-operation correlation. Reconcile an uncertain create before retry; retain candidate classifications/unknown owner until a trusted assignment. Use native assignment/wakeup/review primitives.
- **Grant exporter:** Input: packet/applicant identity. Output: authoritative `ReviewedGrantExport` plus exact artifact bytes through `ReviewedGrantSource`, preserving all five role signoffs and current-cycle checks. Supply a trusted exporter; the packet-list response alone lacks the full review material. Compare frozen hash/version again before accepting authority.
- **Governance:** Input: network, proposal ID, authorized action and exact frozen packet hash. Output: independently verified final result and evidence reference through `GovernanceVerifier` with `kind: chain`. Test wrong chain/action/hash, pending/rejected result and stale packet. Persist receipt acceptance transactionally; submission is a separate authorized human handoff.
- **Buzz/Paperclip:** Input: configured relay/company/thread binding and verified human pairing. Output: native interaction ID plus persisted signed receipt ID. Confirm native membership and thread audience on the installed host. Unknown outcomes stay unresolved until authoritative readback; replay must not duplicate a native response.
- **Y2:** Input: team-approved interest/topic and authorized visibility. Output: stable subscription ID and deduplicable update IDs correlated to the native initiative. Obtain the real API/event contract before adding an adapter; route updates into existing native work.
- **Member runner:** Input: member identity, scoped native work assignment and minimum authorized task data. Output: native task/artifact references and verifiable execution result. Validate client-side sandbox/worktree isolation, server-side scope enforcement, revocation, and cross-member denial; keep control-plane credentials off member runtimes.

## Demo acceptance

- Receipt source revision/output hash agrees with work provenance.
- Work packet version/hash agrees with the frozen packet and governance receipt.
- Paired decision and receipt resolve to the same native issue/interaction.
- One accepted reply causes one native mutation, including restart replay.
- Fixture authority remains explicitly labeled; pending publication and unfinished adapters stay visible.
- Before a live rehearsal, replace each fixture with its tested adapter and capture real IDs/readbacks. The offline receipt is reproducible engineering evidence; the live receipt is produced only by the connected deployment.
