import { describe, it, expect, beforeEach } from 'vitest';
import { createPaperclipWorkSource, paperclipConfig, type MemberMapping } from '../src/adapters/paperclip';
import { createMemoryWorkSource } from '../src/adapters/memory-work';

type Call = { method: string; path: string; body: unknown; auth: string | null };

/** A small in-memory Paperclip that answers the routes the adapter uses. */
function fakePaperclip() {
  const calls: Call[] = [];
  const state = {
    labels: [] as { id: string; name: string }[],
    goals: [{ id: 'g-hack', title: 'HackFW 2026', description: null, level: 'company', status: 'active' }, { id: 'g-team', title: 'Team goal', description: null, level: 'team', status: 'active' }] as Record<string, unknown>[],
    issues: [] as Record<string, unknown>[],
    agents: [{ id: 'a-ceo', name: 'CEO' }],
  };
  let n = 0;
  const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path: url.pathname, body, auth: new Headers(init?.headers).get('authorization') });
    const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
    const p = url.pathname;
    if (p === '/api/companies/c1/labels' && method === 'GET') return json(state.labels);
    if (p === '/api/companies/c1/labels' && method === 'POST') { const l = { id: `l${++n}`, name: body.name }; state.labels.push(l); return json(l, 201); }
    if (p === '/api/companies/c1/goals' && method === 'GET') return json(state.goals);
    if (p === '/api/companies/c1/goals' && method === 'POST') { const g = { id: `g${++n}`, ...body }; state.goals.push(g); return json(g, 201); }
    if (p === '/api/companies/c1/projects' && method === 'POST') return json({ id: `p${++n}`, ...body }, 201);
    if (p === '/api/companies/c1/agents') return json(state.agents);
    if (p === '/api/companies/c1/issues' && method === 'GET') return json(state.issues);
    if (p === '/api/companies/c1/issues' && method === 'POST') {
      const issue = { id: `i${++n}`, identifier: `FW-${n}`, status: 'todo', assigneeAgentId: null, assigneeUserId: null, projectId: null, completedAt: null, updatedAt: '2026-10-27T10:00:00Z', ...body };
      state.issues.push(issue);
      return json(issue, 201);
    }
    const issueMatch = p.match(/^\/api\/issues\/([^/]+)$/);
    if (issueMatch) {
      const issue = state.issues.find((i) => i.id === issueMatch[1]);
      if (!issue) return json({ error: 'Not found' }, 404);
      if (method === 'PATCH') {
        const { comment: _comment, ...rest } = body;
        // Like the real server: in progress needs someone assigned.
        if (rest.status === 'in_progress' && !(rest.assigneeUserId ?? issue.assigneeUserId) && !issue.assigneeAgentId) return json({ error: 'in_progress issues require an assignee' }, 422);
        Object.assign(issue, rest);
      }
      return json(issue);
    }
    return json({ error: `unexpected ${method} ${p}` }, 500);
  }) as typeof fetch;
  return { fetchImpl, calls, state };
}

const mapping: MemberMapping = {
  async workUserOf(id) { return id === 'm-john' ? { userId: 'u-john', displayName: 'John' } : { userId: null, displayName: 'Kyle' }; },
  async memberOfWorkUser(userId) { return userId === 'u-john' ? 'm-john' : null; },
};

