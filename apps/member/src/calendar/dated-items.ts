import { and, desc, eq, gte } from 'drizzle-orm';
import type { Adapters, DaoEvent, FundingOpportunity, HumanTask, Meeting, Proposal } from '../adapters/types';
import type { Db } from '../db/client';
import { orgPassages, orgSources } from '../db/schema';
import { DAO_TIME_ZONE } from '../feed/week';

export type DatedTag = 'Meeting' | 'Deadline' | 'Vote' | 'Funding' | 'Task due' | 'Event' | 'From your data';

export type DatedItem = {
  id: string;
  /** YYYY-MM-DD in the DAO's time zone. */
  date: string;
  title: string;
  tag: DatedTag;
  href: string | null;
};

export type DatedPassage = { sourceId: string; sourceTitle: string; text: string; createdAt: string };

export type DatedInput = {
  events: DaoEvent[];
  meetings: Meeting[];
  proposals: Proposal[];
  opportunities: FundingOpportunity[];
  humanTasks: HumanTask[];
  passages: DatedPassage[];
};

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const MONTH_NAME = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(\d{4})\b)?/gi;
const ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
const US = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
const SNIPPET_MAX = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, '0');

function validDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1) return null;
  const at = new Date(Date.UTC(year, month - 1, day));
  return at.getUTCMonth() === month - 1 ? `${year}-${pad(month)}-${pad(day)}` : null;
}

/** With no year written, the one that puts the date nearest the text's own date. */
function nearestYear(month: number, day: number, reference: Date): number | null {
  const year = reference.getUTCFullYear();
  const candidates = [year - 1, year, year + 1].filter((y) => validDate(y, month, day));
  if (!candidates.length) return null;
  const distance = (y: number) => Math.abs(Date.UTC(y, month - 1, day) - reference.getTime());
  return candidates.reduce((best, y) => (distance(y) < distance(best) ? y : best));
}

function snippet(sentence: string): string {
  const text = sentence.trim().replace(/[.;:!?,\s]+$/, '');
  return text.length <= SNIPPET_MAX ? text : `${text.slice(0, SNIPPET_MAX - 1).trimEnd()}…`;
}

/** Dates written in a text (Nov 14, November 14, 2026, 2026-11-14, 11/14/2026), each with its sentence. */
export function findDatesInText(text: string, reference: Date): { date: string; snippet: string }[] {
  const found: { date: string; snippet: string }[] = [];
  for (const sentence of text.split(/(?<=[.;!?])\s+|\n+/)) {
    const hits: { index: number; date: string }[] = [];
    for (const m of sentence.matchAll(MONTH_NAME)) {
      const month = MONTHS[m[1].slice(0, 3).toLowerCase()];
      const day = Number(m[2]);
      const year = m[3] ? Number(m[3]) : nearestYear(month, day, reference);
      const date = year ? validDate(year, month, day) : null;
      if (date) hits.push({ index: m.index!, date });
    }
    for (const m of sentence.matchAll(ISO)) {
      const date = validDate(Number(m[1]), Number(m[2]), Number(m[3]));
      if (date) hits.push({ index: m.index!, date });
    }
    for (const m of sentence.matchAll(US)) {
      const date = validDate(Number(m[3]), Number(m[1]), Number(m[2]));
      if (date) hits.push({ index: m.index!, date });
    }
    for (const hit of hits.sort((a, b) => a.index - b.index)) found.push({ date: hit.date, snippet: snippet(sentence) });
  }
  return found;
}

const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: DAO_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** A timestamp's day in the DAO's time zone; a bare YYYY-MM-DD stays that day. */
function dayOf(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : dayKey.format(new Date(value));
}

/** Sorts within a day by time; bare dates come first. */
function timeOf(value: string): number {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(`${value}T00:00:00Z`) - DAY_MS : Date.parse(value);
}

const EVENT_TAGS: Record<DaoEvent['kind'], DatedTag> = { meeting: 'Meeting', deadline: 'Deadline', vote: 'Vote', other: 'Event' };

/** Every date the organization's data mentions in one month, tagged by where it came from. */
export function datedItems(data: DatedInput, month: { year: number; month: number }): DatedItem[] {
  const prefix = `${month.year}-${pad(month.month)}-`;
  const items: (DatedItem & { at: number })[] = [];
  const add = (value: string, item: Omit<DatedItem, 'date'>) => {
    const date = dayOf(value);
    if (date.startsWith(prefix)) items.push({ ...item, date, at: timeOf(value) });
  };

  for (const e of data.events) add(e.startsAt, { id: `event:${e.id}`, title: e.title, tag: EVENT_TAGS[e.kind], href: null });
  for (const m of data.meetings) add(m.date, { id: `meeting:${m.id}`, title: m.title, tag: 'Meeting', href: `/org?tab=docs#meeting-${m.id}` });
  for (const p of data.proposals) add(p.closesAt, { id: `vote:${p.id}`, title: `Voting closes: ${p.title}`, tag: 'Vote', href: p.url });
  for (const o of data.opportunities) if (o.deadline) add(o.deadline, { id: `funding:${o.id}`, title: `Due: ${o.program}`, tag: 'Funding', href: `/org?tab=funding#opportunity-${o.id}` });
  for (const t of data.humanTasks) if (t.due && t.status !== 'done') add(t.due, { id: `task:${t.id}`, title: t.title, tag: 'Task due', href: '/#your-work' });

  const seen = new Set<string>();
  for (const passage of data.passages) {
    for (const hit of findDatesInText(passage.text, new Date(passage.createdAt))) {
      const key = `${passage.sourceId}:${hit.date}`;
      if (seen.has(key)) continue;
      seen.add(key);
      add(hit.date, { id: `data:${key}`, title: hit.snippet, tag: 'From your data', href: `/org?tab=data#source-${passage.sourceId}` });
    }
  }

  return items
    .sort((a, b) => a.date.localeCompare(b.date) || a.at - b.at || a.id.localeCompare(b.id))
    .map((item) => ({ id: item.id, date: item.date, title: item.title, tag: item.tag, href: item.href }));
}

const PASSAGE_LIMIT = 3000;
const SOURCE_WINDOW_DAYS = 400;

/** Reads what datedItems needs for the month around `monthStart`. */
export async function loadDatedInput(adapters: Adapters, db: Db, monthStart: Date): Promise<DatedInput> {
  const since = new Date(monthStart.getTime() - SOURCE_WINDOW_DAYS * DAY_MS);
  const [events, meetings, proposals, opportunities, humanTasks, passages] = await Promise.all([
    adapters.events.listUpcoming(new Date(monthStart.getTime() - 7 * DAY_MS), 200),
    adapters.meetings.listMeetings(60),
    adapters.proposals.listProposals(),
    adapters.funding.listOpportunities(),
    adapters.work.listHumanTasks(),
    db
      .select({ sourceId: orgSources.id, sourceTitle: orgSources.title, text: orgPassages.text, createdAt: orgSources.createdAt })
      .from(orgPassages)
      .innerJoin(orgSources, eq(orgSources.id, orgPassages.sourceId))
      .where(and(eq(orgSources.status, 'active'), gte(orgSources.createdAt, since)))
      .orderBy(desc(orgSources.createdAt))
      .limit(PASSAGE_LIMIT),
  ]);
  return { events, meetings, proposals, opportunities, humanTasks, passages: passages.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })) };
}
