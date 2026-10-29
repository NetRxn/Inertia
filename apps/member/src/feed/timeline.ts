import { desc, eq } from 'drizzle-orm';
import type {
  Adapters,
  AgentTask,
  FundingApplication,
  FundingOpportunity,
  HumanTask,
  Initiative,
  Meeting,
  Proposal,
  SourceRef,
} from '../adapters/types';
import type { Db } from '../db/client';
import { orgSources } from '../db/schema';
import { formatDay, plural } from '../components/cards/format';
import type { ShareSummary } from './build-feed';

export type TimelineActor =
  | { kind: 'member'; name: string }
  | { kind: 'agent'; name: string | null }
  | { kind: 'connector'; name: string }
  | { kind: 'organization' };

export type TimelineItem = {
  /** `${kind}:${sourceId}`: stable for keys and paging. */
  id: string;
  kind: 'task-done' | 'agent-done' | 'agent-started' | 'agent-blocked' | 'agent-queued' | 'meeting' | 'share' | 'proposal' | 'funding' | 'incoming';
  at: string;
  actor: TimelineActor;
  title: string;
  detail: string | null;
  /** Null reads as general work. */
  initiative: { id: string; title: string } | null;
  href: string | null;
  source: SourceRef;
};

export type TimelineSource = Pick<typeof orgSources.$inferSelect, 'id' | 'kind' | 'title' | 'origin' | 'summary'> & { createdAt: string };

export type TimelineInput = {
  initiatives: Initiative[];
  /** Member external id → display name. Ids never leave this module. */
  names: Map<string, string>;
  humanTasks: HumanTask[];
  agentTasks: AgentTask[];
  meetings: Meeting[];
  shares: ShareSummary[];
  proposals: Proposal[];
  opportunities: FundingOpportunity[];
  applications: FundingApplication[];
  sources: TimelineSource[];
};

export type TimelineOptions = { limit: number; before?: string; actors?: TimelineActor['kind'][] };

const DETAIL_MAX = 160;
const clip = (text: string | null | undefined) => (text ? (text.length <= DETAIL_MAX ? text : `${text.slice(0, DETAIL_MAX - 1).trimEnd()}…`) : null);

/** Who delivered a source: a connector for digests, otherwise how it arrived. */
function connectorName(source: TimelineSource): string {
  if (source.kind === 'chat-export') return source.title.startsWith('Buzz:') ? 'Buzz' : source.title.startsWith('Telegram') ? 'Telegram' : 'Chat export';
  if (source.kind === 'link' && source.origin?.includes('github.com')) return 'GitHub';
  return { website: 'Website', meeting: 'Meeting notes', document: 'Upload', note: 'Note', 'chat-export': 'Chat export', link: 'Link' }[source.kind];
}

