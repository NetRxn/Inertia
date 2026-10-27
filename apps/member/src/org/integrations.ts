import type { Adapters } from '../adapters/types';

export type IntegrationStatus = 'connected' | 'available' | 'planned';

export interface IntegrationCard {
  id: string;
  name: string;
  what: string;
  how: string;
  status: IntegrationStatus;
  direction: 'Reads' | 'Writes' | 'Reads and writes';
}

/**
 * Everything the organization can plug into Inertia, with live status where
 * the app can tell from its own settings. Anything can join this list: an
 * integration only needs to say what it reads or writes and how it connects.
 */
export function integrationCards(env: Record<string, string | undefined>, adapters: Pick<Adapters, 'work'>, counts: { sources: number; meetings: number; chatExports: number; repositories?: number }): IntegrationCard[] {
  const live = env.MEMBER_APP_ADAPTERS === 'live';
  const engine = adapters.work.engine?.name;
  const model = env.MEMBER_APP_MODEL_PROVIDER && env.MEMBER_APP_MODEL ? `${env.MEMBER_APP_MODEL}${env.MEMBER_APP_MODEL_BASE_URL?.includes('z.ai') ? ' (Z.ai)' : ''}` : null;
  return [
    { id: 'paperclip', name: 'Paperclip', what: 'Agents and the work they do: initiatives, projects and tasks.', how: engine === 'Paperclip' ? 'Connected with a board API key. Human tasks carry the "human" label; claims assign the member.' : 'Set PAPERCLIP_URL, PAPERCLIP_API_KEY and PAPERCLIP_COMPANY_ID.', status: engine === 'Paperclip' ? 'connected' : 'available', direction: 'Reads and writes' },
    { id: 'model', name: 'Language model', what: 'Reads what you share, drafts the profile, answers questions with sources.', how: model ? `Using ${model}.` : 'Set MEMBER_APP_MODEL_PROVIDER and MEMBER_APP_MODEL (Z.ai GLM, Anthropic or any OpenAI-compatible server).', status: model ? 'connected' : 'available', direction: 'Reads' },
    { id: 'uploads', name: 'Uploads and notes', what: 'Meeting transcripts, notes, documents and links anyone adds.', how: `${counts.sources} things read so far, ${counts.meetings} of them meetings.`, status: 'connected', direction: 'Reads' },
    { id: 'website', name: 'Website', what: 'Your public pages, read during setup or any time from Data.', how: 'Pages are fetched safely (public hosts only) and read as text.', status: 'connected', direction: 'Reads' },
    { id: 'telegram', name: 'Telegram', what: 'Group discussion as context.', how: counts.chatExports ? `${counts.chatExports} chat export${counts.chatExports === 1 ? '' : 's'} read. A listening bot is next.` : 'Upload a chat export (.json) from Telegram Desktop now; a listening bot is next.', status: counts.chatExports ? 'connected' : 'available', direction: 'Reads' },
    { id: 'grant-finder', name: 'Grant finder', what: 'New funding opportunities matched to your initiatives.', how: env.MEMBER_APP_FUNDING_FILE ? 'Reading the grant finder export.' : 'Point MEMBER_APP_FUNDING_FILE at a grant finder export.', status: env.MEMBER_APP_FUNDING_FILE || !live ? 'connected' : 'available', direction: 'Reads' },
    { id: 'buzz', name: 'Buzz', what: 'Member conversations mirrored with tasks and comments.', how: 'Through the signed Buzz bridge in the Paperclip plugin.', status: 'available', direction: 'Reads and writes' },
    { id: 'roberts-rules', name: "Robert's Rules (Vocdoni)", what: 'Votes that adopt initiatives when governance is on.', how: 'Read-only: Inertia shows proposals and tallies and links out to vote.', status: live ? 'available' : 'connected', direction: 'Reads' },
    { id: 'github', name: 'GitHub', what: 'Repositories and READMEs as project context.', how: counts.repositories ? `${counts.repositories} repositor${counts.repositories === 1 ? 'y' : 'ies'} read. Read more from Data.` : 'Enter an organization or owner/repo in Data → Read GitHub.', status: counts.repositories ? 'connected' : 'available', direction: 'Reads' },
    { id: 'drive', name: 'Google Drive and Meet', what: 'Meeting recordings and Gemini notes as they are created.', how: 'Through the meeting ingestion already built in Inertia.', status: 'planned', direction: 'Reads' },
    { id: 'discord', name: 'Discord', what: 'Community chat as context.', how: 'Same pattern as Telegram.', status: 'planned', direction: 'Reads' },
  ];
}
