import { beforeAll, afterAll, expect, it } from 'vitest';
import { createOrgStore } from '../../src/org/store.js';
import { createOrgService } from '../../src/org/service.js';
import { BRIDGE_NAMESPACE } from '../../src/store/postgres.js';
import type { PluginDatabaseClient } from '@paperclipai/plugin-sdk';
import { OrgError } from '../../src/org/contracts.js';
import { createHostDb, migration009, type HostDb } from '../support/paperclip-host-db.js';

const rid = () => crypto.randomUUID();

let host: HostDb;
let db: PluginDatabaseClient;

beforeAll(async () => {
  host = await createHostDb([migration009]);
  db = host.db;
}, 60000);

afterAll(async () => {
  await host.close();
});

it('setup makes caller founder; second setup by another user → conflict', async () => {
  const store = createOrgStore(db);
  const service = createOrgService(store, () => new Date('2025-01-15T10:00:00Z'), () => 'id1');

  const profile1 = await service.setup('co1', 'alice', { name: 'Acme Inc', displayName: 'Alice' });
  expect(profile1.companyId).toBe('co1');
  expect(profile1.name).toBe('Acme Inc');

  const aliceRole = await service.actorRole('co1', 'alice');
  expect(aliceRole).toBe('founder');

  await expect(service.setup('co1', 'bob', { name: 'Acme Inc', displayName: 'Bob' }))
    .rejects.toThrow(OrgError);
  await expect(service.setup('co1', 'bob', { name: 'Acme Inc', displayName: 'Bob' }))
    .rejects.toHaveProperty('kind', 'conflict');
});

it('two concurrent setups → one profile, one conflict', async () => {
  const store = createOrgStore(db);
  const service = createOrgService(store, () => new Date('2025-01-15T10:00:00Z'), () => 'id2');

  const results = await Promise.allSettled([
    service.setup('co2', 'alice', { name: 'Beta Corp', displayName: 'Alice' }),
    service.setup('co2', 'bob', { name: 'Beta Corp', displayName: 'Bob' })
  ]);

  const fulfilled = results.filter(r => r.status === 'fulfilled');
  const rejected = results.filter(r => r.status === 'rejected');

  expect(fulfilled).toHaveLength(1);
  expect(rejected).toHaveLength(1);

  const profile = await store.readProfile('co2');
  expect(profile).not.toBeNull();
});

it('non-member calling members/addMember → forbidden', async () => {
  const store = createOrgStore(db);
  const service = createOrgService(store, () => new Date('2025-01-15T10:00:00Z'), () => 'id3');

  await service.setup('co3', 'alice', { name: 'Gamma Inc', displayName: 'Alice' });

  await expect(service.members('co3', 'bob')).rejects.toThrow(OrgError);
  await expect(service.members('co3', 'bob')).rejects.toHaveProperty('kind', 'forbidden');

  await expect(service.addMember('co3', 'bob', { requestId: rid(), userId: 'charlie', displayName: 'Charlie', reason: 'invited' }))
    .rejects.toThrow(OrgError);
  await expect(service.addMember('co3', 'bob', { requestId: rid(), userId: 'charlie', displayName: 'Charlie', reason: 'invited' }))
    .rejects.toHaveProperty('kind', 'forbidden');
});

it('member cannot addMember (forbidden); moderator can; log has member.add with actor and reason', async () => {
  const store = createOrgStore(db);
  const service = createOrgService(store, () => new Date('2025-01-15T10:00:00Z'), () => 'id4');

  await service.setup('co4', 'alice', { name: 'Delta Inc', displayName: 'Alice' });

  await service.addMember('co4', 'alice', { requestId: rid(), userId: 'bob', displayName: 'Bob', reason: 'invited by founder' });
  const bobRole = await service.actorRole('co4', 'bob');
  expect(bobRole).toBe('member');

  await expect(service.addMember('co4', 'bob', { requestId: rid(), userId: 'charlie', displayName: 'Charlie', reason: 'invited by member' }))
    .rejects.toThrow(OrgError);
  await expect(service.addMember('co4', 'bob', { requestId: rid(), userId: 'charlie', displayName: 'Charlie', reason: 'invited by member' }))
    .rejects.toHaveProperty('kind', 'forbidden');

  await service.setModerator('co4', 'alice', { requestId: rid(), userId: 'bob', moderator: true, reason: 'promoted' });
  const bobRoleAfter = await service.actorRole('co4', 'bob');
  expect(bobRoleAfter).toBe('moderator');

  await service.addMember('co4', 'bob', { requestId: rid(), userId: 'charlie', displayName: 'Charlie', reason: 'invited by moderator' });
  const charlieRole = await service.actorRole('co4', 'charlie');
  expect(charlieRole).toBe('member');

  const log = await store.listLog('co4', 10);
  const memberAddEntry = log.find(e => e.action === 'member.add' && e.subject === 'charlie');
  expect(memberAddEntry).toBeDefined();
  expect(memberAddEntry?.actor).toBe('bob');
  expect(memberAddEntry?.reason).toBe('invited by moderator');
});

