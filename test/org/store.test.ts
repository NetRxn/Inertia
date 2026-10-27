import { beforeAll, afterAll, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createOrgStore } from '../../src/org/store.js';
import { BRIDGE_NAMESPACE } from '../../src/store/postgres.js';
import type { PluginDatabaseClient } from '@paperclipai/plugin-sdk';
import { createHostDb, type HostDb } from '../support/paperclip-host-db.js';

const rid = () => crypto.randomUUID();

let host: HostDb;
let pg: PGlite;
let db: PluginDatabaseClient;

beforeAll(async () => {
  host = await createHostDb();
  pg = host.pg;
  db = host.db;
}, 60000);

afterAll(async () => {
  await host.close();
});

it('createProfile twice for one company: first true, second false, one founder row', async () => {
  const store = createOrgStore(db);
  const profile = { companyId: 'co1', name: 'Acme Inc', createdBy: 'alice', createdAt: new Date().toISOString() };
  const founder = { companyId: 'co1', userId: 'alice', displayName: 'Alice', role: 'founder' as const, status: 'active' as const, joinedAt: new Date().toISOString() };

  expect(await store.createProfile(profile, founder.displayName)).toBe(true);
  expect(await store.createProfile(profile, founder.displayName)).toBe(false);

  const members = await store.listMembers('co1');
  expect(members).toHaveLength(1);
  expect(members[0]).toMatchObject({ userId: 'alice', role: 'founder' });
});

it('founder exists if and only if createProfile returned true', async () => {
  const store = createOrgStore(db);
  const profile1 = { companyId: 'co1a', name: 'First Inc', createdBy: 'alice', createdAt: new Date().toISOString() };
  const founder1 = { companyId: 'co1a', userId: 'alice', displayName: 'Alice', role: 'founder' as const, status: 'active' as const, joinedAt: new Date().toISOString() };

  const result1 = await store.createProfile(profile1, founder1.displayName);
  expect(result1).toBe(true);
  expect(await store.readProfile('co1a')).not.toBeNull();
  expect(await store.readMember('co1a', 'alice')).toMatchObject({ role: 'founder' });

  const result2 = await store.createProfile(profile1, founder1.displayName);
  expect(result2).toBe(false);
  const members = await store.listMembers('co1a');
  expect(members).toHaveLength(1);
});

it('concurrent createProfile x8 yields exactly one true, one profile, one founder', async () => {
  const store = createOrgStore(db);
  const profile = { companyId: 'co2', name: 'Beta Corp', createdBy: 'bob', createdAt: new Date().toISOString() };
  const founder = { companyId: 'co2', userId: 'bob', displayName: 'Bob', role: 'founder' as const, status: 'active' as const, joinedAt: new Date().toISOString() };

  const results = await Promise.all(Array.from({ length: 8 }, () => store.createProfile(profile, founder.displayName)));
  const trueCount = results.filter(r => r === true).length;
  expect(trueCount).toBe(1);

  const storedProfile = await store.readProfile('co2');
  expect(storedProfile).not.toBeNull();
  expect(storedProfile?.name).toBe('Beta Corp');

  const members = await store.listMembers('co2');
  expect(members).toHaveLength(1);
  expect(members[0]).toMatchObject({ userId: 'bob', role: 'founder' });
});

it('setHidden on an objective key needs an intake row for that company; never lists the stub as a shared source', async () => {
  const store = createOrgStore(db);
  const profile = { companyId: 'co3', name: 'Gamma LLC', createdBy: 'charlie', createdAt: new Date().toISOString() };
  const founder = { companyId: 'co3', userId: 'charlie', displayName: 'Charlie', role: 'founder' as const, status: 'active' as const, joinedAt: new Date().toISOString() };
  await store.createProfile(profile, founder.displayName);

  const key = 'a'.repeat(64);
  const hidden = { by: 'charlie', at: new Date().toISOString(), reason: 'spam' };
  expect(await store.setHidden('co3', `objective:${key}`, hidden, rid())).toBe(false);
  expect(await store.isHidden('co3', `objective:${key}`)).toBe(false);

  await pg.query(`INSERT INTO ${BRIDGE_NAMESPACE}.objective_intake (mapping_key, record) VALUES ($1, $2::jsonb)`, [key, JSON.stringify({ companyId: 'co3', snapshot: { title: 'T', audience: 'members', sourceSystem: 's' } })]);
  expect(await store.setHidden('co4', `objective:${key}`, hidden, rid())).toBe(false);
  expect(await store.setHidden('co3', `objective:${key}`, hidden, rid())).toBe(true);
  expect(await store.isHidden('co3', `objective:${key}`)).toBe(true);
  expect(await store.setHidden('co3', `objective:${key}`, null, rid())).toBe(true);
  expect(await store.isHidden('co3', `objective:${key}`)).toBe(false);
  expect(await store.listSources('co3', { includeHidden: true, limit: 10 })).toEqual([]);
});

it('countModerators returns a number', async () => {
  const store = createOrgStore(db);
  const count = await store.countModerators('co3');
  expect(count).toBe(1);
  expect(typeof count).toBe('number');
});

