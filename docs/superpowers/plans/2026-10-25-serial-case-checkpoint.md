# Serial case checkpoint adapter

Keep the existing six public tools, actors, tasks, ownership and approval policy.
An optional administrator-only nativeCaseProgression flag routes checkpoint to
the private domain checkpoint operation; absent/false preserves fixed-match
workspace behavior. The domain returns an immutable bounded handoff receipt,
not a current workspace: replay must work after source changes or match deletion.

Validate receipt schema, current authenticated run, no acceptance/submission,
and disposition before writing a case/selection/packet-keyed immutable native
snapshot. Existing native owner serializes writes; conflicting stored content
fails closed. Pending review blocks; agent work remains in progress; owner/human
handoff enters review. No automatic wake, new capability, scheduler or policy.

Test-first: opt-in/default routing, schema/actor denial, same and lost-response
replay, immutable history/conflicts, correct status, no self-wake, unchanged tools.
Run focused and complete tests, typecheck/build/package, independent code review.
Publish only reviewed draft source changes; no deployment or runtime activation.
