import { asc, eq, inArray } from 'drizzle-orm';
import { getDb } from '../db/client';
import { members, workEvents } from '../db/schema';
import type { AgentTask, ClaimResult, HumanTask, Initiative, NewTask, TaskKind, WorkSource } from './types';

export type PaperclipConfig = {
  /** Base URL of the Paperclip server, e.g. https://paperclip.example.org */
  url: string;
  /** A board API key for the company. */
  apiKey: string;
  companyId: string;
  /** Label that marks work for a person rather than an agent. */
  humanLabel: string;
  /** Agent that picks up new agent tasks, usually the CEO. Unset leaves them for the engine to route. */
  defaultAgentId: string | null;
};

/** Reads Paperclip settings from the environment; null when it isn't configured. */
export function paperclipConfig(env: Record<string, string | undefined>): PaperclipConfig | null {
  const url = env.PAPERCLIP_URL?.trim();
  const apiKey = env.PAPERCLIP_API_KEY?.trim();
  const companyId = env.PAPERCLIP_COMPANY_ID?.trim();
  if (!url || !apiKey || !companyId) return null;
  return { url: url.replace(/\/+$/, ''), apiKey, companyId, humanLabel: env.PAPERCLIP_HUMAN_LABEL?.trim() || 'human', defaultAgentId: env.PAPERCLIP_DEFAULT_AGENT_ID?.trim() || null };
}

type PcGoal = { id: string; title: string; description: string | null; level: string; status: 'planned' | 'active' | 'achieved' | 'cancelled' };
type PcLabel = { id: string; name: string };
type PcAgent = { id: string; name: string };
type PcIssue = {
  id: string;
  identifier: string | null;
  title: string;
  description: string | null;
  status: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked' | 'cancelled';
  goalId: string | null;
  projectId: string | null;
  assigneeAgentId: string | null;
  assigneeUserId: string | null;
  labels?: PcLabel[];
  labelIds?: string[];
  completedAt: string | null;
  updatedAt: string;
};

/** How members map to Paperclip users. Defaults to the member's work user id in the app database. */
export type MemberMapping = {
  workUserOf(memberExternalId: string): Promise<{ userId: string | null; displayName: string } | null>;
  memberOfWorkUser(userId: string): Promise<string | null>;
  /**
   * Claims (and who finished) held in Inertia's work log for members with no
   * Paperclip user: Paperclip can't mark those in progress, so Inertia keeps them exclusive.
   */
  inertiaClaims?(taskIds: string[]): Promise<Map<string, string>>;
};

const dbMapping: MemberMapping = {
  async workUserOf(externalId) {
    const [row] = await getDb().select({ userId: members.workUserId, displayName: members.displayName }).from(members).where(eq(members.externalId, externalId));
    return row ?? null;
  },
  async memberOfWorkUser(userId) {
    const [row] = await getDb().select({ externalId: members.externalId }).from(members).where(eq(members.workUserId, userId));
    return row?.externalId ?? null;
  },
  async inertiaClaims(taskIds) {
    const held = new Map<string, string>();
    if (!taskIds.length) return held;
    const rows = await getDb()
      .select({ taskId: workEvents.taskId, kind: workEvents.kind, externalId: members.externalId })
      .from(workEvents)
      .leftJoin(members, eq(workEvents.memberId, members.id))
      .where(inArray(workEvents.taskId, taskIds))
      .orderBy(asc(workEvents.at));
    for (const row of rows) {
      // A finished task stays with whoever finished it, so the recap can credit them.
      if ((row.kind === 'claimed' || row.kind === 'completed') && row.externalId) held.set(row.taskId, row.externalId);
      else if (row.kind === 'released') held.delete(row.taskId);
    }
    return held;
  },
};

const KIND_PREFIX = /^\[(creative|outreach|review|real-world)\]\s*/i;
const MINUTES = /about (\d{1,3}) min/i;

export class PaperclipError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

/**
 * Paperclip as Inertia's work engine. Goals are initiatives, projects group a
 * piece of work under one, and issues are tasks: those labelled for a person
 * are human tasks, the rest is agent work.
 */
