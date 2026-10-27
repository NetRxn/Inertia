export type SourceRef = {
  kind:
    | 'meeting'
    | 'chat'
    | 'proposal'
    | 'task'
    | 'initiative'
    | 'share'
    | 'event'
    | 'document'
    | 'opportunity'
    | 'application';
  id: string;
  title: string;
  url?: string;
};

// Member directory
export interface DirectoryMember {
  externalId: string;
  email: string;
  displayName: string;
  active: boolean;
}

export interface MemberDirectory {
  listMembers(): Promise<DirectoryMember[]>;
}

// Proposals
export interface Proposal {
  id: string;
  title: string;
  status: 'upcoming' | 'open' | 'closed';
  opensAt: string;
  closesAt: string;
  tally: {
    yes: number;
    no: number;
    abstain: number;
  };
  url: string;
}

export interface ProposalSource {
  listProposals(): Promise<Proposal[]>;
}

// Work and tasks
export interface Initiative {
  id: string;
  title: string;
  status: 'active' | 'paused' | 'done';
  // The next three are optional: a source may not track them. The UI drops the
  // progress arc and status line, and unranked initiatives sort last in source order.
  progress?: number; // 0..1
  statusLabel?: string;
  priority?: number; // lower is more important
}

export type TaskKind = 'creative' | 'outreach' | 'review' | 'real-world';

export interface HumanTask {
  id: string;
  initiativeId: string;
  title: string;
  kind?: TaskKind; // read through taskKind(), which defaults to 'review'
  estimateMinutes: number | null;
  due: string | null;
  prepared: string;
  status: 'open' | 'claimed' | 'done';
  claimedBy: string | null;
  completedBy: string | null;
  completedAt: string | null;
}

export type ClaimResult =
  | { ok: true }
  | { ok: false; reason: 'already-claimed' | 'not-found' | 'unavailable' };

export interface WorkSource {
  listInitiatives(): Promise<Initiative[]>;
  listHumanTasks(): Promise<HumanTask[]>;
  completionsBetween(from: Date, to: Date): Promise<{ memberExternalId: string; count: number }[]>;
  claim(taskId: string, memberExternalId: string): Promise<ClaimResult>;
}

// Meetings
export interface Meeting {
  id: string;
  date: string;
  title: string;
  summary: string;
  decisions: string[];
  openQuestions: string[];
  actionItems: { text: string; owner: string | null }[];
  transcriptUrl: string | null;
}

export interface MeetingSource {
  listMeetings(limit: number): Promise<Meeting[]>;
  getMeeting(id: string): Promise<Meeting | null>;
  search(query: string): Promise<Meeting[]>;
}

// Chat
export interface ChatThread {
  id: string;
  channel: string;
  title: string;
  summary: string | null;
  messages: { id: string; author: string; text: string; at: string }[];
}

export interface ChatSource {
  listRecentThreads(since: Date): Promise<ChatThread[]>;
  search(query: string): Promise<ChatThread[]>;
}

// Events
export interface DaoEvent {
  id: string;
  title: string;
  startsAt: string;
  detail: string;
  kind: 'meeting' | 'deadline' | 'vote' | 'other';
}

export interface EventSource {
  listUpcoming(from: Date, limit: number): Promise<DaoEvent[]>;
}

// Funding: the grant finder's output, read-only. Agents find and prepare;
// members see the picture and confirm packets where the funding system lives.

/** How the DAO would pursue an opportunity, as the grant finder assessed it. */
export type FundingRoute = 'direct' | 'partner' | 'next-cycle' | 'monitor' | 'standing-benefit';

export interface FundingOpportunity {
  id: string;
  sponsor: string;
  program: string;
  route: FundingRoute;
  summary: string;
  /** An ISO timestamp for an exact cutoff, YYYY-MM-DD when only the day is known, null when unknown or rolling. */
  deadline: string | null;
  benefit: string | null; // e.g. "Up to $25,000"; unknown stays null
  effort: string | null;
  nextStep: string;
  /** The official page the finding was validated against. */
  sourceUrl: string;
  /** When the grant finder last checked the source. */
  observedAt: string;
  initiativeId: string | null;
}

export type ApplicationStage = 'drafting' | 'agent-review' | 'needs-members' | 'ready' | 'submitted';

export interface FundingApplication {
  id: string;
  opportunityId: string;
  title: string;
  stage: ApplicationStage;
  /** Answered requirements out of all of them, when the source tracks it. */
  readiness: { answered: number; total: number } | null;
  /** What members still need to decide or supply, and what each one blocks. */
  decisionsNeeded: { id: string; question: string; blocks: string }[];
  submittedAt: string | null;
  /** Where members review and confirm the exact packet. Null until that flow is live. */
  packetUrl: string | null;
}

export interface FundingSource {
  listOpportunities(): Promise<FundingOpportunity[]>;
  listApplications(): Promise<FundingApplication[]>;
}

// Adapters collection
export interface Adapters {
  directory: MemberDirectory;
  proposals: ProposalSource;
  work: WorkSource;
  meetings: MeetingSource;
  chat: ChatSource;
  events: EventSource;
  funding: FundingSource;
}