it('listSources includeHidden:false omits hidden rows', async () => {
  const store = createOrgStore(db);
  const profile = { companyId: 'co4', name: 'Delta Inc', createdBy: 'dave', createdAt: new Date().toISOString() };
  const founder = { companyId: 'co4', userId: 'dave', displayName: 'Dave', role: 'founder' as const, status: 'active' as const, joinedAt: new Date().toISOString() };
  await store.createProfile(profile, founder.displayName);

  const source1 = { companyId: 'co4', sourceKey: 'share:s1', kind: 'link' as const, title: 'Visible Link', url: 'https://example.com', mediaType: null, byteLength: null, sha256: null, sharedBy: 'dave', audience: 'members' as const, hidden: null, pins: 0, createdAt: new Date().toISOString() };
  const source2 = { companyId: 'co4', sourceKey: 'share:s2', kind: 'note' as const, title: 'Hidden Note', url: null, mediaType: null, byteLength: null, sha256: null, sharedBy: 'dave', audience: 'members' as const, hidden: { by: 'dave', at: new Date().toISOString(), reason: 'duplicate' }, pins: 0, createdAt: new Date().toISOString() };

  await store.insertSource(source1, null, rid());
  await store.insertSource(source2, null, rid());

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
  await store.createProfile(profile, founder.displayName);

  const source = { companyId: 'co5', sourceKey: 'share:s3', kind: 'file' as const, title: 'Document', url: null, mediaType: 'application/pdf', byteLength: 1024, sha256: 'abcd', sharedBy: 'eve', audience: 'members' as const, hidden: null, pins: 0, createdAt: new Date().toISOString() };
  await store.insertSource(source, Buffer.from([1, 2, 3]).toString('base64'), rid());

  expect(await store.addPin('co5', 'share:s3', 'eve', rid())).toBe(true);
  expect(await store.addPin('co5', 'share:s3', 'eve', rid())).toBe(false);

  const updated = await store.readSource('co5', 'share:s3');
  expect(updated?.pins).toBe(1);
});

it('listLog returns newest first with increasing seq', async () => {
  const store = createOrgStore(db);
  const profile = { companyId: 'co6', name: 'Foxtrot Inc', createdBy: 'frank', createdAt: new Date().toISOString() };
  const founder = { companyId: 'co6', userId: 'frank', displayName: 'Frank', role: 'founder' as const, status: 'active' as const, joinedAt: new Date().toISOString() };
  await store.createProfile(profile, founder.displayName);

  await store.appendLog({ companyId: 'co6', opKey: 'setup', actor: 'frank', action: 'org.setup', subject: 'co6', reason: '' });
  await store.appendLog({ companyId: 'co6', opKey: rid(), actor: 'frank', action: 'member.add', subject: 'grace', reason: 'invited' });
  await store.appendLog({ companyId: 'co6', opKey: rid(), actor: 'frank', action: 'moderator.set', subject: 'grace', reason: 'promoted' });

  const log = await store.listLog('co6', 10);
  expect(log).toHaveLength(3);
  expect(log.map(entry => typeof entry.seq)).toEqual(['number', 'number', 'number']);
  expect(log[2]!.seq).toBeLessThan(log[1]!.seq);
  expect(log[1]!.seq).toBeLessThan(log[0]!.seq);
  expect(log[0]?.action).toBe('moderator.set');
  expect(log[1]?.action).toBe('member.add');
  expect(log[2]?.action).toBe('org.setup');
});

it('rejects namespace "public" and redacts SQL errors to "Organization data unavailable."', async () => {
  expect(() => createOrgStore({ ...db, namespace: 'public' })).toThrow('Unexpected plugin database namespace.');

  const bad = { ...db, query: async () => { throw Error('secret-password-123'); } };
  await expect(createOrgStore(bad).readProfile('co')).rejects.toThrow(/^Organization data unavailable\.$/);
});

it('file bytes round-trip byte-exact through the host as base64 text (all 256 values)', async () => {
  const store = createOrgStore(db);
  const bytes = new Uint8Array(512).map((_, i) => i % 256);
  const base64 = Buffer.from(bytes).toString('base64');
  const source = { companyId: 'co7', sourceKey: 'share:bytes', kind: 'file' as const, title: 'All bytes', url: null, mediaType: 'application/octet-stream', byteLength: bytes.length, sha256: null, sharedBy: 'u', audience: 'members' as const, hidden: null, pins: 0, createdAt: new Date().toISOString() };
  await store.insertSource(source, base64, rid());

  const content = await store.readContent('co7', 'share:bytes');
  expect(content).toEqual({ base64, mediaType: 'application/octet-stream' });
  expect(Buffer.from(content!.base64, 'base64').equals(Buffer.from(bytes))).toBe(true);
  expect(await store.readContent('co7', 'share:missing')).toBeNull();
});

it('a link has no content to read', async () => {
  const store = createOrgStore(db);
  const source = { companyId: 'co7', sourceKey: 'share:link', kind: 'link' as const, title: 'Link', url: 'https://example.com', mediaType: null, byteLength: null, sha256: null, sharedBy: 'u', audience: 'members' as const, hidden: null, pins: 0, createdAt: new Date().toISOString() };
  await store.insertSource(source, null, rid());
  expect(await store.readContent('co7', 'share:link')).toBeNull();
});
