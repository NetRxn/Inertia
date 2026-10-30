import { describe, it, expect } from 'vitest';
import { buildFeed, type FeedCard, type ShareSummary } from '../src/feed/build-feed';
import { createFixtureAdapters, defaultFixture, FIXTURE_NOW } from '../src/adapters';
import type { Adapters } from '../src/adapters';
import type { Member } from '../src/identity/session';
import { mergeInitiatives } from '../src/work/org-initiatives';

const DAY = 24 * 60 * 60 * 1000;

function member(externalId: string, displayName: string): Member {
  return {
    id: `uuid-${externalId}`,
    externalId,
    email: `${externalId.slice(2)}@example.org`,
    displayName,
    status: 'active',
    lastSyncedAt: FIXTURE_NOW,
    lastSeenAt: null, role: 'member', origin: 'directory', workUserId: null,
  };
}

const sam = member('m-sam', 'Sam Williams');

const share: ShareSummary = {
  id: 'share-1',
  kind: 'idea',
  description: 'What if the garden had a tool library?',
  linkUrl: null,
  previewTitle: null,
  authorName: 'Ana Rodriguez',
  createdAt: new Date(FIXTURE_NOW.getTime() - DAY).toISOString(),
};

function card<T extends FeedCard['type']>(cards: FeedCard[], type: T): Extract<FeedCard, { type: T }> {
  const found = cards.find((c) => c.type === type);
  if (!found) throw new Error(`no ${type} card`);
  return found as Extract<FeedCard, { type: T }>;
}

