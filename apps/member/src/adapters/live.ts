import { and, desc, eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { orgSources } from '../db/schema';
import type { Adapters, ChatThread, FundingApplication, FundingOpportunity, Meeting, WorkSource } from './types';
import { readFileSync } from 'fs';

/** A meeting as Inertia knows it: an uploaded transcript or notes. */
function toMeeting(row: { id: string; title: string; summary: string | null; content: string; createdAt: Date }): Meeting {
  return {
    id: row.id,
    date: row.createdAt.toISOString(),
    title: row.title,
    summary: row.summary ?? `${row.content.slice(0, 400).trim()}${row.content.length > 400 ? '…' : ''}`,
    decisions: [],
    openQuestions: [],
    actionItems: [],
    transcriptUrl: null,
  };
}

const LINE = /^\[(?:(\d{4}-\d{2}-\d{2}) )?(\d{2}:\d{2})\] ([^:]{1,80}): (.*)$/;

/**
 * A chat digest from a connector or an uploaded export, as a thread:
 * "[12:30] Rob: text" lines, dated from the digest title when it has one.
 */
export function toThread(row: { id: string; title: string; content: string; createdAt: Date }): ChatThread {
  const day = row.title.match(/(\d{4}-\d{2}-\d{2})\s*$/)?.[1] ?? row.createdAt.toISOString().slice(0, 10);
  const channel = row.title.includes(':') ? row.title.split(':')[0].trim() : 'Chat';
  const messages = row.content.split('\n').flatMap((line, i) => {
    const m = line.match(LINE);
    return m ? [{ id: `${row.id}:${i}`, author: m[3], text: m[4], at: new Date(`${m[1] ?? day}T${m[2]}:00Z`).toISOString() }] : [];
  });
  return { id: row.id, channel, title: row.title, summary: null, messages };
}

const chatColumns = { id: orgSources.id, title: orgSources.title, content: orgSources.content, createdAt: orgSources.createdAt };
const visibleChats = and(eq(orgSources.kind, 'chat-export'), eq(orgSources.status, 'active'));

const meetingColumns = { id: orgSources.id, title: orgSources.title, summary: orgSources.summary, content: orgSources.content, createdAt: orgSources.createdAt };
const visibleMeetings = and(eq(orgSources.kind, 'meeting'), eq(orgSources.status, 'active'));

/**
 * Funding opportunities exported by the grant finder, read from a JSON file
 * ({ opportunities: [...], applications: [...] }) until its live feed is connected.
 */
function readFundingFile(path: string | undefined): { opportunities: FundingOpportunity[]; applications: FundingApplication[] } {
  if (!path) return { opportunities: [], applications: [] };
  try {
    const data = JSON.parse(readFileSync(path, 'utf8')) as { opportunities?: FundingOpportunity[]; applications?: FundingApplication[] };
    return { opportunities: data.opportunities ?? [], applications: data.applications ?? [] };
  } catch (error) {
    console.error('[funding] Could not read MEMBER_APP_FUNDING_FILE:', error);
    return { opportunities: [], applications: [] };
  }
}

/**
 * Adapters for a real organization: members are managed in the app, meetings
 * come from what people uploaded, work runs in the given engine, and sources
 * that aren't connected yet are simply empty.
 */
export function createLiveAdapters(work: WorkSource, env: Record<string, string | undefined> = process.env): Adapters {
  return {
    // Members are added in the app; there is no outside directory to sync yet.
    directory: { async listMembers() { return []; } },
    // Placeholder until Robert's Rules (Vocdoni) is connected.
    proposals: { connected: false, async listProposals() { return []; } },
    events: { async listUpcoming() { return []; } },
    // Chat comes from digests the connectors (Telegram, Buzz) deliver, and from uploaded exports.
    chat: {
      async listRecentThreads(since) {
        const rows = await getDb().select(chatColumns).from(orgSources).where(and(visibleChats, sql`${orgSources.createdAt} >= ${since.toISOString()}`)).orderBy(desc(orgSources.createdAt)).limit(20);
        return rows.map(toThread).filter((t) => t.messages.length);
      },
      async search(query) {
        const q = query.trim();
        if (!q) return [];
        const rows = await getDb()
          .select(chatColumns)
          .from(orgSources)
          .where(and(visibleChats, sql`(${orgSources.title} ilike ${`%${q}%`} or to_tsvector('english', ${orgSources.content}) @@ websearch_to_tsquery('english', ${q}))`))
          .orderBy(desc(orgSources.createdAt))
          .limit(8);
        return rows.map(toThread);
      },
    },
    work,
    meetings: {
      async listMeetings(limit) {
        const rows = await getDb().select(meetingColumns).from(orgSources).where(visibleMeetings).orderBy(desc(orgSources.createdAt)).limit(limit);
        return rows.map(toMeeting);
      },
      async getMeeting(id) {
        const [row] = await getDb().select(meetingColumns).from(orgSources).where(and(visibleMeetings, eq(orgSources.id, id)));
        return row ? toMeeting(row) : null;
      },
      async search(query) {
        const q = query.trim();
        if (!q) return [];
        const rows = await getDb()
          .select(meetingColumns)
          .from(orgSources)
          .where(and(visibleMeetings, sql`(${orgSources.title} ilike ${`%${q}%`} or to_tsvector('english', ${orgSources.content}) @@ websearch_to_tsquery('english', ${q}))`))
          .orderBy(desc(orgSources.createdAt))
          .limit(8);
        return rows.map(toMeeting);
      },
    },
    funding: {
      async listOpportunities() { return readFundingFile(env.MEMBER_APP_FUNDING_FILE).opportunities; },
      async listApplications() { return readFundingFile(env.MEMBER_APP_FUNDING_FILE).applications; },
    },
  };
}
