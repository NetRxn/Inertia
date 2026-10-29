import type { Initiative, WorkSource } from '../adapters/types';
import type { Db } from '../db/client';
import { getOrganization } from '../org/organization';
import type { OrgProfile } from '../org/profile-types';

type OrgInitiativeInput = { governanceEnabled: boolean; profile: OrgProfile | null } | null;

const AWAITING_VOTE = { status: 'active', statusLabel: 'Awaiting vote', awaitingVote: true } as const;

const titleKey = (title: string) => title.trim().toLowerCase();

/**
 * The organization's initiatives, as every screen shows them. Initiatives
 * accepted in onboarding come first, in their order, whether or not they
 * reached the work engine (a read-only engine never gets them). An engine goal
 * joins one by work id or title and lends its id, status and progress. Other
 * engine goals, such as the agents' own root goal, only show when nothing was
 * accepted in onboarding; their work reads as general.
 */
export function mergeInitiatives(org: OrgInitiativeInput, engine: Initiative[]): Initiative[] {
  const accepted = (org?.profile?.initiatives ?? []).filter((i) => i.status === 'accepted');
  if (accepted.length === 0) {
    return engine.map((goal) => (goal.statusLabel === 'proposed' ? { ...goal, ...AWAITING_VOTE, source: 'engine' } : { ...goal, source: 'engine' }));
  }

  const byId = new Map(engine.map((goal) => [goal.id, goal]));
  const byTitle = new Map(engine.map((goal) => [titleKey(goal.title), goal]));
  return accepted.map((initiative, index): Initiative => {
    const goal = (initiative.workId ? byId.get(initiative.workId) : undefined) ?? byTitle.get(titleKey(initiative.title));
    const waiting = org!.governanceEnabled && !initiative.adopted;
    const base: Initiative = goal
      ? { ...goal, title: initiative.title, priority: index, source: 'both' }
      : { id: initiative.workId ?? `org:${initiative.id}`, title: initiative.title, status: 'active', priority: index, source: 'organization' };
    if (base.status === 'done') return base;
    if (waiting) return { ...base, ...AWAITING_VOTE };
    // The engine may still call it proposed; the organization has accepted it.
    if (base.statusLabel === 'proposed') return { ...base, status: 'active', statusLabel: undefined };
    return base;
  });
}

/** The organization's initiatives from its profile and the work engine. */
export async function listOrgInitiatives(db: Db, work: Pick<WorkSource, 'listInitiatives'>): Promise<Initiative[]> {
  const [org, engine] = await Promise.all([getOrganization(db), work.listInitiatives()]);
  return mergeInitiatives(org, engine);
}
