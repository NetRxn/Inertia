import { describe, it, expect } from 'vitest';
import { cardQuestion } from '../src/feed/card-question';
import type { FeedCard } from '../src/feed/build-feed';
import type { Meeting } from '../src/adapters';

const meeting: Meeting = {
  id: 'm1',
  date: '2026-10-21',
  title: 'Garden planning',
  summary: '',
  decisions: [],
  openQuestions: [],
  actionItems: [],
  transcriptUrl: null,
};

describe('cardQuestion', () => {
  it('asks about the last meeting by its date', () => {
    expect(cardQuestion({ type: 'last-meeting', meeting })).toBe('What happened at the Oct 21 meeting?');
  });

  it('dates a timestamped meeting in the DAO time zone', () => {
    // 03:00 UTC on Oct 22 is still the evening of Oct 21 in Chicago.
    expect(cardQuestion({ type: 'last-meeting', meeting: { ...meeting, date: '2026-10-22T03:00:00Z' } })).toBe(
      'What happened at the Oct 21 meeting?',
    );
  });

  it('has fixed copy for every other card', () => {
    const cases: [FeedCard, string][] = [
      [{ type: 'proposals', proposals: [] }, "What are the open Robert's Rules proposals about?"],
      [{ type: 'priorities', initiatives: [] }, "What's the status of our top priorities?"],
      [{ type: 'coming-up', events: [] }, "What's coming up in the next two weeks?"],
      [{ type: 'this-week', top: [], openItems: 0 }, 'What got done this week?'],
      [{ type: 'from-chat', threads: [] }, "What's being discussed in the chat?"],
      [{ type: 'waiting', tasks: [] }, 'What do I need to do for my tasks?'],
      [{ type: 'recently-shared', shares: [] }, 'What have members shared recently?'],
    ];
    for (const [card, question] of cases) expect(cardQuestion(card)).toBe(question);
  });
});
