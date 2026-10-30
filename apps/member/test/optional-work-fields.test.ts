import { describe, it, expect, beforeAll } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTestDb } from '../src/db/test-db';
import type { Db } from '../src/db/client';
import { members } from '../src/db/schema';
import { createFixtureAdapters, defaultFixture, FIXTURE_NOW } from '../src/adapters';
import type { HumanTask, Initiative } from '../src/adapters';
import { byPriority, taskKind } from '../src/work/initiatives';
import { buildFeed, type FeedCard } from '../src/feed/build-feed';
import { createAssistantTools } from '../src/assistant/tools';
import { InitiativesStrip } from '../src/components/InitiativesStrip';
import type { Member } from '../src/identity/session';

/** An initiative from a source that only knows its id, title and status. */
function bare(id: string, title: string): Initiative {
  return { id, title, status: 'active' };
}

const sam: Member = {
  id: 'uuid-m-sam',
  externalId: 'm-sam',
  email: 'sam@example.org',
  displayName: 'Sam Williams',
  status: 'active',
  lastSyncedAt: FIXTURE_NOW,
  lastSeenAt: null, role: 'member', origin: 'directory', workUserId: null,
};

describe('optional initiative and task fields', () => {
  let db: Db;

  beforeAll(async () => {
    db = (await createTestDb()) as Db;
  });

  it('byPriority puts known priorities first and keeps source order for the rest', () => {
    const initiatives: Initiative[] = [
      bare('a', 'A'),
      { ...bare('b', 'B'), priority: 2 },
      bare('c', 'C'),
      { ...bare('d', 'D'), priority: 1 },
    ];
    expect([...initiatives].sort(byPriority).map((i) => i.id)).toEqual(['d', 'b', 'a', 'c']);
  });

  it('a task without a kind reads as review', () => {
    const task = defaultFixture(FIXTURE_NOW).tasks[0];
    const { kind: _kind, ...withoutKind } = task;
    expect(taskKind(withoutKind as HumanTask)).toBe('review');
    expect(taskKind(task)).toBe(task.kind);
  });

  it('the feed lists initiatives without a priority after ranked ones, in source order', async () => {
    const data = defaultFixture(FIXTURE_NOW);
    data.initiatives = [bare('x', 'X'), { ...bare('y', 'Y'), priority: 5 }, bare('z', 'Z')];
    const cards = await buildFeed(createFixtureAdapters(data), sam, [], FIXTURE_NOW);
    const priorities = cards.find((c) => c.type === 'priorities') as Extract<FeedCard, { type: 'priorities' }>;
    expect(priorities.initiatives.map((i) => i.id)).toEqual(['y', 'x', 'z']);
  });

  it('listWork leaves out unknown fields instead of printing undefined', async () => {
    const [ana] = await db
      .insert(members)
      .values({ externalId: 'm-ana', email: 'ana@example.org', displayName: 'Ana Rodriguez' })
      .returning();
    const data = defaultFixture(FIXTURE_NOW);
    data.initiatives = [bare('x', 'Bare initiative')];
    const open = data.tasks.find((t) => t.status === 'open')!;
    const { kind: _kind, ...withoutKind } = open;
    data.tasks = [{ ...(withoutKind as HumanTask), initiativeId: 'x' }];

    const tools = createAssistantTools({ adapters: createFixtureAdapters(data), db, memberId: ana.id }, () => {});
    const execute = tools.listWork.execute as unknown as (input: unknown, opts: unknown) => Promise<{ results: string[] }>;
    const output = await execute({}, { toolCallId: 'call-1', messages: [], context: {} });
    const text = output.results.join('\n');

    expect(text).not.toContain('undefined');
    expect(text).not.toContain('NaN');
    expect(text).not.toContain('Progress:');
    expect(text).not.toContain('Priority:');
    expect(text).toContain('Status: active\n');
    expect(text).toContain('Kind: review');
  });

  it('InitiativesStrip drops the progress bar and the status line when unknown', () => {
    const html = renderToStaticMarkup(createElement(InitiativesStrip, { initiatives: [bare('x', 'Bare initiative')] }));
    expect(html).toContain('Bare initiative');
    expect(html).not.toContain('along');
    expect(html).not.toContain('NaN');
    expect(html).not.toMatch(/<p[^>]*><\/p>/);
  });

  it('InitiativesStrip still shows progress and status when the source has them', () => {
    const initiative: Initiative = { ...bare('x', 'Ranked'), progress: 0.4, statusLabel: 'First session scheduled' };
    const html = renderToStaticMarkup(createElement(InitiativesStrip, { initiatives: [initiative] }));
    expect(html).toContain('40% along');
    expect(html).toContain('First session scheduled');
  });

  it('InitiativesStrip marks initiatives awaiting a vote', () => {
    const html = renderToStaticMarkup(createElement(InitiativesStrip, { initiatives: [{ ...bare('x', 'HackFW 2026'), awaitingVote: true, statusLabel: 'Awaiting vote' }] }));
    expect(html).toContain('Awaiting vote');
  });
});