it('removeMember sets status removed; removed user\'s actorRole is null and members() → forbidden', async () => {
  const store = createOrgStore(db);
  const service = createOrgService(store, () => new Date('2025-01-15T10:00:00Z'), () => 'id5');

  await service.setup('co5', 'alice', { name: 'Echo Ltd', displayName: 'Alice' });
  await service.addMember('co5', 'alice', { requestId: rid(), userId: 'bob', displayName: 'Bob', reason: 'invited' });

  expect(await service.actorRole('co5', 'bob')).toBe('member');

  await service.removeMember('co5', 'alice', { requestId: rid(), userId: 'bob', reason: 'left company' });

  const bobRoleAfter = await service.actorRole('co5', 'bob');
  expect(bobRoleAfter).toBeNull();

  await expect(service.members('co5', 'bob')).rejects.toThrow(OrgError);
  await expect(service.members('co5', 'bob')).rejects.toHaveProperty('kind', 'forbidden');

  const member = await store.readMember('co5', 'bob');
  expect(member?.status).toBe('removed');
});

it('removing or demoting the last founder/moderator → conflict', async () => {
  const store = createOrgStore(db);
  const service = createOrgService(store, () => new Date('2025-01-15T10:00:00Z'), () => 'id6');

  await service.setup('co6', 'alice', { name: 'Foxtrot Inc', displayName: 'Alice' });

  await expect(service.removeMember('co6', 'alice', { requestId: rid(), userId: 'alice', reason: 'leaving' }))
    .rejects.toThrow(OrgError);
  await expect(service.removeMember('co6', 'alice', { requestId: rid(), userId: 'alice', reason: 'leaving' }))
    .rejects.toHaveProperty('kind', 'conflict');

  await service.addMember('co6', 'alice', { requestId: rid(), userId: 'bob', displayName: 'Bob', reason: 'invited' });
  await service.setModerator('co6', 'alice', { requestId: rid(), userId: 'bob', moderator: true, reason: 'promoted' });

  await expect(service.setModerator('co6', 'alice', { requestId: rid(), userId: 'alice', moderator: false, reason: 'demoting self' }))
    .rejects.toThrow(OrgError);
  await expect(service.setModerator('co6', 'alice', { requestId: rid(), userId: 'alice', moderator: false, reason: 'demoting self' }))
    .rejects.toHaveProperty('kind', 'conflict');

  await service.setModerator('co6', 'alice', { requestId: rid(), userId: 'bob', moderator: false, reason: 'demoted' });

  await expect(service.setModerator('co6', 'alice', { requestId: rid(), userId: 'alice', moderator: false, reason: 'demoting self' }))
    .rejects.toThrow(OrgError);
  await expect(service.setModerator('co6', 'alice', { requestId: rid(), userId: 'alice', moderator: false, reason: 'demoting self' }))
    .rejects.toHaveProperty('kind', 'conflict');
});

