# Normal agent permission grants

This source overlay adds generic board-only `PATCH /api/agents/:id/permission-grants` for existing company agent memberships. It does not configure agents, start providers, unpause a company, grant a funding-specific bypass or change human membership routes. Active and paused companies are supported for normal held maintenance.

Body is exactly `{grants:[{permissionKey,scope?},...],expectedGrantsFingerprint:<64lowerhex>}`. Permission keys/scope use the existing updateMemberPermissionsSchema; duplicate permission keys are rejected. The whole grant set is replaced, so callers must merge intended changes with the fresh complete grant list. Empty grants explicitly clear that target's grants. No missing membership is created.

Existing `GET /api/agents/:id` supplies `access.membership` and `access.grants` to an authorized operator. Compute the fingerprint with exported `agentPermissionGrantsFingerprint` or the exact canonical schema below:

```
SHA256(canonicalJSON({version:1,companyId,agentId,membershipId:membership.id,
 membershipStatus:membership.status,
 grants:grants.map(g=>({id:g.id,permissionKey:g.permissionKey,scope:g.scope??null,
 updatedAt:new Date(g.updatedAt).toISOString()})).sort((a,b)=>a.id.localeCompare(b.id))}))
```

Canonical JSON recursively sorts object keys, preserving array order. POST/GET/other paths are not added. Old fingerprints return409 without replacement. The success response is `{companyId,agentId,membershipId,grants,grantsFingerprint}`; it never uses the human-only response loader.

The transaction locks current company, actual same-company agent, active agent membership, requesting board user's membership/permission and all current target grant rows. It rechecks `users:manage_permissions` through native authorization. Non-board callers, wrong companies/missing memberships, pending/terminated agents and any reserved builtin metadata marker are denied. Audit `agent.permission_grants_updated` commits atomically with the full replacement and includes current board actor snapshot, old/new grants and CAS fingerprints. It changes no agent flags, company status, connections or membership row.

The installer verifies exact package/build, previous route bytes, immutable auth/private/resource/source guards, new helper and patch hashes, rejects partial/drift/symlink states and applies idempotently. The actual native Express/PostgreSQL fixture checks authorized held maintenance, unauthorized/cross-company/builtin/lifecycle denial, stale CAS, full replacement, audit rollback and unchanged human self/owner protection.