describe('Paperclip work engine', () => {
  let pc: ReturnType<typeof fakePaperclip>;
  beforeEach(() => { pc = fakePaperclip(); });
  const source = () => createPaperclipWorkSource({ url: 'https://pc.example.org/', apiKey: 'key', companyId: 'c1', humanLabel: 'human', defaultAgentId: 'a-ceo' }, { fetchImpl: pc.fetchImpl, mapping });

  it('reads settings only when all three are set', () => {
    expect(paperclipConfig({ PAPERCLIP_URL: 'https://x/' })).toBeNull();
    expect(paperclipConfig({ PAPERCLIP_URL: 'https://x/', PAPERCLIP_API_KEY: 'k', PAPERCLIP_COMPANY_ID: 'c' })).toMatchObject({ url: 'https://x', humanLabel: 'human', defaultAgentId: null });
  });

  it('maps company goals to initiatives and creates proposed ones as planned', async () => {
    const work = source();
    expect(await work.listInitiatives()).toEqual([{ id: 'g-hack', title: 'HackFW 2026', status: 'active', statusLabel: undefined }]);
    const { id } = await work.createInitiative!({ title: 'Pursue grant funding strategy', summary: 'Grants', adopted: false });
    expect(pc.state.goals.find((g) => g.id === id)).toMatchObject({ level: 'company', status: 'planned' });
    expect((await work.listInitiatives()).find((i) => i.id === id)).toMatchObject({ status: 'paused', statusLabel: 'proposed' });
    expect(pc.calls.every((c) => c.auth === 'Bearer key')).toBe(true);
  });

  it('splits work into human tasks and agent tasks, with parity on both sides', async () => {
    const work = source();
    await work.createTask!({ initiativeId: 'g-hack', title: 'Pick the lead story', description: 'Choose A or B', lane: 'human', kind: 'creative', estimateMinutes: 10 });
    await work.createTask!({ initiativeId: 'g-hack', title: 'Draft the narrative', description: 'Use the brief', lane: 'agent' });
    expect(pc.state.labels).toEqual([{ id: expect.any(String), name: 'human' }]);
    const human = await work.listHumanTasks();
    expect(human).toEqual([expect.objectContaining({ title: 'Pick the lead story', initiativeId: 'g-hack', kind: 'creative', estimateMinutes: 10, status: 'open', prepared: expect.stringContaining('Choose A or B') })]);
    const agent = await work.listAgentTasks!();
    expect(agent).toEqual([expect.objectContaining({ title: 'Draft the narrative', agentName: 'CEO', status: 'queued', url: expect.stringContaining('/issues/FW-') })]);
  });

  it('claims by assigning the mapped Paperclip user, and refuses taken work', async () => {
    const work = source();
    const { id } = await work.createTask!({ initiativeId: 'g-hack', title: 'Confirm budget', description: 'Numbers', lane: 'human' });
    expect(await work.claim(id, 'm-john')).toEqual({ ok: true });
    const patch = pc.calls.find((c) => c.method === 'PATCH');
    expect(patch?.body).toMatchObject({ assigneeUserId: 'u-john', status: 'in_progress', comment: 'Claimed in Inertia by John.' });
    expect((await work.listHumanTasks())[0]).toMatchObject({ status: 'claimed', claimedBy: 'm-john' });
    expect(await work.claim(id, 'm-kyle')).toEqual({ ok: false, reason: 'already-claimed' });
    expect(await work.claim('missing', 'm-john')).toEqual({ ok: false, reason: 'not-found' });
    expect(await work.release!(id, 'm-john')).toEqual({ ok: true });
    expect((await work.listHumanTasks())[0]).toMatchObject({ status: 'open', claimedBy: null });
  });

  it('counts finished work on both sides for the recap', async () => {
    const work = source();
    const h = await work.createTask!({ initiativeId: 'g-hack', title: 'Human', description: '', lane: 'human' });
    const a = await work.createTask!({ initiativeId: 'g-hack', title: 'Agent', description: '', lane: 'agent' });
    Object.assign(pc.state.issues.find((i) => i.id === h.id)!, { status: 'done', assigneeUserId: 'u-john', completedAt: '2026-10-27T12:00:00Z' });
    Object.assign(pc.state.issues.find((i) => i.id === a.id)!, { status: 'done', completedAt: '2026-10-27T12:00:00Z' });
    const from = new Date('2026-10-26T00:00:00Z');
    const to = new Date('2026-10-28T00:00:00Z');
    expect(await work.completionsBetween(from, to)).toEqual([{ memberExternalId: 'm-john', count: 1 }]);
    expect(await work.agentCompletionsBetween!(from, to)).toBe(1);
  });
});

describe('members without a Paperclip user', () => {
  it('claim by comment and stay exclusive through the Inertia work log', async () => {
    const pc = fakePaperclip();
    const held = new Map<string, string>();
    const unmapped: MemberMapping = {
      async workUserOf() { return { userId: null, displayName: 'John' }; },
      async memberOfWorkUser() { return null; },
      async inertiaClaims(ids) { return new Map([...held].filter(([id]) => ids.includes(id))); },
    };
    const work = createPaperclipWorkSource({ url: 'https://pc.example.org', apiKey: 'key', companyId: 'c1', humanLabel: 'human', defaultAgentId: null }, { fetchImpl: pc.fetchImpl, mapping: unmapped });
    const { id } = await work.createTask!({ initiativeId: 'g-hack', title: 'Confirm budget', description: 'Numbers', lane: 'human' });
    expect(await work.claim(id, 'm-john')).toEqual({ ok: true });
    expect(pc.calls.find((c) => c.method === 'PATCH')?.body).toEqual({ comment: 'Claimed in Inertia by John (not linked to a Paperclip user).' });
    held.set(id, 'm-john'); // what the claim action records in the work log
    expect((await work.listHumanTasks())[0]).toMatchObject({ status: 'claimed', claimedBy: 'm-john' });
    expect(await work.claim(id, 'm-kyle')).toEqual({ ok: false, reason: 'already-claimed' });
    expect(await work.complete!(id, 'm-john', 'Done')).toEqual({ ok: true });
    expect(pc.state.issues[0]).toMatchObject({ status: 'done' });
    expect((await work.listHumanTasks())[0]).toMatchObject({ status: 'done', completedBy: 'm-john' });
  });
});

