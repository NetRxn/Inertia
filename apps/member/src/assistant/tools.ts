import { tool } from 'ai';
import { z } from 'zod';
import type { Adapters, ChatThread, HumanTask, Initiative, Meeting, Proposal, SourceRef } from '../adapters/types';
import type { Db } from '../db/client';
import type { ShareSummary } from '../feed/build-feed';
import { getDocument, saveDocument, type Document } from '../documents/documents';
import { listShares } from '../shares/shares';
import { wrapSourceDataCapped } from './source-data';

/** At most this many blocks per tool call, each at most this long (tags included). */
export const MAX_RESULTS = 8;
export const MAX_BLOCK_CHARS = 4000;

/** How many recent shares searchShares looks through. */
const SHARE_SEARCH_WINDOW = 200;

type Source = { ref: SourceRef; text: string };

export type AssistantContext = { adapters: Adapters; db: Db; memberId: string };

function ref(kind: SourceRef['kind'], id: string, title: string, url?: string | null): SourceRef {
  return url ? { kind, id, title, url } : { kind, id, title };
}

function lines(label: string, items: string[]): string[] {
  return items.length ? [`${label}:`, ...items.map((item) => `- ${item}`)] : [];
}

function meetingSource(meeting: Meeting): Source {
  return {
    ref: ref('meeting', meeting.id, meeting.title, meeting.transcriptUrl),
    text: [
      `Date: ${meeting.date}`,
      `Summary: ${meeting.summary}`,
      ...lines('Decisions', meeting.decisions),
      ...lines('Open questions', meeting.openQuestions),
      ...lines(
        'Action items',
        meeting.actionItems.map((item) => (item.owner ? `${item.text} (${item.owner})` : item.text)),
      ),
    ].join('\n'),
  };
}

function proposalSource(proposal: Proposal): Source {
  const { yes, no, abstain } = proposal.tally;
  return {
    ref: ref('proposal', proposal.id, proposal.title, proposal.url),
    text: [
      `Status: ${proposal.status}`,
      `Opens: ${proposal.opensAt}`,
      `Closes: ${proposal.closesAt}`,
      `Tally: ${yes} yes, ${no} no, ${abstain} abstain`,
      `Vote in Robert's Rules: ${proposal.url}`,
    ].join('\n'),
  };
}

function initiativeSource(initiative: Initiative): Source {
  return {
    ref: ref('initiative', initiative.id, initiative.title),
    text: [
      `Status: ${initiative.status} (${initiative.statusLabel})`,
      `Progress: ${Math.round(initiative.progress * 100)}%`,
      `Priority: ${initiative.priority} (lower is more important)`,
    ].join('\n'),
  };
}

/** Who claimed a task stays out: the assistant only says whether a person is still needed. */
function taskSource(task: HumanTask, initiativeTitle: string | undefined): Source {
  return {
    ref: ref('task', task.id, task.title),
    text: [
      `Initiative: ${initiativeTitle ?? 'unknown'}`,
      `Status: ${task.status === 'open' ? 'open, needs a person' : task.status}`,
      `Kind: ${task.kind}`,
      task.estimateMinutes != null ? `Rough time: ${task.estimateMinutes} minutes` : null,
      task.due ? `Due: ${task.due}` : null,
      `Already prepared: ${task.prepared}`,
    ]
      .filter((line): line is string => line !== null)
      .join('\n'),
  };
}

function chatSource(thread: ChatThread): Source {
  return {
    ref: ref('chat', thread.id, thread.title),
    text: [
      `Channel: ${thread.channel}`,
      thread.summary ? `Summary: ${thread.summary}` : null,
      ...thread.messages.map((message) => `${message.author} (${message.at}): ${message.text}`),
    ]
      .filter((line): line is string => line !== null)
      .join('\n'),
  };
}

function shareSource(share: ShareSummary): Source {
  return {
    ref: ref('share', share.id, `${share.authorName}'s ${share.kind}`, share.linkUrl),
    text: [
      `Shared by ${share.authorName} on ${share.createdAt}`,
      share.description ? `Description: ${share.description}` : null,
      share.linkUrl ? `Link: ${share.previewTitle ? `${share.previewTitle} — ` : ''}${share.linkUrl}` : null,
      share.fileName ? `Attachment: ${share.fileName}` : null,
    ]
      .filter((line): line is string => line !== null)
      .join('\n'),
  };
}

