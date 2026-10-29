'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { getAdapters } from '../adapters';
import { backgroundAskJson } from '../assistant/model';
import { getDb } from '../db/client';
import { clearIntegrationSetting, effectiveEnv, getIntegrationSetting, saveIntegrationSetting } from '../settings/store';
import { SecretKeyMissingError } from '../settings/secrets';
import { issueSignInLink } from '../identity/auth';
import { requireMember } from '../identity/session';
import { addSource, hideSource, IngestError, restoreSource } from './ingest';
import { addMember, isAdmin, MemberError, removeMember, setRole, setWorkUser, type Role } from './members';
import { completeSetup, getOrganization, saveBasics, saveProfile, setGovernance, updateInitiative } from './organization';
import { regenerateProfile } from './profile';
import { readWebsite } from './website';
import { ReadOnlyWorkError } from '../work/read-only';

export type ActionResult = { ok: true; message?: string; link?: string } | { ok: false; error: string };

function fail(error: unknown, fallback: string): ActionResult {
  if (error instanceof MemberError || error instanceof IngestError || error instanceof ReadOnlyWorkError) return { ok: false, error: error.message };
  console.error('[org]', error);
  return { ok: false, error: fallback };
}

async function requireAdminMember() {
  const member = await requireMember();
  if (!isAdmin(member)) throw new MemberError('forbidden', 'Only admins can do that.');
  return member;
}

function refresh() {
  for (const path of ['/', '/org', '/agents', '/setup']) revalidatePath(path);
}

/** Saves the name, website and description from setup or the Profile page. */
export async function saveOrganizationBasics(input: { name?: string; website?: string; description?: string }): Promise<ActionResult> {
  try {
    const member = await requireAdminMember();
    if (input.name !== undefined && !input.name.trim()) return { ok: false, error: 'The organization needs a name.' };
    // The website is shown as a link, so only web addresses.
    if (input.website?.trim() && !/^https?:\/\/[^\s]+$/i.test(input.website.trim())) return { ok: false, error: 'The website should start with https://.' };
    const db = getDb();
    const before = await getOrganization(db);
    const org = await saveBasics(db, input);
    if (input.description?.trim() && input.description.trim() !== before?.description) {
      await addSource(db, { kind: 'note', title: `About ${org.name}`, content: input.description, addedBy: member.id });
    }
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error, "Couldn't save that. Try again?");
  }
}

/** Reads a website's pages into org memory. */
export async function readOrganizationWebsite(website: string): Promise<ActionResult> {
  try {
    const member = await requireAdminMember();
    const url = new URL(/^https?:\/\//i.test(website.trim()) ? website.trim() : `https://${website.trim()}`);
    const db = getDb();
    await saveBasics(db, { website: url.toString() });
    const pages = await readWebsite(url.toString());
    let added = 0;
    for (const page of pages) {
      const { duplicate } = await addSource(db, { kind: 'website', title: page.title, origin: page.url, content: page.text, addedBy: member.id });
      if (!duplicate) added++;
    }
    refresh();
    return pages.length
      ? { ok: true, message: `Read ${pages.length} page${pages.length === 1 ? '' : 's'}${added < pages.length ? ` (${pages.length - added} already known)` : ''}.` }
      : { ok: false, error: "Couldn't read that website. You can paste some text about it instead." };
  } catch (error) {
    return fail(error, "Couldn't read that website. Check the address?");
  }
}

/** Adds a pasted note to org memory. Anyone signed in can share. */
export async function addNote(input: { title: string; text: string; kind?: 'note' | 'meeting' }): Promise<ActionResult> {
  try {
    const member = await requireMember();
    const { duplicate } = await addSource(getDb(), { kind: input.kind ?? 'note', title: input.title || 'Note', content: input.text, addedBy: member.id });
    refresh();
    return { ok: true, message: duplicate ? 'Inertia already had that.' : 'Added.' };
  } catch (error) {
    return fail(error, "Couldn't add that. Try again?");
  }
}

export async function draftProfile(): Promise<ActionResult> {
  try {
    await requireAdminMember();
    const profile = await regenerateProfile(getDb(), backgroundAskJson(await effectiveEnv(getDb())));
    refresh();
    return { ok: true, message: `Drafted ${profile.initiatives.length} initiatives.` };
  } catch (error) {
    if (error instanceof Error && /Share something/.test(error.message)) return { ok: false, error: error.message };
    return fail(error, 'Inertia could not draft the profile just now. Try again in a moment?');
  }
}

/**
 * Accepting an initiative creates it in the work engine. With governance on,
 * it stays proposed there until the organization adopts it.
 */
export async function decideInitiative(id: string, decision: 'accept' | 'dismiss' | 'adopt' | 'reopen'): Promise<ActionResult> {
  try {
    await requireAdminMember();
    const db = getDb();
    const org = await getOrganization(db);
    const initiative = org?.profile?.initiatives.find((i) => i.id === id);
    if (!org || !initiative) return { ok: false, error: 'That initiative is gone. Refresh?' };
    if (decision === 'dismiss') await updateInitiative(db, id, { status: 'dismissed' });
    else if (decision === 'reopen') await updateInitiative(db, id, { status: 'proposed' });
    else {
      const adopted = decision === 'adopt' || !org.governanceEnabled || initiative.adopted;
      let workId = initiative.workId;
      const work = getAdapters().work;
      if (!workId && work.createInitiative) workId = (await work.createInitiative({ title: initiative.title, summary: initiative.summary, adopted })).id;
      await updateInitiative(db, id, { status: 'accepted', workId, adopted });
    }
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error, "Couldn't update that initiative. Try again?");
  }
}