it('reason is required (empty → invalid) for remove and moderator changes', async () => {
  const store = createOrgStore(db);
  const service = createOrgService(store, () => new Date('2025-01-15T10:00:00Z'), () => 'id7');

  await service.setup('co7', 'alice', { name: 'Golf LLC', displayName: 'Alice' });
  await service.addMember('co7', 'alice', { requestId: rid(), userId: 'bob', displayName: 'Bob', reason: 'invited' });

  await expect(service.removeMember('co7', 'alice', { requestId: rid(), userId: 'bob', reason: '' }))
    .rejects.toThrow(OrgError);
  await expect(service.removeMember('co7', 'alice', { requestId: rid(), userId: 'bob', reason: '' }))
    .rejects.toHaveProperty('kind', 'invalid');

  await expect(service.removeMember('co7', 'alice', { requestId: rid(), userId: 'bob', reason: '   ' }))
    .rejects.toThrow(OrgError);
  await expect(service.removeMember('co7', 'alice', { requestId: rid(), userId: 'bob', reason: '   ' }))
    .rejects.toHaveProperty('kind', 'invalid');

  await expect(service.setModerator('co7', 'alice', { requestId: rid(), userId: 'bob', moderator: true, reason: '' }))
    .rejects.toThrow(OrgError);
  await expect(service.setModerator('co7', 'alice', { requestId: rid(), userId: 'bob', moderator: true, reason: '' }))
    .rejects.toHaveProperty('kind', 'invalid');

  await expect(service.setModerator('co7', 'alice', { requestId: rid(), userId: 'bob', moderator: true, reason: '  ' }))
    .rejects.toThrow(OrgError);
  await expect(service.setModerator('co7', 'alice', { requestId: rid(), userId: 'bob', moderator: true, reason: '  ' }))
    .rejects.toHaveProperty('kind', 'invalid');
});

it('addMember on an active member → conflict and leaves founder/moderator roles intact', async () => {
  const store = createOrgStore(db);
  const service = createOrgService(store, () => new Date('2025-01-15T10:00:00Z'), () => 'id8');

  await service.setup('co8', 'alice', { name: 'Hotel Inc', displayName: 'Alice' });
  await service.addMember('co8', 'alice', { requestId: rid(), userId: 'bob', displayName: 'Bob', reason: 'invited' });
  await service.setModerator('co8', 'alice', { requestId: rid(), userId: 'bob', moderator: true, reason: 'promoted' });

  await expect(service.addMember('co8', 'bob', { requestId: rid(), userId: 'alice', displayName: 'Alice', reason: 'downgrade' }))
    .rejects.toMatchObject({ kind: 'conflict', message: 'Already a member.' });
  await expect(service.addMember('co8', 'alice', { requestId: rid(), userId: 'bob', displayName: 'Bob', reason: 'again' }))
    .rejects.toMatchObject({ kind: 'conflict' });

  expect(await service.actorRole('co8', 'alice')).toBe('founder');
  expect(await service.actorRole('co8', 'bob')).toBe('moderator');
});

it('re-adding a removed moderator restores them as an active member', async () => {
  const store = createOrgStore(db);
  const service = createOrgService(store, () => new Date('2025-01-15T10:00:00Z'), () => 'id9');

  await service.setup('co9', 'alice', { name: 'India Inc', displayName: 'Alice' });
  await service.addMember('co9', 'alice', { requestId: rid(), userId: 'bob', displayName: 'Bob', reason: 'invited' });
  await service.setModerator('co9', 'alice', { requestId: rid(), userId: 'bob', moderator: true, reason: 'promoted' });
  await service.removeMember('co9', 'alice', { requestId: rid(), userId: 'bob', reason: 'left' });

  await service.addMember('co9', 'alice', { requestId: rid(), userId: 'bob', displayName: 'Bob Again', reason: 'returned' });
  expect(await store.readMember('co9', 'bob')).toMatchObject({ role: 'member', status: 'active', displayName: 'Bob Again' });
});

it('after the founder is removed, demoting the last remaining moderator → conflict', async () => {
  const store = createOrgStore(db);
  const service = createOrgService(store, () => new Date('2025-01-15T10:00:00Z'), () => 'id10');

  await service.setup('co10', 'alice', { name: 'Juliet Inc', displayName: 'Alice' });
  await service.addMember('co10', 'alice', { requestId: rid(), userId: 'bob', displayName: 'Bob', reason: 'invited' });
  await service.setModerator('co10', 'alice', { requestId: rid(), userId: 'bob', moderator: true, reason: 'promoted' });
  await service.removeMember('co10', 'bob', { requestId: rid(), userId: 'alice', reason: 'founder left' });

  await expect(service.setModerator('co10', 'bob', { requestId: rid(), userId: 'bob', moderator: false, reason: 'stepping down' }))
    .rejects.toMatchObject({ kind: 'conflict' });
  expect(await service.actorRole('co10', 'bob')).toBe('moderator');
});