describe('Paperclip read-only', () => {
  it('is read-only unless write is asked for', () => {
    const env = { PAPERCLIP_URL: 'https://x', PAPERCLIP_API_KEY: 'k', PAPERCLIP_COMPANY_ID: 'c' };
    expect(paperclipConfig(env)?.readOnly).toBe(true);
    expect(paperclipConfig({ ...env, PAPERCLIP_ACCESS: 'write' })?.readOnly).toBe(false);
  });

  it('reads work and claims without writing anything to Paperclip', async () => {
    const pc = fakePaperclip();
    pc.state.labels.push({ id: 'l-h', name: 'Human' });
    pc.state.issues.push(
      { id: 'i1', identifier: 'FW-1', title: 'Pick the lead story', description: '[creative] Choose A or B', status: 'todo', goalId: 'g-hack', projectId: null, assigneeAgentId: null, assigneeUserId: null, labels: [{ id: 'l-h', name: 'Human' }], completedAt: null, updatedAt: '2026-10-27T10:00:00Z' },
      { id: 'i2', identifier: 'FW-2', title: 'Draft the narrative', description: '', status: 'in_progress', goalId: 'g-hack', projectId: null, assigneeAgentId: 'a-ceo', assigneeUserId: null, labels: [], completedAt: null, updatedAt: '2026-10-27T10:00:00Z' },
    );
    const work = createPaperclipWorkSource({ url: 'https://pc.example.org', apiKey: 'key', companyId: 'c1', humanLabel: 'human', defaultAgentId: null, readOnly: true }, { fetchImpl: pc.fetchImpl, mapping });
    expect(work.engine).toMatchObject({ readOnly: true });
    expect(work.createInitiative ?? work.createProject ?? work.createTask ?? work.complete).toBeUndefined();
    expect((await work.listHumanTasks()).map((t) => t.title)).toEqual(['Pick the lead story']);
    expect((await work.listAgentTasks!()).map((t) => t.status)).toEqual(['running']);
    expect(await work.claim('i1', 'm-john')).toEqual({ ok: true });
    expect(await work.release!('i1', 'm-john')).toEqual({ ok: true });
    expect(pc.calls.filter((c) => c.method !== 'GET')).toEqual([]);
  });

  it('treats a missing label as no human tasks rather than creating it', async () => {
    const pc = fakePaperclip();
    const work = createPaperclipWorkSource({ url: 'https://pc.example.org', apiKey: 'key', companyId: 'c1', humanLabel: 'human', defaultAgentId: null, readOnly: true }, { fetchImpl: pc.fetchImpl, mapping });
    expect(await work.listHumanTasks()).toEqual([]);
    expect(pc.calls.filter((c) => c.method !== 'GET')).toEqual([]);
  });
});

describe('memory work engine', () => {
  it('creates, lists and claims work without an outside engine', async () => {
    const work = createMemoryWorkSource();
    const { id: ini } = await work.createInitiative!({ title: 'HackFW', summary: '', adopted: true });
    const { id } = await work.createTask!({ initiativeId: ini, title: 'Judge', description: 'Score demos', lane: 'human', estimateMinutes: 30 });
    await work.createTask!({ initiativeId: ini, title: 'Draft recap', description: '', lane: 'agent' });
    expect(await work.listInitiatives()).toEqual([expect.objectContaining({ id: ini, status: 'active' })]);
    expect(await work.claim(id, 'm1')).toEqual({ ok: true });
    expect(await work.claim(id, 'm2')).toEqual({ ok: false, reason: 'already-claimed' });
    expect(await work.listAgentTasks!()).toHaveLength(1);
  });
});

describe('memory work engine after a restart', () => {
  it('reloads kept initiatives so new work lands under them', async () => {
    const work = createMemoryWorkSource(undefined, async () => [{ id: 'ini-kept', title: 'HackFW 2026', adopted: false }]);
    expect(await work.listInitiatives()).toEqual([{ id: 'ini-kept', title: 'HackFW 2026', status: 'paused', statusLabel: 'proposed' }]);
    await work.createInitiative!({ title: 'Roundtables', summary: '', adopted: true });
    expect((await work.listInitiatives()).map((i) => i.title)).toEqual(['HackFW 2026', 'Roundtables']);
  });
});
