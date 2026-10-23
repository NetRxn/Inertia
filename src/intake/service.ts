import { createHash } from 'node:crypto';
import type { IntakeDependencies, IntakeMapping, IntakeReceipt, NativeObjective, ObjectiveRef, ObjectiveSubmission } from './contracts.js';
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const hex = /^[a-f0-9]{64}$/;
export function objectiveHash(s: ObjectiveSubmission): string {
    return hash([s.sourceSystem, s.sourceId, s.organizationId, s.revision, s.expectedPreviousHash, s.authorRef, s.audience, s.title, s.text, s.withdrawn]);
}
function valid(s: ObjectiveSubmission): boolean {
    if (!s || typeof s !== 'object' || Object.keys(s).sort().join(',') !== ['sourceSystem', 'sourceId', 'organizationId', 'revision', 'sourceHash', 'expectedPreviousHash', 'authorRef', 'audience', 'title', 'text', 'withdrawn'].sort().join(','))
        return false;
    if ([s.sourceSystem, s.sourceId, s.organizationId, s.revision, s.authorRef, s.title, s.text].some(v => typeof v !== 'string' || !v.trim() || v.length > 100000 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v)))
        return false;
    return ['public', 'members', 'restricted'].includes(s.audience) && typeof s.withdrawn === 'boolean' && hex.test(s.sourceHash) && (s.expectedPreviousHash === null || hex.test(s.expectedPreviousHash)) && objectiveHash(s) === s.sourceHash;
}
export function objectiveKey(organizationId: string, ref: ObjectiveRef): string { return hash([organizationId, ref.sourceSystem, ref.sourceId]); }
function matches(row: NativeObjective, m: IntakeMapping): boolean { return row.companyId === m.companyId && row.originId === m.key && row.marker === m.marker && (!m.nativeIssueId || row.id === m.nativeIssueId); }
async function current(s: ObjectiveSubmission, d: IntakeDependencies): Promise<boolean> {
    const latest = await d.source.read({ sourceSystem: s.sourceSystem, sourceId: s.sourceId });
    return !!latest && valid(latest) && latest.organizationId === d.organizationId && latest.sourceHash === s.sourceHash;
}
/** Public event data is only a hint. The configured source reauthorizes and reads back every snapshot. */
export async function ingestObjective(input: ObjectiveSubmission, d: IntakeDependencies): Promise<IntakeReceipt> {
    const s = structuredClone(input);
    const result = (status: IntakeReceipt['status'], id: string | null = null): IntakeReceipt => ({ status, sourceId: s?.sourceId, revision: s?.revision, nativeIssueId: id });
    if (!valid(s) || s.organizationId !== d.organizationId || !d.companyId || !d.intakeAgentId)
        return result('blocked');
    try {
        const authoritative = await d.source.read({ sourceSystem: s.sourceSystem, sourceId: s.sourceId });
        if (!authoritative)
            return result('blocked');
        if (!valid(authoritative) || authoritative.organizationId !== d.organizationId)
            return result('blocked');
        if (authoritative.sourceHash !== s.sourceHash)
            return result('stale');
        const key = objectiveKey(d.organizationId, s);
        let previous = await d.store.read(key);
        if (previous?.companyId !== undefined && previous.companyId !== d.companyId)
            return result('blocked');
        if (previous?.pending) {
            const rows = await d.native.find(key);
            if (rows.length !== 1 || !matches(rows[0]!, previous))
                return result(rows.length > 1 ? 'conflict' : 'pending');
            if (!await d.store.finish(key, previous.version, rows[0]!.id))
                return result('pending');
            previous = await d.store.read(key);
            if (!previous || previous.pending)
                return result('pending');
        }
        if (previous?.snapshot.sourceHash === s.sourceHash)
            return result('replayed', previous.nativeIssueId);
        if (previous && s.expectedPreviousHash !== previous.snapshot.sourceHash)
            return result('conflict', previous.nativeIssueId);
        // A current initial snapshot can arrive after missed historical events. Source authority,
        // rather than lexical revision ordering, proves currency; subsequent updates require CAS.
        const version = (previous?.version ?? 0) + 1;
        const next: IntakeMapping = { key, companyId: d.companyId, version, snapshot: s, nativeIssueId: previous?.nativeIssueId ?? null, pending: true, marker: hash([key, version, s.sourceHash]) };
        if (!await d.store.claim(next, previous?.version ?? 0))
            return result('pending');
        // Restore/import safety: an existing exact origin must be reconciled before
        // the first create, even when a mapping was lost during an operator restore.
        const existing = next.nativeIssueId === null ? await d.native.find(key) : [];
        if (!await current(s, d)) {
            await d.store.abort(key, version, previous);
            return result('stale');
        }
        if (existing.length) {
            if (existing.length !== 1 || !matches(existing[0]!, next))
                return result('conflict');
            if (!await d.store.finish(key, version, existing[0]!.id))
                return result('pending');
            return result('replayed', existing[0]!.id);
        }
        // One call only. A timeout can mean success; retained claim must be reconciled, never stolen.
        const applied = await d.native.apply({ key, marker: next.marker, companyId: d.companyId, intakeAgentId: d.intakeAgentId, nativeIssueId: next.nativeIssueId, withdrawn: s.withdrawn });
        if (!matches(applied, next))
            return result('conflict');
        const rows = await d.native.find(key);
        if (rows.length !== 1 || !matches(rows[0]!, next))
            return result('pending');
        if (!await d.store.finish(key, version, applied.id))
            return result('pending');
        if (!await current(s, d))
            return result('stale', applied.id);
        return result('applied', applied.id);
    }
    catch {
        return result('pending');
    }
}
export type ProgressProjection = {
    status: 'suppressed';
} | {
    status: 'visible';
    sourceId: string;
    revision: string;
    nativeIssueId: string;
    progress: {
        status: string;
        priority: string;
        goalId: string | null;
    };
};
/** Read-through view, not a second queue. Never expose source text or native comments to wider audiences. */
export async function projectObjectiveProgress(ref: ObjectiveRef, audience: ObjectiveSubmission['audience'], d: IntakeDependencies): Promise<ProgressProjection> {
    const hidden: ProgressProjection = { status: 'suppressed' };
    try {
        const s = await d.source.read(ref);
        if (!s || !valid(s) || s.organizationId !== d.organizationId || s.withdrawn)
            return hidden;
        if (audience !== s.audience && s.audience !== 'public')
            return hidden;
        const m = await d.store.read(objectiveKey(d.organizationId, ref));
        if (!m || m.companyId !== d.companyId || m.pending || m.snapshot.sourceHash !== s.sourceHash)
            return hidden;
        const rows = await d.native.find(m.key);
        if (rows.length !== 1 || !matches(rows[0]!, m) || !await current(s, d))
            return hidden;
        const row = rows[0]!;
        return { status: 'visible', sourceId: s.sourceId, revision: s.revision, nativeIssueId: row.id, progress: { status: row.status, priority: row.priority, goalId: row.goalId } };
    }
    catch {
        return hidden;
    }
}
