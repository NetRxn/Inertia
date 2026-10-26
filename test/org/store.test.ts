import { beforeAll, afterAll, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { createOrgStore } from '../../src/org/store.js';
import { BRIDGE_NAMESPACE } from '../../src/store/postgres.js';
import type { PluginDatabaseClient } from '@paperclipai/plugin-sdk';

let pg: PGlite;
let db: PluginDatabaseClient;

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`CREATE SCHEMA ${BRIDGE_NAMESPACE}`);
  await pg.exec(await readFile(new URL('../../migrations/009_org_profile.sql', import.meta.url), 'utf8'));
  db = {
    namespace: BRIDGE_NAMESPACE,
    query: async <T>(q: string, p?: unknown[]) => (await pg.query<T>(q, p)).rows,
    execute: async (q, p) => ({ rowCount: (await pg.query(q, p)).affectedRows ?? 0 })
  };
}, 60000);

afterAll(async () => {
  await pg.close();
});

it('createProfile twice for one company: first true, second false, one founder row', async () => {
  const store = createOrgStore(db);
  const profile = { companyId: 'co1', name: 'Acme Inc', createdBy: 'alice', createdAt: new Date().toISOString() };
  const founder = { companyId: 'co1', userId: 'alice', displayName: 'Alice', role: 'founder' as const, status: 'active' as const, joinedAt: new Date().toISOString() };

  expect(await store.createProfile(profile, founder)).toBe(true);
  expect(await store.createProfile(profile, founder)).toBe(false);

  const members = await store.listMembers('co1');
  expect(members).toHaveLength(1);
  expect(members[0]).toMatchObject({ userId: 'alice', role: 'founder' });
});

it('concurrent createProfile x8 yields exactly one true', async () => {
  const store = createOrgStore(db);
  const profile = { companyId: 'co2', name: 'Beta Corp', createdBy: 'bob', createdAt: new Date().toISOString() };
  const founder = { companyId: 'co2', userId: 'bob', displayName: 'Bob', role: 'founder' as const, status: 'active' as const, joinedAt: new Date().toISOString() };

  const results = await Promise.all(Array.from({ length: 8 }, () => store.createProfile(profile, founder)));
  expect(results.filter(r => r === true)).toHaveLength(1);

  const members = await store.listMembers('co2');
  expect(members).toHaveLength(1);
});

it('setHidden on objective:abc with no row creates it; isHidden true; setHidden null → false', async () => {
  const store = createOrgStore(db);
  const profile = { companyId: 'co3', name: 'Gamma LLC', createdBy: 'charlie', createdAt: new Date().toISOString() };
  const founder = { companyId: 'co3', userId: 'charlie', displayName: 'Charlie', role: 'founder' as const, status: 'active' as const, joinedAt: new Date().toISOString() };
  await store.createProfile(profile, founder);

  const hidden = { by: 'charlie', at: new Date().toISOString(), reason: 'spam' };
  expect(await store.setHidden('co3', 'objective:abc', hidden)).toBe(true);
  expect(await store.isHidden('co3', 'objective:abc')).toBe(true);
  expect(await store.setHidden('co3', 'objective:abc', null)).toBe(true);
  expect(await store.isHidden('co3', 'objective:abc')).toBe(false);
});

it('listSources includeHidden:false omits hidden rows', async () => {
  const store = createOrgStore(db);
  const profile = { companyId: 'co4', name: 'Delta Inc', createdBy: 'dave', createdAt: new Date().toISOString() };
  const founder = { companyId: 'co4', userId: 'dave', displayName: 'Dave', role: 'founder' as const, status: 'active' as const, joinedAt: new Date().toISOString() };
  await store.createProfile(profile, founder);

  const source1 = { companyId: 'co4', sourceKey: 'share:s1', kind: 'link' as const, title: 'Visible Link', url: 'https://example.com', mediaType: null, byteLength: null, sha256: null, sharedBy: 'dave', audience: 'members' as const, hidden: null, pins: 0, createdAt: new Date().toISOString() };
  const source2 = { companyId: 'co4', sourceKey: 'share:s2', kind: 'note' as const, title: 'Hidden Note', url: null, mediaType: null, byteLength: null, sha256: null, sharedBy: 'dave', audience: 'members' as const, hidden: { by: 'dave', at: new Date().toISOString(), reason: 'duplicate' }, pins: 0, createdAt: new Date().toISOString() };

  await store.insertSource(source1, null);
  await store.insertSource(source2, null);

  const visible = await store.listSources('co4', { includeHidden: false, limit: 10 });
  const all = await store.listSources('co4', { includeHidden: true, limit: 10 });

  expect(visible).toHaveLength(1);
  expect(visible[0]?.sourceKey).toBe('share:s1');
  expect(all).toHaveLength(2);
});

it('addPin same user twice → second false, pins === 1', async () => {
  const store = createOrgStore(db);
  const profile = { companyId: 'co5', name: 'Echo Ltd', createdBy: 'eve', createdAt: new Date().toISOString() };
  const founder = { companyId: 'co5', userId: 'eve', displayName: 'Eve', role: 'founder' as const, status: 'active' as const, joinedAt: new Date().toISOString() };
  await store.createProfile(profile, founder);

  const source = { companyId: 'co5', sourceKey: 'share:s3', kind: 'file' as const, title: 'Document', url: null, mediaType: 'application/pdf', byteLength: 1024, sha256: 'abcd', sharedBy: 'eve', audience: 'members' as const, hidden: null, pins: 0, createdAt: new Date().toISOString() };
  await store.insertSource(source, new Uint8Array([1, 2, 3]));

  expect(await store.addPin('co5', 'share:s3', 'eve')).toBe(true);
  expect(await store.addPin('co5', 'share:s3', 'eve')).toBe(false);

  const updated = await store.readSource('co5', 'share:s3');
  expect(updated?.pins).toBe(1);
});

it('listLog returns newest first with increasing seq', async () => {
  const store = createOrgStore(db);
  const profile = { companyId: 'co6', name: 'Foxtrot Inc', createdBy: 'frank', createdAt: new Date().toISOString() };
  const founder = { companyId: 'co6', userId: 'frank', displayName: 'Frank', role: 'founder' as const, status: 'active' as const, joinedAt: new Date().toISOString() };
  await store.createProfile(profile, founder);

  const entry1 = await store.appendLog({ companyId: 'co6', actor: 'frank', action: 'org.setup', subject: 'co6', reason: '' });
  const entry2 = await store.appendLog({ companyId: 'co6', actor: 'frank', action: 'member.add', subject: 'grace', reason: 'invited' });
  const entry3 = await store.appendLog({ companyId: 'co6', actor: 'frank', action: 'moderator.set', subject: 'grace', reason: 'promoted' });

  expect(entry1.seq).toBeLessThan(entry2.seq);
  expect(entry2.seq).toBeLessThan(entry3.seq);

  const log = await store.listLog('co6', 10);
  expect(log).toHaveLength(3);
  expect(log[0]?.action).toBe('moderator.set');
  expect(log[1]?.action).toBe('member.add');
  expect(log[2]?.action).toBe('org.setup');
});

it('rejects namespace "public" and redacts SQL errors to "Organization data unavailable."', async () => {
  expect(() => createOrgStore({ ...db, namespace: 'public' })).toThrow('Unexpected plugin database namespace.');

  const bad = { ...db, query: async () => { throw Error('secret-password-123'); } };
  await expect(createOrgStore(bad).readProfile('co')).rejects.toThrow(/^Organization data unavailable\.$/);
});