export function createPaperclipWorkSource(config: PaperclipConfig, deps: { fetchImpl?: typeof fetch; mapping?: MemberMapping } = {}): WorkSource {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const mapping = deps.mapping ?? dbMapping;
  const base = config.url.replace(/\/+$/, '');
  const company = `/api/companies/${encodeURIComponent(config.companyId)}`;
  let humanLabelId: Promise<string> | null = null;

  async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const response = await fetchImpl(`${base}${path}`, {
      method: init.method ?? 'GET',
      headers: { authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json', accept: 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new PaperclipError(response.status, `Paperclip ${init.method ?? 'GET'} ${path} answered ${response.status}${text ? `: ${text.slice(0, 200)}` : ''}`);
    }
    return (await response.json()) as T;
  }

  function ensureHumanLabel(): Promise<string> {
    humanLabelId ??= (async () => {
      const labels = await call<PcLabel[]>(`${company}/labels`);
      const found = labels.find((l) => l.name.toLowerCase() === config.humanLabel.toLowerCase());
      if (found) return found.id;
      return (await call<PcLabel>(`${company}/labels`, { method: 'POST', body: { name: config.humanLabel, color: '#e8a33d' } })).id;
    })().catch((error) => {
      humanLabelId = null;
      throw error;
    });
    return humanLabelId;
  }

  const isHuman = (issue: PcIssue, labelId: string) =>
    (issue.labelIds ?? []).includes(labelId) || (issue.labels ?? []).some((l) => l.id === labelId || l.name.toLowerCase() === config.humanLabel.toLowerCase());

  async function listIssues(): Promise<PcIssue[]> {
    return call<PcIssue[]>(`${company}/issues`);
  }

  async function goalOf(issue: PcIssue, projectGoals: Map<string, string | null>): Promise<string | null> {
    if (issue.goalId) return issue.goalId;
    if (!issue.projectId) return null;
    if (!projectGoals.has(issue.projectId)) {
      try {
        const project = await call<{ goalId?: string | null; goalIds?: string[] }>(`/api/projects/${encodeURIComponent(issue.projectId)}`);
        projectGoals.set(issue.projectId, project.goalId ?? project.goalIds?.[0] ?? null);
      } catch {
        projectGoals.set(issue.projectId, null);
      }
    }
    return projectGoals.get(issue.projectId) ?? null;
  }

  async function toHumanTask(issue: PcIssue, projectGoals: Map<string, string | null>, localClaims: Map<string, string>): Promise<HumanTask> {
    const description = issue.description ?? '';
    const kind = description.match(KIND_PREFIX)?.[1]?.toLowerCase() as TaskKind | undefined;
    const minutes = description.match(MINUTES)?.[1];
    const claimedBy = issue.assigneeUserId ? await mapping.memberOfWorkUser(issue.assigneeUserId) : localClaims.get(issue.id) ?? null;
    const done = issue.status === 'done';
    return {
      id: issue.id,
      initiativeId: (await goalOf(issue, projectGoals)) ?? '',
      title: issue.title,
      kind,
      estimateMinutes: minutes ? Number(minutes) : null,
      due: null,
      prepared: description.replace(KIND_PREFIX, '').trim(),
      status: done ? 'done' : issue.assigneeUserId || claimedBy ? 'claimed' : 'open',
      claimedBy,
      completedBy: done ? claimedBy : null,
      completedAt: done ? issue.completedAt ?? issue.updatedAt : null,
    };
  }

  const agentStatus = (status: PcIssue['status']): AgentTask['status'] =>
    status === 'done' ? 'done' : status === 'blocked' ? 'blocked' : status === 'in_progress' || status === 'in_review' ? 'running' : 'queued';

  const source: WorkSource = {
    engine: { name: 'Paperclip', url: base },

    async listInitiatives(): Promise<Initiative[]> {
      const goals = await call<PcGoal[]>(`${company}/goals`);
      return goals
        .filter((g) => g.level === 'company' && g.status !== 'cancelled')
        .map((g) => ({
          id: g.id,
          title: g.title,
          status: g.status === 'achieved' ? 'done' : g.status === 'active' ? 'active' : 'paused',
          statusLabel: g.status === 'planned' ? 'proposed' : undefined,
        }));
    },

    async listHumanTasks(): Promise<HumanTask[]> {
      const [labelId, issues] = await Promise.all([ensureHumanLabel(), listIssues()]);
      const projectGoals = new Map<string, string | null>();
      const tasks = issues.filter((i) => i.status !== 'cancelled' && isHuman(i, labelId));
      const localClaims = (await mapping.inertiaClaims?.(tasks.filter((i) => !i.assigneeUserId).map((i) => i.id))) ?? new Map<string, string>();
      return Promise.all(tasks.map((i) => toHumanTask(i, projectGoals, localClaims)));
    },

    async listAgentTasks(): Promise<AgentTask[]> {
      const [labelId, issues, agents] = await Promise.all([ensureHumanLabel(), listIssues(), call<PcAgent[]>(`${company}/agents`).catch(() => [] as PcAgent[])]);
      const names = new Map(agents.map((a) => [a.id, a.name]));
      const projectGoals = new Map<string, string | null>();
      const work = issues.filter((i) => i.status !== 'cancelled' && !isHuman(i, labelId) && !i.assigneeUserId);
      return Promise.all(
        work.map(async (i) => ({
          id: i.id,
          initiativeId: await goalOf(i, projectGoals),
          title: i.title,
          agentName: i.assigneeAgentId ? names.get(i.assigneeAgentId) ?? 'An agent' : null,
          status: agentStatus(i.status),
          updatedAt: i.completedAt ?? i.updatedAt,
          url: `${base}/issues/${i.identifier ?? i.id}`,
        })),
      );
    },

    async completionsBetween(from, to) {
      const tasks = await source.listHumanTasks();
      const counts = new Map<string, number>();
      for (const t of tasks) {
        if (t.status === 'done' && t.completedBy && t.completedAt) {
          const at = new Date(t.completedAt);
          if (at >= from && at < to) counts.set(t.completedBy, (counts.get(t.completedBy) ?? 0) + 1);
        }
      }
      return [...counts].map(([memberExternalId, count]) => ({ memberExternalId, count }));
    },

    async agentCompletionsBetween(from, to) {
      const tasks = await source.listAgentTasks!();
      return tasks.filter((t) => t.status === 'done' && new Date(t.updatedAt) >= from && new Date(t.updatedAt) < to).length;
    },

    async claim(taskId, memberExternalId): Promise<ClaimResult> {
      let issue: PcIssue;
      try {
        issue = await call<PcIssue>(`/api/issues/${encodeURIComponent(taskId)}`);
      } catch (error) {
        if (error instanceof PaperclipError && error.status === 404) return { ok: false, reason: 'not-found' };
        return { ok: false, reason: 'unavailable' };
      }
      if (issue.status === 'done' || issue.status === 'cancelled' || issue.assigneeUserId || issue.assigneeAgentId) return { ok: false, reason: 'already-claimed' };
      if ((await mapping.inertiaClaims?.([taskId]))?.has(taskId)) return { ok: false, reason: 'already-claimed' };
      const who = await mapping.workUserOf(memberExternalId);
      try {
        // Paperclip only allows in progress with an assignee. Members without a
        // Paperclip user claim through a comment; Inertia's work log keeps it theirs.
        await call(`/api/issues/${encodeURIComponent(taskId)}`, {
          method: 'PATCH',
          body: who?.userId
            ? { assigneeUserId: who.userId, status: 'in_progress', comment: `Claimed in Inertia by ${who.displayName}.` }
            : { comment: `Claimed in Inertia by ${who?.displayName ?? 'a member'} (not linked to a Paperclip user).` },
        });
        return { ok: true };
      } catch (error) {
        if (error instanceof PaperclipError && error.status === 409) return { ok: false, reason: 'already-claimed' };
        return { ok: false, reason: 'unavailable' };
      }
    },

    async release(taskId, memberExternalId): Promise<ClaimResult> {
      const who = await mapping.workUserOf(memberExternalId);
      try {
        await call(`/api/issues/${encodeURIComponent(taskId)}`, {
          method: 'PATCH',
          body: who?.userId
            ? { assigneeUserId: null, status: 'todo', comment: `Released in Inertia by ${who.displayName}; it's open for someone else.` }
            : { comment: `Released in Inertia by ${who?.displayName ?? 'a member'}; it's open for someone else.` },
        });
        return { ok: true };
      } catch (error) {
        return { ok: false, reason: error instanceof PaperclipError && error.status === 404 ? 'not-found' : 'unavailable' };
      }
    },

    async complete(taskId, memberExternalId, answer): Promise<ClaimResult> {
      const who = await mapping.workUserOf(memberExternalId);
      try {
        await call(`/api/issues/${encodeURIComponent(taskId)}`, {
          method: 'PATCH',
          body: { status: 'done', comment: `${who?.displayName ?? 'A member'} answered in Inertia:\n\n${answer}` },
        });
        return { ok: true };
      } catch (error) {
        return { ok: false, reason: error instanceof PaperclipError && error.status === 404 ? 'not-found' : 'unavailable' };
      }
    },

    async createInitiative({ title, summary, adopted }) {
      const goal = await call<PcGoal>(`${company}/goals`, { method: 'POST', body: { title, description: summary, level: 'company', status: adopted ? 'active' : 'planned' } });
      return { id: goal.id };
    },

    async createProject({ initiativeId, title, description }) {
      const project = await call<{ id: string }>(`${company}/projects`, { method: 'POST', body: { name: title, description, goalIds: [initiativeId], status: 'planned' } });
      return { id: project.id };
    },

    async createTask(input: NewTask) {
      const human = input.lane === 'human';
      const description = [
        human && input.kind ? `[${input.kind}]` : null,
        input.description,
        human && input.estimateMinutes ? `\n\nAbout ${input.estimateMinutes} minutes of a member's time.` : null,
      ].filter(Boolean).join(' ');
      const issue = await call<PcIssue>(`${company}/issues`, {
        method: 'POST',
        body: {
          title: input.title,
          description,
          status: 'todo',
          ...(input.initiativeId ? { goalId: input.initiativeId } : {}),
          ...(input.projectId ? { projectId: input.projectId } : {}),
          ...(human ? { labelIds: [await ensureHumanLabel()] } : config.defaultAgentId ? { assigneeAgentId: config.defaultAgentId } : {}),
        },
      });
      return { id: issue.id };
    },
  };
  return source;
}
