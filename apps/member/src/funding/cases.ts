/**
 * Grant cases the funding workflow prepares in the work engine (Paperclip),
 * shown on Funding with the engine's own state in plain words. Machine review
 * never makes a case "submitted" or "approved": done means the agents
 * finished preparing, and a member checks it before anything is sent.
 */

export type FundingCaseState = 'queued' | 'preparing' | 'agent-review' | 'waiting' | 'needs-person' | 'prepared';

export interface FundingCase {
  id: string;
  /** The grant program, as the case is titled. */
  title: string;
  state: FundingCaseState;
  stateLabel: string;
  /** The official page the case was opened from, when the brief names it. */
  sourceUrl: string | null;
  /** Where to open the case in the engine. */
  url: string | null;
  agentName: string | null;
  updatedAt: string;
}

const CASE_BRIEF = /^\s*Prepare (?:preliminary|this explicitly bound) funding case\b/i;
const REVIEW = /\breview/i;

export function isFundingCase(description: string | null | undefined): boolean {
  return Boolean(description && CASE_BRIEF.test(description));
}

/** The program's name, without the workflow's "Prepare funding case —" lead-in. */
export function caseTitle(title: string): string {
  return title.replace(/^\s*Prepare (?:preliminary )?funding case\s*[—–-]\s*/i, '').trim() || title;
}

export function officialSource(description: string | null | undefined): string | null {
  const match = description?.match(/official source (https?:\/\/[^\s)]+)/i)?.[1];
  return match ? match.replace(/[.,;:]+$/, '') : null;
}

type Owner = { userId?: string; agentId?: string } | string | null | undefined;

/** The engine's status and who it waits on, as a member would say it. */
export function caseState(issue: { status: string; unblockDescriptor?: { owner?: Owner; action?: string } | null }): { state: FundingCaseState; label: string } | null {
  switch (issue.status) {
    case 'backlog':
    case 'todo':
      return { state: 'queued', label: 'Queued' };
    case 'in_progress':
      return { state: 'preparing', label: 'Being prepared' };
    case 'in_review':
      return { state: 'agent-review', label: 'In agent review' };
    case 'done':
      return { state: 'prepared', label: 'Prepared by agents' };
    case 'blocked': {
      const owner = issue.unblockDescriptor?.owner;
      const person = typeof owner === 'string' || Boolean(owner && typeof owner === 'object' && owner.userId);
      if (person) return { state: 'needs-person', label: 'Needs a person' };
      if (REVIEW.test(issue.unblockDescriptor?.action ?? '')) return { state: 'agent-review', label: 'In agent review' };
      return { state: 'waiting', label: 'Waiting on an agent' };
    }
    default:
      return null;
  }
}
