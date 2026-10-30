'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  addInitiative,
  decideInitiative,
  draftProfile,
  finishSetup,
  readOrganizationWebsite,
  saveOrganizationBasics,
  type ActionResult,
} from '../org/actions';
import type { OrgProfile } from '../org/profile-types';
import styles from './SetupConversation.module.css';

export type SetupState = {
  name: string | null;
  website: string | null;
  description: string;
  sourceCount: number;
  profile: OrgProfile | null;
};

type Step = 'name' | 'website' | 'about' | 'uploads' | 'review';

function firstStep(state: SetupState): Step {
  if (!state.name) return 'name';
  if (state.profile) return 'review';
  if (!state.description) return 'website';
  return 'uploads';
}

function Bubble({ from, children }: { from: 'inertia' | 'you'; children: React.ReactNode }) {
  return <div className={from === 'inertia' ? styles.inertia : styles.you}>{children}</div>;
}

/**
 * "Tell me about your organization": a short, friendly conversation that
 * collects the basics, reads what the admin shares and drafts the profile.
 */
export function SetupConversation({ state }: { state: SetupState }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(() => firstStep(state));
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState(state.name ?? '');
  const [website, setWebsite] = useState(state.website ?? '');
  const [about, setAbout] = useState(state.description);
  const [pasted, setPasted] = useState('');
  const [added, setAdded] = useState<string[]>([]);
  const [newInitiative, setNewInitiative] = useState('');
  const org = name || state.name || 'your organization';

  function run(action: () => Promise<ActionResult>, next?: Step) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      if (result.message) setMessage(result.message);
      router.refresh();
      if (next) setStep(next);
    });
  }

  async function upload(files: FileList | null) {
    if (!files?.length && !pasted.trim()) return;
    const form = new FormData();
    for (const file of Array.from(files ?? [])) form.append('file', file);
    if (pasted.trim()) form.append('text', pasted);
    setMessage(null);
    startTransition(async () => {
      const response = await fetch('/api/org/sources', { method: 'POST', body: form });
      const body = (await response.json().catch(() => ({}))) as { added?: { title: string; duplicate: boolean }[]; error?: string };
      if (!response.ok) {
        setMessage(body.error ?? "Couldn't add that. Try again?");
        return;
      }
      setAdded((list) => [...list, ...(body.added ?? []).map((a) => (a.duplicate ? `${a.title} (already had it)` : a.title))]);
      setPasted('');
      router.refresh();
    });
  }

  const submit = (fn: () => void) => (event: FormEvent) => {
    event.preventDefault();
    fn();
  };

  return (
    <section className={styles.conversation} aria-live="polite">
      <Bubble from="inertia">Hi, I&apos;m Inertia. I keep your organization&apos;s work moving. Let&apos;s get to know each other. What&apos;s your organization called?</Bubble>
      {step === 'name' ? (
        <form className={styles.answer} onSubmit={submit(() => run(() => saveOrganizationBasics({ name }), 'website'))}>
          <input className={styles.input} aria-label="Organization name" value={name} onChange={(e) => setName(e.target.value)} placeholder="FWTX DAO" required maxLength={120} autoFocus />
          <button className="in-btn in-btn--primary" disabled={pending || !name.trim()}>That&apos;s us</button>
        </form>
      ) : (
        <Bubble from="you">{org}</Bubble>
      )}

      {step !== 'name' && (
        <>
          <Bubble from="inertia">Nice to meet you, {org}. Do you have a website? I&apos;ll read it.</Bubble>
          {step === 'website' ? (
            <form className={styles.answer} onSubmit={submit(() => run(() => readOrganizationWebsite(website), 'about'))}>
              <input className={styles.input} aria-label="Website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="fwtx.city" inputMode="url" autoFocus />
              <button className="in-btn in-btn--primary" disabled={pending || !website.trim()}>{pending ? 'Reading…' : 'Read it'}</button>
              <button type="button" className="in-btn in-btn--quiet" disabled={pending} onClick={() => setStep('about')}>No website</button>
            </form>
          ) : (
            <Bubble from="you">{state.website ?? website ?? 'No website'}</Bubble>
          )}
        </>
      )}

      {(step === 'about' || step === 'uploads' || step === 'review') && (
        <>
          <Bubble from="inertia">In a few sentences, what does {org} do? Who&apos;s it for?</Bubble>
          {step === 'about' ? (
            <form className={styles.answer} onSubmit={submit(() => run(() => saveOrganizationBasics({ description: about }), 'uploads'))}>
              <textarea className={styles.textarea} aria-label="About the organization" value={about} onChange={(e) => setAbout(e.target.value)} rows={4} maxLength={4000} autoFocus />
              <button className="in-btn in-btn--primary" disabled={pending || !about.trim()}>Next</button>
            </form>
          ) : (
            <Bubble from="you">{state.description || about}</Bubble>
          )}
        </>
      )}

      {(step === 'uploads' || step === 'review') && (
        <>
          <Bubble from="inertia">
            Got meeting notes, transcripts, a Telegram export or documents? Drop them in. The more I read, the better I can help.
            {state.sourceCount > 0 && <span className={styles.meta}> I&apos;ve read {state.sourceCount} things so far.</span>}
          </Bubble>
          {step === 'uploads' && (
            <div className={styles.answer}>
              <label className={styles.drop}>
                <input type="file" multiple accept=".txt,.md,.markdown,.vtt,.srt,.json,.html,.htm,.csv" onChange={(e) => void upload(e.target.files)} disabled={pending} />
                <span>Choose files: notes, transcripts (.vtt, .srt), Telegram export (.json)</span>
                <span className={styles.meta}>Recordings: transcribe them first. Audio upload is coming.</span>
              </label>
              <textarea className={styles.textarea} aria-label="Paste text" value={pasted} onChange={(e) => setPasted(e.target.value)} rows={3} placeholder="…or paste meeting notes here" />
              {pasted.trim() && <button type="button" className="in-btn in-btn--secondary" disabled={pending} onClick={() => void upload(null)}>Add this text</button>}
              {added.length > 0 && <ul className={styles.added}>{added.map((a, i) => <li key={i} className="in-chip in-chip--moss">{a}</li>)}</ul>}
              <button className="in-btn in-btn--primary" disabled={pending || state.sourceCount === 0} onClick={() => run(draftProfile, 'review')}>
                {pending ? 'Reading everything…' : "That's everything for now"}
              </button>
            </div>
          )}
        </>
      )}

      {step === 'review' && state.profile && (
        <>
          <Bubble from="inertia">Here&apos;s what I learned. Keep what&apos;s right; everything links back to where I read it.</Bubble>
          <div className={`in-glass ${styles.profile}`}>
            {state.profile.mission && <p className={styles.mission}>{state.profile.mission.text}</p>}
            {state.profile.programs.length > 0 && (
              <>
                <h3 className="in-label">What you do</h3>
                <ul>{state.profile.programs.map((p) => <li key={p.id}>{p.text}</li>)}</ul>
              </>
            )}
            {state.profile.people.length > 0 && (
              <>
                <h3 className="in-label">People</h3>
                <ul>{state.profile.people.map((p) => <li key={p.id}>{p.text}</li>)}</ul>
              </>
            )}
          </div>
          <Bubble from="inertia">These look like your initiatives, the efforts work gets organized under. Keep the ones that are real.</Bubble>
          <ul className={styles.initiatives}>
            {state.profile.initiatives.map((i) => (
              <li key={i.id} className={`in-glass ${styles.initiative}`} data-status={i.status}>
                <div>
                  <strong>{i.title}</strong>
                  <p className={styles.meta}>{i.summary}</p>
                  {i.citations.length > 0 && <p className={styles.meta}>From: {Array.from(new Set(i.citations.map((c) => c.title))).join(', ')}</p>}
                </div>
                {i.status === 'proposed' ? (
                  <div className={styles.choices}>
                    <button className="in-btn in-btn--secondary" disabled={pending} onClick={() => run(() => decideInitiative(i.id, 'accept'))}>Keep</button>
                    <button className="in-btn in-btn--quiet" disabled={pending} onClick={() => run(() => decideInitiative(i.id, 'dismiss'))}>Not us</button>
                  </div>
                ) : (
                  <button className="in-btn in-btn--quiet" disabled={pending} onClick={() => run(() => decideInitiative(i.id, 'reopen'))}>
                    {i.status === 'accepted' ? (i.adopted ? 'Kept' : 'Kept · awaiting a vote') : 'Skipped'} · undo
                  </button>
                )}
              </li>
            ))}
          </ul>
          <form className={styles.answer} onSubmit={submit(() => run(async () => { const r = await addInitiative({ title: newInitiative, summary: '' }); if (r.ok) setNewInitiative(''); return r; }))}>
            <input className={styles.input} aria-label="Another initiative" value={newInitiative} onChange={(e) => setNewInitiative(e.target.value)} placeholder="Missing one? e.g. Pursue grant funding strategy" maxLength={120} />
            <button className="in-btn in-btn--secondary" disabled={pending || !newInitiative.trim()}>Add</button>
          </form>
          <div className={styles.answer}>
            <button className="in-btn in-btn--quiet" disabled={pending} onClick={() => setStep('uploads')}>Add more first</button>
            <button className="in-btn in-btn--quiet" disabled={pending} onClick={() => run(draftProfile)}>{pending ? 'Reading…' : 'Read everything again'}</button>
            <button className="in-btn in-btn--primary" disabled={pending} onClick={() => run(async () => { const r = await finishSetup(); if (r.ok) router.push('/org'); return r; })}>Looks good</button>
          </div>
        </>
      )}

      {message && <p className={styles.notice} role="status">{message}</p>}
    </section>
  );
}
