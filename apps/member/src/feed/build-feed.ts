import type {
  Adapters,
  ChatThread,
  DaoEvent,
  FundingApplication,
  FundingOpportunity,
  HumanTask,
  Initiative,
  Meeting,
  Proposal,
} from '../adapters/types';
import { fundingHighlights } from '../funding/funding';
import type { Member } from '../identity/session';
import { byPriority } from '../work/initiatives';
import { weekBounds } from './week';

/**
 * A member's post, as the home feed shows it. Task 7 fills these from the
 * shares table; the Task 7 fields are additive so Task 5 consumers keep working.
 */
export type ShareSummary = {
  id: string;
  kind: 'idea' | 'resource' | 'event' | 'update';
  description: string;
  linkUrl: string | null;
  previewTitle: string | null;
  authorName: string;
  createdAt: string;
  /** Task 7 additions (all optional). */
  authorExternalId?: string;
  isMine?: boolean;
  previewDescription?: string | null;
  previewImageUrl?: string | null;
  fileId?: string | null;
  fileName?: string | null;
};

export type FeedCard =
  | { type: 'waiting'; tasks: HumanTask[] }
  | { type: 'priorities'; initiatives: Initiative[] }
  | { type: 'coming-up'; events: DaoEvent[] }
  | { type: 'proposals'; proposals: Proposal[] }
  | { type: 'funding'; opportunities: FundingOpportunity[]; applications: FundingApplication[] }
  | { type: 'last-meeting'; meeting: Meeting }
  | { type: 'this-week'; top: { displayName: string; count: number }[]; openItems: number }
  | { type: 'from-chat'; threads: { thread: ChatThread; line: string }[] }
  | { type: 'recently-shared'; shares: ShareSummary[] };

const DAY_MS = 24 * 60 * 60 * 1000;
const CHAT_LINE_MAX = 120;

const time = (iso: string) => new Date(iso).getTime();

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Builds the member's home feed. Cards come back in the fixed home order;
 * `waiting` is always present, and any other card without data is left out.
 */
export async function buildFeed(
  adapters: Adapters,
  member: Member,
  shares: ShareSummary[],
  now: Date,
): Promise<FeedCard[]> {
  const nowMs = now.getTime();
  const week = weekBounds(now);
  const chatSince = new Date(nowMs - 7 * DAY_MS);

  const [tasks, initiatives, events, proposals, meetings, completions, directory, threads, opportunities, applications] =
    await Promise.all([
      adapters.work.listHumanTasks(),
      adapters.work.listInitiatives(),
      adapters.events.listUpcoming(now, 4),
      adapters.proposals.listProposals(),
      adapters.meetings.listMeetings(1),
      adapters.work.completionsBetween(week.from, week.to),
      adapters.directory.listMembers(),
      adapters.chat.listRecentThreads(chatSince),
      adapters.funding.listOpportunities(),
      adapters.funding.listApplications(),
    ]);

  const cards: FeedCard[] = [];

  cards.push({
    type: 'waiting',
    tasks: tasks.filter((t) => t.status === 'claimed' && t.claimedBy === member.externalId),
  });

  const priorities = initiatives
    .filter((i) => i.status === 'active')
    .sort(byPriority)
    .slice(0, 3);
  if (priorities.length > 0) cards.push({ type: 'priorities', initiatives: priorities });

  const comingUp = events.filter((e) => time(e.startsAt) < nowMs + 14 * DAY_MS);
  if (comingUp.length > 0) cards.push({ type: 'coming-up', events: comingUp });

  const open = proposals.filter((p) => p.status === 'open').sort((a, b) => time(a.closesAt) - time(b.closesAt));
  const recentlyClosed = proposals
    .filter((p) => p.status === 'closed' && time(p.closesAt) >= nowMs - 7 * DAY_MS)
    .sort((a, b) => time(b.closesAt) - time(a.closesAt));
  if (open.length + recentlyClosed.length > 0) {
    cards.push({ type: 'proposals', proposals: [...open, ...recentlyClosed] });
  }

  const funding = fundingHighlights(opportunities, applications, now);
  if (funding) cards.push({ type: 'funding', ...funding });

  // Meeting sources list newest first.
  const [lastMeeting] = meetings;
  if (lastMeeting) cards.push({ type: 'last-meeting', meeting: lastMeeting });

  const names = new Map(directory.map((m) => [m.externalId, m.displayName]));
  const top = completions
    .filter((c) => c.count > 0 && names.has(c.memberExternalId))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((c) => ({ displayName: names.get(c.memberExternalId)!, count: c.count }));
  const openItems = tasks.filter((t) => t.status === 'open').length;
  if (top.length > 0 || openItems > 0) cards.push({ type: 'this-week', top, openItems });

  const recentCount = (thread: ChatThread) => thread.messages.filter((m) => time(m.at) >= chatSince.getTime()).length;
  const lastAt = (thread: ChatThread) => Math.max(...thread.messages.map((m) => time(m.at)));
  const busiest = threads
    .filter((thread) => recentCount(thread) > 0)
    .sort((a, b) => recentCount(b) - recentCount(a) || lastAt(b) - lastAt(a))
    .slice(0, 3)
    .map((thread) => {
      const latest = thread.messages.reduce((a, b) => (time(b.at) > time(a.at) ? b : a));
      return { thread, line: thread.summary || truncate(latest.text, CHAT_LINE_MAX) };
    });
  if (busiest.length > 0) cards.push({ type: 'from-chat', threads: busiest });

  const newestShares = [...shares].sort((a, b) => time(b.createdAt) - time(a.createdAt)).slice(0, 3);
  if (newestShares.length > 0) cards.push({ type: 'recently-shared', shares: newestShares });

  return cards;
}
