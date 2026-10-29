import { describe, it, expect, beforeAll } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTestDb } from '../src/db/test-db';
import type { Db } from '../src/db/client';
import { members } from '../src/db/schema';
import { createFixtureAdapters, defaultFixture, FIXTURE_NOW } from '../src/adapters';
import type { FundingApplication, FundingOpportunity, SourceRef } from '../src/adapters';
import { deadlineLabel, deadlineTime, fundingHighlights, safeHttpUrl } from '../src/funding/funding';
import { buildFeed, type FeedCard } from '../src/feed/build-feed';
import { cardQuestion } from '../src/feed/card-question';
import { createAssistantTools } from '../src/assistant/tools';
import { FundingCard } from '../src/components/cards/FundingCard';
import type { Member } from '../src/identity/session';

const DAY = 24 * 60 * 60 * 1000;
const at = (offsetDays: number) => new Date(FIXTURE_NOW.getTime() + offsetDays * DAY).toISOString();

function opportunity(id: string, overrides: Partial<FundingOpportunity> = {}): FundingOpportunity {
  return {
    id,
    sponsor: 'Example Fund',
    program: `Program ${id}`,
    route: 'direct',
    summary: 'Supports neighborhood projects.',
    deadline: at(10),
    benefit: null,
    effort: null,
    nextStep: 'Draft the narrative.',
    sourceUrl: `https://grants.example.org/${id}`,
    observedAt: at(-1),
    initiativeId: null,
    ...overrides,
  };
}

function application(id: string, overrides: Partial<FundingApplication> = {}): FundingApplication {
  return {
    id,
    opportunityId: 'opp-x',
    title: `Application ${id}`,
    stage: 'needs-members',
    readiness: { answered: 8, total: 10 },
    decisionsNeeded: [{ id: `${id}-d1`, question: 'Confirm the match amount', blocks: 'the budget section' }],
    submittedAt: null,
    packetUrl: null,
    ...overrides,
  };
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

describe('funding fixtures', () => {
  it('cover every route, an exact and a date-only deadline, and an application waiting on members', async () => {
    const adapters = createFixtureAdapters(defaultFixture(FIXTURE_NOW));
    const opportunities = await adapters.funding.listOpportunities();
    const applications = await adapters.funding.listApplications();

    expect(new Set(opportunities.map((o) => o.route))).toEqual(
      new Set(['direct', 'partner', 'next-cycle', 'monitor', 'standing-benefit']),
    );
    expect(opportunities.some((o) => o.deadline && /^\d{4}-\d{2}-\d{2}$/.test(o.deadline))).toBe(true);
    expect(opportunities.some((o) => o.deadline && o.deadline.includes('T'))).toBe(true);
    expect(opportunities.some((o) => o.deadline === null)).toBe(true);
    expect(opportunities.every((o) => o.sourceUrl.startsWith('https://') && o.sourceUrl.includes('example.org'))).toBe(true);
    expect(applications.some((a) => a.stage === 'needs-members' && a.decisionsNeeded.length > 0)).toBe(true);
    expect(applications.every((a) => opportunities.some((o) => o.id === a.opportunityId))).toBe(true);
  });
});

describe('funding helpers', () => {
  it('safeHttpUrl keeps http(s) links and drops everything else', () => {
    expect(safeHttpUrl('https://grants.example.org/a')).toBe('https://grants.example.org/a');
    expect(safeHttpUrl('http://grants.example.org/a')).toBe('http://grants.example.org/a');
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl('not a url')).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
  });

  it('deadlineLabel says what is known and no more', () => {
    expect(deadlineLabel(null)).toBe('No fixed deadline');
    expect(deadlineLabel('2026-11-06')).toBe('Due Nov 6');
    expect(deadlineLabel('2026-11-06T22:59:00Z')).toBe('Due Fri, Nov 6, 4:59 PM');
  });

  it('a date-only deadline stays open through that whole day', () => {
    expect(deadlineTime('2026-11-06')).toBeGreaterThan(new Date('2026-11-06T23:00:00-06:00').getTime());
    expect(deadlineTime(null)).toBeNull();
  });

  it('fundingHighlights keeps the next three open direct and partner deadlines within 30 days, soonest first', () => {
    const opportunities = [
      opportunity('later', { deadline: at(20) }),
      opportunity('soon', { deadline: at(3) }),
      opportunity('partner', { route: 'partner', deadline: at(6) }),
      opportunity('passed', { deadline: at(-1) }),
      opportunity('far', { deadline: at(45) }),
      opportunity('monitor', { route: 'monitor', deadline: at(2) }),
      opportunity('rolling', { deadline: null }),
      opportunity('fourth', { deadline: at(25) }),
    ];
    const highlights = fundingHighlights(opportunities, [], FIXTURE_NOW);
    expect(highlights?.opportunities.map((o) => o.id)).toEqual(['soon', 'partner', 'later']);
  });

  it('fundingHighlights lists applications waiting on members, and is null with nothing to show', () => {
    const waiting = application('a1');
    const drafting = application('a2', { stage: 'drafting', decisionsNeeded: [] });
    expect(fundingHighlights([], [waiting, drafting], FIXTURE_NOW)?.applications.map((a) => a.id)).toEqual(['a1']);
    expect(fundingHighlights([opportunity('far', { deadline: at(45) })], [drafting], FIXTURE_NOW)).toBeNull();
  });
});