/** An initiative the profile didn't find, such as a strategy that hasn't been voted on yet. */
export async function addInitiative(input: { title: string; summary: string }): Promise<ActionResult> {
  try {
    await requireAdminMember();
    const db = getDb();
    const org = await getOrganization(db);
    if (!org) return { ok: false, error: 'Set up the organization first.' };
    const title = input.title.trim().slice(0, 120);
    if (!title) return { ok: false, error: 'Give it a name.' };
    const profile = org.profile ?? { mission: null, programs: [], people: [], recent: [], initiatives: [] };
    await saveProfile(db, {
      ...profile,
      initiatives: [...profile.initiatives, { id: randomUUID(), title, summary: input.summary.trim().slice(0, 600), citations: [], status: 'proposed', workId: null, adopted: false }],
    }, org.profileGeneratedAt ?? new Date());
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error, "Couldn't add that initiative.");
  }
}

export async function finishSetup(): Promise<ActionResult> {
  try {
    await requireAdminMember();
    await completeSetup(getDb());
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error, "Couldn't finish setup. Try again?");
  }
}

export async function changeGovernance(enabled: boolean): Promise<ActionResult> {
  try {
    await requireAdminMember();
    await setGovernance(getDb(), enabled);
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error, "Couldn't change governance.");
  }
}

export async function setSourceVisibility(id: string, visible: boolean, reason = ''): Promise<ActionResult> {
  try {
    const member = await requireAdminMember();
    if (visible) await restoreSource(getDb(), id);
    else await hideSource(getDb(), id, member.id, reason);
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error, "Couldn't change that source.");
  }
}

const signInBase = () => process.env.MEMBER_APP_BASE_URL || 'http://localhost:3000';

/** Adds a member and returns a one-time sign-in link for the admin to send them. */
export async function inviteMember(input: { email: string; displayName: string; role: Role }): Promise<ActionResult> {
  try {
    const member = await requireMember();
    const db = getDb();
    const added = await addMember(db, member, input);
    const issued = await issueSignInLink(db, added.id, { baseUrl: signInBase() });
    refresh();
    return { ok: true, message: `${added.displayName} is a member. Send them this sign-in link; it works once, within 3 days.`, link: issued?.url };
  } catch (error) {
    return fail(error, "Couldn't add that member.");
  }
}

/** A fresh one-time sign-in link for an existing member, for when theirs was used or expired. */
export async function memberSignInLink(memberId: string): Promise<ActionResult> {
  try {
    await requireAdminMember();
    const issued = await issueSignInLink(getDb(), memberId, { baseUrl: signInBase() });
    if (!issued) return { ok: false, error: 'That member is no longer active.' };
    return { ok: true, message: 'Send this sign-in link; it works once, within 3 days.', link: issued.url };
  } catch (error) {
    return fail(error, "Couldn't make a sign-in link.");
  }
}

