import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createOrgStore } from '../../src/org/store.js';
import { createOrgService, type OrgService } from '../../src/org/service.js';
import { BRIDGE_NAMESPACE } from '../../src/store/postgres.js';
import { createHostDb, type HostDb } from '../support/paperclip-host-db.js';

const rid = () => crypto.randomUUID();
const founderStep = /INSERT INTO \S+org_members[\s\S]*FROM \S+org_profile/;
const auditStep = /INSERT INTO \S+org_log/;

let host: HostDb;
let service: OrgService;

beforeEach(async () => {
  host = await createHostDb();
  service = createOrgService(createOrgStore(host.db), () => new Date('2026-10-26T12:00:00Z'), () => rid());
}, 60000);

afterEach(async () => {
  await host.close();
});

async function logRows(companyId: string): Promise<Array<{ op_key: string; action: string; actor: string }>> {
  return (await host.pg.query<{ op_key: string; action: string; actor: string }>(
    `SELECT op_key, action, actor FROM ${BRIDGE_NAMESPACE}.org_log WHERE company_id=$1 ORDER BY seq`,
    [companyId]
  )).rows;
}

async function memberRows(companyId: string) {
  return (await host.pg.query<{ user_id: string; role: string; status: string }>(
    `SELECT user_id, role, status FROM ${BRIDGE_NAMESPACE}.org_members WHERE company_id=$1 ORDER BY user_id`,
    [companyId]
  )).rows;
}

describe('setup: claim then complete', () => {
  it('concurrent setup x8 by different users yields one profile, one founder and one setup audit', async () => {
    const users = Array.from({ length: 8 }, (_, i) => `user-${i}`);
    const results = await Promise.allSettled(users.map(u => service.setup('co', u, { name: 'DAO', displayName: u })));

    const won = results.flatMap((r, i) => (r.status === 'fulfilled' ? [users[i]!] : []));
    expect(won).toHaveLength(1);
    for (const r of results) {
      if (r.status === 'rejected') expect(r.reason).toMatchObject({ kind: 'conflict' });
    }
    const profiles = await host.pg.query(`SELECT created_by FROM ${BRIDGE_NAMESPACE}.org_profile WHERE company_id='co'`);
    expect(profiles.rows).toEqual([{ created_by: won[0] }]);
    expect(await memberRows('co')).toEqual([{ user_id: won[0], role: 'founder', status: 'active' }]);
    expect((await logRows('co')).map(r => r.action)).toEqual(['org.setup']);
  });

  it('concurrent setup x8 by the same user leaves one profile, one founder and one setup audit', async () => {
    await Promise.allSettled(Array.from({ length: 8 }, () => service.setup('co', 'alice', { name: 'DAO', displayName: 'Alice' })));
    expect(await memberRows('co')).toEqual([{ user_id: 'alice', role: 'founder', status: 'active' }]);
    expect(await logRows('co')).toHaveLength(1);
  });

  it('a failed founder step is unavailable; the creator\'s retry completes it, anyone else conflicts', async () => {
    host.failWhen(founderStep);
    await expect(service.setup('co', 'alice', { name: 'DAO', displayName: 'Alice' })).rejects.toMatchObject({ kind: 'unavailable' });
    expect(await memberRows('co')).toEqual([]);

    await expect(service.setup('co', 'bob', { name: 'Other', displayName: 'Bob' })).rejects.toMatchObject({ kind: 'conflict' });

    const profile = await service.setup('co', 'alice', { name: 'DAO', displayName: 'Alice' });
    expect(profile).toMatchObject({ companyId: 'co', name: 'DAO', createdBy: 'alice' });
    expect(await memberRows('co')).toEqual([{ user_id: 'alice', role: 'founder', status: 'active' }]);
    expect(await service.actorRole('co', 'alice')).toBe('founder');
    expect((await logRows('co')).map(r => r.action)).toEqual(['org.setup']);

    await expect(service.setup('co', 'alice', { name: 'DAO', displayName: 'Alice' })).rejects.toMatchObject({ kind: 'conflict' });
  });

  it('a failed setup audit is completed by the creator\'s retry', async () => {
    host.failWhen(auditStep);
    await expect(service.setup('co', 'alice', { name: 'DAO', displayName: 'Alice' })).rejects.toMatchObject({ kind: 'unavailable' });
    expect(await logRows('co')).toEqual([]);
    await service.setup('co', 'alice', { name: 'DAO', displayName: 'Alice' });
    expect((await logRows('co')).map(r => r.action)).toEqual(['org.setup']);
  });

  it('a creator left without a founder row is healed to founder by overview', async () => {
    host.failWhen(founderStep);
    await expect(service.setup('co', 'alice', { name: 'DAO', displayName: 'Alice' })).rejects.toMatchObject({ kind: 'unavailable' });

    const overview = await service.overview('co', 'alice');
    expect(overview?.role).toBe('founder');
    expect(await memberRows('co')).toEqual([{ user_id: 'alice', role: 'founder', status: 'active' }]);
    expect((await service.members('co', 'alice'))[0]).toMatchObject({ displayName: 'Alice', role: 'founder' });
  });

  it('a removed founder is not healed back', async () => {
    await service.setup('co', 'alice', { name: 'DAO', displayName: 'Alice' });
    await service.addMember('co', 'alice', { requestId: rid(), userId: 'bob', displayName: 'Bob', reason: 'r' });
    await service.setModerator('co', 'alice', { requestId: rid(), userId: 'bob', moderator: true, reason: 'r' });
    await service.removeMember('co', 'bob', { requestId: rid(), userId: 'alice', reason: 'r' });
    expect(await service.actorRole('co', 'alice')).toBeNull();
  });
});

