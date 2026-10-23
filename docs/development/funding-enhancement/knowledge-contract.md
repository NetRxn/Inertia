# Meeting knowledge candidates

Contract revision: `dao-knowledge-v1`.

`extractKnowledgeCandidates(source: Source, notes: Notes): KnowledgeCandidate[]`
is a pure, opt-in extractor. It does not change meeting preparation, publication,
admission, native tasks, or existing grant behavior. It uses existing ingestion
types and the existing SHA-256 codec. A ready transcript is required; summary-only
or malformed input fails closed, without returning partial candidates.

## Evidence and wire fields

Every candidate contains:

- `contract_version`, `candidate_id`, `kind`, and `value`.
- `source_id`, `source_revision`, `source_hash`, and `audience` copied from the
  source envelope, with `source_hash` computed over raw UTF-8 `Source.text`.
- `source_locator: { meeting_id, line_start, line_end }`. Both line fields are the
  same positive, 1-based line number in
  `source.text.replace(/\r\n?/g, '\n').trim()`.
- Fixed `status: "candidate"`, `verification: "unverified"`, and `owner: null`.

`value` is an unchanged complete source line. Partial, rewritten, wrong-line, or
unsafe excerpts are rejected using ingestion-compatible bounds. Negations,
contradictions, alleged adoptions and corrections are preserved verbatim.
The selection labels map `notes` to `fact`, `decisions` to `decision`, and
`actions` to `commitment`; these are unverified candidate categories, not claims
that a fact is verified or a decision/commitment adopted. Non-null action owners
are rejected. Other producer-supplied metadata cannot override output fields.

## Identity and replay

`candidate_id` is the lowercase hexadecimal SHA-256 of the UTF-8 JavaScript
`JSON.stringify` serialization of this ordered array:

```text
[contract_version, meetingId, sourceId, revision, sourceHash,
 audience, kind, line, quote]
```

Repeated evidence of the same kind at the same source line is emitted once.
Repeated calls are deterministic; results sort by line, then ASCII kind. The same
text at another line, a different category, meeting, source, revision, audience,
or raw source hash has a distinct identity. Even changes to raw line endings
produce a new hash/identity while preserving normalized line evidence. Revisions
are opaque and never lexically ordered. This function does not itself persist or
reconcile duplicate deliveries.

## Trusted receiving boundary

The extractor intentionally emits no `organization_id`, scope, claim key,
effective dates, adoption decision, supersession, or authority attribution.
A trusted receiving adapter must resolve organization and scope server-side,
link existing admitted document versions/facts, verify the exact quote and
locator against the raw-source hash and current source revision, and enforce
current audience authorization before proposing or reusing knowledge. Source
metadata and candidate IDs are provenance bindings, not proof of authorization.

The Python `dao-knowledge-v1` service owns persistence, source invalidation,
conflict handling and trusted admission. Source-policy admission can establish
ordinary factual/resource observations, not priorities, decisions or
commitments. Those require the appropriate trusted authority. Extraction never
widens an opportunity-specific budget into organization-wide spending authority,
even when the transcript asks it to. Corrected or revoked sources require the
receiving service to invalidate dependent records; this pure extractor cannot
detect an external revocation.

The tests use synthetic transcripts only. This contract does not qualify live
meeting adapters, production databases, or adoption workflows.
