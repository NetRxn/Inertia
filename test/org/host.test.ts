import { afterAll, beforeAll, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestHarness } from '@paperclipai/plugin-sdk/testing';
import { manifest } from '../../src/manifest.js';
import { BRIDGE_NAMESPACE } from '../../src/store/postgres.js';
import { registerOrgProfile } from '../../src/org/host.js';
import { createHostDb, type HostDb } from '../support/paperclip-host-db.js';

let host: HostDb;
let pg: PGlite;

beforeAll(async () => {
  host = await createHostDb();
  pg = host.pg;
}, 60000);

afterAll(async () => host.close());

function createHarness() {
  const h = createTestHarness({
    manifest,
  });

  Object.assign(h.ctx.db, { namespace: host.db.namespace, query: host.db.query, execute: host.db.execute });

  registerOrgProfile(h.ctx);

  return h;
}

it('agent actor calling org.members returns forbidden', async () => {
  const h = createHarness();
  const result = await h.performAction('org.members', {}, {
    actor: { type: 'agent', userId: null, agentId: 'agent1', runId: 'run1', companyId: 'co' },
    companyId: 'co',
  });
  expect(result).toEqual({ ok: false, error: { kind: 'forbidden', message: 'Access denied.' } });
});

it('org.overview before org.setup returns null (setup form can show)', async () => {
  const h = createHarness();
  const result = await h.performAction('org.overview', {}, {
    actor: { type: 'user', userId: 'user1', agentId: null, runId: null, companyId: 'co-no-profile' },
    companyId: 'co-no-profile',
  });
  expect(result).toEqual({ ok: true, data: null });
});

it('user not in org calling org.overview returns forbidden and response has no data field', async () => {
  const h = createHarness();

  await h.performAction('org.setup', { name: 'secret-dao', displayName: 'Founder' }, {
    actor: { type: 'user', userId: 'founder', agentId: null, runId: null, companyId: 'co' },
    companyId: 'co',
  });

  await h.performAction('org.source.share', { requestId: crypto.randomUUID(), kind: 'link', title: 'Secret Doc', url: 'https://example.com/secret' }, {
    actor: { type: 'user', userId: 'founder', agentId: null, runId: null, companyId: 'co' },
    companyId: 'co',
  });

  const overviewResult = await h.performAction('org.overview', {}, {
    actor: { type: 'user', userId: 'outsider', agentId: null, runId: null, companyId: 'co' },
    companyId: 'co',
  }) as any;
  expect(overviewResult.ok).toBe(false);
  expect(overviewResult.error.kind).toBe('forbidden');
  expect(overviewResult).not.toHaveProperty('data');
  expect(JSON.stringify(overviewResult)).not.toContain('secret-dao');
  expect(JSON.stringify(overviewResult)).not.toContain('Founder');
  expect(JSON.stringify(overviewResult)).not.toContain('Secret Doc');

  const membersResult = await h.performAction('org.members', {}, {
    actor: { type: 'user', userId: 'outsider', agentId: null, runId: null, companyId: 'co' },
    companyId: 'co',
  }) as any;
  expect(membersResult.ok).toBe(false);
  expect(membersResult.error.kind).toBe('forbidden');
  expect(membersResult).not.toHaveProperty('data');
  expect(JSON.stringify(membersResult)).not.toContain('secret-dao');
  expect(JSON.stringify(membersResult)).not.toContain('Founder');

  const sourcesResult = await h.performAction('org.sources', { hidden: false }, {
    actor: { type: 'user', userId: 'outsider', agentId: null, runId: null, companyId: 'co' },
    companyId: 'co',
  }) as any;
  expect(sourcesResult.ok).toBe(false);
  expect(sourcesResult.error.kind).toBe('forbidden');
  expect(sourcesResult).not.toHaveProperty('data');
  expect(JSON.stringify(sourcesResult)).not.toContain('Secret Doc');
});

it('setup then overview returns role founder and memberCount 1', async () => {
  const h = createHarness();
  const setupResult = await h.performAction('org.setup', { name: 'test-dao', displayName: 'Alice' }, {
    actor: { type: 'user', userId: 'founder-alice', agentId: null, runId: null, companyId: 'co-alice' },
    companyId: 'co-alice',
  });
  expect(setupResult).toMatchObject({ ok: true, data: { companyId: 'co-alice', name: 'test-dao' } });

  const overviewResult = await h.performAction('org.overview', {}, {
    actor: { type: 'user', userId: 'founder-alice', agentId: null, runId: null, companyId: 'co-alice' },
    companyId: 'co-alice',
  });
  expect(overviewResult).toMatchObject({
    ok: true,
    data: {
      profile: { companyId: 'co-alice', name: 'test-dao' },
      role: 'founder',
      memberCount: 1,
      feed: expect.any(Array),
      keyDocuments: expect.any(Array),
      initiatives: expect.any(Array),
    },
  });

  const membersResult = await h.performAction('org.members', {}, {
    actor: { type: 'user', userId: 'founder-alice', agentId: null, runId: null, companyId: 'co-alice' },
    companyId: 'co-alice',
  });
  expect(membersResult).toMatchObject({ ok: true, data: expect.any(Array) });
  expect((membersResult as any).data).toHaveLength(1);
  expect((membersResult as any).data[0]).toMatchObject({
    userId: 'founder-alice',
    role: 'founder',
    status: 'active',
  });
});

