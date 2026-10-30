/** Display catalog for the company Integrations settings page. Describes how each integration connects; it is not live health or authority. */
export type IntegrationStatus = 'in_use' | 'setup_needed' | 'planned';
export type IntegrationDirection = 'reads' | 'writes' | 'reads_and_writes';

export interface Integration {
  id: string;
  name: string;
  category: 'Conversation' | 'Meetings' | 'Funding' | 'DAO platform' | 'Governance' | 'Knowledge' | 'Model';
  status: IntegrationStatus;
  direction: IntegrationDirection;
  summary: string;
  how: string;
  link?: string;
}

export const statusLabel: Record<IntegrationStatus, string> = { in_use: 'In use', setup_needed: 'Setup needed', planned: 'Planned' };
export const directionLabel: Record<IntegrationDirection, string> = { reads: 'Reads', writes: 'Writes', reads_and_writes: 'Reads and writes' };

export const integrations: readonly Integration[] = [
  { id: 'buzz', name: 'Buzz', category: 'Conversation', status: 'in_use', direction: 'reads_and_writes', summary: 'Member conversations and replies mirrored with native tasks and comments.', how: 'Signed relay bridge with paired member identities and recoverable delivery.', link: 'https://github.com/block/buzz' },
  { id: 'telegram', name: 'Telegram', category: 'Conversation', status: 'setup_needed', direction: 'reads', summary: 'Group discussion as organizational context.', how: 'Chat history export upload now; a listening bot later.' },
  { id: 'meetings', name: 'Meeting recordings and transcripts', category: 'Meetings', status: 'in_use', direction: 'reads', summary: 'Wednesday Roundtables become a faithful transcript, separate notes and follow-up work.', how: 'Upload audio (transcribed locally with Whisper), a transcript or notes; Meet/Drive source when connected.' },
  { id: 'meeting-mode', name: 'Meeting Mode', category: 'Meetings', status: 'planned', direction: 'reads', summary: 'Live meeting state, agendas and motions.', how: 'Read existing meeting records by their identifiers.', link: 'https://github.com/FWTX-DAO/meeting-mode' },
  { id: 'grant-finder', name: 'Grant finder', category: 'Funding', status: 'in_use', direction: 'reads', summary: 'New funding opportunities matched to initiatives.', how: 'Discovery service briefs with source-bound deadline and benefit facts.' },
  { id: 'funding-workflow', name: 'Funding workflow', category: 'Funding', status: 'in_use', direction: 'reads_and_writes', summary: 'Evidence, application packets and member review.', how: 'Named SQL tools on the DAO database; exact-version packet confirmation in the Packet tab.' },
  { id: 'dao-platform', name: 'DAO platform', category: 'DAO platform', status: 'setup_needed', direction: 'reads', summary: 'Members, projects and innovation bounties.', how: 'Objective intake from bounty submissions into native work.', link: 'https://github.com/FWTX-DAO/dao-platform' },
  { id: 'website', name: 'Website and member portal', category: 'DAO platform', status: 'setup_needed', direction: 'reads_and_writes', summary: 'Public programs as context; members-only meeting publication.', how: 'Repository and pages read as sources; publication through the member portal API.', link: 'https://github.com/FWTX-DAO/website' },
  { id: 'github', name: 'GitHub', category: 'Knowledge', status: 'setup_needed', direction: 'reads', summary: 'Repositories, READMEs and issues as project context.', how: 'Read public organization repositories.', link: 'https://github.com/FWTX-DAO' },
  { id: 'governance', name: "Rob's Rules (Vocdoni)", category: 'Governance', status: 'setup_needed', direction: 'reads', summary: 'Votes that adopt initiatives or authorize a packet when required.', how: 'Verifies a final vote result bound to the exact packet; never casts votes.', link: 'https://robsrulesdao.com/' },
  { id: 'texas-nova', name: 'Texas Nova', category: 'Knowledge', status: 'planned', direction: 'reads', summary: 'Statewide and county civic news for opportunity context.', how: 'Innovation Lab app, read as an external source.' },
  { id: '990-graph', name: '990 Graph', category: 'Knowledge', status: 'planned', direction: 'reads', summary: 'Nonprofit and funder research from IRS Form 990 filings.', how: 'Innovation Lab app, read-only research source.' },
  { id: 'talent-network', name: 'Fort Worth Talent Network', category: 'DAO platform', status: 'planned', direction: 'reads', summary: 'Member skills and interests for suggesting work.', how: 'Member-approved profile fields only.' },
  { id: 'glm', name: 'GLM', category: 'Model', status: 'setup_needed', direction: 'reads_and_writes', summary: 'Language model for agents, extraction and drafting.', how: 'API key stored in company secrets; agents use the Anthropic-compatible endpoint.' },
];
