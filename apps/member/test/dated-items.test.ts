import { describe, it, expect } from 'vitest';
import { datedItems, findDatesInText, type DatedInput } from '../src/calendar/dated-items';

const REF = new Date('2026-10-27T15:00:00Z');

function input(change: Partial<DatedInput> = {}): DatedInput {
  return { events: [], meetings: [], proposals: [], opportunities: [], humanTasks: [], passages: [], ...change };
}

describe('findDatesInText', () => {
  it('finds month-name, ISO and US dates with the sentence around them', () => {
    const found = findDatesInText('Decisions: move garden build day to Nov 14. Grant due 2026-12-01; board call on 1/8/2027.', REF);
    expect(found).toEqual([
      { date: '2026-11-14', snippet: 'Decisions: move garden build day to Nov 14' },
      { date: '2026-12-01', snippet: 'Grant due 2026-12-01' },
      { date: '2027-01-08', snippet: 'board call on 1/8/2027' },
    ]);
  });

  it('picks the year nearest the source when none is given', () => {
    expect(findDatesInText('Kickoff on January 5th', REF)).toEqual([{ date: '2027-01-05', snippet: 'Kickoff on January 5th' }]);
    expect(findDatesInText('We met on September 30', REF)).toEqual([{ date: '2026-09-30', snippet: 'We met on September 30' }]);
  });

  it('ignores impossible dates and words that only look like months', () => {
    expect(findDatesInText('Feb 31 is not a day. May we meet? 13/45/2026 neither.', REF)).toEqual([]);
  });
});

describe('datedItems', () => {
  it('collects dates from every source for one month, tagged', () => {
    const items = datedItems(input({
      events: [{ id: 'e-1', title: 'Monthly governance meeting', startsAt: '2026-11-03T00:30:00Z', detail: '', kind: 'meeting' }],
      proposals: [{ id: 'p-1', title: 'Garden grant', status: 'open', opensAt: '2026-10-20T00:00:00Z', closesAt: '2026-11-02T18:00:00Z', tally: { yes: 0, no: 0, abstain: 0 }, url: 'https://vote.example.org/p-1' }],
      opportunities: [{ id: 'o-1', sponsor: 'Fund', program: 'Green Spaces', route: 'direct', summary: '', deadline: '2026-11-16', benefit: null, effort: null, nextStep: '', sourceUrl: 'https://fund.example.org', observedAt: '2026-10-01T00:00:00Z', initiativeId: null }],
      humanTasks: [{ id: 't-1', initiativeId: 'g', title: 'Design signage', estimateMinutes: null, due: '2026-11-05T17:00:00Z', prepared: '', status: 'open', claimedBy: null, completedBy: null, completedAt: null }],
      passages: [{ sourceId: 's-1', sourceTitle: 'Roundtable notes', text: 'Move garden build day to Nov 14.', createdAt: REF.toISOString() }],
    }), { year: 2026, month: 11 });
    expect(items.map((i) => [i.date, i.tag, i.title])).toEqual([
      ['2026-11-02', 'Vote', 'Voting closes: Garden grant'],
      // 00:30 UTC on Nov 3 is still Nov 2 in the DAO's time zone.
      ['2026-11-02', 'Meeting', 'Monthly governance meeting'],
      ['2026-11-05', 'Task due', 'Design signage'],
      ['2026-11-14', 'From your data', 'Move garden build day to Nov 14'],
      ['2026-11-16', 'Funding', 'Due: Green Spaces'],
    ]);
  });

  it('does not shift a date-only deadline by time zone', () => {
    const items = datedItems(input({
      opportunities: [{ id: 'o-1', sponsor: 'Fund', program: 'Green Spaces', route: 'direct', summary: '', deadline: '2026-11-01', benefit: null, effort: null, nextStep: '', sourceUrl: 'https://fund.example.org', observedAt: '2026-10-01T00:00:00Z', initiativeId: null }],
    }), { year: 2026, month: 11 });
    expect(items.map((i) => i.date)).toEqual(['2026-11-01']);
  });

  it('leaves out other months and repeats of the same date from one source', () => {
    const items = datedItems(input({
      passages: [
        { sourceId: 's-1', sourceTitle: 'Notes', text: 'Build day Nov 14. Again: Nov 14. Party Dec 1.', createdAt: REF.toISOString() },
      ],
    }), { year: 2026, month: 11 });
    expect(items.map((i) => i.date)).toEqual(['2026-11-14']);
  });
});
