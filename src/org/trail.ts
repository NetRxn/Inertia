import type { IntakeMapping } from '../intake/contracts.js';
import type { OrgRole } from './contracts.js';

export interface TrailStep {
  label: string;
  detail: string;
  available: boolean;
}

export interface TaskTrail {
  summary: string;
  steps: TrailStep[];
  alsoUsed: string[];
}

export interface TrailAdapter {
  originKind: string;
  build(
    issue: {
      id: string;
      title: string;
      status: string;
      originKind?: string | null;
      originId?: string | null;
      description?: string | null;
      assigneeAgentId?: string | null;
      assigneeUserId?: string | null;
    },
    deps: {
      readMapping(key: string): Promise<IntakeMapping | null>;
      isHidden(sourceKey: string): Promise<boolean>;
      viewerRole: OrgRole;
    }
  ): Promise<TaskTrail | null>;
}

export async function buildTrail(
  issue: {
    id: string;
    title: string;
    status: string;
    originKind?: string | null;
    originId?: string | null;
    description?: string | null;
    assigneeAgentId?: string | null;
    assigneeUserId?: string | null;
  },
  adapters: TrailAdapter[],
  deps: {
    readMapping(key: string): Promise<IntakeMapping | null>;
    isHidden(sourceKey: string): Promise<boolean>;
    viewerRole: OrgRole;
  }
): Promise<TaskTrail> {
  if (!issue.originKind) {
    return { summary: 'No recorded source', steps: [], alsoUsed: [] };
  }

  const adapter = adapters.find((a) => a.originKind === issue.originKind);
  if (!adapter) {
    return { summary: 'No recorded source', steps: [], alsoUsed: [] };
  }

  const trail = await adapter.build(issue, deps);
  if (!trail) {
    return { summary: 'No recorded source', steps: [], alsoUsed: [] };
  }

  return trail;
}

export const objectiveTrailAdapter: TrailAdapter = {
  originKind: 'plugin:netrxn.inertia:objective',
  async build(issue, deps) {
    if (!issue.originId) {
      return null;
    }

    const mapping = await deps.readMapping(issue.originId);
    if (!mapping) {
      return null;
    }

    const sourceKey = `objective:${issue.originId}`;
    const hidden = await deps.isHidden(sourceKey);
    const snapshot = mapping.snapshot;
    const isModerator = deps.viewerRole === 'founder' || deps.viewerRole === 'moderator';
    const canView = isModerator || (snapshot.audience !== 'restricted' && !hidden);

    const alsoUsed: string[] = [];
    const sourceCount = 1 + alsoUsed.length;
    const sourcePlural = sourceCount === 1 ? 'source' : 'sources';

    let summary: string;
    let step1Detail: string;
    let step1Available: boolean;

    if (canView) {
      summary = `from ${snapshot.title} · uses ${sourceCount} ${sourcePlural}`;
      if (snapshot.authorRef === 'configured-roundtable-integration') {
        step1Detail = `Meeting source (${snapshot.sourceId})`;
      } else {
        step1Detail = `${snapshot.title} (${snapshot.sourceSystem}, ${snapshot.audience})`;
      }
      if (hidden) {
        step1Detail += ' (hidden)';
      }
      step1Available = true;
    } else {
      summary = `from a source not available to you · uses ${sourceCount} ${sourcePlural}`;
      step1Detail = 'Source not available to you';
      step1Available = false;
    }

    const steps: TrailStep[] = [
      {
        label: 'Source',
        detail: step1Detail,
        available: step1Available,
      },
      {
        label: 'Intake',
        detail: `Pulled into intake as "${snapshot.title}"`,
        available: true,
      },
      {
        label: 'Task',
        detail: 'This task',
        available: true,
      },
    ];

    return { summary, steps, alsoUsed };
  },
};

export function parseTaskFields(description: string | null): {
  doneWhen: string | null;
  nextStep: string | null;
} {
  if (!description) {
    return { doneWhen: null, nextStep: null };
  }

  let doneWhen: string | null = null;
  let nextStep: string | null = null;

  const lines = description.split('\n');
  for (const line of lines) {
    const doneWhenMatch = line.match(/^Done when:\s*(.+)$/);
    if (doneWhenMatch) {
      doneWhen = doneWhenMatch[1] ?? null;
    }
    const nextStepMatch = line.match(/^Next step:\s*(.+)$/);
    if (nextStepMatch) {
      nextStep = nextStepMatch[1] ?? null;
    }
  }

  return { doneWhen, nextStep };
}