export async function updateMember(memberId: string, change: { role?: Role; workUserId?: string | null; remove?: boolean }): Promise<ActionResult> {
  try {
    const member = await requireMember();
    const db = getDb();
    if (change.remove) await removeMember(db, member, memberId);
    if (change.role) await setRole(db, member, memberId, change.role);
    if (change.workUserId !== undefined) await setWorkUser(db, member, memberId, change.workUserId);
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error, "Couldn't update that member.");
  }
}

/** Starts pursuing a funding opportunity: a project under the grant initiative and its first tasks. */
export async function pursueFunding(opportunityId: string): Promise<ActionResult> {
  try {
    const member = await requireAdminMember();
    const adapters = getAdapters();
    const opportunity = (await adapters.funding.listOpportunities()).find((o) => o.id === opportunityId);
    if (!opportunity) return { ok: false, error: 'That opportunity is gone. Refresh?' };
    const { pursueOpportunity } = await import('../work/pursue');
    const result = await pursueOpportunity(getDb(), adapters, backgroundAskJson(await effectiveEnv(getDb())), opportunity, member.id);
    for (const path of ['/org', '/']) revalidatePath(path);
    refresh();
    if (result.already) return { ok: true, message: 'Already being pursued. See Home.' };
    const people = result.plan.tasks.filter((t) => t.lane === 'human').length;
    return { ok: true, message: `Started: ${result.created} tasks, ${people} for people. See Home.` };
  } catch (error) {
    return fail(error, 'Inertia could not plan this one just now. Try again in a moment?');
  }
}

/** Reads one shared source for work people or agents could pick up. */
export async function findWorkIn(sourceId: string): Promise<ActionResult> {
  try {
    const member = await requireAdminMember();
    const { suggestWorkFromSource } = await import('../work/suggest');
    const result = await suggestWorkFromSource(getDb(), getAdapters(), backgroundAskJson(await effectiveEnv(getDb())), sourceId, member.id);
    refresh();
    if (result.already) return { ok: true, message: 'Already read for work. See Home and Agents.' };
    if (!result.created) return { ok: true, message: 'Nothing actionable found in this one.' };
    return { ok: true, message: `Found ${result.created} item${result.created === 1 ? '' : 's'}, ${result.people} for people. See Home and Agents.` };
  } catch (error) {
    if (error instanceof Error && /Keep at least one initiative|not available/.test(error.message)) return { ok: false, error: error.message };
    return fail(error, 'Inertia could not read this for work just now. Try again in a moment?');
  }
}

/** Reads an organization's public GitHub repositories (or named ones) into what Inertia knows. */
export async function readGithubRepos(input: string): Promise<ActionResult> {
  try {
    const member = await requireAdminMember();
    const { readGithub } = await import('./github');
    const pages = await readGithub(input);
    if (!pages.length) return { ok: false, error: "Couldn't read any repositories there. Try owner/repo for each one?" };
    const db = getDb();
    let added = 0;
    for (const page of pages) {
      const { duplicate } = await addSource(db, { kind: 'document', title: page.title, origin: page.url, content: page.text, addedBy: member.id });
      if (!duplicate) added++;
    }
    refresh();
    return { ok: true, message: `Read ${pages.length} repositor${pages.length === 1 ? 'y' : 'ies'}${added < pages.length ? ` (${pages.length - added} already known)` : ''}.` };
  } catch (error) {
    return fail(error, "Couldn't read GitHub just now.");
  }
}

/** Tests each integration with the current settings, for Agents → Connections. */
export async function checkIntegrations(): Promise<{ ok: true; results: import('../connectors/check').CheckResult[] } | { ok: false; error: string }> {
  try {
    await requireAdminMember();
    const { checkConnections } = await import('../connectors/check');
    return { ok: true, results: await checkConnections(await effectiveEnv(getDb(), process.env, { fresh: true })) };
  } catch (error) {
    if (error instanceof MemberError) return { ok: false, error: error.message };
    return { ok: false, error: "Couldn't run the checks." };
  }
}

