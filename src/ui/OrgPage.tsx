import React, { useEffect, useState, useMemo, type CSSProperties, type FormEvent } from 'react';
import type { PluginPageProps } from '@paperclipai/plugin-sdk/ui';
import { usePluginAction } from '@paperclipai/plugin-sdk/ui';
import { parseOrgOverview, parseOrgMembers, parseOrgSources, type OrgOverview, type OrgSourceWithFeeds } from './org-client.js';
import type { OrgMember, SourceKind } from '../org/contracts.js';

const control: CSSProperties = {
  padding: '0.4rem 0.65rem',
  border: '1px solid var(--border, #d4d4d8)',
  borderRadius: 6,
  background: 'var(--background, transparent)',
  color: 'inherit',
  font: 'inherit',
};

const section: CSSProperties = {
  border: '1px solid var(--border, #d4d4d8)',
  borderRadius: 8,
  padding: '1rem',
  display: 'grid',
  gap: '0.7rem',
};

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: { kind: string; message?: string } };

type Tab = 'overview' | 'members' | 'sources';

export function OrgPage({ context }: PluginPageProps) {
  if (!context.userId) return <p>Sign in to view this DAO.</p>;

  const [tab, setTab] = useState<Tab>('overview');
  const [overview, setOverview] = useState<OrgOverview | null | undefined>(undefined);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [sources, setSources] = useState<OrgSourceWithFeeds[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<SourceKind | 'all'>('all');
  const [showHidden, setShowHidden] = useState(false);

  const [orgName, setOrgName] = useState('');
  const [displayName, setDisplayName] = useState('');

  const [shareLink, setShareLink] = useState('');
  const [shareNote, setShareNote] = useState('');
  const [shareTitle, setShareTitle] = useState('');
  const [shareFile, setShareFile] = useState<File | null>(null);

  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [removeReason, setRemoveReason] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [addUserId, setAddUserId] = useState('');
  const [addDisplayName, setAddDisplayName] = useState('');
  const [addReason, setAddReason] = useState('');

  const [moderatorUserId, setModeratorUserId] = useState<string | null>(null);
  const [moderatorValue, setModeratorValue] = useState(false);
  const [moderatorReason, setModeratorReason] = useState('');

  const [hidingSourceKey, setHidingSourceKey] = useState<string | null>(null);
  const [hideReason, setHideReason] = useState('');

  const overviewAction = usePluginAction('org.overview');
  const setupAction = usePluginAction('org.setup');
  const membersAction = usePluginAction('org.members');
  const addMemberAction = usePluginAction('org.member.add');
  const removeMemberAction = usePluginAction('org.member.remove');
  const setModeratorAction = usePluginAction('org.moderator.set');
  const shareAction = usePluginAction('org.source.share');
  const sourcesAction = usePluginAction('org.sources');
  const hideAction = usePluginAction('org.source.hide');
  const restoreAction = usePluginAction('org.source.restore');

  async function loadOverview() {
    setLoading(true);
    setMessage('');
    try {
      const result = (await overviewAction({})) as ActionResult<OrgOverview | null>;
      if (!result.ok) {
        if (result.error.kind === 'forbidden') {
          setMessage('You\'re not a member of this DAO yet.');
          setOverview(null);
        } else {
          setMessage(result.error.message || 'Could not load overview.');
          setOverview(null);
        }
      } else {
        if (result.data === null) {
          setOverview(null);
        } else {
          setOverview(parseOrgOverview(result.data));
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load overview.');
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadMembers() {
    try {
      const result = (await membersAction({})) as ActionResult<OrgMember[]>;
      if (result.ok) {
        setMembers(parseOrgMembers(result.data));
      } else {
        setMessage(result.error.message || 'Could not load members.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load members.');
    }
  }

  async function loadSources() {
    try {
      const params = sourceFilter === 'all' ? { hidden: showHidden } : { kind: sourceFilter, hidden: showHidden };
      const result = (await sourcesAction(params)) as ActionResult<OrgSourceWithFeeds[]>;
      if (result.ok) {
        setSources(parseOrgSources(result.data));
      } else {
        setMessage(result.error.message || 'Could not load sources.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load sources.');
    }
  }

  useEffect(() => {
    void loadOverview();
  }, []);

  useEffect(() => {
    if (tab === 'members' && overview !== undefined && overview !== null) {
      void loadMembers();
    }
  }, [tab, overview]);

  useEffect(() => {
    if (tab === 'sources' && overview !== undefined && overview !== null) {
      void loadSources();
    }
  }, [tab, sourceFilter, showHidden, overview]);

  async function handleSetup(event: FormEvent) {
    event.preventDefault();
    if (!orgName.trim() || !displayName.trim()) return;

    setLoading(true);
    setMessage('');
    try {
      const result = (await setupAction({ name: orgName.trim(), displayName: displayName.trim() })) as ActionResult<unknown>;
      if (result.ok) {
        await loadOverview();
      } else {
        setMessage(result.error.message || 'Could not set up DAO.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not set up DAO.');
    } finally {
      setLoading(false);
    }
  }

  async function handleShare(event: FormEvent) {
    event.preventDefault();
    setMessage('');

    const hasLink = shareLink.trim().length > 0;
    const hasNote = shareNote.trim().length > 0;
    const hasFile = shareFile !== null;

    if (!hasLink && !hasNote && !hasFile) {
      setMessage('Provide a link, note, or file to share.');
      return;
    }

    if (hasFile && shareFile!.size > 1024 * 1024) {
      setMessage('File size must be under 1 MiB.');
      return;
    }

    try {
      let fileData: { name: string; mediaType: string; base64: string } | undefined;
      if (hasFile) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            const prefix = 'data:';
            if (!result.startsWith(prefix)) {
              reject(new Error('Invalid file data'));
              return;
            }
            const commaIndex = result.indexOf(',');
            if (commaIndex === -1) {
              reject(new Error('Invalid file data'));
              return;
            }
            resolve(result.slice(commaIndex + 1));
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(shareFile!);
        });

        fileData = {
          name: shareFile!.name,
          mediaType: shareFile!.type || 'application/octet-stream',
          base64,
        };
      }

      const params: any = {};
      if (hasLink) params.link = shareLink.trim();
      if (hasNote) params.note = shareNote.trim();
      if (shareTitle.trim()) params.title = shareTitle.trim();
      if (fileData) params.file = fileData;

      const result = (await shareAction(params)) as ActionResult<unknown>;
      if (result.ok) {
        setShareLink('');
        setShareNote('');
        setShareTitle('');
        setShareFile(null);
        await loadOverview();
      } else {
        setMessage(result.error.message || 'Could not share.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not share.');
    }
  }

  async function handleAddMember(event: FormEvent) {
    event.preventDefault();
    if (!addUserId.trim() || !addDisplayName.trim() || !addReason.trim()) return;

    setMessage('');
    try {
      const result = (await addMemberAction({
        userId: addUserId.trim(),
        displayName: addDisplayName.trim(),
        reason: addReason.trim(),
      })) as ActionResult<null>;
      if (result.ok) {
        setAddingMember(false);
        setAddUserId('');
        setAddDisplayName('');
        setAddReason('');
        await loadMembers();
      } else {
        setMessage(result.error.message || 'Could not add member.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not add member.');
    }
  }

  async function handleRemoveMember(event: FormEvent) {
    event.preventDefault();
    if (!removingUserId || !removeReason.trim()) return;

    setMessage('');
    try {
      const result = (await removeMemberAction({
        userId: removingUserId,
        reason: removeReason.trim(),
      })) as ActionResult<null>;
      if (result.ok) {
        setRemovingUserId(null);
        setRemoveReason('');
        await loadMembers();
      } else {
        setMessage(result.error.message || 'Could not remove member.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not remove member.');
    }
  }

  async function handleSetModerator(event: FormEvent) {
    event.preventDefault();
    if (!moderatorUserId || !moderatorReason.trim()) return;

    setMessage('');
    try {
      const result = (await setModeratorAction({
        userId: moderatorUserId,
        moderator: moderatorValue,
        reason: moderatorReason.trim(),
      })) as ActionResult<null>;
      if (result.ok) {
        setModeratorUserId(null);
        setModeratorReason('');
        await loadMembers();
      } else {
        setMessage(result.error.message || 'Could not update moderator status.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update moderator status.');
    }
  }

  async function handleHideSource(event: FormEvent) {
    event.preventDefault();
    if (!hidingSourceKey || !hideReason.trim()) return;

    setMessage('');
    try {
      const result = (await hideAction({
        sourceKey: hidingSourceKey,
        reason: hideReason.trim(),
      })) as ActionResult<null>;
      if (result.ok) {
        setHidingSourceKey(null);
        setHideReason('');
        await loadSources();
      } else {
        setMessage(result.error.message || 'Could not hide source.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not hide source.');
    }
  }

  async function handleRestoreSource(sourceKey: string) {
    setMessage('');
    try {
      const result = (await restoreAction({
        sourceKey,
        reason: 'Restored from UI',
      })) as ActionResult<null>;
      if (result.ok) {
        await loadSources();
      } else {
        setMessage(result.error.message || 'Could not restore source.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not restore source.');
    }
  }

  if (loading && overview === undefined) {
    return <p role="status">Loading DAO…</p>;
  }

  if (message && overview === null) {
    return (
      <section style={{ display: 'grid', gap: '1rem', maxWidth: 880 }}>
        <p role="alert">{message}</p>
      </section>
    );
  }

  if (overview === null || overview === undefined) {
    if (overview === null) {
      return (
        <section style={{ display: 'grid', gap: '1rem', maxWidth: 880 }}>
          <h2>Set up your DAO</h2>
          {message && <p role="alert">{message}</p>}
          <form onSubmit={handleSetup} style={section}>
            <label style={{ display: 'grid', gap: 4 }}>
              DAO name
              <input
                style={control}
                type="text"
                required
                maxLength={200}
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
              />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              Your display name
              <input
                style={control}
                type="text"
                required
                maxLength={200}
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
              />
            </label>
            <button style={control} type="submit" disabled={loading}>
              {loading ? 'Setting up…' : 'Set up DAO'}
            </button>
          </form>
        </section>
      );
    }
    return null;
  }

  const canEdit = overview.role === 'founder' || overview.role === 'moderator';
  const availableTabs: Tab[] = canEdit ? ['overview', 'members', 'sources'] : ['overview', 'members'];

  return (
    <section style={{ display: 'grid', gap: '1rem', maxWidth: 880 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>
          {overview.profile.name} · {overview.memberCount} {overview.memberCount === 1 ? 'member' : 'members'}
        </h2>
      </header>

      {message && <p role="alert">{message}</p>}

      <div role="tablist" style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border, #d4d4d8)' }}>
        {availableTabs.map(t => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            style={{
              ...control,
              borderBottom: 'none',
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              background: tab === t ? 'var(--background, transparent)' : 'transparent',
              fontWeight: tab === t ? 600 : 400,
            }}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <form onSubmit={handleShare} style={section} aria-label="Share with the DAO">
              <h3 style={{ margin: 0 }}>Share with the DAO</h3>
              <label style={{ display: 'grid', gap: 4 }}>
                Link or note
                <input
                  style={control}
                  type="text"
                  placeholder="https://… or your note"
                  value={shareLink || shareNote}
                  onChange={e => {
                    const val = e.target.value;
                    if (val.startsWith('http://') || val.startsWith('https://')) {
                      setShareLink(val);
                      setShareNote('');
                    } else {
                      setShareNote(val);
                      setShareLink('');
                    }
                  }}
                />
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                File
                <input
                  style={control}
                  type="file"
                  onChange={e => setShareFile(e.target.files?.[0] || null)}
                />
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                Title (optional)
                <input
                  style={control}
                  type="text"
                  maxLength={200}
                  value={shareTitle}
                  onChange={e => setShareTitle(e.target.value)}
                />
              </label>
              <button style={control} type="submit">
                Share
              </button>
            </form>

            <section style={section} aria-label="Activity feed">
              <h3 style={{ margin: 0 }}>Activity</h3>
              {overview.feed.length === 0 ? (
                <p>No activity yet</p>
              ) : (
                overview.feed.slice().reverse().map(entry => (
                  <article key={entry.seq} style={{ fontSize: '0.9em' }}>
                    {entry.action === 'source.share' && `${entry.actor} shared "${entry.subject}"`}
                    {entry.action === 'member.add' && `${entry.actor} added ${entry.subject}`}
                    {entry.action === 'member.remove' && `${entry.actor} removed ${entry.subject}`}
                    {entry.action === 'moderator.set' && `${entry.actor} changed moderator status for ${entry.subject}`}
                    {entry.action === 'source.hide' && `${entry.actor} hid ${entry.subject}`}
                    {entry.action === 'source.restore' && `${entry.actor} restored ${entry.subject}`}
                    {entry.action === 'source.pin' && `${entry.actor} pinned ${entry.subject}`}
                    {entry.action === 'org.setup' && `${entry.actor} set up the DAO`}
                  </article>
                ))
              )}
            </section>
          </div>

          <aside style={{ display: 'grid', gap: '1rem', gridAutoRows: 'max-content' }}>
            <section style={section}>
              <h3 style={{ margin: 0 }}>Initiatives</h3>
              {overview.initiatives.length === 0 ? (
                <p style={{ fontSize: '0.9em' }}>None</p>
              ) : (
                overview.initiatives.map(init => (
                  <div key={init.issueId} style={{ fontSize: '0.9em' }}>
                    {init.title} · {init.openTasks} open {init.openTasks === 1 ? 'task' : 'tasks'}
                  </div>
                ))
              )}
            </section>

            <section style={section}>
              <h3 style={{ margin: 0 }}>Key documents</h3>
              {overview.keyDocuments.length === 0 ? (
                <p style={{ fontSize: '0.9em' }}>None</p>
              ) : (
                overview.keyDocuments.map(doc => (
                  <div key={doc.sourceKey} style={{ fontSize: '0.9em' }}>
                    {doc.title}
                  </div>
                ))
              )}
            </section>
          </aside>
        </div>
      )}

      {tab === 'members' && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {canEdit && (
            <div style={{ ...section, background: 'var(--warning-background, #fffbeb)', border: '1px solid var(--warning-border, #fbbf24)' }}>
              Sync source: not connected yet.
            </div>
          )}

          {canEdit && !addingMember && (
            <button style={{ ...control, justifySelf: 'start' }} onClick={() => setAddingMember(true)}>
              Add member
            </button>
          )}

          {addingMember && (
            <form onSubmit={handleAddMember} style={section}>
              <h3 style={{ margin: 0 }}>Add member</h3>
              <small>Will require a DAO vote</small>
              <label style={{ display: 'grid', gap: 4 }}>
                User ID
                <input
                  style={control}
                  type="text"
                  required
                  value={addUserId}
                  onChange={e => setAddUserId(e.target.value)}
                />
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                Display name
                <input
                  style={control}
                  type="text"
                  required
                  value={addDisplayName}
                  onChange={e => setAddDisplayName(e.target.value)}
                />
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                Reason
                <textarea
                  style={control}
                  required
                  value={addReason}
                  onChange={e => setAddReason(e.target.value)}
                />
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button style={control} type="submit">Add</button>
                <button style={control} type="button" onClick={() => setAddingMember(false)}>Cancel</button>
              </div>
            </form>
          )}

          <div style={{ ...section, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Name</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Role</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Joined</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Status</th>
                  {canEdit && <th style={{ textAlign: 'left', padding: '0.5rem' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {members.map(member => (
                  <tr key={member.userId}>
                    <td style={{ padding: '0.5rem' }}>{member.displayName}</td>
                    <td style={{ padding: '0.5rem' }}>{member.role}</td>
                    <td style={{ padding: '0.5rem' }}>{new Date(member.joinedAt).toLocaleDateString()}</td>
                    <td style={{ padding: '0.5rem' }}>{member.status}</td>
                    {canEdit && (
                      <td style={{ padding: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                        {member.status === 'active' && member.role !== 'founder' && (
                          <>
                            <button
                              style={{ ...control, fontSize: '0.85em', padding: '0.25rem 0.5rem' }}
                              onClick={() => setRemovingUserId(member.userId)}
                            >
                              Remove
                            </button>
                            <button
                              style={{ ...control, fontSize: '0.85em', padding: '0.25rem 0.5rem' }}
                              onClick={() => {
                                setModeratorUserId(member.userId);
                                setModeratorValue(member.role !== 'moderator');
                              }}
                            >
                              {member.role === 'moderator' ? 'Remove moderator' : 'Make moderator'}
                            </button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {removingUserId && (
            <form onSubmit={handleRemoveMember} style={section}>
              <h3 style={{ margin: 0 }}>Remove member</h3>
              <small>Will require a DAO vote</small>
              <label style={{ display: 'grid', gap: 4 }}>
                Reason
                <textarea
                  style={control}
                  required
                  value={removeReason}
                  onChange={e => setRemoveReason(e.target.value)}
                />
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button style={control} type="submit">Remove</button>
                <button style={control} type="button" onClick={() => { setRemovingUserId(null); setRemoveReason(''); }}>Cancel</button>
              </div>
            </form>
          )}

          {moderatorUserId && (
            <form onSubmit={handleSetModerator} style={section}>
              <h3 style={{ margin: 0 }}>{moderatorValue ? 'Make moderator' : 'Remove moderator'}</h3>
              <small>Will require a DAO vote</small>
              <label style={{ display: 'grid', gap: 4 }}>
                Reason
                <textarea
                  style={control}
                  required
                  value={moderatorReason}
                  onChange={e => setModeratorReason(e.target.value)}
                />
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button style={control} type="submit">Confirm</button>
                <button style={control} type="button" onClick={() => { setModeratorUserId(null); setModeratorReason(''); }}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}

      {tab === 'sources' && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {(['all', 'link', 'file', 'note', 'objective'] as const).map(kind => (
              <button
                key={kind}
                style={{
                  ...control,
                  background: sourceFilter === kind ? 'var(--accent, #3b82f6)' : 'transparent',
                  color: sourceFilter === kind ? 'white' : 'inherit',
                }}
                onClick={() => setSourceFilter(kind)}
              >
                {kind === 'objective' ? 'Meetings' : kind.charAt(0).toUpperCase() + kind.slice(1)}
              </button>
            ))}
            <button
              style={{
                ...control,
                background: showHidden ? 'var(--accent, #3b82f6)' : 'transparent',
                color: showHidden ? 'white' : 'inherit',
              }}
              onClick={() => setShowHidden(!showHidden)}
            >
              Hidden
            </button>
          </div>

          <div style={{ ...section, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Source</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Shared by</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Who can see</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Feeds</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sources.map(source => (
                  <tr key={source.sourceKey}>
                    <td style={{ padding: '0.5rem' }}>{source.title || source.sourceKey}</td>
                    <td style={{ padding: '0.5rem' }}>{source.sharedBy}</td>
                    <td style={{ padding: '0.5rem' }}>{source.hidden ? 'Hidden' : 'Visible'}</td>
                    <td style={{ padding: '0.5rem' }}>{source.audience}</td>
                    <td style={{ padding: '0.5rem' }}>{source.feeds.tasks > 0 ? `${source.feeds.tasks} ${source.feeds.tasks === 1 ? 'task' : 'tasks'}` : '—'}</td>
                    <td style={{ padding: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                      {!source.hidden ? (
                        <button
                          style={{ ...control, fontSize: '0.85em', padding: '0.25rem 0.5rem' }}
                          onClick={() => setHidingSourceKey(source.sourceKey)}
                        >
                          Hide as spam
                        </button>
                      ) : (
                        <button
                          style={{ ...control, fontSize: '0.85em', padding: '0.25rem 0.5rem' }}
                          onClick={() => handleRestoreSource(source.sourceKey)}
                        >
                          Restore
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hidingSourceKey && (
            <form onSubmit={handleHideSource} style={section}>
              <h3 style={{ margin: 0 }}>Hide as spam</h3>
              <label style={{ display: 'grid', gap: 4 }}>
                Reason
                <input
                  style={control}
                  type="text"
                  required
                  value={hideReason}
                  onChange={e => setHideReason(e.target.value)}
                />
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button style={control} type="submit">Hide</button>
                <button style={control} type="button" onClick={() => { setHidingSourceKey(null); setHideReason(''); }}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