describe('buildFeed', () => {
  it('cards follow the fixed order', async () => {
    const adapters = createFixtureAdapters(defaultFixture(FIXTURE_NOW));
    const cards = await buildFeed(adapters, sam, [share], FIXTURE_NOW);

    expect(cards.map((c) => c.type)).toEqual([
      'waiting',
      'priorities',
      'coming-up',
      'proposals',
      'funding',
      'last-meeting',
      'this-week',
      'from-chat',
      'recently-shared',
    ]);
  });

  it('this-week shows at most three members and never a zero count', async () => {
    const base = createFixtureAdapters(defaultFixture(FIXTURE_NOW));
    let asked: { from: Date; to: Date } | null = null;
    const adapters: Adapters = {
      ...base,
      work: {
        ...base.work,
        async completionsBetween(from, to) {
          asked = { from, to };
          return [
            { memberExternalId: 'm-ana', count: 2 },
            { memberExternalId: 'm-rob', count: 0 },
            { memberExternalId: 'm-jordan', count: 5 },
            { memberExternalId: 'm-alex', count: 1 },
            { memberExternalId: 'm-casey', count: 3 },
          ];
        },
      },
    };

    const cards = await buildFeed(adapters, sam, [], FIXTURE_NOW);
    const thisWeek = card(cards, 'this-week');

    expect(thisWeek.top).toEqual([
      { displayName: 'Jordan Kim', count: 5 },
      { displayName: 'Casey Thompson', count: 3 },
      { displayName: 'Ana Rodriguez', count: 2 },
    ]);
    expect(thisWeek.openItems).toBe(3);
    expect(asked).toEqual({
      from: new Date('2026-10-19T05:00:00Z'),
      to: new Date('2026-10-26T05:00:00Z'),
    });

    const withOnlyZeros: Adapters = {
      ...adapters,
      work: { ...adapters.work, completionsBetween: async () => [{ memberExternalId: 'm-rob', count: 0 }] },
    };
    const zeroCards = await buildFeed(withOnlyZeros, sam, [], FIXTURE_NOW);
    expect(card(zeroCards, 'this-week').top).toEqual([]);
  });

  it("waiting shows only this member's claimed tasks", async () => {
    const adapters = createFixtureAdapters(defaultFixture(FIXTURE_NOW));
    // Someone else claims an open task; Sam already holds task-3.
    await adapters.work.claim('task-1', 'm-rob');

    const samCards = await buildFeed(adapters, sam, [], FIXTURE_NOW);
    expect(card(samCards, 'waiting').tasks.map((t) => t.id)).toEqual(['task-3']);

    const anaCards = await buildFeed(adapters, member('m-ana', 'Ana Rodriguez'), [], FIXTURE_NOW);
    expect(card(anaCards, 'waiting').tasks).toEqual([]);
    expect(anaCards[0].type).toBe('waiting');
  });

  it('omits last-meeting when there are no meetings', async () => {
    const data = defaultFixture(FIXTURE_NOW);
    data.meetings = [];
    const cards = await buildFeed(createFixtureAdapters(data), sam, [], FIXTURE_NOW);

    expect(cards.map((c) => c.type)).not.toContain('last-meeting');
    expect(cards.map((c) => c.type)).not.toContain('recently-shared');
  });

  it('from-chat falls back to the truncated latest message', async () => {
    const data = defaultFixture(FIXTURE_NOW);
    const latest = 'We could ask the library about evening hours. '.repeat(5);
    data.chatThreads = [
      {
        id: 'thread-long',
        channel: '#general',
        title: 'Library hours',
        summary: null,
        messages: [
          { id: 'a', author: 'm-ana', text: 'Earlier message', at: new Date(FIXTURE_NOW.getTime() - 2 * DAY).toISOString() },
          { id: 'b', author: 'm-rob', text: latest, at: new Date(FIXTURE_NOW.getTime() - DAY).toISOString() },
        ],
      },
      {
        id: 'thread-summary',
        channel: '#projects',
        title: 'Venue',
        summary: 'Planning the venue.',
        messages: [{ id: 'c', author: 'm-sam', text: 'Hi', at: new Date(FIXTURE_NOW.getTime() - DAY).toISOString() }],
      },
    ];

    const cards = await buildFeed(createFixtureAdapters(data), sam, [], FIXTURE_NOW);
    const threads = card(cards, 'from-chat').threads;
    const long = threads.find((t) => t.thread.id === 'thread-long')!;

    expect(long.line.length).toBeLessThanOrEqual(120);
    expect(long.line.endsWith('…')).toBe(true);
    expect(latest.startsWith(long.line.slice(0, -1))).toBe(true);
    expect(threads.find((t) => t.thread.id === 'thread-summary')!.line).toBe('Planning the venue.');
  });

  it('from-chat keeps the three busiest threads of the past week', async () => {
    const cards = await buildFeed(createFixtureAdapters(defaultFixture(FIXTURE_NOW)), sam, [], FIXTURE_NOW);
    expect(card(cards, 'from-chat').threads.map((t) => t.thread.id)).toEqual(['thread-1', 'thread-2', 'thread-4']);
  });

  it('selects priorities, events, proposals and the newest meeting', async () => {
    const data = defaultFixture(FIXTURE_NOW);
    data.initiatives.push(
      { id: 'init-paused', title: 'Paused', status: 'paused', progress: 0, statusLabel: '', priority: 0 },
      { id: 'init-four', title: 'Fourth', status: 'active', progress: 0, statusLabel: '', priority: 4 },
    );
    data.events.push({
      id: 'event-far',
      title: 'Far away',
      startsAt: new Date(FIXTURE_NOW.getTime() + 20 * DAY).toISOString(),
      detail: '',
      kind: 'other',
    });
    data.proposals.push(
      {
        id: 'prop-old',
        title: 'Old',
        status: 'closed',
        opensAt: new Date(FIXTURE_NOW.getTime() - 30 * DAY).toISOString(),
        closesAt: new Date(FIXTURE_NOW.getTime() - 8 * DAY).toISOString(),
        tally: { yes: 1, no: 0, abstain: 0 },
        url: 'https://vote.example.org/proposals/prop-old',
      },
      {
        id: 'prop-upcoming',
        title: 'Upcoming',
        status: 'upcoming',
        opensAt: new Date(FIXTURE_NOW.getTime() + 2 * DAY).toISOString(),
        closesAt: new Date(FIXTURE_NOW.getTime() + 9 * DAY).toISOString(),
        tally: { yes: 0, no: 0, abstain: 0 },
        url: 'https://vote.example.org/proposals/prop-upcoming',
      },
    );

    const cards = await buildFeed(createFixtureAdapters(data), sam, [], FIXTURE_NOW);

    expect(card(cards, 'priorities').initiatives.map((i) => i.id)).toEqual(['init-garden', 'init-coding', 'init-treasury']);
    expect(card(cards, 'coming-up').events.map((e) => e.id)).toEqual(['event-1', 'event-2', 'event-3', 'event-4']);
    expect(card(cards, 'proposals').proposals.map((p) => p.id)).toEqual(['prop-1', 'prop-2']);
    expect(card(cards, 'last-meeting').meeting.id).toBe('meeting-1');
  });

  it('recently-shared keeps the newest three shares', async () => {
    const shares: ShareSummary[] = [1, 4, 2, 3].map((daysAgo) => ({
      ...share,
      id: `share-${daysAgo}`,
      createdAt: new Date(FIXTURE_NOW.getTime() - daysAgo * DAY).toISOString(),
    }));

    const cards = await buildFeed(createFixtureAdapters(defaultFixture(FIXTURE_NOW)), sam, shares, FIXTURE_NOW);
    expect(card(cards, 'recently-shared').shares.map((s) => s.id)).toEqual(['share-1', 'share-2', 'share-3']);
  });

  it('shows the organization’s initiatives, including ones awaiting a vote', async () => {
    const adapters = createFixtureAdapters(defaultFixture(FIXTURE_NOW));
    const initiatives = mergeInitiatives(
      {
        governanceEnabled: true,
        profile: { mission: null, programs: [], people: [], recent: [], initiatives: [
          { id: 'p-1', title: 'HackFW 2026', summary: '', citations: [], status: 'accepted', workId: null, adopted: false },
        ] },
      },
      await adapters.work.listInitiatives(),
    );
    const cards = await buildFeed(adapters, sam, [], FIXTURE_NOW, initiatives);
    expect(card(cards, 'priorities').initiatives).toEqual([
      expect.objectContaining({ title: 'HackFW 2026', statusLabel: 'Awaiting vote', awaitingVote: true }),
    ]);
  });
});
