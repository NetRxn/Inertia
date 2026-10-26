import { afterAll, beforeAll, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { createTestHarness } from '@paperclipai/plugin-sdk/testing';
import { readFile } from 'node:fs/promises';
import { manifest } from '../../src/manifest.js';
import { BRIDGE_NAMESPACE } from '../../src/store/postgres.js';
import { registerOrgProfile } from '../../src/org/host.js';

let pg: PGlite;

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`CREATE SCHEMA ${BRIDGE_NAMESPACE}`);
  await pg.exec(await readFile(new URL('../../migrations/007_objective_intake.sql', import.meta.url), 'utf8'));
  await pg.exec(await readFile(new URL('../../migrations/009_org_profile.sql', import.meta.url), 'utf8'));
}, 60000);

afterAll(async () => pg.close());

function createHarness() {
  const h = createTestHarness({
    manifest,
  });

  Object.assign(h.ctx.db, {
    namespace: BRIDGE_NAMESPACE,
    query: async (q: string, p: unknown[]) => (await pg.query(q, p)).rows,
    execute: async (q: string, p: unknown[]) => ({
      rowCount: (await pg.query(q, p)).affectedRows ?? 0,
    }),
  });

  registerOrgProfile(h.ctx);

  return h;
}

it('agent actor calling org.members returns forbidden', async () => {
  const h = createHarness();
  const result = await h.performAction('org.members', {}, {
    actor: { type: 'agent', userId: null, agentId: 'agent1', runId: 'run1', companyId: 'co' },
    companyId: 'co',
  });
  expect(result).toEqual({ ok: false, error: { kind: 'forbidden' } });
});

it('user not in org calling org.overview returns forbidden and response has no data field', async () => {
  const h = createHarness();
  const result = await h.performAction('org.overview', {}, {
    actor: { type: 'user', userId: 'u1', agentId: null, runId: null, companyId: 'co' },
    companyId: 'co',
  }) as any;
  expect(result.ok).toBe(false);
  expect(result.error.kind).toBe('forbidden');
  expect(result).not.toHaveProperty('data');
});

it('setup then overview returns role founder and memberCount 1', async () => {
  const h = createHarness();
  const setupResult = await h.performAction('org.setup', { name: 'test-dao', displayName: 'Alice' }, {
    actor: { type: 'user', userId: 'founder', agentId: null, runId: null, companyId: 'co' },
    companyId: 'co',
  });
  expect(setupResult).toMatchObject({ ok: true, data: { companyId: 'co', name: 'test-dao' } });

  const overviewResult = await h.performAction('org.overview', {}, {
    actor: { type: 'user', userId: 'founder', agentId: null, runId: null, companyId: 'co' },
    companyId: 'co',
  });
  expect(overviewResult).toMatchObject({
    ok: true,
    data: {
      profile: { companyId: 'co', name: 'test-dao' },
      role: 'founder',
      feed: expect.any(Array),
      keyDocuments: expect.any(Array),
      initiatives: expect.any(Array),
    },
  });

  const membersResult = await h.performAction('org.members', {}, {
    actor: { type: 'user', userId: 'founder', agentId: null, runId: null, companyId: 'co' },
    companyId: 'co',
  });
  expect(membersResult).toMatchObject({ ok: true, data: expect.any(Array) });
  expect((membersResult as any).data).toHaveLength(1);
  expect((membersResult as any).data[0]).toMatchObject({
    userId: 'founder',
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
