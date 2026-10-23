import { objectiveHash } from '../../src/intake/service.js';
import type { IntakeDependencies, IntakeMapping, ObjectiveSubmission, NativeObjective } from '../../src/intake/contracts.js';
export function fixture() {
    const f = { source: null as unknown as ObjectiveSubmission, ref: { sourceSystem: 'dao-platform', sourceId: 'bounty-1' }, allowed: true, beforeClaim: undefined as undefined | (() => void),
        store: { rows: new Map<string, IntakeMapping>(), history: [] as IntakeMapping[] },
        native: { rows: [] as NativeObjective[], loseResponse: false, failBeforeWrite: false, afterWrite: undefined as undefined | (() => void) },
        deps: null as unknown as IntakeDependencies,
        revise(patch: Partial<ObjectiveSubmission>) { f.source = { ...f.source, expectedPreviousHash: f.source.sourceHash, ...patch }; f.source.sourceHash = objectiveHash(f.source); f.ref = { sourceSystem: f.source.sourceSystem, sourceId: f.source.sourceId }; } };
    f.source = { sourceSystem: 'dao-platform', sourceId: 'bounty-1', organizationId: 'dao', revision: 'z', sourceHash: '', expectedPreviousHash: null, authorRef: 'member-private', audience: 'members', title: 'Private objective', text: 'Original private problem statement', withdrawn: false };
    f.source.sourceHash = objectiveHash(f.source);
    f.deps = { organizationId: 'dao', companyId: 'co', intakeAgentId: 'ceo', source: { async read(ref) { return f.allowed && ref.sourceId === f.source.sourceId ? structuredClone(f.source) : null; } },
        store: { async abort(key, version, previous) { const row = f.store.rows.get(key); if (row?.version !== version)
                return false; if (previous)
                f.store.rows.set(key, structuredClone(previous));
            else
                f.store.rows.delete(key); return true; }, async read(key) { return structuredClone(f.store.rows.get(key) ?? null); }, async claim(next, expected) { f.beforeClaim?.(); const old = f.store.rows.get(next.key); if ((old?.version ?? 0) !== expected || old?.pending)
                return false; f.store.rows.set(next.key, structuredClone(next)); f.store.history.push(structuredClone(next)); return true; }, async finish(key, version, id) { const row = f.store.rows.get(key); if (!row || row.version !== version || !row.pending)
                return false; row.pending = false; row.nativeIssueId = id; return true; } },
        native: { async find(key) { return f.native.rows.filter(r => r.originId === key).map(r => structuredClone(r)); }, async apply(operation) { if (f.native.failBeforeWrite)
                throw Error('lost'); let row = f.native.rows.find(r => r.id === operation.nativeIssueId); if (!row) {
                row = { id: 'native-' + f.native.rows.length, companyId: operation.companyId, originId: operation.key, marker: operation.marker, status: 'backlog', priority: 'medium', goalId: null, assigneeAgentId: operation.intakeAgentId };
                f.native.rows.push(row);
            } row.marker = operation.marker; if (operation.withdrawn)
                row.status = 'cancelled'; f.native.afterWrite?.(); if (f.native.loseResponse)
                throw Error('lost'); return structuredClone(row); } } };
    return f;
}