function documentSource(doc: Document): Source {
  return { ref: ref('document', doc.id, doc.title), text: doc.content };
}

/** True when every word of the query appears in the text, ignoring case. */
function matches(text: string, query: string): boolean {
  const haystack = text.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

const query = z.object({ query: z.string().min(1).max(200).describe('Words to look for') });

/**
 * The assistant's tool set. Read tools return delimited <source> blocks and
 * report what they read through `collect`, so the server, not the model,
 * records citations. draftDocument is the only tool that writes, and only to
 * the calling member's own documents.
 */
export function createAssistantTools(ctx: AssistantContext, collect: (refs: SourceRef[]) => void) {
  // Everything read through this tool set, once each: a draft cites what it drew on.
  const read = new Map<string, SourceRef>();

  function results(sources: Source[]): { results: string[] } {
    const kept = sources.slice(0, MAX_RESULTS);
    for (const { ref } of kept) read.set(`${ref.kind}:${ref.id}`, ref);
    collect(kept.map((source) => source.ref));
    return { results: kept.map((source) => wrapSourceDataCapped(source.ref, source.text, MAX_BLOCK_CHARS)) };
  }

  return {
    searchMeetings: tool({
      description: 'Search meeting summaries, decisions, open questions and action items.',
      inputSchema: query,
      execute: async ({ query }) => results((await ctx.adapters.meetings.search(query)).map(meetingSource)),
    }),

    listProposals: tool({
      description: "List Robert's Rules proposals with their status and tally. Read-only; members vote in Robert's Rules.",
      inputSchema: z.object({}),
      execute: async () => results((await ctx.adapters.proposals.listProposals()).map(proposalSource)),
    }),

    listWork: tool({
      description: 'List initiatives and the tasks that need a person, most important first.',
      inputSchema: z.object({}),
      execute: async () => {
        const [initiatives, tasks] = await Promise.all([
          ctx.adapters.work.listInitiatives(),
          ctx.adapters.work.listHumanTasks(),
        ]);
        const byPriority = [...initiatives].sort((a, b) => a.priority - b.priority);
        const titles = new Map(initiatives.map((initiative) => [initiative.id, initiative.title]));
        const open = tasks.filter((task) => task.status === 'open');
        return results([
          ...open.map((task) => taskSource(task, titles.get(task.initiativeId))),
          ...byPriority.map(initiativeSource),
        ]);
      },
    }),

    searchChat: tool({
      description: 'Search chat threads by title, summary and messages.',
      inputSchema: query,
      execute: async ({ query }) => results((await ctx.adapters.chat.search(query)).map(chatSource)),
    }),

    searchShares: tool({
      description: 'Search what members have shared: ideas, resources, events and updates.',
      inputSchema: query,
      execute: async ({ query }) => {
        const shares = await listShares(ctx.db, { limit: SHARE_SEARCH_WINDOW });
        return results(
          shares
            .filter((share) =>
              matches([share.description, share.previewTitle, share.linkUrl, share.fileName].filter(Boolean).join(' '), query),
            )
            .map(shareSource),
        );
      },
    }),

    getDocument: tool({
      description: "Read one of this member's own documents by id.",
      inputSchema: z.object({ id: z.string().describe('The document id') }),
      execute: async ({ id }) => {
        const doc = await getDocument(ctx.db, ctx.memberId, id);
        return results(doc ? [documentSource(doc)] : []);
      },
    }),

    draftDocument: tool({
      description:
        "Save a draft document to this member's private Docs. Only use this when the member asks for a document.",
      inputSchema: z.object({
        title: z.string().min(1).max(200),
        body: z.string().min(1).max(50_000),
      }),
      execute: async ({ title, body }) => {
        const { id } = await saveDocument(ctx.db, ctx.memberId, { title, body, sources: [...read.values()] });
        collect([ref('document', id, title)]);
        return { documentId: id };
      },
    }),
  };
}
