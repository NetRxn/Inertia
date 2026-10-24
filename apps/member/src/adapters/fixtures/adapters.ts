import type {
  Adapters,
  DirectoryMember,
  MemberDirectory,
  Proposal,
  ProposalSource,
  Initiative,
  HumanTask,
  ClaimResult,
  WorkSource,
  Meeting,
  MeetingSource,
  ChatThread,
  ChatSource,
  DaoEvent,
  EventSource,
} from '../types.js';
import type { FixtureData } from './dao.js';
import { defaultFixture } from './dao.js';

/**
 * Creates in-memory fixture adapters from the given data.
 * The adapters mutate the data for operations like claim().
 */
export function createFixtureAdapters(data?: FixtureData): Adapters {
  const fixtureData = data || defaultFixture();

  // Member directory adapter
  const directory: MemberDirectory = {
    async listMembers(): Promise<DirectoryMember[]> {
      return [...fixtureData.members];
    },
  };

  // Proposal source adapter
  const proposals: ProposalSource = {
    async listProposals(): Promise<Proposal[]> {
      return [...fixtureData.proposals];
    },
  };

  // Work source adapter
  const work: WorkSource = {
    async listInitiatives(): Promise<Initiative[]> {
      return [...fixtureData.initiatives];
    },

    async listHumanTasks(): Promise<HumanTask[]> {
      return [...fixtureData.tasks];
    },

    async completionsBetween(from: Date, to: Date): Promise<{ memberExternalId: string; count: number }[]> {
      const counts = new Map<string, number>();

      for (const task of fixtureData.tasks) {
        if (task.status === 'done' && task.completedAt && task.completedBy) {
          const completedAt = new Date(task.completedAt);
          if (completedAt >= from && completedAt < to) {
            counts.set(
              task.completedBy,
              (counts.get(task.completedBy) || 0) + 1
            );
          }
        }
      }

      return Array.from(counts.entries()).map(([memberExternalId, count]) => ({
        memberExternalId,
        count,
      }));
    },

    async claim(taskId: string, memberExternalId: string): Promise<ClaimResult> {
      const task = fixtureData.tasks.find(t => t.id === taskId);

      if (!task) {
        return { ok: false, reason: 'not-found' };
      }

      if (task.status === 'claimed' || task.status === 'done') {
        return { ok: false, reason: 'already-claimed' };
      }

      // Mutate the task to mark it as claimed
      task.status = 'claimed';
      task.claimedBy = memberExternalId;

      return { ok: true };
    },
  };

  // Meeting source adapter
  const meetings: MeetingSource = {
    async listMeetings(limit: number): Promise<Meeting[]> {
      return fixtureData.meetings.slice(0, limit);
    },

    async getMeeting(id: string): Promise<Meeting | null> {
      return fixtureData.meetings.find(m => m.id === id) || null;
    },

    async search(query: string): Promise<Meeting[]> {
      const lowerQuery = query.toLowerCase();
      return fixtureData.meetings.filter(meeting => {
        // Search in title, summary, decisions, and open questions
        return (
          meeting.title.toLowerCase().includes(lowerQuery) ||
          meeting.summary.toLowerCase().includes(lowerQuery) ||
          meeting.decisions.some(d => d.toLowerCase().includes(lowerQuery)) ||
          meeting.openQuestions.some(q => q.toLowerCase().includes(lowerQuery))
        );
      });
    },
  };

  // Chat source adapter
  const chat: ChatSource = {
    async listRecentThreads(since: Date): Promise<ChatThread[]> {
      return fixtureData.chatThreads.filter(thread => {
        // Check if any message is after 'since'
        return thread.messages.some(msg => new Date(msg.at) >= since);
      });
    },

    async search(query: string): Promise<ChatThread[]> {
      const lowerQuery = query.toLowerCase();
      return fixtureData.chatThreads.filter(thread => {
        // Search in title, summary, and message text
        return (
          thread.title.toLowerCase().includes(lowerQuery) ||
          thread.summary?.toLowerCase().includes(lowerQuery) ||
          thread.messages.some(m => m.text.toLowerCase().includes(lowerQuery))
        );
      });
    },
  };

  // Event source adapter
  const events: EventSource = {
    async listUpcoming(from: Date, limit: number): Promise<DaoEvent[]> {
      return fixtureData.events
        .filter(event => new Date(event.startsAt) >= from)
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
        .slice(0, limit);
    },
  };

  return {
    directory,
    proposals,
    work,
    meetings,
    chat,
    events,
  };
}
