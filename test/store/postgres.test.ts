import { vi, beforeEach, afterEach, it, expect } from 'vitest';
// PGlite initializes PostgreSQL WASM per fixture. Shared cloud CPU can make
// startup slow; this fixture-only budget does not change application deadlines.
vi.setConfig({ hookTimeout: 60000 });
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import type { PluginDatabaseClient } from '@paperclipai/plugin-sdk';
import { createBridgeStore, BRIDGE_NAMESPACE } from '../../src/store/postgres.js';
let pg: PGlite;
let db: PluginDatabaseClient;
beforeEach(async () => { pg = new PGlite(); await pg.exec(`CREATE SCHEMA ${BRIDGE_NAMESPACE}`); await pg.exec(await readFile(new URL('../../migrations/001_bridge.sql', import.meta.url), 'utf8')); await pg.exec(await readFile(new URL('../../migrations/003_delivery_recovery.sql', import.meta.url), 'utf8')); db = { namespace: BRIDGE_NAMESPACE, query: async <T>(sql: string, params?: unknown[]) => (await pg.query<T>(sql, params)).rows, execute: async (sql, params) => ({ rowCount: (await pg.query(sql, params)).affectedRows ?? 0 }) }; });
afterEach(async () => { await pg.close(); });
const key = { relay: 'https://buzz.example', eventId: 'a'.repeat(64) };
const input = { destination: { relay: key.relay, channelId: 'channel', rootId: 'root', companyId: 'co', issueId: 'issue' }, command: { kind: 'comment', body: 'hello' }, receiptKey: 'receipt-a' };
it('allows exactly one concurrent claim and survives store reconstruction', async () => { const a = createBridgeStore(db); const results = await Promise.all(Array.from({ length: 8 }, () => a.claim(key, input))); expect(results.filter(r => r === 'claimed')).toHaveLength(1); expect(await createBridgeStore(db).get(key)).toMatchObject({ state: 'applying', receiptKey: 'receipt-a' }); expect(await a.claim({ ...key, relay: 'https://other.example' }, { ...input, receiptKey: 'receipt-other-relay' })).toBe('claimed'); });
it('uses conditional transitions and never reclaims uncertain mutation', async () => { const s = createBridgeStore(db); await s.claim(key, input); expect(await s.markUncertain(key)).toBe(true); expect(await s.claim(key, input)).toMatchObject({ state: 'uncertain' }); expect(await s.saveOutcome(key, 'applied', { nativeId: 'comment' })).toBe(true); expect(await s.saveOutcome(key, 'rejected', { reason: 'late' })).toBe(false); expect(await s.markUncertain(key)).toBe(false); expect((await s.get(key))?.outcome).toEqual({ nativeId: 'comment' }); });
it('repairs one deterministic outbox and retains immutable publication', async () => { const s = createBridgeStore(db); await s.claim(key, input); await s.saveOutcome(key, 'applied', { nativeId: 'comment' }); expect(await s.listRecoverable()).toHaveLength(1); const record = { receiptKey: 'receipt-a', relay: key.relay, eventId: 'signed-id', event: { id: 'signed-id', content: 'receipt' } }; expect(await s.putOutbox(record)).toBe(true); expect(await s.putOutbox({ ...record, eventId: 'replacement', event: { id: 'replacement' } })).toBe(false); expect((await s.listOutbox())[0]?.eventId).toBe('signed-id'); expect(await s.markDelivered('receipt-a')).toBe(true); expect(await s.markDelivered('receipt-a')).toBe(false); expect(await s.listOutbox()).toHaveLength(0); expect(await s.listRecoverable()).toHaveLength(0); });
it('parameterizes hostile values and rejects forged namespace without disclosure', async () => { const s = createBridgeStore(db); const hostile = { ...key, eventId: "x'); DROP TABLE inbox; --" }; await s.claim(hostile, input); expect((await s.get(hostile))?.eventId).toBe(hostile.eventId); expect(() => createBridgeStore({ ...db, namespace: 'public; secret-token' })).toThrow('Unexpected plugin database namespace'); expect(await s.get(key)).toBeNull(); });
it('persists host-owned identity, binding and immutable card mappings', async () => { const s = createBridgeStore(db); await s.putBinding(input.destination); await s.putPairing({ relay: key.relay, companyId: 'co', pubkey: 'pub', actorUserId: 'human', kind: 'human', active: true }); const card = { token: 'c'.repeat(32), companyId: 'co', issueId: 'issue', interactionId: 'i', digest: 'd'.repeat(64) }; expect(await s.putCard(card)).toBe(true); expect(await s.putCard({ ...card, digest: 'changed' })).toBe(false); await s.putPairing({ relay: key.relay, companyId: 'co', pubkey: 'pub', actorUserId: 'human', kind: 'human', active: false }); const cfg = await createBridgeStore(db).loadConfig(key.relay, 'bridge'); expect(cfg.pairings[0]?.active).toBe(false); expect(cfg.cards[0]?.digest).toBe(card.digest); expect(cfg.bindings).toEqual([input.destination]); });
it('redacts database failure details at the store boundary', async () => { const bad = { ...db, execute: async () => { throw Error('password=private; body=restricted'); } }; await expect(createBridgeStore(bad).claim(key, input)).rejects.toThrow(/^Bridge database operation failed\.$/); });
it('rotates recovery fairly across store restarts without reclaiming uncertain work', async () => {
    const s = createBridgeStore(db);
    for (let i = 0; i < 102; i++) {
        const k = { ...key, eventId: `event-${i.toString().padStart(3, '0')}` };
        await s.claim(k, { ...input, receiptKey: `receipt-${i}` });
        await s.markUncertain(k);
    }
    const terminal = { ...key, eventId: 'terminal' };
    await s.claim(terminal, { ...input, receiptKey: 'terminal-receipt' });
    await s.saveOutcome(terminal, 'applied', { nativeId: 'result' });
    const first = await s.listRecoverable(100);
    expect(first).toHaveLength(100);
    const second = await createBridgeStore(db).listRecoverable(100);
    const seen = new Set([...first, ...second].map(r => r.eventId));
    expect(seen.size).toBe(103);
    expect(second.some(r => r.eventId === 'terminal')).toBe(true);
    expect(await s.claim({ ...key, eventId: 'event-101' }, { ...input, receiptKey: 'receipt-101' })).toMatchObject({ state: 'uncertain' });
});
it('persists retry deferral across restart and does not shorten earlier relay advice', async () => {
    const s = createBridgeStore(db);
    await s.putOutbox({ receiptKey: 'receipt', relay: key.relay, eventId: 'out', event: { id: 'out' } });
    expect(await s.markDeferred('receipt', 60000)).toBe(true);
    expect(await createBridgeStore(db).listOutbox()).toHaveLength(0);
    await s.markDeferred('receipt', 0);
    expect(await s.listOutbox()).toHaveLength(0);
    await pg.query(`UPDATE ${BRIDGE_NAMESPACE}.bridge_outbox SET next_attempt_at=now()-interval '1 second'`);
    expect(await s.listOutbox()).toHaveLength(1);
    await s.markDelivered('receipt');
    expect(await s.markDeferred('receipt', 60000)).toBe(false);
});
it('pages delivery with a stable timestamp and receipt key instead of starving later rows', async () => {
    const s = createBridgeStore(db);
    for (const id of ['a', 'b', 'c'])
        await s.putOutbox({ receiptKey: id, relay: key.relay, eventId: id, event: { id } });
    const first = await s.listOutbox(2);
    const last = first.at(-1)!;
    const second = await s.listOutbox(2, { createdAt: String(last.createdAt), receiptKey: last.receiptKey });
    expect(first.map(r => r.receiptKey)).toEqual(['a', 'b']);
    expect(second.map(r => r.receiptKey)).toEqual(['c']);
});
