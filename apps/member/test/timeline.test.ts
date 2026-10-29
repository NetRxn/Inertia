import { describe, it, expect } from 'vitest';
import { buildTimeline, type TimelineInput } from '../src/feed/timeline';

const at = (day: number, hour = 12) => new Date(Date.UTC(2026, 9, day, hour)).toISOString();

function input(change: Partial<TimelineInput> = {}): TimelineInput {
  return {
    initiatives: [{ id: 'g-hack', title: 'HackFW 2026', status: 'active' }],
    names: new Map([['m-ana', 'Ana Rodriguez']]),
    humanTasks: [],
    agentTasks: [],
    meetings: [],
    shares: [],
    proposals: [],
    opportunities: [],
    applications: [],
    sources: [],
    ...change,
  };
}

const task = (id: string, completedAt: string | null, change = {}) => ({
  id, initiativeId: 'g-hack', title: `Task ${id}`, estimateMinutes: null, due: null, prepared: '',
  status: completedAt ? 'done' as const : 'open' as const, claimedBy: completedAt ? 'm-ana' : null,
  completedBy: completedAt ? 'm-ana' : null, completedAt, ...change,
});

describe('buildTimeline', () => {
  it('puts what members and agents did in one list, newest first', () => {
    const { items } = buildTimeline(input({
      humanTasks: [task('t-1', at(20))],
      agentTasks: [{ id: 'a-1', initiativeId: 'g-hack', title: 'Draft sponsor list', agentName: 'Scout', status: 'done', updatedAt: at(21), url: null }],
    }), { limit: 10 });
    expect(items.map((i) => [i.kind, i.actor, i.initiative?.title])).toEqual([
      ['agent-done', { kind: 'agent', name: 'Scout' }, 'HackFW 2026'],
      ['task-done', { kind: 'member', name: 'Ana Rodriguez' }, 'HackFW 2026'],
    ]);
  });

  it('never carries member ids', () => {
    const { items } = buildTimeline(input({ humanTasks: [task('t-1', at(20))] }), { limit: 10 });
    expect(JSON.stringify(items)).not.toContain('m-ana');
  });

  it('filters by actor kind', () => {
    const data = input({
      humanTasks: [task('t-1', at(20))],
      agentTasks: [{ id: 'a-1', initiativeId: null, title: 'Index notes', agentName: null, status: 'blocked', updatedAt: at(21), url: null }],
      sources: [{ id: 's-1', kind: 'chat-export', title: 'Buzz: #general, Oct 22', origin: null, summary: 'Venue talk', createdAt: at(22) }],
    });
    expect(buildTimeline(data, { limit: 10, actors: ['member', 'organization'] }).items.map((i) => i.kind)).toEqual(['task-done']);
    expect(buildTimeline(data, { limit: 10, actors: ['agent', 'connector'] }).items.map((i) => [i.kind, i.actor])).toEqual([
      ['incoming', { kind: 'connector', name: 'Buzz' }],
      ['agent-blocked', { kind: 'agent', name: null }],
    ]);
  });

  it('agent work under an unknown goal has no initiative', () => {
    const { items } = buildTimeline(input({
      agentTasks: [{ id: 'a-1', initiativeId: 'g-root', title: 'Index notes', agentName: null, status: 'done', updatedAt: at(21), url: null }],
    }), { limit: 10 });
    expect(items[0].initiative).toBeNull();
  });

  it('pages with before and returns no duplicates', () => {
    const data = input({ humanTasks: [task('t-1', at(20)), task('t-2', at(21)), task('t-3', at(22))] });
    const first = buildTimeline(data, { limit: 2 });
    expect(first.items.map((i) => i.id)).toEqual(['task-done:t-3', 'task-done:t-2']);
    expect(first.nextBefore).toBe(at(21));
    const second = buildTimeline(data, { limit: 2, before: first.nextBefore! });
    expect(second.items.map((i) => i.id)).toEqual(['task-done:t-1']);
    expect(second.nextBefore).toBeNull();
  });

  it('includes meetings, shares, votes, funding and incoming data', () => {
    const { items } = buildTimeline(input({
      meetings: [{ id: 'mt-1', date: at(19), title: 'Planning', summary: 'Venue and dates', decisions: ['Book the hall'], openQuestions: [], actionItems: [{ text: 'Call the venue', owner: null }], transcriptUrl: null }],
      shares: [{ id: 'sh-1', kind: 'idea', description: 'Tool library', linkUrl: null, previewTitle: null, authorName: 'Casey', createdAt: at(18) }],
      proposals: [{ id: 'p-1', title: 'Garden grant', status: 'closed', opensAt: at(10), closesAt: at(17), tally: { yes: 8, no: 1, abstain: 0 }, url: 'https://vote.example.org/p-1' }],
      opportunities: [{ id: 'o-1', sponsor: 'Fund', program: 'Green Spaces', route: 'direct', summary: '', deadline: null, benefit: 'Up to $15,000', effort: null, nextStep: 'Apply', sourceUrl: 'https://fund.example.org', observedAt: at(16), initiativeId: null }],
      sources: [{ id: 's-1', kind: 'document', title: 'One-pager.pdf', origin: 'One-pager.pdf', summary: null, createdAt: at(15) }],
    }), { limit: 10 });
    expect(items.map((i) => [i.kind, i.title])).toEqual([
      ['meeting', 'Planning'],
      ['share', 'Tool library'],
      ['proposal', 'Garden grant'],
      ['funding', 'Green Spaces'],
      ['incoming', 'One-pager.pdf'],
    ]);
    expect(items[0].detail).toBe('1 decision · 1 action item');
    expect(items[2]).toMatchObject({ actor: { kind: 'organization' }, detail: 'Vote closed: 8 yes · 1 no · 0 abstain' });
  });

  it('shows a proposal that is open as opened, at its opening time', () => {
    const { items } = buildTimeline(input({
      proposals: [{ id: 'p-1', title: 'Garden grant', status: 'open', opensAt: at(10), closesAt: at(30), tally: { yes: 0, no: 0, abstain: 0 }, url: 'https://vote.example.org/p-1' }],
    }), { limit: 10 });
    expect(items[0]).toMatchObject({ at: at(10), detail: 'Vote open until Fri, Oct 30' });
  });

  it('names the engine project for agent work outside the initiatives', () => {
    const { items } = buildTimeline(input({
      agentTasks: [{ id: 'a-1', initiativeId: 'g-root', title: 'FUTO Grants', agentName: 'Codex Preprod Beta', project: 'Shared organization knowledge', status: 'blocked', updatedAt: at(21), url: null }],
    }), { limit: 10 });
    expect(items[0]).toMatchObject({ initiative: null, project: 'Shared organization knowledge' });
  });
});

