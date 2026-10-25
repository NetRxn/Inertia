import type { FundingApplication, FundingOpportunity, FundingRoute } from '../adapters/types';
import { DAO_TIME_ZONE } from '../feed/week';

const DAY_MS = 24 * 60 * 60 * 1000;
/** How far ahead the home card looks for deadlines. */
const HIGHLIGHT_WINDOW_MS = 30 * DAY_MS;
const HIGHLIGHT_LIMIT = 3;

export const ROUTE_LABELS: Record<FundingRoute, string> = {
  direct: 'Apply directly',
  partner: 'With a partner',
  'next-cycle': 'Next cycle',
  monitor: 'Watching',
  'standing-benefit': 'Standing benefit',
};

/** Routes the DAO can act on now. The rest are for later or ongoing. */
export const ACTIONABLE_ROUTES: FundingRoute[] = ['direct', 'partner'];

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const dayUtc = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
const exact = new Intl.DateTimeFormat('en-US', {
  timeZone: DAO_TIME_ZONE,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/** Links from outside sources render only when they're http(s). */
export function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/**
 * When a deadline passes, in ms. A date-only deadline counts as open through
 * that whole day anywhere in the US, so it's taken as the end of the next UTC day.
 */
export function deadlineTime(deadline: string | null): number | null {
  if (!deadline) return null;
  return DATE_ONLY.test(deadline) ? new Date(deadline).getTime() + 2 * DAY_MS - 1 : new Date(deadline).getTime();
}

/** "Due Nov 6" when only the day is known, the exact cutoff in the DAO's time zone otherwise. */
export function deadlineLabel(deadline: string | null): string {
  if (!deadline) return 'No fixed deadline';
  return `Due ${DATE_ONLY.test(deadline) ? dayUtc.format(new Date(deadline)) : exact.format(new Date(deadline))}`;
}

export type FundingHighlights = { opportunities: FundingOpportunity[]; applications: FundingApplication[] };

/**
 * What the home card shows: the next few open deadlines the DAO can act on,
 * and applications waiting on members. Null when there's neither.
 */
export function fundingHighlights(
  opportunities: FundingOpportunity[],
  applications: FundingApplication[],
  now: Date,
): FundingHighlights | null {
  const nowMs = now.getTime();
  const soon = opportunities
    .filter((o) => ACTIONABLE_ROUTES.includes(o.route))
    .map((o) => ({ o, due: deadlineTime(o.deadline) }))
    .filter((x): x is { o: FundingOpportunity; due: number } => x.due !== null && x.due >= nowMs && x.due <= nowMs + HIGHLIGHT_WINDOW_MS)
    .sort((a, b) => a.due - b.due)
    .slice(0, HIGHLIGHT_LIMIT)
    .map((x) => x.o);
  const waiting = applications.filter((a) => a.stage === 'needs-members' && a.decisionsNeeded.length > 0);
  return soon.length + waiting.length > 0 ? { opportunities: soon, applications: waiting } : null;
}
