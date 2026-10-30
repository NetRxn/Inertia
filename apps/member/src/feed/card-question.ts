import type { FeedCard } from './build-feed';
import { DAO_TIME_ZONE } from './week';

const monthDay = new Intl.DateTimeFormat('en-US', { timeZone: DAO_TIME_ZONE, month: 'short', day: 'numeric' });
const monthDayUtc = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });

/** "Oct 21": a bare date stays that calendar day; a timestamp is read in the DAO's time zone. */
function shortDate(date: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? monthDayUtc.format(new Date(date)) : monthDay.format(new Date(date));
}

/** The question the chat sends when a member taps a home feed card. */
export function cardQuestion(card: FeedCard): string {
  switch (card.type) {
    case 'last-meeting':
      return `What happened at the ${shortDate(card.meeting.date)} meeting?`;
    case 'proposals':
      return "What are the open Robert's Rules proposals about?";
    case 'funding':
      return 'Which grants should we go after, and what do members need to decide?';
    case 'priorities':
      return "What's the status of our top priorities?";
    case 'coming-up':
      return "What's coming up in the next two weeks?";
    case 'this-week':
      return 'What got done this week?';
    case 'from-chat':
      return "What's being discussed in the chat?";
    case 'waiting':
      return 'What do I need to do for my tasks?';
    case 'recently-shared':
      return 'What have members shared recently?';
  }
}