describe('funding on the home feed', () => {
  it('sits after the votes card and before the last meeting', async () => {
    const cards = await buildFeed(createFixtureAdapters(defaultFixture(FIXTURE_NOW)), sam, [], FIXTURE_NOW);
    const types = cards.map((c) => c.type);
    expect(types.indexOf('funding')).toBe(types.indexOf('proposals') + 1);
    expect(types.indexOf('last-meeting')).toBe(types.indexOf('funding') + 1);
    const funding = cards.find((c) => c.type === 'funding') as Extract<FeedCard, { type: 'funding' }>;
    expect(cardQuestion(funding)).toBe('Which grants should we go after, and what do members need to decide?');
  });

  it('is left out when the grant finder has nothing current', async () => {
    const data = defaultFixture(FIXTURE_NOW);
    data.opportunities = [];
    data.applications = [];
    const cards = await buildFeed(createFixtureAdapters(data), sam, [], FIXTURE_NOW);
    expect(cards.some((c) => c.type === 'funding')).toBe(false);
  });

  it('FundingCard shows deadlines, decisions and only safe links', () => {
    const html = renderToStaticMarkup(
      createElement(FundingCard, {
        opportunities: [opportunity('o1', { benefit: 'Up to $25,000', sourceUrl: 'javascript:alert(1)' })],
        applications: [application('a1')],
      }),
    );
    expect(html).toContain('Program o1');
    expect(html).toContain('Up to $25,000');
    expect(html).toContain('Confirm the match amount');
    expect(html).toContain('href="/org?tab=funding#opportunity-o1"');
    expect(html).toContain('href="/org?tab=funding#application-a1"');
    expect(html).not.toContain('javascript:');
  });
});

describe('listFunding tool', () => {
  let db: Db;
  let ana: { id: string };

  beforeAll(async () => {
    db = (await createTestDb()) as Db;
    [ana] = await db
      .insert(members)
      .values({ externalId: 'm-ana', email: 'ana@example.org', displayName: 'Ana Rodriguez' })
      .returning();
  });

  it('returns opportunities and applications as cited sources, with unknowns left out', async () => {
    const data = defaultFixture(FIXTURE_NOW);
    data.opportunities = [opportunity('o1', { deadline: null, benefit: null }), opportunity('o2', { sourceUrl: 'ftp://x' })];
    data.applications = [application('a1', { opportunityId: 'o1', readiness: null })];
    const collected: SourceRef[] = [];
    const tools = createAssistantTools({ adapters: createFixtureAdapters(data), db, memberId: ana.id }, (refs) =>
      collected.push(...refs),
    );
    const execute = tools.listFunding.execute as unknown as (input: unknown, opts: unknown) => Promise<{ results: string[] }>;
    const output = await execute({}, { toolCallId: 'call-1', messages: [], context: {} });
    const text = output.results.join('\n');

    expect(output.results[0]).toMatch(/^<source kind="application" id="a1"/);
    expect(text).toContain('<source kind="opportunity" id="o1"');
    expect(text).toContain('Decision needed: Confirm the match amount (blocks the budget section)');
    expect(text).toContain('For: Program o1');
    expect(text).toContain('Deadline: none published');
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('Benefit:');
    expect(text).not.toContain('Readiness:');
    expect(collected.find((r) => r.id === 'o1')?.url).toBe('https://grants.example.org/o1');
    expect(collected.find((r) => r.id === 'o2')?.url).toBeUndefined();
  });
});
