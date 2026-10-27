import { randomUUID } from 'crypto';
import type { AgentTask, ClaimResult, HumanTask, Initiative, NewTask, WorkSource } from './types';

/**
 * A work engine that lives in process memory, for running a real
 * organization before a work engine like Paperclip is connected.
 * Everything here is lost on restart.
 */
export function createMemoryWorkSource(now: () => Date = () => new Date()): WorkSource {
  const initiatives: Initiative[] = [];
  const humanTasks: HumanTask[] = [];
  const agentTasks: AgentTask[] = [];

  return {
    engine: { name: 'Inertia (in memory)', url: null },
    async listInitiatives() {
      return [...initiatives];
    },
    async listHumanTasks() {
      return [...humanTasks];
    },
    async listAgentTasks() {
      return [...agentTasks];
    },
    async completionsBetween(from, to) {
      const counts = new Map<string, number>();
      for (const task of humanTasks) {
        if (task.status === 'done' && task.completedBy && task.completedAt) {
          const at = new Date(task.completedAt);
          if (at >= from && at < to) counts.set(task.completedBy, (counts.get(task.completedBy) ?? 0) + 1);
        }
      }
      return [...counts].map(([memberExternalId, count]) => ({ memberExternalId, count }));
    },
    async agentCompletionsBetween(from, to) {
      return agentTasks.filter((t) => t.status === 'done' && new Date(t.updatedAt) >= from && new Date(t.updatedAt) < to).length;
    },
    async claim(taskId, memberExternalId): Promise<ClaimResult> {
      const task = humanTasks.find((t) => t.id === taskId);
      if (!task) return { ok: false, reason: 'not-found' };
      if (task.status !== 'open') return { ok: false, reason: 'already-claimed' };
      task.status = 'claimed';
      task.claimedBy = memberExternalId;
      return { ok: true };
    },
    async release(taskId, memberExternalId): Promise<ClaimResult> {
      const task = humanTasks.find((t) => t.id === taskId);
      if (!task) return { ok: false, reason: 'not-found' };
      if (task.claimedBy !== memberExternalId || task.status !== 'claimed') return { ok: false, reason: 'already-claimed' };
      task.status = 'open';
      task.claimedBy = null;
      return { ok: true };
    },
    async createInitiative({ title, adopted }) {
      const id = `ini-${randomUUID()}`;
      initiatives.push({ id, title, status: adopted ? 'active' : 'paused', statusLabel: adopted ? undefined : 'proposed' });
      return { id };
    },
    async createProject({ initiativeId, title }) {
      // Projects are grouped under their initiative; the memory engine keeps no separate list.
      return { id: `proj-${initiativeId}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}` };
    },
    async createTask(input: NewTask) {
      const id = `task-${randomUUID()}`;
      if (input.lane === 'human') {
        humanTasks.push({
          id,
          initiativeId: input.initiativeId,
          title: input.title,
          kind: input.kind,
          estimateMinutes: input.estimateMinutes ?? null,
          due: null,
          prepared: input.description,
          status: 'open',
          claimedBy: null,
          completedBy: null,
          completedAt: null,
        });
      } else {
        agentTasks.push({ id, initiativeId: input.initiativeId, title: input.title, agentName: null, status: 'queued', updatedAt: now().toISOString(), url: null });
      }
      return { id };
    },
  };
}
