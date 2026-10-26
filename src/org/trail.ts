import type { IntakeMapping } from '../intake/contracts.js';
import type { OrgRole } from './contracts.js';
import { clean } from './text.js';

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
      companyId: string;
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
    companyId: string;
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
    if (!mapping || mapping.companyId !== deps.companyId) {
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

    const title = clean(snapshot.title, 1000, 'Untitled source');
    if (canView) {
      summary = `from ${title} · uses ${sourceCount} ${sourcePlural}`;
      if (snapshot.authorRef === 'configured-roundtable-integration') {
        step1Detail = `Meeting source (${clean(snapshot.sourceId, 200, 'unknown')})`;
      } else {
        step1Detail = `${title} (${clean(snapshot.sourceSystem, 200, 'unknown')}, ${snapshot.audience})`;
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
        detail: canView ? `Pulled into intake as "${title}"` : 'Pulled into intake',
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

  const lines = description.split(/\r?\n/);
  for (const line of lines) {
    const doneWhenMatch = line.match(/^Done when:(.*)$/)?.[1]?.trim();
    if (doneWhenMatch) {
      doneWhen = doneWhenMatch;
    }
    const nextStepMatch = line.match(/^Next step:(.*)$/)?.[1]?.trim();
    if (nextStepMatch) {
      nextStep = nextStepMatch;
    }
  }

  return { doneWhen, nextStep };
}
