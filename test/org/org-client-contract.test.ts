import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { createTestHarness } from '@paperclipai/plugin-sdk/testing';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseOrgOverview, parseOrgMembers, parseOrgSources, parseTaskTrailResponse } from '../../src/ui/org-client.js';
import { manifest } from '../../src/manifest.js';
import { BRIDGE_NAMESPACE } from '../../src/store/postgres.js';
import { registerOrgProfile } from '../../src/org/host.js';

describe('org-client contract', () => {
  let pg: PGlite;

  beforeAll(async () => {
    pg = new PGlite();
    await pg.exec(`CREATE SCHEMA ${BRIDGE_NAMESPACE}`);
    await pg.exec(await readFile(new URL('../../migrations/007_objective_intake.sql', import.meta.url), 'utf8'));
    await pg.exec(await readFile(new URL('../../migrations/009_org_profile.sql', import.meta.url), 'utf8'));
  }, 60000);

  afterAll(async () => pg.close());

  function createHarness() {
    const h = createTestHarness({ manifest });

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

  const actorContext = {
    actor: { type: 'user' as const, userId: 'founder-1', agentId: null, runId: null, companyId: 'company-1' },
    companyId: 'company-1',
  };

  it('org.setup returns valid profile', async () => {
    const h = createHarness();

    const result = await h.performAction('org.setup', {
      name: 'Test DAO',
      displayName: 'Founder Name',
    }, actorContext) as { ok: boolean; data?: any; error?: any };

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The setup action returns OrgProfile directly
    expect(result.data).toHaveProperty('companyId');
    expect(result.data).toHaveProperty('name');
    expect(result.data).toHaveProperty('createdBy');
    expect(result.data).toHaveProperty('createdAt');
  });

  it('org.overview returns shape that parseOrgOverview accepts', async () => {
    const h = createHarness();

    await h.performAction('org.setup', {
      name: 'Test DAO',
      displayName: 'Founder Name',
    }, actorContext);

    const result = await h.performAction('org.overview', {}, actorContext) as { ok: boolean; data?: any; error?: any };

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Should parse without throwing
    const overview = parseOrgOverview(result.data);

    expect(overview.profile.name).toBe('Test DAO');
    expect(overview.role).toBe('founder');
    expect(overview.memberCount).toBe(1);
    expect(Array.isArray(overview.feed)).toBe(true);
    expect(Array.isArray(overview.keyDocuments)).toBe(true);
    expect(Array.isArray(overview.initiatives)).toBe(true);
  });

  it('org.members returns shape that parseOrgMembers accepts', async () => {
    const h = createHarness();

    await h.performAction('org.setup', {
      name: 'Test DAO',
      displayName: 'Founder Name',
    }, actorContext);

    const result = await h.performAction('org.members', {}, actorContext) as { ok: boolean; data?: any; error?: any };

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Should parse without throwing
    const members = parseOrgMembers(result.data);

    expect(members.length).toBe(1);
    expect(members[0]!.userId).toBe('founder-1');
    expect(members[0]!.displayName).toBe('Founder Name');
    expect(members[0]!.role).toBe('founder');
    expect(members[0]!.status).toBe('active');
  });

  it('org.source.share returns valid source', async () => {
    const h = createHarness();

    await h.performAction('org.setup', {
      name: 'Test DAO',
      displayName: 'Founder Name',
    }, actorContext);

    const result = await h.performAction('org.source.share', {
      kind: 'link',
      url: 'https://example.com/doc',
      title: 'Shared Document',
    }, actorContext) as { ok: boolean; data?: any; error?: any };

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The share action returns OrgSource directly
    expect(result.data).toHaveProperty('sourceKey');
    expect(result.data).toHaveProperty('kind');
    expect(result.data).toHaveProperty('title');
    expect(result.data.title).toBe('Shared Document');
  });

  it('org.sources returns shape that parseOrgSources accepts', async () => {
    const h = createHarness();

    await h.performAction('org.setup', {
      name: 'Test DAO',
      displayName: 'Founder Name',
    }, actorContext);

    await h.performAction('org.source.share', {
      kind: 'link',
      url: 'https://example.com/doc',
      title: 'Shared Document',
    }, actorContext);

    const result = await h.performAction('org.sources', { hidden: false }, actorContext) as { ok: boolean; data?: any; error?: any };

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Should parse without throwing
    const sources = parseOrgSources(result.data);

    expect(sources.length).toBeGreaterThan(0);
    expect(sources[0]!.sourceKey).toBeTruthy();
    expect(sources[0]!.kind).toBeTruthy();
    expect(sources[0]!.feeds).toHaveProperty('tasks');
    expect(typeof sources[0]!.feeds.tasks).toBe('number');
  });

  it('org.task.trail returns shape that parseTaskTrailResponse accepts', async () => {
    const h = createHarness();

    await h.performAction('org.setup', {
      name: 'Test DAO',
      displayName: 'Founder Name',
    }, actorContext);

    const issue = await h.ctx.issues.create({
      companyId: 'company-1',
      title: 'Test Task',
      description: 'Done when: All tests pass\nNext step: Write more tests',
      status: 'in_progress',
      originKind: 'plugin:netrxn.inertia:objective',
      originId: 'objective-1',
    });

    await pg.query(
      `INSERT INTO ${BRIDGE_NAMESPACE}.objective_intake (mapping_key, record) VALUES ($1, $2::jsonb)`,
      [
        'objective-1',
        JSON.stringify({
          key: 'objective-1',
          companyId: 'company-1',
          version: 1,
          snapshot: {
            sourceSystem: 'test',
            sourceId: 'source-1',
            audience: 'members',
            title: 'Test Objective',
            text: 'Test text',
            withdrawn: false,
            authorRef: 'author-1',
          },
          nativeIssueId: null,
          pending: false,
          marker: 'test-marker',
        }),
      ]
    );

    const result = await h.performAction('org.task.trail', { issueId: issue.id }, actorContext) as { ok: boolean; data?: any; error?: any };

    if (!result.ok) {
      throw new Error(`org.task.trail failed: ${JSON.stringify(result.error)}`);
    }

    expect(result.ok).toBe(true);

    // Should parse without throwing
    const trail = parseTaskTrailResponse(result.data);

    expect(trail.title).toBe('Test Task');
    expect(trail.status).toBe('in_progress');
    expect(trail.doneWhen).toBe('All tests pass');
    expect(trail.nextStep).toBe('Write more tests');
    expect(trail.trail).toHaveProperty('summary');
    expect(trail.trail).toHaveProperty('steps');
    expect(trail.trail).toHaveProperty('alsoUsed');
    expect(Array.isArray(trail.trail.steps)).toBe(true);
    expect(Array.isArray(trail.trail.alsoUsed)).toBe(true);
  });

  function ctxFor(companyId: string, userId = 'founder-1') {
    return { actor: { type: 'user' as const, userId, agentId: null, runId: null, companyId }, companyId };
  }

  it('org.source.share accepts the exact link, note and file params the UI sends', async () => {
    const h = createHarness();
    const c = ctxFor('company-share');
    await h.performAction('org.setup', { name: 'Share DAO', displayName: 'Founder Name' }, c);

    const bytes = new TextEncoder().encode('hello file');
    const base64 = Buffer.from(bytes).toString('base64');
    const uiParams = [
      { kind: 'link', title: 'A link', url: 'https://example.com/a' },
      { kind: 'note', title: 'A note', text: 'Some note text' },
      { kind: 'file', title: 'notes.txt', mediaType: 'text/plain', base64 },
    ];
    for (const params of uiParams) {
      const result = await h.performAction('org.source.share', params, c) as { ok: boolean; error?: unknown };
      expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
    }

    const listed = await h.performAction('org.sources', { hidden: false }, c) as { ok: boolean; data?: unknown };
    const sources = parseOrgSources(listed.data);
    const file = sources.find(s => s.kind === 'file')!;
    expect(file).toMatchObject({ title: 'notes.txt', mediaType: 'text/plain', byteLength: bytes.length });
    expect(file.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    expect(sources.find(s => s.kind === 'link')!.url).toBe('https://example.com/a');
    expect(sources.find(s => s.kind === 'note')!.title).toBe('A note');
  });

  it('org.source.share rejects malformed base64 as invalid', async () => {
    const h = createHarness();
    const c = ctxFor('company-share-bad');
    await h.performAction('org.setup', { name: 'Share DAO', displayName: 'Founder Name' }, c);
    for (const base64 of ['not base64!', 'abc', 'ab=c', 12]) {
      const result = await h.performAction('org.source.share', { kind: 'file', title: 'x', mediaType: 'text/plain', base64 }, c) as any;
      expect(result.ok).toBe(false);
      expect(result.error.kind).toBe('invalid');
    }
  });

  it('org.task.trail sanitizes a 5000-char multi-line title and CRLF fields so the parser accepts them', async () => {
    const h = createHarness();
    const c = ctxFor('company-trail');
    await h.performAction('org.setup', { name: 'Trail DAO', displayName: 'Founder Name' }, c);
    const longTitle = ('Line one\nline\ttwo ' + 'x'.repeat(100) + '\n').repeat(40).slice(0, 5000);
    const issue = await h.ctx.issues.create({
      companyId: 'company-trail',
      title: longTitle,
      description: 'Intro\r\nDone when: ' + 'd'.repeat(3000) + '\r\nNext step: Ship it  \r\n',
      status: 'in_progress',
      originKind: 'plugin:netrxn.inertia:objective',
      originId: 'objective-long',
    });
    await pg.query(
      `INSERT INTO ${BRIDGE_NAMESPACE}.objective_intake (mapping_key, record) VALUES ($1, $2::jsonb)`,
      ['objective-long', JSON.stringify({
        key: 'objective-long', companyId: 'company-trail', version: 1,
        snapshot: { sourceSystem: 'Drive sync', sourceId: 'source-long', audience: 'members', title: longTitle, text: 't', withdrawn: false, authorRef: 'author-1' },
        nativeIssueId: issue.id, pending: false, marker: 'm',
      })]
    );

    const result = await h.performAction('org.task.trail', { issueId: issue.id }, c) as any;
    expect(result.ok, JSON.stringify(result.error)).toBe(true);
    const trail = parseTaskTrailResponse(result.data);
    expect(trail.title.startsWith('Line one line two x')).toBe(true);
    expect(trail.title.endsWith('…')).toBe(true);
    expect(trail.doneWhen!.endsWith('…')).toBe(true);
    expect(trail.nextStep).toBe('Ship it');
    expect(trail.trail.steps[0]!.detail).toContain('(Drive sync, members)');
  });

  it('org.overview caps initiatives at 20 with sanitized titles the parser accepts', async () => {
    const h = createHarness();
    const c = ctxFor('company-many');
    await h.performAction('org.setup', { name: 'Busy DAO', displayName: 'Founder Name' }, c);
    for (let i = 0; i < 25; i++) {
      await h.ctx.issues.create({ companyId: 'company-many', title: ` Initiative ${i}\n` + 'y'.repeat(3000) });
    }
    const result = await h.performAction('org.overview', {}, c) as any;
    expect(result.ok).toBe(true);
    const overview = parseOrgOverview(result.data);
    expect(overview.initiatives).toHaveLength(20);
    expect(overview.initiatives[0]!.title).toMatch(/^Initiative \d+ y+…$/);
  });
});
