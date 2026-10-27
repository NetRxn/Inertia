import { describe, it, expect } from 'vitest';
import { createFixtureAdapters, defaultFixture, FIXTURE_NOW } from '../src/adapters';
import { buildGreetingContext } from '../src/assistant/greeting';
import type { Member } from '../src/identity/session';

const DAY = 24 * 60 * 60 * 1000;

function member(externalId: string): Member {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    externalId,
    email: 'x@example.org',
    displayName: 'X',
    status: 'active',
    lastSyncedAt: FIXTURE_NOW,
    lastSeenAt: null, role: 'member', origin: 'directory', workUserId: null,
  };
}

describe('buildGreetingContext', () => {
  it('wraps what changed in source blocks and lists the member\'s claimed tasks', async () => {
    const data = defaultFixture(FIXTURE_NOW);
    const claimed = data.tasks[0];
    const adapters = createFixtureAdapters({
      ...data,
      tasks: data.tasks.map((task) =>
        task.id === claimed.id ? { ...task, status: 'claimed' as const, claimedBy: 'm-zed' } : task,
      ),
    });

    const context = await buildGreetingContext(adapters, member('m-zed'), null, FIXTURE_NOW);

    // The last 7 days' meeting, and the claimed task, each in its own block.
    const recent = data.meetings.filter((m) => new Date(m.date).getTime() >= FIXTURE_NOW.getTime() - 7 * DAY);
    expect(recent.length).toBeGreaterThan(0);
    for (const meeting of recent) expect(context).toContain(`<source kind="meeting" id="${meeting.id}"`);
    expect(context).toContain(`<source kind="task" id="${claimed.id}"`);
    // Every opening tag is closed: nothing in the context escapes its block.
    expect(context.match(/<source /g)?.length).toBe(context.match(/<\/source>/g)?.length);
  });

  it('only includes meetings since the given date', async () => {
    const adapters = createFixtureAdapters(defaultFixture(FIXTURE_NOW));
    const context = await buildGreetingContext(adapters, member('m-nobody'), new Date(FIXTURE_NOW.getTime() - DAY), FIXTURE_NOW);
    expect(context).not.toContain('<source kind="meeting"');
    expect(context).toContain('Nothing claimed');
  });
});
