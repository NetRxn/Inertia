import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestHarness } from '@paperclipai/plugin-sdk/testing';
import { createHash } from 'node:crypto';
import { parseOrgOverview, parseOrgMembers, parseOrgSources, parseOrgSourceOpen, parseOrgShared, parseTaskTrailResponse } from '../../src/ui/org-client.js';
import { manifest } from '../../src/manifest.js';
import { BRIDGE_NAMESPACE } from '../../src/store/postgres.js';
import { registerOrgProfile } from '../../src/org/host.js';
import { createHostDb, type HostDb } from '../support/paperclip-host-db.js';

describe('org-client contract', () => {
  let host: HostDb;
  let pg: PGlite;

  beforeAll(async () => {
    host = await createHostDb();
    pg = host.pg;
  }, 60000);

  afterAll(async () => host.close());

  function createHarness() {
    const h = createTestHarness({ manifest });

    Object.assign(h.ctx.db, { namespace: host.db.namespace, query: host.db.query, execute: host.db.execute });

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
      requestId: crypto.randomUUID(),
      kind: 'link',
      url: 'https://example.com/doc',
      title: 'Shared Document',
    }, actorContext) as { ok: boolean; data?: any; error?: any };

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The share action returns only the new item's key, kind and title.
    expect(parseOrgShared(result.data)).toEqual({ sourceKey: result.data.sourceKey, kind: 'link', title: 'Shared Document' });
    expect(Object.keys(result.data).sort()).toEqual(['kind', 'sourceKey', 'title']);
  });

  it('org.source.share replay by a removed member is forbidden; by a member after a hide it reveals nothing', async () => {
    const h = createHarness();
    const founder = ctxFor('company-replay');
    const member = ctxFor('company-replay', 'member-1');
    await h.performAction('org.setup', { name: 'Replay DAO', displayName: 'Founder Name' }, founder);
    await h.performAction('org.member.add', { requestId: crypto.randomUUID(), userId: 'member-1', displayName: 'Member One', reason: 'joins' }, founder);
    const share = { requestId: crypto.randomUUID(), kind: 'link', title: 'Soon hidden', url: 'https://hidden.example/x' };
    const first = await h.performAction('org.source.share', share, member) as any;
    expect(parseOrgShared(first.data)).toMatchObject({ kind: 'link', title: 'Soon hidden' });

    await h.performAction('org.source.hide', { requestId: crypto.randomUUID(), sourceKey: first.data.sourceKey, reason: 'mod-only reason' }, founder);
    const hidden = await h.performAction('org.source.share', share, member);
    expect(hidden).toEqual({ ok: false, error: { kind: 'invalid', message: 'Source not found.' } });

    await h.performAction('org.member.remove', { requestId: crypto.randomUUID(), userId: 'member-1', reason: 'left' }, founder);
    const removed = await h.performAction('org.source.share', share, member);
    expect(removed).toEqual({ ok: false, error: { kind: 'forbidden', message: 'Access denied.' } });

    const reused = await h.performAction('org.source.share', share, founder);
    expect(reused).toEqual({ ok: false, error: { kind: 'conflict', message: 'This request id was already used for a different request.' } });
  });

  it('org.sources returns shape that parseOrgSources accepts', async () => {
    const h = createHarness();

    await h.performAction('org.setup', {
      name: 'Test DAO',
      displayName: 'Founder Name',
    }, actorContext);

    await h.performAction('org.source.share', {
      requestId: crypto.randomUUID(),
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
      { requestId: crypto.randomUUID(), kind: 'link', title: 'A link', url: 'https://example.com/a' },
      { requestId: crypto.randomUUID(), kind: 'note', title: 'A note', text: 'Some note text' },
      { requestId: crypto.randomUUID(), kind: 'file', title: 'notes.txt', mediaType: 'text/plain', base64 },
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
      const result = await h.performAction('org.source.share', { requestId: crypto.randomUUID(), kind: 'file', title: 'x', mediaType: 'text/plain', base64 }, c) as any;
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

  it('org.sources objective rows (hidden, restored, restricted) satisfy parseOrgSources', async () => {
    const h = createHarness();
    const c = ctxFor('company-obj');
    await h.performAction('org.setup', { name: 'Objective DAO', displayName: 'Founder Name' }, c);
    await h.performAction('org.source.share', { requestId: crypto.randomUUID(), kind: 'link', title: 'A link', url: 'https://example.com/a' }, c);
    const keys = ['c'.repeat(64), 'd'.repeat(64), 'e'.repeat(64)];
    const audiences = ['members', 'restricted', 'public'];
    for (const [i, key] of keys.entries()) {
      await pg.query(
        `INSERT INTO ${BRIDGE_NAMESPACE}.objective_intake (mapping_key, record) VALUES ($1, $2::jsonb)`,
        [key, JSON.stringify({
          key, companyId: 'company-obj', version: 1,
          snapshot: { sourceSystem: i === 0 ? 'Drive sync' : 'dao-platform', sourceId: 's' + i, audience: audiences[i], title: `Objective ${i}\nsecond line`, text: 't', withdrawn: false, authorRef: 'a' },
          nativeIssueId: i === 0 ? 'issue-1' : null, pending: false, marker: 'm',
        })]
      );
    }
    for (const params of [
      ['org.source.hide', { requestId: crypto.randomUUID(), sourceKey: `objective:${keys[0]}`, reason: 'spam' }],
      ['org.source.restore', { requestId: crypto.randomUUID(), sourceKey: `objective:${keys[0]}`, reason: 'false alarm' }],
      ['org.source.hide', { requestId: crypto.randomUUID(), sourceKey: `objective:${keys[1]}`, reason: 'spam' }],
    ] as const) {
      const result = await h.performAction(params[0], params[1], c) as any;
      expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
    }

    const all = await h.performAction('org.sources', { hidden: true }, c) as any;
    const sources = parseOrgSources(all.data);
    expect(sources.filter(s => s.kind === 'objective')).toHaveLength(3);
    const restored = sources.find(s => s.sourceKey === `objective:${keys[0]}`)!;
    expect(restored).toMatchObject({ sharedBy: 'Drive sync', audience: 'members', hidden: null, title: 'Objective 0 second line', feeds: { tasks: 1 } });
    const hidden = sources.find(s => s.sourceKey === `objective:${keys[1]}`)!;
    expect(hidden).toMatchObject({ sharedBy: 'dao-platform', audience: 'moderators', hidden: { by: 'founder-1', reason: 'spam' } });

    const objectiveOnly = await h.performAction('org.sources', { kind: 'objective', hidden: false }, c) as any;
    expect(parseOrgSources(objectiveOnly.data).map(s => s.sourceKey).sort()).toEqual([`objective:${keys[0]}`, `objective:${keys[2]}`]);

    const overview = await h.performAction('org.overview', {}, c) as any;
    expect(parseOrgOverview(overview.data).keyDocuments.map(d => d.title)).toEqual(['A link']);
  });

  it('org.source.open returns link, note and file shapes parseOrgSourceOpen accepts, byte-exact over the wire', async () => {
    const h = createHarness();
    const founder = ctxFor('company-open');
    const member = ctxFor('company-open', 'member-1');
    await h.performAction('org.setup', { name: 'Open DAO', displayName: 'Founder Name' }, founder);
    await h.performAction('org.member.add', { requestId: crypto.randomUUID(), userId: 'member-1', displayName: 'Member One', reason: 'joins' }, founder);

    const bytes = new Uint8Array(256).map((_, i) => i);
    const base64 = Buffer.from(bytes).toString('base64');
    const text = 'Two lines\nwith émoji 🎉';
    const keys: string[] = [];
    for (const params of [
      { kind: 'link', title: 'A link', url: 'https://example.com/a' },
      { kind: 'note', title: 'A note', text },
      { kind: 'file', title: 'all.bin', mediaType: 'application/octet-stream', base64 },
    ]) {
      const requestId = crypto.randomUUID();
      const result = await h.performAction('org.source.share', { requestId, ...params }, founder) as any;
      expect(result, JSON.stringify(result)).toMatchObject({ ok: true, data: { sourceKey: `share:${requestId}` } });
      keys.push(result.data.sourceKey);
    }

    const open = async (sourceKey: string, c = member) => h.performAction('org.source.open', { sourceKey }, c) as Promise<any>;
    const link = await open(keys[0]!);
    expect(parseOrgSourceOpen(link.data)).toEqual({ kind: 'link', title: 'A link', url: 'https://example.com/a' });
    const note = await open(keys[1]!);
    expect(parseOrgSourceOpen(note.data)).toEqual({ kind: 'note', title: 'A note', text });
    const file = parseOrgSourceOpen((await open(keys[2]!)).data);
    expect(file).toMatchObject({ kind: 'file', title: 'all.bin', mediaType: 'application/octet-stream' });
    expect(Buffer.from((file as { base64: string }).base64, 'base64').equals(Buffer.from(bytes))).toBe(true);

    await h.performAction('org.source.hide', { requestId: crypto.randomUUID(), sourceKey: keys[0], reason: 'spam' }, founder);
    expect(await open(keys[0]!)).toEqual({ ok: false, error: { kind: 'invalid', message: 'Source not found.' } });
    expect(await open(`share:${crypto.randomUUID()}`)).toEqual({ ok: false, error: { kind: 'invalid', message: 'Source not found.' } });
    expect(parseOrgSourceOpen((await open(keys[0]!, founder)).data)).toMatchObject({ kind: 'link' });

    const overview = parseOrgOverview(((await h.performAction('org.overview', {}, member)) as any).data);
    expect(overview.labels).toMatchObject({ 'founder-1': 'Founder Name', 'member-1': 'Member One', [keys[1]!]: 'A note', [keys[2]!]: 'all.bin' });
    expect(overview.labels[keys[0]!]).toBeUndefined();
  });

  it('parseOrgShared refuses extra keys and non-share keys', () => {
    expect(() => parseOrgShared({ sourceKey: 'share:x', kind: 'link', title: 't', url: 'https://x.example' })).toThrow();
    expect(() => parseOrgShared({ sourceKey: 'objective:x', kind: 'link', title: 't' })).toThrow();
  });

  it('parseOrgSourceOpen refuses non-http links, extra keys and bad base64', () => {
    expect(() => parseOrgSourceOpen({ kind: 'link', title: 't', url: 'javascript:alert(1)' })).toThrow();
    expect(() => parseOrgSourceOpen({ kind: 'link', title: 't', url: 'https://x.example', extra: 1 })).toThrow();
    expect(() => parseOrgSourceOpen({ kind: 'file', title: 't', mediaType: 'text/plain', base64: 'abc' })).toThrow();
    expect(() => parseOrgSourceOpen({ kind: 'objective', title: 't' })).toThrow();
  });
});