const MODEL_PROVIDERS = ['anthropic', 'openai-compatible'] as const;
const TELEGRAM_TOKEN = /^\d{5,}:[A-Za-z0-9_-]{30,}$/;
const CHAT_IDS = /^\s*(-?\d+\s*(,\s*-?\d+\s*)*)?$/;

function settingError(error: unknown, fallback: string): ActionResult {
  if (error instanceof SecretKeyMissingError) return { ok: false, error: error.message };
  return fail(error, fallback);
}

/** The language model for the chat and the data processing. An empty key keeps the saved one. */
export async function saveModelSettings(input: { provider: string; model: string; fastModel: string; baseUrl: string; apiKey: string }): Promise<ActionResult> {
  try {
    const member = await requireAdminMember();
    const provider = MODEL_PROVIDERS.find((p) => p === input.provider);
    if (!provider) return { ok: false, error: 'Pick Anthropic or an OpenAI-compatible server.' };
    const model = input.model.trim().slice(0, 120);
    if (!model) return { ok: false, error: 'Name the model, e.g. claude-sonnet-5-5.' };
    const baseUrl = input.baseUrl.trim();
    if (baseUrl && !/^https?:\/\/[^\s]+$/.test(baseUrl)) return { ok: false, error: 'The server address should start with https://.' };
    if (provider === 'openai-compatible' && !baseUrl) return { ok: false, error: 'An OpenAI-compatible server needs its address.' };
    const db = getDb();
    await saveIntegrationSetting(db, 'model', { provider, model, fastModel: input.fastModel.trim().slice(0, 120), baseUrl }, input.apiKey.trim() || undefined, member.id);
    refresh();
    return { ok: true, message: 'Saved. The chat and the data processing use it from now on. Check the connections to try it.' };
  } catch (error) {
    return settingError(error, "Couldn't save the model settings.");
  }
}

/** The Telegram bot the connectors read. The token is checked with Telegram before it is kept. */
export async function saveTelegramSettings(input: { token: string; chatIds: string }): Promise<ActionResult> {
  try {
    const member = await requireAdminMember();
    const token = input.token.trim();
    if (token && !TELEGRAM_TOKEN.test(token)) return { ok: false, error: 'That doesn’t look like a bot token from @BotFather (it looks like 123456:ABC…).' };
    if (!CHAT_IDS.test(input.chatIds)) return { ok: false, error: 'Chat ids are numbers separated by commas, like -1001234567890.' };
    const chatIds = input.chatIds.split(',').map((id) => id.trim()).filter(Boolean).join(',');
    const db = getDb();
    let who = '';
    if (token) {
      const { telegramMe } = await import('../connectors/telegram');
      try {
        const me = await telegramMe({ token, chatIds: [] });
        who = ` as @${me.username}${me.canReadAllGroupMessages ? '' : '. Turn off privacy in @BotFather (/setprivacy → Disable) so it sees group messages'}`;
      } catch {
        return { ok: false, error: 'Telegram didn’t accept that token. Copy it again from @BotFather?' };
      }
    } else if (!(await getIntegrationSetting(db, 'telegram'))?.hasSecret) {
      return { ok: false, error: 'Paste the bot token from @BotFather.' };
    }
    await saveIntegrationSetting(db, 'telegram', { chatIds }, token || undefined, member.id);
    refresh();
    return { ok: true, message: `Saved${who}. The connectors pick it up within a minute (they must be running).` };
  } catch (error) {
    return settingError(error, "Couldn't save the Telegram settings.");
  }
}

/** Forgets what was saved in the app, so the server's own settings apply again. */
export async function clearIntegrationSettings(id: 'model' | 'telegram'): Promise<ActionResult> {
  try {
    await requireAdminMember();
    await clearIntegrationSetting(getDb(), id);
    refresh();
    return { ok: true, message: 'Cleared. The server’s own settings apply again.' };
  } catch (error) {
    return fail(error, "Couldn't clear that.");
  }
}
