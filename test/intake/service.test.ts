import { expect, it } from 'vitest';
import { ingestObjective, projectObjectiveProgress, objectiveHash } from '../../src/intake/service.js';
import { fixture } from './support.js';
it('creates one CEO-owned native backlog item across replay and simultaneous deliveries', async () => {
    const f = fixture();
    const results = await Promise.all([ingestObjective(f.source, f.deps), ingestObjective(f.source, f.deps)]);
    expect(results.some(r => r.status === 'applied')).toBe(true);
    expect((await ingestObjective(f.source, f.deps)).status).toBe('replayed');
    expect(f.native.rows).toHaveLength(1);
    expect(f.native.rows[0]).toMatchObject({ assigneeAgentId: 'ceo', status: 'backlog' });
});
it('updates source content without taking over native priority or goal ownership', async () => {
    const f = fixture();
    await ingestObjective(f.source, f.deps);
    f.native.rows[0]!.priority = 'high';
    f.native.rows[0]!.goalId = 'existing-goal';
    f.revise({ revision: 'opaque-earlier', title: 'Corrected' });
    expect((await ingestObjective(f.source, f.deps)).status).toBe('applied');
    expect(f.native.rows).toHaveLength(1);
    expect(f.native.rows[0]).toMatchObject({ priority: 'high', goalId: 'existing-goal' });
});
it('rejects stale delivery and forged audience before any native operation', async () => {
    const f = fixture();
    const old = structuredClone(f.source);
    f.revise({ revision: '2' });
    expect((await ingestObjective(old, f.deps)).status).toBe('stale');
    expect((await ingestObjective({ ...f.source, audience: 'public' }, f.deps)).status).toBe('blocked');
    expect(f.native.rows).toHaveLength(0);
});
it('does not deduplicate independently attributed equal text', async () => {
    const f = fixture();
    await ingestObjective(f.source, f.deps);
    f.revise({ sourceId: 'second', authorRef: 'other', expectedPreviousHash: null });
    await ingestObjective(f.source, f.deps);
    expect(f.native.rows).toHaveLength(2);
});
it('reconciles accepted creation after response loss and never repeats ambiguous creates', async () => {
    const f = fixture();
    f.native.loseResponse = true;
    expect((await ingestObjective(f.source, f.deps)).status).toBe('pending');
    expect((await ingestObjective(f.source, f.deps)).status).toBe('replayed');
    expect(f.native.rows).toHaveLength(1);
    const g = fixture();
    g.native.failBeforeWrite = true;
    await ingestObjective(g.source, g.deps);
    g.native.failBeforeWrite = false;
    expect((await ingestObjective(g.source, g.deps)).status).toBe('pending');
    expect(g.native.rows).toHaveLength(0);
});
it('withdrawal retains mapping/history and stale resurrection is rejected', async () => {
    const f = fixture();
    const old = structuredClone(f.source);
    await ingestObjective(f.source, f.deps);
    f.revise({ withdrawn: true, revision: 'withdrawn' });
    await ingestObjective(f.source, f.deps);
    expect(f.native.rows[0]!.status).toBe('cancelled');
    expect((await ingestObjective(old, f.deps)).status).toBe('stale');
    expect(f.store.history).toHaveLength(2);
});
it('does not copy private source text or submitter into company-wide issue', async () => {
    const f = fixture();
    await ingestObjective(f.source, f.deps);
    expect(JSON.stringify(f.native.rows)).not.toContain(f.source.text);
    expect(JSON.stringify(f.native.rows)).not.toContain(f.source.authorRef);
});
it('fails closed on denied source and cross-company native readback', async () => {
    const f = fixture();
    f.allowed = false;
    expect((await ingestObjective(f.source, f.deps)).status).toBe('blocked');
    expect(f.native.rows).toHaveLength(0);
    f.allowed = true;
    await ingestObjective(f.source, f.deps);
    f.native.rows[0]!.companyId = 'other';
    expect((await projectObjectiveProgress(f.ref, 'members', f.deps)).status).toBe('suppressed');
});
it('projects native progress only after current audience and exact source checks', async () => {
    const f = fixture();
    await ingestObjective(f.source, f.deps);
    f.native.rows[0]!.status = 'in_progress';
    expect(await projectObjectiveProgress(f.ref, 'members', f.deps)).toMatchObject({ status: 'visible', progress: { status: 'in_progress' } });
    expect((await projectObjectiveProgress(f.ref, 'public', f.deps)).status).toBe('suppressed');
    f.revise({ revision: '2', audience: 'restricted' });
    expect((await projectObjectiveProgress(f.ref, 'members', f.deps)).status).toBe('suppressed');
});
it('checks source again before native write and suppresses races after write', async () => {
    const f = fixture();
    f.beforeClaim = () => f.revise({ revision: '2', withdrawn: true });
    expect((await ingestObjective(f.source, f.deps)).status).toBe('stale');
    expect(f.native.rows).toHaveLength(0);
    const g = fixture();
    g.native.afterWrite = () => g.revise({ revision: '2', audience: 'restricted' });
    expect((await ingestObjective(g.source, g.deps)).status).toBe('stale');
    expect((await projectObjectiveProgress(g.ref, 'members', g.deps)).status).toBe('suppressed');
});
it('requires source chain CAS rather than comparing opaque revision labels', async () => {
    const f = fixture();
    await ingestObjective(f.source, f.deps);
    f.revise({ revision: 'a', expectedPreviousHash: '0'.repeat(64) });
    expect((await ingestObjective(f.source, f.deps)).status).toBe('conflict');
    expect(f.native.rows).toHaveLength(1);
});
it('binds all source fields into hash and rejects payload mutation', async () => {
    const f = fixture();
    expect(objectiveHash({ ...f.source, title: 'changed' })).not.toBe(f.source.sourceHash);
    expect((await ingestObjective({ ...f.source, text: 'forged' }, f.deps)).status).toBe('blocked');
});
it('reconciles an exact native origin after mapping restoration instead of creating a duplicate',async()=>{
 const f=fixture();await ingestObjective(f.source,f.deps);f.store.rows.clear();
 expect((await ingestObjective(f.source,f.deps)).status).toBe('replayed');expect(f.native.rows).toHaveLength(1);
});
it('does not adopt or duplicate a pre-existing native origin with a different revision marker',async()=>{
 const f=fixture();await ingestObjective(f.source,f.deps);f.store.rows.clear();f.native.rows[0]!.marker='f'.repeat(64);
 expect((await ingestObjective(f.source,f.deps)).status).toBe('conflict');expect(f.native.rows).toHaveLength(1);
});