it('org.task.trail for an issue in another company returns forbidden/not found, no title leaked', async () => {
  const h = createHarness();
  const setupResult = await h.performAction('org.setup', { name: 'test-dao-2', displayName: 'Bob' }, {
    actor: { type: 'user', userId: 'founder2', agentId: null, runId: null, companyId: 'co2' },
    companyId: 'co2',
  }) as any;
  expect(setupResult.ok).toBe(true);

  const issue = await h.ctx.issues.create({
    companyId: 'other-co',
    projectId: 'proj',
    title: 'Secret Task',
  });

  const trailResult = await h.performAction('org.task.trail', { issueId: issue.id }, {
    actor: { type: 'user', userId: 'founder2', agentId: null, runId: null, companyId: 'co2' },
    companyId: 'co2',
  });
  expect(trailResult).toEqual({ ok: false, error: { kind: 'invalid', message: 'Task not found.' } });
  expect(JSON.stringify(trailResult)).not.toContain('Secret');
});

it('unexpected thrown error maps to unavailable with fixed message', async () => {
  const h = createHarness();

  await h.performAction('org.setup', { name: 'test-dao-3', displayName: 'Charlie' }, {
    actor: { type: 'user', userId: 'founder3', agentId: null, runId: null, companyId: 'co3' },
    companyId: 'co3',
  });

  const originalList = h.ctx.issues.list;
  h.ctx.issues.list = async () => {
    throw new Error('Simulated unexpected error');
  };

  const result = await h.performAction('org.overview', {}, {
    actor: { type: 'user', userId: 'founder3', agentId: null, runId: null, companyId: 'co3' },
    companyId: 'co3',
  });
  expect(result).toEqual({ ok: false, error: { kind: 'unavailable', message: 'Operation unavailable.' } });

  h.ctx.issues.list = originalList;
});

it('non-member calling org.task.trail on a real issue in their company returns forbidden, no title', async () => {
  const h = createHarness();

  await h.performAction('org.setup', { name: 'test-dao-trail', displayName: 'Founder' }, {
    actor: { type: 'user', userId: 'founder-trail', agentId: null, runId: null, companyId: 'co-trail' },
    companyId: 'co-trail',
  });

  const issue = await h.ctx.issues.create({
    companyId: 'co-trail',
    projectId: 'proj',
    title: 'Confidential Task',
  });

  const trailResult = await h.performAction('org.task.trail', { issueId: issue.id }, {
    actor: { type: 'user', userId: 'outsider', agentId: null, runId: null, companyId: 'co-trail' },
    companyId: 'co-trail',
  }) as any;
  expect(trailResult.ok).toBe(false);
  expect(trailResult.error.kind).toBe('forbidden');
  expect(trailResult).not.toHaveProperty('data');
  expect(JSON.stringify(trailResult)).not.toContain('Confidential');
});

it('org.member.add validates target userId', async () => {
  const h = createHarness();

  await h.performAction('org.setup', { name: 'test-dao-validation', displayName: 'Founder' }, {
    actor: { type: 'user', userId: 'founder-val', agentId: null, runId: null, companyId: 'co-val' },
    companyId: 'co-val',
  });

  const emptyResult = await h.performAction('org.member.add', { requestId: crypto.randomUUID(), userId: '', displayName: 'Test', reason: 'test' }, {
    actor: { type: 'user', userId: 'founder-val', agentId: null, runId: null, companyId: 'co-val' },
    companyId: 'co-val',
  }) as any;
  expect(emptyResult.ok).toBe(false);
  expect(emptyResult.error.kind).toBe('invalid');

  const tooLongResult = await h.performAction('org.member.add', { requestId: crypto.randomUUID(), userId: 'x'.repeat(129), displayName: 'Test', reason: 'test' }, {
    actor: { type: 'user', userId: 'founder-val', agentId: null, runId: null, companyId: 'co-val' },
    companyId: 'co-val',
  }) as any;
  expect(tooLongResult.ok).toBe(false);
  expect(tooLongResult.error.kind).toBe('invalid');

  const controlCharResult = await h.performAction('org.member.add', { requestId: crypto.randomUUID(), userId: 'user\x00id', displayName: 'Test', reason: 'test' }, {
    actor: { type: 'user', userId: 'founder-val', agentId: null, runId: null, companyId: 'co-val' },
    companyId: 'co-val',
  }) as any;
  expect(controlCharResult.ok).toBe(false);
  expect(controlCharResult.error.kind).toBe('invalid');
});

it('manifest has page slot dao and detailTab task-trail with the listed export names', () => {
  expect(manifest.ui?.slots).toEqual(
    expect.arrayContaining([
      { type: 'page', id: 'dao', displayName: 'DAO', exportName: 'OrgPage' },
      {
        type: 'detailTab',
        id: 'task-trail',
        displayName: 'Why this exists',
        exportName: 'TaskTrailTab',
        entityTypes: ['issue'],
      },
      {
        type: 'detailTab',
        id: 'member-packet',
        displayName: 'Packet',
        exportName: 'MemberPacketTab',
        entityTypes: ['issue'],
      },
    ])
  );
  expect(manifest.capabilities).toContain('ui.page.register');
  expect(manifest.capabilities).toContain('issues.read');
});