function events(data: TimelineInput): TimelineItem[] {
  const titles = new Map(data.initiatives.map((i) => [i.id, i.title]));
  const initiativeOf = (id: string | null) => (id && titles.has(id) ? { id, title: titles.get(id)! } : null);
  const items: TimelineItem[] = [];

  for (const task of data.humanTasks) {
    if (task.status !== 'done' || !task.completedAt) continue;
    const name = (task.completedBy && data.names.get(task.completedBy)) || 'A member';
    items.push({ id: `task-done:${task.id}`, kind: 'task-done', at: task.completedAt, actor: { kind: 'member', name }, title: task.title, detail: null, initiative: initiativeOf(task.initiativeId), href: null, source: { kind: 'task', id: task.id, title: task.title } });
  }

  for (const task of data.agentTasks) {
    const kind = task.status === 'done' ? 'agent-done' : task.status === 'blocked' ? 'agent-blocked' : task.status === 'queued' ? 'agent-queued' : 'agent-started';
    items.push({ id: `${kind}:${task.id}`, kind, at: task.updatedAt, actor: { kind: 'agent', name: task.agentName }, title: task.title, detail: null, initiative: initiativeOf(task.initiativeId), href: task.url, source: { kind: 'task', id: task.id, title: task.title, ...(task.url ? { url: task.url } : {}) } });
  }

  for (const meeting of data.meetings) {
    const parts = [meeting.decisions.length && plural(meeting.decisions.length, 'decision'), meeting.actionItems.length && plural(meeting.actionItems.length, 'action item')].filter(Boolean);
    items.push({ id: `meeting:${meeting.id}`, kind: 'meeting', at: meeting.date, actor: { kind: 'organization' }, title: meeting.title, detail: parts.length ? parts.join(' · ') : clip(meeting.summary), initiative: null, href: `/org?tab=docs#meeting-${meeting.id}`, source: { kind: 'meeting', id: meeting.id, title: meeting.title } });
  }

  for (const share of data.shares) {
    items.push({ id: `share:${share.id}`, kind: 'share', at: share.createdAt, actor: { kind: 'member', name: share.authorName }, title: clip(share.description)!, detail: share.previewTitle, initiative: null, href: share.linkUrl, source: { kind: 'share', id: share.id, title: clip(share.description)! } });
  }

  for (const proposal of data.proposals) {
    if (proposal.status === 'upcoming') continue;
    const closed = proposal.status === 'closed';
    const { yes, no, abstain } = proposal.tally;
    items.push({ id: `proposal:${proposal.id}`, kind: 'proposal', at: closed ? proposal.closesAt : proposal.opensAt, actor: { kind: 'organization' }, title: proposal.title, detail: closed ? `Vote closed: ${yes} yes · ${no} no · ${abstain} abstain` : `Vote open until ${formatDay(proposal.closesAt)}`, initiative: null, href: proposal.url, source: { kind: 'proposal', id: proposal.id, title: proposal.title, url: proposal.url } });
  }

  for (const opportunity of data.opportunities) {
    items.push({ id: `funding:${opportunity.id}`, kind: 'funding', at: opportunity.observedAt, actor: { kind: 'organization' }, title: opportunity.program, detail: [opportunity.sponsor, opportunity.benefit].filter(Boolean).join(' · '), initiative: initiativeOf(opportunity.initiativeId), href: '/org?tab=funding', source: { kind: 'opportunity', id: opportunity.id, title: opportunity.program } });
  }

  for (const application of data.applications) {
    if (!application.submittedAt) continue;
    items.push({ id: `funding:${application.id}`, kind: 'funding', at: application.submittedAt, actor: { kind: 'organization' }, title: application.title, detail: 'Application submitted', initiative: null, href: '/org?tab=funding', source: { kind: 'application', id: application.id, title: application.title } });
  }

  for (const source of data.sources) {
    items.push({ id: `incoming:${source.id}`, kind: 'incoming', at: source.createdAt, actor: { kind: 'connector', name: connectorName(source) }, title: source.title, detail: clip(source.summary), initiative: null, href: '/org?tab=data', source: { kind: 'source', id: source.id, title: source.title } });
  }

  return items;
}

/** Everything that happened in the organization, newest first, a page at a time. */
export function buildTimeline(data: TimelineInput, options: TimelineOptions): { items: TimelineItem[]; nextBefore: string | null } {
  const before = options.before ? new Date(options.before).getTime() : Infinity;
  const sorted = events(data)
    .filter((item) => !options.actors || options.actors.includes(item.actor.kind))
    .filter((item) => new Date(item.at).getTime() < before)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime() || a.id.localeCompare(b.id));
  const items = sorted.slice(0, options.limit);
  return { items, nextBefore: sorted.length > options.limit ? items.at(-1)!.at : null };
}

const SOURCE_LIMIT = 100;
const MEETING_LIMIT = 30;

/** Reads every timeline source once. Callers filter and page with buildTimeline. */
export async function loadTimelineInput(adapters: Adapters, db: Db, initiatives: Initiative[], shares: ShareSummary[]): Promise<TimelineInput> {
  const [directory, humanTasks, agentTasks, meetings, proposals, opportunities, applications, sources] = await Promise.all([
    adapters.directory.listMembers(),
    adapters.work.listHumanTasks(),
    adapters.work.listAgentTasks ? adapters.work.listAgentTasks() : Promise.resolve([] as AgentTask[]),
    adapters.meetings.listMeetings(MEETING_LIMIT),
    adapters.proposals.listProposals(),
    adapters.funding.listOpportunities(),
    adapters.funding.listApplications(),
    db
      .select({ id: orgSources.id, kind: orgSources.kind, title: orgSources.title, origin: orgSources.origin, summary: orgSources.summary, createdAt: orgSources.createdAt })
      .from(orgSources)
      .where(eq(orgSources.status, 'active'))
      .orderBy(desc(orgSources.createdAt))
      .limit(SOURCE_LIMIT),
  ]);
  return {
    initiatives,
    names: new Map(directory.map((m) => [m.externalId, m.displayName])),
    humanTasks,
    agentTasks,
    meetings,
    shares,
    proposals,
    opportunities,
    applications,
    sources: sources.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
  };
}
