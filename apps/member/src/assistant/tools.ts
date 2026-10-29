import { tool } from 'ai';
import { z } from 'zod';
import type {
  Adapters,
  ChatThread,
  FundingApplication,
  FundingOpportunity,
  HumanTask,
  Initiative,
  Meeting,
  Proposal,
  SourceRef,
} from '../adapters/types';
import { routeLabel, safeHttpUrl } from '../funding/funding';
import type { Db } from '../db/client';
import { members } from '../db/schema';
import type { ShareSummary } from '../feed/build-feed';
import { getDocument, saveDocument, type Document } from '../documents/documents';
import { listShares } from '../shares/shares';
import { byPriority, taskKind } from '../work/initiatives';
import { wrapSourceDataCapped } from './source-data';
import { searchPassages } from '../org/ingest';
import { getOrganization } from '../org/organization';
import { listOrgInitiatives } from '../work/org-initiatives';

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

/** Turns a member external id into the name people know them by. */
type NameOf = (externalId: string) => string;

/** Display names by external id, so no member id ever reaches the model. */
async function memberNames(db: Db): Promise<NameOf> {
  const rows = await db.select({ externalId: members.externalId, displayName: members.displayName }).from(members);
  const names = new Map(rows.map((row) => [row.externalId, row.displayName]));
  return (externalId) => names.get(externalId) ?? 'a member';
}