describe('audited mutations are requestId-keyed and retry-safe', () => {
  const companyId = 'co';
  let shared: string;
  let hiddenKey: string;

  beforeEach(async () => {
    await service.setup(companyId, 'alice', { name: 'DAO', displayName: 'Alice' });
    await service.addMember(companyId, 'alice', { requestId: rid(), userId: 'bob', displayName: 'Bob', reason: 'r' });
    await service.addMember(companyId, 'alice', { requestId: rid(), userId: 'carol', displayName: 'Carol', reason: 'r' });
    shared = (await service.share(companyId, 'bob', { requestId: rid(), kind: 'link', title: 'Doc', url: 'https://example.com' })).sourceKey;
    hiddenKey = (await service.share(companyId, 'bob', { requestId: rid(), kind: 'link', title: 'Spam', url: 'https://spam.example' })).sourceKey;
    await service.hide(companyId, 'alice', { requestId: rid(), sourceKey: hiddenKey, reason: 'spam' });
  });

  type Case = { name: string; run: (requestId: string) => Promise<unknown>; state: () => Promise<unknown> };
  const sourceState = async () => (await host.pg.query(
    `SELECT source_key, hidden IS NOT NULL as hidden FROM ${BRIDGE_NAMESPACE}.org_sources WHERE company_id='co' ORDER BY source_key`
  )).rows;
  const pinState = async () => (await host.pg.query(`SELECT source_key, user_id FROM ${BRIDGE_NAMESPACE}.org_source_pins ORDER BY user_id`)).rows;
  const cases: Case[] = [
    { name: 'member.add', run: r => service.addMember(companyId, 'alice', { requestId: r, userId: 'dave', displayName: 'Dave', reason: 'joins' }), state: () => memberRows(companyId) },
    { name: 'member.remove', run: r => service.removeMember(companyId, 'alice', { requestId: r, userId: 'carol', reason: 'leaves' }), state: () => memberRows(companyId) },
    { name: 'moderator.set', run: r => service.setModerator(companyId, 'alice', { requestId: r, userId: 'bob', moderator: true, reason: 'trusted' }), state: () => memberRows(companyId) },
    { name: 'source.share', run: r => service.share(companyId, 'carol', { requestId: r, kind: 'note', title: 'Note', text: 'hi' }), state: sourceState },
    { name: 'source.hide', run: r => service.hide(companyId, 'alice', { requestId: r, sourceKey: shared, reason: 'spam' }), state: sourceState },
    { name: 'source.restore', run: r => service.restore(companyId, 'alice', { requestId: r, sourceKey: hiddenKey, reason: 'fine' }), state: sourceState },
    { name: 'source.pin', run: r => service.pin(companyId, 'carol', { requestId: r, sourceKey: shared }), state: pinState },
  ];

  for (const c of cases) {
    it(`${c.name}: one audit row; a replay changes nothing and logs nothing more`, async () => {
      const before = (await logRows(companyId)).length;
      const requestId = rid();
      await c.run(requestId);
      const after = await logRows(companyId);
      expect(after).toHaveLength(before + 1);
      expect(after.at(-1)).toMatchObject({ op_key: requestId, action: c.name });

      const state = await c.state();
      await c.run(requestId);
      expect(await logRows(companyId)).toHaveLength(before + 1);
      expect(await c.state()).toEqual(state);
    });

    it(`${c.name}: a failed audit is unavailable, applies once, and the same requestId completes it`, async () => {
      const before = (await logRows(companyId)).length;
      const requestId = rid();
      host.failWhen(auditStep);
      await expect(c.run(requestId)).rejects.toMatchObject({ kind: 'unavailable' });
      expect(await logRows(companyId)).toHaveLength(before);
      const applied = await c.state();

      await c.run(requestId);
      expect(await c.state()).toEqual(applied);
      const after = await logRows(companyId);
      expect(after).toHaveLength(before + 1);
      expect(after.filter(r => r.op_key === requestId)).toHaveLength(1);
    });
  }

  it('a replayed member.add does not resurrect a member removed since', async () => {
    const add = rid();
    await service.addMember(companyId, 'alice', { requestId: add, userId: 'dave', displayName: 'Dave', reason: 'joins' });
    await service.removeMember(companyId, 'alice', { requestId: rid(), userId: 'dave', reason: 'left' });
    await service.addMember(companyId, 'alice', { requestId: add, userId: 'dave', displayName: 'Dave', reason: 'joins' });
    expect((await memberRows(companyId)).find(m => m.user_id === 'dave')).toMatchObject({ status: 'removed' });
  });

  it('member.add retried after a failed audit does not report "Already a member."', async () => {
    const requestId = rid();
    host.failWhen(auditStep);
    await expect(service.addMember(companyId, 'alice', { requestId, userId: 'dave', displayName: 'Dave', reason: 'joins' })).rejects.toMatchObject({ kind: 'unavailable' });
    await expect(service.addMember(companyId, 'alice', { requestId, userId: 'dave', displayName: 'Dave', reason: 'joins' })).resolves.toBeUndefined();
    await expect(service.addMember(companyId, 'alice', { requestId: rid(), userId: 'dave', displayName: 'Dave', reason: 'joins' })).rejects.toMatchObject({ kind: 'conflict', message: 'Already a member.' });
  });

  it('a share retry yields one source keyed by the requestId', async () => {
    const requestId = rid();
    host.failWhen(auditStep);
    await expect(service.share(companyId, 'carol', { requestId, kind: 'link', title: 'Once', url: 'https://once.example' })).rejects.toMatchObject({ kind: 'unavailable' });
    const first = await service.share(companyId, 'carol', { requestId, kind: 'link', title: 'Once', url: 'https://once.example' });
    const again = await service.share(companyId, 'carol', { requestId, kind: 'link', title: 'Once', url: 'https://once.example' });
    expect(first.sourceKey).toBe(`share:${requestId}`);
    expect(again).toEqual(first);
    const rows = await host.pg.query(`SELECT source_key FROM ${BRIDGE_NAMESPACE}.org_sources WHERE title='Once'`);
    expect(rows.rows).toEqual([{ source_key: `share:${requestId}` }]);
  });

  it('business rules run only when applying: a forbidden caller is refused, an audited replay is not re-checked', async () => {
    const requestId = rid();
    await expect(service.addMember(companyId, 'bob', { requestId, userId: 'eve', displayName: 'Eve', reason: 'r' })).rejects.toMatchObject({ kind: 'forbidden' });
    expect((await memberRows(companyId)).map(m => m.user_id)).not.toContain('eve');

    const done = rid();
    await service.removeMember(companyId, 'alice', { requestId: done, userId: 'carol', reason: 'leaves' });
    await expect(service.removeMember(companyId, 'alice', { requestId: done, userId: 'carol', reason: 'leaves' })).resolves.toBeUndefined();
  });

  it('every mutation requires a UUID v4 requestId', async () => {
    for (const requestId of [undefined, '', 'not-a-uuid', '00000000-0000-1000-8000-000000000000', 'A0000000-0000-4000-8000-000000000000']) {
      const input = { requestId, userId: 'dave', displayName: 'Dave', reason: 'r', sourceKey: shared, moderator: true, kind: 'link', title: 't', url: 'https://x.example' } as never;
      for (const call of ['addMember', 'removeMember', 'setModerator', 'share', 'hide', 'restore', 'pin'] as const) {
        await expect((service[call] as (c: string, u: string, i: never) => Promise<unknown>)(companyId, 'alice', input)).rejects.toMatchObject({ kind: 'invalid' });
      }
    }
  });
});
