'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  changeGovernance,
  checkIntegrations,
  clearIntegrationSettings,
  saveModelSettings,
  saveOrganizationBasics,
  saveTelegramSettings,
  decideInitiative,
  draftProfile,
  findWorkIn,
  inviteMember,
  memberSignInLink,
  readOrganizationWebsite,
  readGithubRepos,
  setSourceVisibility,
  updateMember,
  type ActionResult,
} from '../org/actions';
import type { Role } from '../org/members';
import type { CheckResult } from '../connectors/check';
import styles from './OrgControls.module.css';

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const run = (action: () => Promise<ActionResult>, after?: () => void) => {
    setMessage(null);
    setLink(null);
    start(async () => {
      const result = await action();
      setMessage(result.ok ? result.message ?? null : result.error);
      setLink(result.ok ? result.link ?? null : null);
      if (result.ok) {
        after?.();
        router.refresh();
      }
    });
  };
  return { pending, message, link, run };
}

function Notice({ message }: { message: string | null }) {
  return message ? <p className={styles.notice} role="status">{message}</p> : null;
}

/** A one-time sign-in link for the admin to copy and send, since the app sends no email yet. */
function SignInLink({ url }: { url: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!url) return null;
  return (
    <div className={styles.row}>
      <input className={styles.input} aria-label="Sign-in link" value={url} readOnly onFocus={(e) => e.currentTarget.select()} />
      <button
        type="button"
        className="in-btn in-btn--quiet"
        onClick={() => navigator.clipboard?.writeText(url).then(() => setCopied(true), () => setCopied(false))}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

/** Redraft the profile from everything shared so far. */
export function RedraftProfile() {
  const { pending, message, run } = useAction();
  return (
    <div className={styles.row}>
      <button className="in-btn in-btn--secondary" disabled={pending} onClick={() => run(draftProfile)}>{pending ? 'Reading everything…' : 'Read everything again'}</button>
      <Notice message={message} />
    </div>
  );
}

export function InitiativeChoice({ id, status, adopted, governance }: { id: string; status: 'proposed' | 'accepted' | 'dismissed'; adopted: boolean; governance: boolean }) {
  const { pending, run } = useAction();
  if (status === 'proposed') {
    return (
      <div className={styles.row}>
        <button className="in-btn in-btn--secondary" disabled={pending} onClick={() => run(() => decideInitiative(id, 'accept'))}>Keep</button>
        <button className="in-btn in-btn--quiet" disabled={pending} onClick={() => run(() => decideInitiative(id, 'dismiss'))}>Not us</button>
      </div>
    );
  }
  if (status === 'accepted' && governance && !adopted) {
    return <button className="in-btn in-btn--quiet" disabled={pending} onClick={() => run(() => decideInitiative(id, 'adopt'))}>Mark adopted by vote</button>;
  }
  if (status === 'dismissed') return <button className="in-btn in-btn--quiet" disabled={pending} onClick={() => run(() => decideInitiative(id, 'reopen'))}>Reconsider</button>;
  return null;
}

/** Add to Inertia: files, a link or pasted text. Open to every member. */
export function AddToInertia() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [meeting, setMeeting] = useState(false);

  function send(files: FileList | null) {
    const form = new FormData();
    for (const file of Array.from(files ?? [])) form.append('file', file);
    if (text.trim()) form.append('text', text);
    if (link.trim()) form.append('link', link.trim());
    if (title.trim()) form.append('title', title.trim());
    if (meeting) form.append('kind', 'meeting');
    setMessage(null);
    start(async () => {
      const response = await fetch('/api/org/sources', { method: 'POST', body: form });
      const body = (await response.json().catch(() => ({}))) as { added?: { title: string; duplicate: boolean }[]; error?: string };
      if (!response.ok) {
        setMessage(body.error ?? "Couldn't add that. Try again?");
        return;
      }
      setMessage(`Added: ${(body.added ?? []).map((a) => (a.duplicate ? `${a.title} (already had it)` : a.title)).join(', ')}`);
      setText('');
      setTitle('');
      setLink('');
      router.refresh();
    });
  }

  return (
    <form className={styles.stack} onSubmit={(e: FormEvent) => { e.preventDefault(); send(null); }}>
      <label className={styles.drop}>
        <input type="file" multiple accept=".txt,.md,.markdown,.vtt,.srt,.json,.html,.htm,.csv" disabled={pending} onChange={(e) => send(e.target.files)} />
        <span>Drop in notes, transcripts (.vtt, .srt), a Telegram export (.json) or documents</span>
        <span className={styles.meta}>Recordings: transcribe first (local Whisper). Audio upload is next.</span>
      </label>
      <input className={styles.input} aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" maxLength={200} />
      <input className={styles.input} aria-label="Link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="…or a link to a page" inputMode="url" />
      <textarea className={styles.input} aria-label="Text" value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="…or paste notes, a transcript or an update" />
      <label className={styles.check}><input type="checkbox" checked={meeting} onChange={(e) => setMeeting(e.target.checked)} /> This is from a meeting</label>
      <div className={styles.row}>
        <button className="in-btn in-btn--primary" disabled={pending || (!text.trim() && !link.trim())}>{pending ? 'Reading…' : 'Add to Inertia'}</button>
        <Notice message={message} />
      </div>
    </form>
  );
}

export function ReadWebsite({ current }: { current: string | null }) {
  const { pending, message, run } = useAction();
  const [url, setUrl] = useState(current ?? '');
  return (
    <form className={styles.row} onSubmit={(e) => { e.preventDefault(); run(() => readOrganizationWebsite(url)); }}>
      <input className={styles.input} aria-label="Website" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="fwtx.city" />
      <button className="in-btn in-btn--secondary" disabled={pending || !url.trim()}>{pending ? 'Reading…' : 'Read website'}</button>
      <Notice message={message} />
    </form>
  );
}

/** Read one source for work: action items and offers become open tasks. */
export function FindWork({ id, done }: { id: string; done: boolean }) {
  const { pending, message, run } = useAction();
  return (
    <div className={styles.stack}>
      <button className="in-btn in-btn--secondary" disabled={pending || done} onClick={() => run(() => findWorkIn(id))}>
        {pending ? 'Reading for work…' : done ? 'Read for work' : 'Find work in this'}
      </button>
      <Notice message={message} />
    </div>
  );
}

export function ReadGithub() {
  const { pending, message, run } = useAction();
  const [input, setInput] = useState('');
  return (
    <form className={styles.row} onSubmit={(e) => { e.preventDefault(); run(() => readGithubRepos(input)); }}>
      <input className={styles.input} aria-label="GitHub" value={input} onChange={(e) => setInput(e.target.value)} placeholder="GitHub org or owner/repo, e.g. FWTX-DAO" />
      <button className="in-btn in-btn--secondary" disabled={pending || !input.trim()}>{pending ? 'Reading…' : 'Read GitHub'}</button>
      <Notice message={message} />
    </form>
  );
}

export function SourceVisibility({ id, hidden }: { id: string; hidden: boolean }) {
  const { pending, run } = useAction();
  return hidden ? (
    <button className="in-btn in-btn--quiet" disabled={pending} onClick={() => run(() => setSourceVisibility(id, true))}>Restore</button>
  ) : (
    <button className="in-btn in-btn--quiet" disabled={pending} onClick={() => { const reason = window.prompt('Why hide this? Members and the assistant will stop seeing it.'); if (reason !== null) run(() => setSourceVisibility(id, false, reason)); }}>Hide</button>
  );
}

export function InviteMember() {
  const { pending, message, link, run } = useAction();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('member');
  return (
    <form className={styles.row} onSubmit={(e) => { e.preventDefault(); run(() => inviteMember({ email, displayName: name, role }), () => { setEmail(''); setName(''); }); }}>
      <input className={styles.input} aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" maxLength={120} />
      <input className={styles.input} aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.org" type="email" required />
      <select className={styles.input} aria-label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
        <option value="member">Member</option>
        <option value="admin">Admin</option>
      </select>
      <button className="in-btn in-btn--primary" disabled={pending || !email.trim()}>Add member</button>
      <Notice message={message} />
      <SignInLink url={link} />
    </form>
  );
}

export function MemberControls({ id, role, workUserId, isSelf }: { id: string; role: Role; workUserId: string | null; isSelf: boolean }) {
  const { pending, message, link, run } = useAction();
  const [work, setWork] = useState(workUserId ?? '');
  return (
    <div className={styles.stack}>
      <div className={styles.row}>
        <button className="in-btn in-btn--quiet" disabled={pending} onClick={() => run(() => memberSignInLink(id))}>Sign-in link</button>
        <button className="in-btn in-btn--quiet" disabled={pending} onClick={() => run(() => updateMember(id, { role: role === 'admin' ? 'member' : 'admin' }))}>{role === 'admin' ? 'Make member' : 'Make admin'}</button>
        {!isSelf && <button className="in-btn in-btn--quiet" disabled={pending} onClick={() => { if (window.confirm('Remove this member? Their history stays.')) run(() => updateMember(id, { remove: true })); }}>Remove</button>}
      </div>
      <form className={styles.row} onSubmit={(e) => { e.preventDefault(); run(() => updateMember(id, { workUserId: work })); }}>
        <input className={styles.input} aria-label="Paperclip user id" value={work} onChange={(e) => setWork(e.target.value)} placeholder="Paperclip user id (for claims)" />
        <button className="in-btn in-btn--quiet" disabled={pending || work === (workUserId ?? '')}>Save</button>
      </form>
      <Notice message={message} />
      <SignInLink url={link} />
    </div>
  );
}

export function GovernanceToggle({ enabled }: { enabled: boolean }) {
  const { pending, message, run } = useAction();
  return (
    <div className={styles.stack}>
      <label className={styles.check}>
        <input type="checkbox" checked={enabled} disabled={pending} onChange={(e) => run(() => changeGovernance(e.target.checked))} />
        Initiatives need a vote before they&apos;re active
      </label>
      <p className={styles.meta}>Off: admins keep initiatives directly. On: kept initiatives stay <em>proposed</em> in the work engine until marked adopted by vote (Robert&apos;s Rules).</p>
      <Notice message={message} />
    </div>
  );
}

const CHECK_CHIP: Record<CheckResult['status'], string> = { ok: 'in-chip--moss', warning: 'in-chip--pollen', 'not set': 'in-chip--tide', failed: 'in-chip--signal' };

/** Tests every integration with the current settings and shows what to fix. */
export function CheckConnections() {
  const [pending, start] = useTransition();
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className={styles.stack}>
      <button className="in-btn in-btn--secondary" disabled={pending} onClick={() => start(async () => {
        setError(null);
        const r = await checkIntegrations();
        if (r.ok) setResults(r.results);
        else setError(r.error);
      })}>{pending ? 'Checking…' : 'Check connections'}</button>
      {error && <p className={styles.notice} role="alert">{error}</p>}
      {results && (
        <ul className={styles.stack} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {results.map((r) => (
            <li key={r.name}>
              <span className={`in-chip ${CHECK_CHIP[r.status]}`}>{r.status}</span> <strong>{r.name}</strong>
              <p className={styles.meta}>{r.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type ModelSettingsValue = { provider: string; model: string; fastModel: string; baseUrl: string; hasKey: boolean; saved: boolean };

/** Which language model the chat and the data processing use. Keys are write-only. */
export function ModelSettings({ current, canStoreKeys }: { current: ModelSettingsValue; canStoreKeys: boolean }) {
  const { pending, message, run } = useAction();
  const [provider, setProvider] = useState(current.provider || 'anthropic');
  const [model, setModel] = useState(current.model);
  const [fastModel, setFastModel] = useState(current.fastModel);
  const [baseUrl, setBaseUrl] = useState(current.baseUrl);
  const [apiKey, setApiKey] = useState('');
  return (
    <form className={styles.stack} onSubmit={(e: FormEvent) => { e.preventDefault(); run(() => saveModelSettings({ provider, model, fastModel, baseUrl, apiKey }), () => setApiKey('')); }}>
      <div className={styles.row}>
        <select className={styles.input} aria-label="Provider" value={provider} onChange={(e) => setProvider(e.target.value)}>
          <option value="anthropic">Anthropic (Claude)</option>
          <option value="openai-compatible">OpenAI-compatible (Z.ai GLM, local, others)</option>
        </select>
        <input className={styles.input} aria-label="Model" value={model} onChange={(e) => setModel(e.target.value)} placeholder={provider === 'anthropic' ? 'claude-sonnet-5-5' : 'glm-5'} maxLength={120} />
      </div>
      <div className={styles.row}>
        <input className={styles.input} aria-label="Fast model" value={fastModel} onChange={(e) => setFastModel(e.target.value)} placeholder={provider === 'anthropic' ? 'Fast model for reading data, e.g. claude-haiku-5-5' : 'Fast model (optional)'} maxLength={120} />
        <input className={styles.input} aria-label="Server address" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={provider === 'anthropic' ? 'Server address (optional)' : 'https://api.z.ai/api/paas/v4'} inputMode="url" />
      </div>
      <input className={styles.input} aria-label="API key" type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} disabled={!canStoreKeys} placeholder={!canStoreKeys ? 'Keys need MEMBER_APP_SECRET_KEY on the server' : current.hasKey ? 'Key saved. Paste a new one to replace it' : 'API key'} />
      <div className={styles.row}>
        <button className="in-btn in-btn--primary" disabled={pending || !model.trim()}>{pending ? 'Saving…' : 'Save model'}</button>
        {current.saved && <button type="button" className="in-btn in-btn--quiet" disabled={pending} onClick={() => run(() => clearIntegrationSettings('model'))}>Use the server&apos;s settings</button>}
        <Notice message={message} />
      </div>
    </form>
  );
}

/** The Telegram bot the connectors read group messages with. */
export function TelegramSettings({ current, canStoreKeys }: { current: { chatIds: string; hasToken: boolean; saved: boolean }; canStoreKeys: boolean }) {
  const { pending, message, run } = useAction();
  const [token, setToken] = useState('');
  const [chatIds, setChatIds] = useState(current.chatIds);
  return (
    <form className={styles.stack} onSubmit={(e: FormEvent) => { e.preventDefault(); run(() => saveTelegramSettings({ token, chatIds }), () => setToken('')); }}>
      <ol className={styles.meta}>
        <li>In Telegram, message @BotFather: /newbot, then copy the token.</li>
        <li>Still in @BotFather: /setprivacy, pick the bot, Disable, so it sees group messages.</li>
        <li>Add the bot to your group, then paste the token here.</li>
      </ol>
      <input className={styles.input} aria-label="Bot token" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} disabled={!canStoreKeys} placeholder={!canStoreKeys ? 'Tokens need MEMBER_APP_SECRET_KEY on the server' : current.hasToken ? 'Token saved. Paste a new one to replace it' : '123456:ABC…'} />
      <input className={styles.input} aria-label="Chat ids" value={chatIds} onChange={(e) => setChatIds(e.target.value)} placeholder="Only these chats (optional), e.g. -1001234567890" />
      <div className={styles.row}>
        <button className="in-btn in-btn--primary" disabled={pending || !canStoreKeys || (!token.trim() && !current.hasToken)}>{pending ? 'Checking…' : 'Save Telegram'}</button>
        {current.saved && <button type="button" className="in-btn in-btn--quiet" disabled={pending} onClick={() => run(() => clearIntegrationSettings('telegram'))}>Use the server&apos;s settings</button>}
        <Notice message={message} />
      </div>
    </form>
  );
}

/** The organization's name and website, as everyone sees them. */
export function OrganizationBasics({ name: savedName, website: savedWebsite }: { name: string; website: string }) {
  const { pending, message, run } = useAction();
  const [name, setName] = useState(savedName);
  const [website, setWebsite] = useState(savedWebsite);
  return (
    <form className={styles.stack} onSubmit={(e: FormEvent) => { e.preventDefault(); run(() => saveOrganizationBasics({ name, website }).then((r) => (r.ok ? { ok: true, message: 'Saved.' } : r))); }}>
      <div className={styles.row}>
        <input className={styles.input} aria-label="Organization name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
        <input className={styles.input} aria-label="Website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" inputMode="url" />
      </div>
      <div className={styles.row}>
        <button className="in-btn in-btn--primary" disabled={pending || !name.trim()}>{pending ? 'Saving…' : 'Save'}</button>
        <Notice message={message} />
      </div>
    </form>
  );
}
