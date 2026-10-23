import { beforeAll, afterAll, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { createIntakeStore } from '../../src/intake/store.js';
import { BRIDGE_NAMESPACE } from '../../src/store/postgres.js';
import type { PluginDatabaseClient } from '@paperclipai/plugin-sdk';
import { fixture } from './support.js';
import { ingestObjective } from '../../src/intake/service.js';
let pg: PGlite;
let db: PluginDatabaseClient;
beforeAll(async () => { pg = new PGlite(); await pg.exec(`CREATE SCHEMA ${BRIDGE_NAMESPACE}`); await pg.exec(await readFile(new URL('../../migrations/007_objective_intake.sql', import.meta.url), 'utf8')); db = { namespace: BRIDGE_NAMESPACE, query: async <T>(q: string, p?: unknown[]) => (await pg.query<T>(q, p)).rows, execute: async (q, p) => ({ rowCount: (await pg.query(q, p)).affectedRows ?? 0 }) }; }, 60000);
afterAll(async () => { await pg.close(); });
it('serializes concurrent creates durably across service reconstruction', async () => {
    const f = fixture();
    f.deps.store = createIntakeStore(db);
    await Promise.all(Array.from({ length: 8 }, () => ingestObjective(f.source, f.deps)));
    f.deps.store = createIntakeStore(db);
    expect((await ingestObjective(f.source, f.deps)).status).toBe('replayed');
    expect(f.native.rows).toHaveLength(1);
    f.revise({ revision: 'next' });
    await ingestObjective(f.source, f.deps);
    const rows = await pg.query<{
        history: unknown[];
    }>(`SELECT history FROM ${BRIDGE_NAMESPACE}.objective_intake`);
    expect(rows.rows[0]!.history).toHaveLength(2);
});
it('retains unknown claims and cannot overwrite them with later snapshots', async () => {
    const f = fixture();
    f.revise({ sourceId: 'unknown' });
    f.deps.store = createIntakeStore(db);
    f.native.failBeforeWrite = true;
    await ingestObjective(f.source, f.deps);
    f.revise({ revision: 'new' });
    expect((await ingestObjective(f.source, f.deps)).status).toBe('pending');
    expect(f.native.rows).toHaveLength(0);
});
it('rejects an unexpected namespace and redacts failed SQL', async () => {
    expect(() => createIntakeStore({ ...db, namespace: 'public' })).toThrow();
    const bad = { ...db, query: async () => { throw Error('secret'); } };
    await expect(createIntakeStore(bad).read('x')).rejects.toThrow(/^Objective mapping unavailable\.$/);
});