function meetingSource(meeting: Meeting, nameOf: NameOf): Source {
  return {
    ref: ref('meeting', meeting.id, meeting.title, meeting.transcriptUrl),
    text: [
      `Date: ${meeting.date}`,
      `Summary: ${meeting.summary}`,
      ...lines('Decisions', meeting.decisions),
      ...lines('Open questions', meeting.openQuestions),
      ...lines(
        'Action items',
        meeting.actionItems.map((item) => (item.owner ? `${item.text} (${nameOf(item.owner)})` : item.text)),
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
      initiative.statusLabel ? `Status: ${initiative.status} (${initiative.statusLabel})` : `Status: ${initiative.status}`,
      initiative.progress != null ? `Progress: ${Math.round(initiative.progress * 100)}%` : null,
      initiative.priority != null ? `Priority: ${initiative.priority} (lower is more important)` : null,
    ]
      .filter((line): line is string => line !== null)
      .join('\n'),
  };
}

/** Who claimed a task stays out: the assistant only says whether a person is still needed. */
function taskSource(task: HumanTask, initiativeTitle: string | undefined): Source {
  return {
    ref: ref('task', task.id, task.title),
    text: [
      `Initiative: ${initiativeTitle ?? 'unknown'}`,
      `Status: ${task.status === 'open' ? 'open, needs a person' : task.status}`,
      `Kind: ${taskKind(task)}`,
      task.estimateMinutes != null ? `Rough time: ${task.estimateMinutes} minutes` : null,
      task.due ? `Due: ${task.due}` : null,
      `Already prepared: ${task.prepared}`,
    ]
      .filter((line): line is string => line !== null)
      .join('\n'),
  };
}

function opportunitySource(opportunity: FundingOpportunity): Source {
  return {
    ref: ref('opportunity', opportunity.id, opportunity.program, safeHttpUrl(opportunity.sourceUrl)),
    text: [
      opportunity.sponsor ? `Sponsor: ${opportunity.sponsor}` : null,
      `Route: ${routeLabel(opportunity.route)}`,
      opportunity.summary ? `Summary: ${opportunity.summary}` : null,
      `Deadline: ${opportunity.deadline ?? 'none published'}`,
      opportunity.benefit ? `Benefit: ${opportunity.benefit}` : null,
      opportunity.effort ? `Effort: ${opportunity.effort}` : null,
      opportunity.nextStep ? `Next step: ${opportunity.nextStep}` : null,
      `Checked at the official source: ${opportunity.observedAt}`,
    ]
      .filter((line): line is string => line !== null)
      .join('\n'),
  };
}

/** Applications come first in listFunding: they're what members can act on. */
function applicationSource(application: FundingApplication, program: string | undefined): Source {
  return {
    ref: ref('application', application.id, application.title),
    text: [
      `For: ${program ?? 'an opportunity no longer listed'}`,
      `Stage: ${application.stage}`,
      application.readiness
        ? `Readiness: ${application.readiness.answered} of ${application.readiness.total} requirements answered`
        : null,
      ...application.decisionsNeeded.map((d) => `Decision needed: ${d.question} (blocks ${d.blocks})`),
      application.submittedAt ? `Submitted: ${application.submittedAt}` : null,
    ]
      .filter((line): line is string => line !== null)
      .join('\n'),
  };
}

function chatSource(thread: ChatThread, nameOf: NameOf): Source {
  return {
    ref: ref('chat', thread.id, thread.title),
    text: [
      `Channel: ${thread.channel}`,
      thread.summary ? `Summary: ${thread.summary}` : null,
      ...thread.messages.map((message) => `${nameOf(message.author)} (${message.at}): ${message.text}`),
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
    searchOrganization: tool({
      description:
        "Search everything the organization has shared with Inertia: its website, meeting transcripts and notes, documents, chat exports and notes. Use this first for questions about the organization, its people, programs and history.",
      inputSchema: z.object({ query: z.string().min(1).max(200).describe('Words to look for') }),
      execute: async ({ query }) => {
        const hits = await searchPassages(ctx.db, query, MAX_RESULTS);
        return results(hits.map((hit) => ({ ref: ref('source', hit.sourceId, hit.title), text: `(${hit.location})\n${hit.text}` })));
      },
    }),

    getOrganizationProfile: tool({
      description: "The organization's profile: mission, initiatives (and whether each is active or still proposed), programs, people and recent activity.",
      inputSchema: z.object({}),
      execute: async () => {
        const org = await getOrganization(ctx.db);
        const profile = org?.profile;
        if (!org || !profile) return results([]);
        const kept = profile.initiatives.filter((i) => i.status === 'accepted');
        const text = [
          `Name: ${org.name}`,
          org.website ? `Website: ${org.website}` : null,
          profile.mission ? `Mission: ${profile.mission.text}` : null,
          ...lines('Initiatives', kept.map((i) => `${i.title}${i.adopted ? '' : ' (proposed, awaiting a vote)'}: ${i.summary}`)),
          ...lines('Programs', profile.programs.map((l) => l.text)),
          ...lines('People', profile.people.map((l) => l.text)),
          ...lines('Recently', profile.recent.map((l) => l.text)),
        ].filter((l): l is string => l !== null).join('\n');
        return results([{ ref: ref('initiative', 'profile', `${org.name} profile`), text }]);
      },
    }),

    searchMeetings: tool({
      description:
        'Search meeting summaries, decisions, open questions and action items. Leave the query empty for the most recent meetings.',
      inputSchema: z.object({ query: z.string().max(200).describe('Words to look for, or empty for the latest') }),
      execute: async ({ query }) => {
        const meetings = query.trim()
          ? await ctx.adapters.meetings.search(query)
          : await ctx.adapters.meetings.listMeetings(MAX_RESULTS);
        const nameOf = await memberNames(ctx.db);
        return results(meetings.map((meeting) => meetingSource(meeting, nameOf)));
      },
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
          listOrgInitiatives(ctx.db, ctx.adapters.work),
          ctx.adapters.work.listHumanTasks(),
        ]);
        const ranked = [...initiatives].sort(byPriority);
        const titles = new Map(initiatives.map((initiative) => [initiative.id, initiative.title]));
        const open = tasks.filter((task) => task.status === 'open');
        return results([
          ...open.map((task) => taskSource(task, titles.get(task.initiativeId))),
          ...ranked.map(initiativeSource),
        ]);
      },
    }),

    searchChat: tool({
      description: 'Search chat threads by title, summary and messages.',
      inputSchema: query,
      execute: async ({ query }) => {
        const [threads, nameOf] = await Promise.all([ctx.adapters.chat.search(query), memberNames(ctx.db)]);
        return results(threads.map((thread) => chatSource(thread, nameOf)));
      },
    }),

    listFunding: tool({
      description:
        "List the grant finder's results: applications in progress (with the decisions members still need to make) and funding opportunities with their route, deadline, benefit and next step.",
      inputSchema: z.object({}),
      execute: async () => {
        const [opportunities, applications] = await Promise.all([
          ctx.adapters.funding.listOpportunities(),
          ctx.adapters.funding.listApplications(),
        ]);
        const programs = new Map(opportunities.map((o) => [o.id, o.program]));
        return results([
          ...applications.map((a) => applicationSource(a, programs.get(a.opportunityId))),
          ...opportunities.map(opportunitySource),
        ]);
      },
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
