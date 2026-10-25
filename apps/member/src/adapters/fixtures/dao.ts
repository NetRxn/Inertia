import type {
  DirectoryMember,
  Proposal,
  Initiative,
  HumanTask,
  Meeting,
  ChatThread,
  DaoEvent,
  FundingOpportunity,
  FundingApplication,
} from '../types';

export const FIXTURE_NOW = new Date('2026-10-24T15:00:00Z');

export interface FixtureData {
  members: DirectoryMember[];
  proposals: Proposal[];
  initiatives: Initiative[];
  tasks: HumanTask[];
  meetings: Meeting[];
  chatThreads: ChatThread[];
  events: DaoEvent[];
  opportunities: FundingOpportunity[];
  applications: FundingApplication[];
}

/**
 * Creates a coherent synthetic DAO fixture with all dates relative to anchor.
 * For unit tests, pass FIXTURE_NOW. For the running app, pass new Date().
 */
export function defaultFixture(anchor: Date = FIXTURE_NOW): FixtureData {
  const anchorTime = anchor.getTime();

  // Helper to create relative dates
  const relativeDate = (offsetMs: number): string => {
    return new Date(anchorTime + offsetMs).toISOString();
  };

  const DAY = 24 * 60 * 60 * 1000;
  const HOUR = 60 * 60 * 1000;

  // 13 members (one inactive). Lee is the full-journey e2e's own member.
  const members: DirectoryMember[] = [
    { externalId: 'm-ana', email: 'ana@example.org', displayName: 'Ana Rodriguez', active: true },
    { externalId: 'm-rob', email: 'rob@example.org', displayName: 'Rob Chen', active: true },
    { externalId: 'm-sam', email: 'sam@example.org', displayName: 'Sam Williams', active: true },
    { externalId: 'm-jordan', email: 'jordan@example.org', displayName: 'Jordan Kim', active: true },
    { externalId: 'm-alex', email: 'alex@example.org', displayName: 'Alex Martinez', active: true },
    { externalId: 'm-casey', email: 'casey@example.org', displayName: 'Casey Thompson', active: true },
    { externalId: 'm-morgan', email: 'morgan@example.org', displayName: 'Morgan Davis', active: true },
    { externalId: 'm-riley', email: 'riley@example.org', displayName: 'Riley Anderson', active: true },
    { externalId: 'm-taylor', email: 'taylor@example.org', displayName: 'Taylor Johnson', active: true },
    { externalId: 'm-quinn', email: 'quinn@example.org', displayName: 'Quinn Brown', active: true },
    { externalId: 'm-drew', email: 'drew@example.org', displayName: 'Drew Wilson', active: true },
    { externalId: 'm-lee', email: 'lee@example.org', displayName: 'Lee Okafor', active: true },
    { externalId: 'm-pat', email: 'pat@example.org', displayName: 'Pat Garcia', active: false },
  ];

  // Three initiatives
  const initiatives: Initiative[] = [
    {
      id: 'init-garden',
      title: 'Community garden grant',
      status: 'active',
      progress: 0.65,
      statusLabel: 'Grant application submitted',
      priority: 1,
    },
    {
      id: 'init-coding',
      title: 'Youth coding nights',
      status: 'active',
      progress: 0.40,
      statusLabel: 'First session scheduled',
      priority: 2,
    },
    {
      id: 'init-treasury',
      title: 'Treasury policy v2',
      status: 'active',
      progress: 0.20,
      statusLabel: 'Draft in progress',
      priority: 3,
    },
  ];

  // At least 6 human tasks across all four kinds
  // At least 2 open, at least 3 done this week (completed in last 1-2 days)
  const tasks: HumanTask[] = [
    // Open tasks
    {
      id: 'task-1',
      initiativeId: 'init-garden',
      title: 'Design community garden signage',
      kind: 'creative',
      estimateMinutes: 120,
      due: relativeDate(3 * DAY),
      prepared: 'Inertia drafted three sign layouts and a materials list from the garden plan.',
      status: 'open',
      claimedBy: null,
      completedBy: null,
      completedAt: null,
    },
    {
      id: 'task-2',
      initiativeId: 'init-coding',
      title: 'Reach out to local schools',
      kind: 'outreach',
      estimateMinutes: 90,
      due: relativeDate(7 * DAY),
      prepared: 'Inertia compiled contact info for three nearby schools and drafted an intro email.',
      status: 'open',
      claimedBy: null,
      completedBy: null,
      completedAt: null,
    },
    {
      id: 'task-8',
      initiativeId: 'init-coding',
      title: 'Photograph the first coding night',
      kind: 'real-world',
      estimateMinutes: 45,
      due: relativeDate(5 * DAY),
      prepared: 'Inertia listed the shots the grant report needs and checked the library photo policy.',
      status: 'open',
      claimedBy: null,
      completedBy: null,
      completedAt: null,
    },
    // Claimed task
    {
      id: 'task-3',
      initiativeId: 'init-treasury',
      title: 'Review draft treasury policy',
      kind: 'review',
      estimateMinutes: 60,
      due: relativeDate(2 * DAY),
      prepared: 'Inertia organized the draft policy into sections and highlighted areas needing input.',
      status: 'claimed',
      claimedBy: 'm-sam',
      completedBy: null,
      completedAt: null,
    },
    // Done tasks (completed in last 1-2 days, within "this week")
    {
      id: 'task-4',
      initiativeId: 'init-garden',
      title: 'Install garden beds',
      kind: 'real-world',
      estimateMinutes: 240,
      due: relativeDate(-1 * DAY),
      prepared: 'Inertia reserved tools from the community center and mapped the bed layout.',
      status: 'done',
      claimedBy: 'm-ana',
      completedBy: 'm-ana',
      completedAt: relativeDate(-1 * DAY - 3 * HOUR),
    },
    {
      id: 'task-5',
      initiativeId: 'init-coding',
      title: 'Create coding workshop materials',
      kind: 'creative',
      estimateMinutes: 180,
      due: relativeDate(-2 * DAY),
      prepared: 'Inertia outlined a lesson plan and gathered example projects for beginners.',
      status: 'done',
      claimedBy: 'm-rob',
      completedBy: 'm-rob',
      completedAt: relativeDate(-1.5 * DAY),
    },
    {
      id: 'task-6',
      initiativeId: 'init-treasury',
      title: 'Review expense reporting process',
      kind: 'review',
      estimateMinutes: 45,
      due: relativeDate(-3 * DAY),
      prepared: 'Inertia reviewed the current process and noted pain points from recent reports.',
      status: 'done',
      claimedBy: 'm-jordan',
      completedBy: 'm-jordan',
      completedAt: relativeDate(-2 * DAY + 2 * HOUR),
    },
    // Additional task for variety
    {
      id: 'task-7',
      initiativeId: 'init-garden',
      title: 'Contact local nurseries',
      kind: 'outreach',
      estimateMinutes: 30,
      due: null,
      prepared: 'Inertia found five nurseries within two miles and noted their bulk pricing.',
      status: 'done',
      claimedBy: 'm-alex',
      completedBy: 'm-alex',
      completedAt: relativeDate(-15 * DAY),
    },
  ];

  // Two proposals (one open, one closed within past 7 days)
  const proposals: Proposal[] = [
    {
      id: 'prop-1',
      title: 'Approve community garden grant application',
      status: 'open',
      opensAt: relativeDate(-3 * DAY),
      closesAt: relativeDate(4 * DAY),
      tally: { yes: 8, no: 1, abstain: 2 },
      url: 'https://vote.example.org/proposals/prop-1',
    },
    {
      id: 'prop-2',
      title: 'Budget allocation for coding workshops',
      status: 'closed',
      opensAt: relativeDate(-10 * DAY),
      closesAt: relativeDate(-2 * DAY),
      tally: { yes: 10, no: 0, abstain: 1 },
      url: 'https://vote.example.org/proposals/prop-2',
    },
  ];

  // Two meetings
  const meetings: Meeting[] = [
    {
      id: 'meeting-1',
      date: relativeDate(-5 * DAY),
      title: 'Community garden planning session',
      summary: 'Discussed grant application timeline, site preparation, and community outreach strategy for the new garden.',
      decisions: [
        'Approved $5,000 budget for site preparation',
        'Selected north corner lot as garden location',
      ],
      openQuestions: [
        'Which native plants should we prioritize?',
        'How do we handle winter maintenance?',
      ],
      actionItems: [
        { text: 'Submit grant application by October 30', owner: 'm-ana' },
        { text: 'Design garden layout and signage', owner: null },
      ],
      transcriptUrl: 'https://meetings.example.org/transcripts/meeting-1',
    },
    {
      id: 'meeting-2',
      date: relativeDate(-12 * DAY),
      title: 'Treasury policy review',
      summary: 'Reviewed current treasury practices and discussed proposed policy updates for expense reporting and approval workflows.',
      decisions: [
        'Require two approvers for expenses over $500',
      ],
      openQuestions: [
        'Should we use a different tool for expense tracking?',
      ],
      actionItems: [
        { text: 'Draft updated policy document', owner: 'm-sam' },
        { text: 'Review existing expense reports', owner: 'm-jordan' },
      ],
      transcriptUrl: 'https://meetings.example.org/transcripts/meeting-2',
    },
  ];

  // Four chat threads
  const chatThreads: ChatThread[] = [
    {
      id: 'thread-1',
      channel: '#general',
      title: 'Garden grant application discussion',
      summary: 'Members discussing the timeline and requirements for the community garden grant.',
      messages: [
        {
          id: 'msg-1-1',
          author: 'm-ana',
          text: 'Just submitted the garden grant application! Fingers crossed.',
          at: relativeDate(-1 * DAY),
        },
        {
          id: 'msg-1-2',
          author: 'm-rob',
          text: 'That\'s great news! When will we hear back?',
          at: relativeDate(-1 * DAY + HOUR),
        },
        {
          id: 'msg-1-3',
          author: 'm-ana',
          text: 'They said 4-6 weeks. I\'ll keep everyone posted.',
          at: relativeDate(-1 * DAY + 2 * HOUR),
        },
      ],
    },
    {
      id: 'thread-2',
      channel: '#projects',
      title: 'Coding nights venue update',
      summary: 'Planning logistics for the youth coding workshop series.',
      messages: [
        {
          id: 'msg-2-1',
          author: 'm-rob',
          text: 'Library confirmed we can use their computer lab every Thursday!',
          at: relativeDate(-3 * DAY),
        },
        {
          id: 'msg-2-2',
          author: 'm-jordan',
          text: 'Perfect! I can help with the first session.',
          at: relativeDate(-3 * DAY + 2 * HOUR),
        },
      ],
    },
    {
      id: 'thread-3',
      channel: '#treasury',
      title: 'Expense reporting workflow',
      summary: 'Discussion about improving the current expense reporting process.',
      messages: [
        {
          id: 'msg-3-1',
          author: 'm-sam',
          text: 'Working on the new policy draft. Should have something to review by Monday.',
          at: relativeDate(-4 * DAY),
        },
      ],
    },
    {
      id: 'thread-4',
      channel: '#general',
      title: 'Welcome new members',
      summary: 'Welcoming and onboarding new DAO members.',
      messages: [
        {
          id: 'msg-4-1',
          author: 'm-casey',
          text: 'Welcome to the DAO! Excited to work with everyone.',
          at: relativeDate(-6 * DAY),
        },
        {
          id: 'msg-4-2',
          author: 'm-morgan',
          text: 'Thanks! Looking forward to contributing to the garden project.',
          at: relativeDate(-6 * DAY + HOUR),
        },
      ],
    },
  ];

  // Four events within 14 days
  const events: DaoEvent[] = [
    {
      id: 'event-1',
      title: 'Monthly governance meeting',
      startsAt: relativeDate(2 * DAY),
      detail: 'Review proposals, discuss ongoing initiatives, and plan upcoming activities.',
      kind: 'meeting',
    },
    {
      id: 'event-2',
      title: 'Garden grant proposal voting closes',
      startsAt: relativeDate(4 * DAY),
      detail: 'Last day to vote on the community garden grant application approval.',
      kind: 'vote',
    },
    {
      id: 'event-3',
      title: 'First coding workshop session',
      startsAt: relativeDate(5 * DAY),
      detail: 'Introduction to web development for local youth at the library.',
      kind: 'other',
    },
    {
      id: 'event-4',
      title: 'Treasury policy draft due',
      startsAt: relativeDate(6 * DAY),
      detail: 'Deadline for submitting the updated treasury policy draft for review.',
      kind: 'deadline',
    },
  ];


  // The grant finder's output: one opportunity per route, with an exact cutoff,
  // a date-only deadline and an unknown one. Sponsors and links are invented.
  const dateOnly = (offsetMs: number): string => relativeDate(offsetMs).slice(0, 10);
  const opportunities: FundingOpportunity[] = [
    {
      id: 'opp-garden',
      sponsor: 'Tarrant Neighborhood Fund (example)',
      program: 'Community Green Spaces grant',
      route: 'direct',
      summary: 'Small grants for resident-led gardens and green spaces in Tarrant County neighborhoods.',
      deadline: relativeDate(6 * DAY + 2 * HOUR),
      benefit: 'Up to $15,000',
      effort: 'Medium: narrative, budget and two letters of support',
      nextStep: 'Members confirm the match amount and the site lease letter.',
      sourceUrl: 'https://grants.example.org/green-spaces',
      observedAt: relativeDate(-1 * DAY),
      initiativeId: 'init-garden',
    },
    {
      id: 'opp-coding',
      sponsor: 'Lone Star Digital Futures (example)',
      program: 'Youth Digital Skills partner program',
      route: 'partner',
      summary: 'Funds coding programs for teens when a library or school leads the application.',
      deadline: dateOnly(18 * DAY),
      benefit: 'Up to $40,000 shared with the lead partner',
      effort: 'High: the lead partner files; we draft our capability section',
      nextStep: 'Ask the library branch whether they will lead.',
      sourceUrl: 'https://grants.example.org/digital-futures',
      observedAt: relativeDate(-2 * DAY),
      initiativeId: 'init-coding',
    },
    {
      id: 'opp-arts',
      sponsor: 'Fort Worth Arts Council (example)',
      program: 'Neighborhood arts mini-grants',
      route: 'next-cycle',
      summary: 'This cycle closed last month. The next one is expected to open in the spring.',
      deadline: null,
      benefit: 'Up to $5,000',
      effort: 'Low',
      nextStep: 'Recheck when the spring cycle is announced.',
      sourceUrl: 'https://grants.example.org/arts-mini',
      observedAt: relativeDate(-5 * DAY),
      initiativeId: null,
    },
    {
      id: 'opp-civic',
      sponsor: 'North Texas Civic Tech Foundation (example)',
      program: 'Open civic data awards',
      route: 'monitor',
      summary: 'Eligibility for DAOs is unclear on the official page, so this is being watched rather than pursued.',
      deadline: dateOnly(40 * DAY),
      benefit: null,
      effort: null,
      nextStep: 'Wait for the sponsor to answer the eligibility question.',
      sourceUrl: 'https://grants.example.org/civic-data',
      observedAt: relativeDate(-3 * DAY),
      initiativeId: null,
    },
    {
      id: 'opp-software',
      sponsor: 'Example Cloud Nonprofit Program',
      program: 'Donated software credits',
      route: 'standing-benefit',
      summary: 'Free hosting and office software for registered nonprofits, renewed yearly.',
      deadline: null,
      benefit: '$2,000 a year in credits',
      effort: 'Low: one form, renewed yearly',
      nextStep: 'Renew before the current credits expire.',
      sourceUrl: 'https://grants.example.org/cloud-credits',
      observedAt: relativeDate(-7 * DAY),
      initiativeId: null,
    },
  ];

  const applications: FundingApplication[] = [
    {
      id: 'app-garden',
      opportunityId: 'opp-garden',
      title: 'Community garden: Green Spaces application',
      stage: 'needs-members',
      readiness: { answered: 11, total: 14 },
      decisionsNeeded: [
        { id: 'dec-match', question: 'Confirm the $3,000 in-kind match', blocks: 'the budget and match sections' },
        { id: 'dec-lease', question: 'Upload the site lease letter', blocks: 'the site control requirement' },
        { id: 'dec-letters', question: 'Name who will ask for the two letters of support', blocks: 'the attachments' },
      ],
      submittedAt: null,
      packetUrl: null,
    },
    {
      id: 'app-coding',
      opportunityId: 'opp-coding',
      title: 'Youth coding nights: Digital Skills capability section',
      stage: 'drafting',
      readiness: { answered: 3, total: 9 },
      decisionsNeeded: [],
      submittedAt: null,
      packetUrl: null,
    },
  ];

  return {
    members,
    proposals,
    initiatives,
    tasks,
    meetings,
    chatThreads,
    events,
    opportunities,
    applications,
  };
}
