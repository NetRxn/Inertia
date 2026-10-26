import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { createTestHarness } from '@paperclipai/plugin-sdk/testing';
import type { PluginIssueRunSummary, ToolRunContext } from '@paperclipai/plugin-sdk';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { manifest } from '../../src/manifest.js';
import { BRIDGE_NAMESPACE } from '../../src/store/postgres.js';
import { registerObjectiveIntake, objectiveIntakeJobDeclaration, objectiveSourceContextToolDeclaration, objectiveIntakeCapabilities } from '../../src/intake/host.js';
import { objectiveHash, objectiveKey } from '../../src/intake/service.js';
import { createIntakeStore } from '../../src/intake/store.js';
import { createOrgStore } from '../../src/org/store.js';
import { fixture } from './support.js';
let pg: PGlite;
const directories: string[] = [];
beforeAll(async () => { pg = new PGlite(); await pg.exec(`CREATE SCHEMA ${BRIDGE_NAMESPACE}`); await pg.exec(await readFile(new URL('../../migrations/007_objective_intake.sql', import.meta.url), 'utf8')); await pg.exec(await readFile(new URL('../../migrations/009_org_profile.sql', import.meta.url), 'utf8')); }, 60000);
afterAll(async () => pg.close());
afterEach(async () => { await Promise.all(directories.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
let serial = 0;
async function setup(enabled = true) {
  const directory = await mkdtemp(join(tmpdir(), 'objective-host-')); directories.push(directory);
  const path = join(directory, 'source.json'), f = fixture();
  f.revise({ sourceId: 'bounty-' + ++serial, expectedPreviousHash: null });
  await writeFile(path, JSON.stringify(f.source), { mode: 0o600 });
  const settings = { enabled, sourceMode: 'owner-file', organizationId: 'dao', projectId: 'project', intakeAgentId: 'ceo', sources: [{ sourceSystem: f.source.sourceSystem, sourceId: f.source.sourceId, path, allowedAgentIds: ['ceo', 'researcher'], allowedAudiences: ['members'] }] };
  const h = createTestHarness({ manifest: { ...manifest, capabilities: [...new Set([...manifest.capabilities, ...objectiveIntakeCapabilities])], jobs: [objectiveIntakeJobDeclaration], tools: [objectiveSourceContextToolDeclaration] }, config: { objectiveIntake: settings } });
  h.ctx.companies.list = async () => [{ id: 'co' }] as any;
  Object.assign(h.ctx.db, { namespace: BRIDGE_NAMESPACE, query: async (q: string, p: unknown[]) => (await pg.query(q, p)).rows, execute: async (q: string, p: unknown[]) => ({ rowCount: (await pg.query(q, p)).affectedRows ?? 0 }) });
  const active: Record<string, PluginIssueRunSummary[]> = {};
  const agents: Record<string, any> = { ceo: { id: 'ceo', name: 'CEO', role: 'ceo', title: null, status: 'running' }, researcher: { id: 'researcher', name: 'Researcher', role: 'researcher', title: null, status: 'running' } };
  // SDK harness has no active-run seed API; keep its real issue/subtree/checkout behavior,
  // supplying only host run/assignee readback fixtures.
  const subtree = h.ctx.issues.getSubtree.bind(h.ctx.issues), events: string[] = [];
  h.ctx.issues.getSubtree = async (...args) => { events.push('runs'); const tree = await subtree(...args); return { ...tree, activeRuns: Object.fromEntries(tree.issueIds.map(id => [id, active[id] ?? []])), assignees: agents }; };
  const checkout = h.ctx.issues.assertCheckoutOwner.bind(h.ctx.issues);
  h.ctx.issues.assertCheckoutOwner = async input => { events.push('checkout'); return checkout(input); };
  let secrets = 0, network = 0;
  h.ctx.secrets.resolve = async () => { secrets++; throw Error('No credential use'); };
  h.ctx.http.fetch = async () => { network++; throw Error('No live connector'); };
  let status = registerObjectiveIntake(h.ctx);
  const job = () => h.runJob(objectiveIntakeJobDeclaration.jobKey, { trigger: 'manual' });
  const rows = () => h.ctx.issues.list({ companyId: 'co', includePluginOperations: true });
  async function activate(id: string, agentId = 'ceo', runId = 'run') {
    await h.ctx.issues.update(id, { status: 'in_progress', assigneeAgentId: agentId }, 'co');
    active[id] = [{ id: runId, issueId: id, agentId, status: 'running', invocationSource: 'on_demand', triggerDetail: null, startedAt: '2026-10-25T00:00:00.000Z', finishedAt: null, error: null, createdAt: '2026-10-25T00:00:00.000Z' }];
    return { companyId: 'co', projectId: 'project', agentId, runId };
  }
  async function call(run: ToolRunContext, params: unknown = {}) { return h.executeTool<any>('objective_source_context', params, run); }
  return { h, f, path, settings, active, agents, events, status: () => status(), job, rows, activate, call, io: () => ({ secrets, network }), restart: () => { status = registerObjectiveIntake(h.ctx); }, save: () => writeFile(path, JSON.stringify(f.source)) };
}
it('registers default-disabled manual intake without credentials, network or durable/native mutations', async () => {
  const f = await setup(false); await f.job();
  expect(f.status()).toEqual({ state: 'disabled', results: [] }); expect(await f.rows()).toHaveLength(0); expect(f.io()).toEqual({ secrets: 0, network: 0 });
  await expect(f.call({ companyId: 'co', projectId: 'project', agentId: 'ceo', runId: 'forged' })).rejects.toThrow();
});
it('composes owner source and durable SQL into one reference-only native task across restart and corrections', async () => {
  const f = await setup(); await f.job();
  expect(f.status()).toMatchObject({ state: 'complete', results: [{ status: 'applied' }] });
  const issue = (await f.rows())[0]!;
  expect(issue).toMatchObject({ companyId: 'co', projectId: 'project', assigneeAgentId: 'ceo', status: 'backlog' });
  expect(JSON.stringify(issue)).not.toContain(f.f.source.text); expect(JSON.stringify(issue)).not.toContain(f.f.source.authorRef);
  f.restart(); await f.job(); expect(f.status()).toMatchObject({ results: [{ status: 'replayed', nativeIssueId: issue.id }] });
  await f.h.ctx.issues.update(issue.id, { status: 'in_progress', priority: 'high', assigneeAgentId: 'researcher' }, 'co');
  f.f.revise({ revision: 'earlier-opaque', text: 'Corrected objective problem' }); await f.save(); await f.job();
  expect(await f.rows()).toHaveLength(1); expect((await f.rows())[0]).toMatchObject({ id: issue.id, status: 'in_progress', priority: 'high', assigneeAgentId: 'researcher' });
  const history = await pg.query<{ history: unknown[] }>(`SELECT history FROM ${BRIDGE_NAMESPACE}.objective_intake WHERE mapping_key=$1`, [objectiveKey('dao', f.f.ref)]);
  expect(history.rows[0]!.history).toHaveLength(2); expect(f.io()).toEqual({ secrets: 0, network: 0 });
});
it('returns exact current source only after current native task authentication and preserves native progress', async () => {
  const f = await setup(); await f.job(); const issue = (await f.rows())[0]!, run = await f.activate(issue.id);
  const result = await f.call(run);
  expect(result.data.source).toEqual(f.f.source); expect(result.data.nativeIssueId).toBe(issue.id); expect(result.data.taskIssueId).toBe(issue.id);
  expect(result.data.progress).toMatchObject({ status: 'visible', progress: { status: 'in_progress' } });
  expect(result.content).toMatch(/untrusted|source data/i); expect(f.events.indexOf('runs')).toBeLessThan(f.events.indexOf('checkout'));
  expect(JSON.stringify(await f.rows())).not.toContain(f.f.source.text);
});
it('allows explicitly admitted delegated native descendants but not unrelated tasks', async () => {
  const f = await setup(); await f.job(); const root = (await f.rows())[0]!;
  const child = await f.h.ctx.issues.create({ companyId: 'co', projectId: 'project', parentId: root.id, title: 'Native delegated research', assigneeAgentId: 'researcher' });
  const run = await f.activate(child.id, 'researcher', 'child-run');
  expect((await f.call(run)).data).toMatchObject({ nativeIssueId: root.id, taskIssueId: child.id });
  const unrelated = await f.h.ctx.issues.create({ companyId: 'co', projectId: 'project', title: 'Unrelated', assigneeAgentId: 'researcher' });
  await expect(f.call(await f.activate(unrelated.id, 'researcher', 'outside-run'))).rejects.toThrow();
});
it.each(['wrong-company', 'wrong-project', 'wrong-agent', 'forged-run', 'queued', 'finished', 'reassigned', 'paused', 'done', 'configuration-revoked'])('denies %s before checkout adoption or protected source disclosure', async change => {
  const f = await setup(); await f.job(); const issue = (await f.rows())[0]!; let run = await f.activate(issue.id);
  if (change === 'wrong-company') run.companyId = 'foreign';
  if (change === 'wrong-project') run.projectId = 'foreign';
  if (change === 'wrong-agent') run.agentId = 'foreign';
  if (change === 'forged-run') run.runId = 'forged';
  if (change === 'queued') f.active[issue.id]![0]!.status = 'queued';
  if (change === 'finished') f.active[issue.id]![0]!.finishedAt = '2026-10-25T01:00:00.000Z';
  if (change === 'paused') f.agents.ceo.status = 'paused';
  if (change === 'reassigned') await f.h.ctx.issues.update(issue.id, { assigneeAgentId: 'researcher' }, 'co');
  if (change === 'done') await f.h.ctx.issues.update(issue.id, { status: 'done' }, 'co');
  if (change === 'configuration-revoked') f.h.setConfig({ objectiveIntake: { enabled: false } });
  await expect(f.call(run)).rejects.toThrow(); expect(f.events).not.toContain('checkout');
});
it('rejects model-supplied file, source, identity, audience or authority parameters', async () => {
  const f = await setup(); await f.job(); const run = await f.activate((await f.rows())[0]!.id);
  for (const key of ['path', 'sourceId', 'sourceSystem', 'companyId', 'projectId', 'agentId', 'runId', 'audience', 'authority', 'issueId'])
    await expect(f.call(run, { [key]: 'spoofed' })).rejects.toThrow();
  expect(f.events).not.toContain('checkout');
});
it('withholds stale, audience-narrowed and withdrawn sources; withdrawal retains mapping and cancels one task', async () => {
  const f = await setup(); await f.job(); const issue = (await f.rows())[0]!, run = await f.activate(issue.id);
  f.f.revise({ revision: 'new', text: 'New private text' }); await f.save(); await expect(f.call(run)).rejects.toThrow();
  await f.job(); expect((await f.call(run)).data.source.text).toBe('New private text');
  f.f.revise({ revision: 'narrowed', audience: 'restricted' }); await f.save(); await expect(f.call(run)).rejects.toThrow();
  f.f.revise({ revision: 'withdrawn', audience: 'members', withdrawn: true, expectedPreviousHash: (await createIntakeStore(f.h.ctx.db).read(objectiveKey('dao', f.f.ref)))!.snapshot.sourceHash }); await f.save(); await f.job();
  expect(await f.rows()).toHaveLength(1); expect((await f.rows())[0]!.status).toBe('cancelled');
  await expect(f.call(run)).rejects.toThrow(); expect((await createIntakeStore(f.h.ctx.db).read(objectiveKey('dao', f.f.ref)))!.snapshot.withdrawn).toBe(true);
});
it('withholds source when root native marker or exact origin conflicts', async () => {
  const f = await setup(); await f.job(); const issue = (await f.rows())[0]!, run = await f.activate(issue.id);
  await f.h.ctx.issues.update(issue.id, { description: 'Objective source revision: ' + '0'.repeat(64) }, 'co');
  await expect(f.call(run)).rejects.toThrow(); expect(f.events).not.toContain('checkout');
});
it('revalidates native assignment after the final checkout rather than releasing a now-revoked source', async () => {
  const f = await setup(); await f.job(); const issue = (await f.rows())[0]!, run = await f.activate(issue.id);
  const checkout = f.h.ctx.issues.assertCheckoutOwner.bind(f.h.ctx.issues); let count = 0;
  f.h.ctx.issues.assertCheckoutOwner = async input => { const receipt = await checkout(input); if (++count === 2) await f.h.ctx.issues.update(issue.id, { assigneeAgentId: 'researcher' }, 'co'); return receipt; };
  await expect(f.call(run)).rejects.toThrow(/^Objective source unavailable or task access denied\.$/);
});
it('rechecks source revision after native authentication and never returns a revoked saved snapshot', async () => {
  const f = await setup(); await f.job(); const issue = (await f.rows())[0]!, run = await f.activate(issue.id);
  const checkout = f.h.ctx.issues.assertCheckoutOwner.bind(f.h.ctx.issues); let count = 0;
  f.h.ctx.issues.assertCheckoutOwner = async input => { const receipt = await checkout(input); if (++count === 2) { f.f.revise({ revision: 'revoked', withdrawn: true }); await f.save(); } return receipt; };
  await expect(f.call(run)).rejects.toThrow();
});
it('does not ingest on a schedule trigger or admit forged file authority through manual intake', async () => {
  const f = await setup(); await f.h.runJob(objectiveIntakeJobDeclaration.jobKey, { trigger: 'schedule' }); expect(await f.rows()).toHaveLength(0);
  f.f.source.organizationId = 'foreign'; f.f.source.sourceHash = objectiveHash(f.f.source); await f.save(); await f.job();
  expect(f.status()).toMatchObject({ state: 'attention', results: [{ status: 'blocked' }] }); expect(await f.rows()).toHaveLength(0);
});
it('resolves the active objective when a different configured objective has already completed', async () => {
  const f = await setup(); await f.job(); const first = (await f.rows())[0]!;
  const secondSource = { ...f.f.source, sourceId: f.f.source.sourceId + '-second', sourceHash: '', expectedPreviousHash: null }; secondSource.sourceHash = objectiveHash(secondSource);
  const secondPath = f.path.replace('source.json', 'second.json'); await writeFile(secondPath, JSON.stringify(secondSource), { mode: 0o600 });
  f.settings.sources.push({ ...f.settings.sources[0]!, sourceId: secondSource.sourceId, path: secondPath }); f.h.setConfig({ objectiveIntake: f.settings });
  await f.job(); const second = (await f.rows()).find(row => row.id !== first.id)!;
  await f.h.ctx.issues.update(first.id, { status: 'done' }, 'co');
  expect((await f.call(await f.activate(second.id))).data.source.sourceId).toBe(secondSource.sourceId);
});
it('rejects duplicate native origins without creating replacement work', async () => {
  const f = await setup(); await f.job(); const issue = (await f.rows())[0]!, run = await f.activate(issue.id);
  await f.h.ctx.issues.create({ companyId: 'co', projectId: 'project', title: 'Conflicting native origin', originKind: 'plugin:netrxn.inertia:objective', originId: issue.originId!, description: issue.description!, assigneeAgentId: 'ceo' });
  await expect(f.call(run)).rejects.toThrow();
  f.f.revise({ revision: 'changed' }); await f.save(); await f.job(); expect(await f.rows()).toHaveLength(2);
  expect(f.status()).toMatchObject({ state: 'attention' });
});
it('rejects a root moved into a foreign native project before checkout or source disclosure', async () => {
  const f = await setup(); await f.job(); const issue = (await f.rows())[0]!, run = await f.activate(issue.id);
  f.h.seed({ issues: [{ ...(await f.rows())[0]!, projectId: 'foreign-project' }] });
  await expect(f.call(run)).rejects.toThrow(); expect(f.events).not.toContain('checkout');
  f.f.revise({ revision: 'corrected' }); await f.save(); await f.job();
  expect(f.status().state).toBe('attention'); expect(await f.rows()).toHaveLength(1);
});
it('objective_source_context fails closed when the hidden check throws', async () => {
  const f = await setup(); await f.job(); const issue = (await f.rows())[0]!, run = await f.activate(issue.id);
  expect((await f.call(run)).data.source).toEqual(f.f.source);
  const query = f.h.ctx.db.query;
  f.h.ctx.db.query = (async (q: string, p: unknown[]) => {
    if (/org_sources/.test(q)) throw Error('org store down');
    return query(q, p);
  }) as typeof query;
  await expect(f.call(run)).rejects.toThrow(/^Objective source unavailable or task access denied\.$/);
  f.h.ctx.db.query = query;
  expect((await f.call(run)).data.source).toEqual(f.f.source);
});
it('objective_source_context denies a source hidden as spam and allows it again after restore', async () => {
  const f = await setup(); await f.job(); const issue = (await f.rows())[0]!, run = await f.activate(issue.id);
  const store = createOrgStore(f.h.ctx.db);
  const sourceKey = 'objective:' + objectiveKey('dao', f.f.ref);
  await store.setHidden('co', sourceKey, { by: 'mod', at: new Date().toISOString(), reason: 'spam' });
  await expect(f.call(run)).rejects.toThrow(/^Objective source unavailable or task access denied\.$/);
  await store.setHidden('co', sourceKey, null);
  expect((await f.call(run)).data.source).toEqual(f.f.source);
});
