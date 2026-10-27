import { and, desc, eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { orgSources } from '../db/schema';
import type { Adapters, FundingApplication, FundingOpportunity, Meeting, WorkSource } from './types';
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
    proposals: { async listProposals() { return []; } },
    events: { async listUpcoming() { return []; } },
    chat: { async listRecentThreads() { return []; }, async search() { return []; } },
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
