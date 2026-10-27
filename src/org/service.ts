import type { OrgStore } from './store.js';
import type { OrgProfile, OrgMember, OrgRole, OrgSource, OrgLogEntry } from './contracts.js';
import { OrgError } from './contracts.js';
import { allowed } from './policy.js';
import { validateShare, significance } from './sources.js';
import { clean } from './text.js';
import { webcrypto } from 'node:crypto';

/** Every audited mutation carries the caller's requestId; a retry with the same id completes, never repeats. */
type Op = { requestId: string };

export type OpenedSource =
  | { kind: 'link'; title: string; url: string }
  | { kind: 'note'; title: string; text: string }
  | { kind: 'file'; title: string; mediaType: string; base64: string };

export interface OrgOverviewData {
  profile: OrgProfile;
  role: OrgRole;
  feed: OrgLogEntry[];
  /** Readable names for feed actors and subjects the viewer may see; ids without one stay as they are. */
  labels: Record<string, string>;
  keyDocuments: Array<{ sourceKey: string; title: string; score: number }>;
  initiatives: Array<{ issueId: string; title: string; openTasks: number }>;
}

export interface OrgService {
  actorRole(companyId: string, userId: string): Promise<OrgRole | null>;
  setup(companyId: string, userId: string, input: { name: string; displayName: string }): Promise<OrgProfile>;
  profile(companyId: string, userId: string): Promise<{ profile: OrgProfile; role: OrgRole; memberCount: number; syncSource: null }>;
  members(companyId: string, userId: string): Promise<OrgMember[]>;
  addMember(companyId: string, userId: string, input: Op & { userId: string; displayName: string; reason: string }): Promise<void>;
  removeMember(companyId: string, userId: string, input: Op & { userId: string; reason: string }): Promise<void>;
  setModerator(companyId: string, userId: string, input: Op & { userId: string; moderator: boolean; reason: string }): Promise<void>;
  share(companyId: string, userId: string, input: unknown): Promise<OrgSource>;
  sources(companyId: string, userId: string, opts: { kind?: 'link' | 'file' | 'note' | 'objective'; hidden: boolean }): Promise<Array<OrgSource & { feeds: { tasks: number } }>>;
  hide(companyId: string, userId: string, input: Op & { sourceKey: string; reason: string }): Promise<void>;
  restore(companyId: string, userId: string, input: Op & { sourceKey: string; reason: string }): Promise<void>;
  pin(companyId: string, userId: string, input: Op & { sourceKey: string }): Promise<void>;
  open(companyId: string, userId: string, input: { sourceKey: string }): Promise<OpenedSource>;
  overview(companyId: string, userId: string): Promise<null | OrgOverviewData>;
  isHidden(companyId: string, sourceKey: string): Promise<boolean>;
}

function validateText(value: string, fieldName: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (trimmed.length < 1 || trimmed.length > 200 || /[\x00-\x1F\x7F]/.test(trimmed)) {
    throw new OrgError('invalid', `${fieldName} must be 1-200 characters without control characters.`);
  }
  return trimmed;
}

function validateUserId(value: string): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 128 || /[\x00-\x1F\x7F]/.test(value)) {
    throw new OrgError('invalid', 'userId must be a non-empty string, at most 128 characters, without control characters.');
  }
  return value;
}

const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function validateRequestId(value: unknown): string {
  if (typeof value !== 'string' || !requestIdPattern.test(value)) {
    throw new OrgError('invalid', 'requestId must be a lowercase UUID v4.');
  }
  return value;
}

const sourceKeyPattern = /^(?:share:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|objective:[0-9a-f]{64})$/;

function validateSourceKey(value: unknown): string {
  if (typeof value !== 'string' || !sourceKeyPattern.test(value)) {
    throw new OrgError('invalid', 'Invalid source key.');
  }
  return value;
}

function objectiveAudience(audience: string): OrgSource['audience'] {
  return audience === 'public' || audience === 'members' ? 'members' : 'moderators';
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const hashBuffer = await webcrypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

const setupOpKey = 'setup';

export function createOrgService(
  store: OrgStore,
  clock: () => Date,
  _newId: () => string
): OrgService {
  const forbidden = () => new OrgError('forbidden', 'Access denied.');
  const notFound = () => new OrgError('invalid', 'Source not found.');

  /**
   * Mutate, then audit. (a) An audited requestId is already done. (b) Otherwise apply — unless a row already
   * carries this requestId, meaning an earlier attempt applied it and only its audit failed. Business rules run
   * inside apply, so a replay never re-checks them. (c) Audit once per (company, requestId); a failure surfaces as
   * unavailable and the same requestId completes it. apply returns false when there was nothing to record.
   */
  async function audited(
    companyId: string,
    opKey: string,
    entry: Pick<OrgLogEntry, 'actor' | 'action' | 'subject' | 'reason'>,
    apply: () => Promise<boolean>
  ): Promise<void> {
    if (await store.hasLog(companyId, opKey)) {
      return;
    }
    if (!(await store.opApplied(companyId, opKey)) && !(await apply())) {
      return;
    }
    await store.appendLog({ companyId, opKey, ...entry });
  }

  async function requireRole(companyId: string, userId: string, action: Parameters<typeof allowed>[1]): Promise<OrgRole> {
    const role = await service.actorRole(companyId, userId);
    if (!allowed(role, action)) {
      throw forbidden();
    }
    return role!;
  }

  const service: OrgService = {
    async actorRole(companyId: string, userId: string): Promise<OrgRole | null> {
      const member = await store.readMember(companyId, userId);
      if (!member) {
        // Setup claims the profile before inserting the founder; complete a founder row a failed setup left out.
        const profile = await store.readProfile(companyId);
        if (profile && profile.createdBy === userId) {
          await store.completeFounder(companyId, userId);
          return 'founder';
        }
        return null;
      }
      if (member.status === 'removed') return null;
      return member.role;
    },

    async setup(companyId: string, userId: string, input: { name: string; displayName: string }): Promise<OrgProfile> {
      const name = validateText(input?.name, 'name');
      const displayName = validateText(input?.displayName, 'displayName');

      let profile: OrgProfile = {
        companyId,
        name,
        createdBy: userId,
        createdAt: clock().toISOString()
      };

      if (!(await store.createProfile(profile, displayName))) {
        const existing = await store.readProfile(companyId);
        if (!existing || existing.createdBy !== userId) {
          throw new OrgError('conflict', 'Organization profile already exists.');
        }
        const founder = await store.readMember(companyId, userId);
        if (founder && await store.hasLog(companyId, setupOpKey)) {
          throw new OrgError('conflict', 'Organization profile already exists.');
        }
        // The creator retrying: finish the founder row and audit an earlier attempt left undone.
        if (!founder) {
          await store.completeFounder(companyId, userId);
        }
        profile = existing;
      }

      await store.appendLog({
        companyId,
        opKey: setupOpKey,
        actor: userId,
        action: 'org.setup',
        subject: companyId,
        reason: ''
      });

      return profile;
    },

    async profile(companyId: string, userId: string): Promise<{ profile: OrgProfile; role: OrgRole; memberCount: number; syncSource: null }> {
      const profileData = await store.readProfile(companyId);
      if (!profileData) {
        throw new OrgError('unavailable', 'Organization profile not found.');
      }

      const role = await service.actorRole(companyId, userId);
      if (!role) {
        throw forbidden();
      }

      const members = await store.listMembers(companyId);
      const memberCount = members.filter(m => m.status === 'active').length;

      return {
        profile: profileData,
        role,
        memberCount,
        syncSource: null
      };
    },

    async members(companyId: string, userId: string): Promise<OrgMember[]> {
      await requireRole(companyId, userId, 'view');
      return store.listMembers(companyId);
    },

    async addMember(companyId: string, userId: string, input: Op & { userId: string; displayName: string; reason: string }): Promise<void> {
      const requestId = validateRequestId(input?.requestId);
      const targetUserId = validateUserId(input.userId);
      const displayName = validateText(input.displayName, 'displayName');
      const reason = validateText(input.reason, 'reason');

      await audited(companyId, requestId, { actor: userId, action: 'member.add', subject: targetUserId, reason }, async () => {
        await requireRole(companyId, userId, 'members.edit');

        const existing = await store.readMember(companyId, targetUserId);
        if (existing && existing.status === 'active') {
          throw new OrgError('conflict', 'Already a member.');
        }

        await store.upsertMember({
          companyId,
          userId: targetUserId,
          displayName,
          role: 'member',
          status: 'active',
          joinedAt: clock().toISOString()
        }, requestId);
        return true;
      });
    },

    async removeMember(companyId: string, userId: string, input: Op & { userId: string; reason: string }): Promise<void> {
      const requestId = validateRequestId(input?.requestId);
      const targetUserId = validateUserId(input.userId);
      const reason = validateText(input.reason, 'reason');

      await audited(companyId, requestId, { actor: userId, action: 'member.remove', subject: targetUserId, reason }, async () => {
        await requireRole(companyId, userId, 'members.edit');

        const targetMember = await store.readMember(companyId, targetUserId);
        if (!targetMember || targetMember.status === 'removed') {
          throw new OrgError('invalid', 'Member not found.');
        }

        if (targetMember.role === 'founder' || targetMember.role === 'moderator') {
          const modCount = await store.countModerators(companyId);
          if (modCount <= 1) {
            throw new OrgError('conflict', 'Cannot remove the last moderator.');
          }
        }

        await store.upsertMember({ ...targetMember, status: 'removed' }, requestId);
        return true;
      });
    },

    async setModerator(companyId: string, userId: string, input: Op & { userId: string; moderator: boolean; reason: string }): Promise<void> {
      const requestId = validateRequestId(input?.requestId);
      const targetUserId = validateUserId(input.userId);
      const reason = validateText(input.reason, 'reason');
      if (typeof input.moderator !== 'boolean') {
        throw new OrgError('invalid', 'moderator must be true or false.');
      }

      await audited(companyId, requestId, { actor: userId, action: 'moderator.set', subject: targetUserId, reason }, async () => {
        await requireRole(companyId, userId, 'moderators.edit');

        const targetMember = await store.readMember(companyId, targetUserId);
        if (!targetMember || targetMember.status === 'removed') {
          throw new OrgError('invalid', 'Member not found.');
        }

        if (targetMember.role === 'founder') {
          throw new OrgError('conflict', 'Cannot change founder role.');
        }

        if (!input.moderator && targetMember.role === 'moderator') {
          const modCount = await store.countModerators(companyId);
          if (modCount <= 1) {
            throw new OrgError('conflict', 'Cannot demote the last moderator.');
          }
        }

        // Concurrent demotions may race past the countModerators check; acceptable for v1.
        await store.upsertMember({ ...targetMember, role: input.moderator ? 'moderator' : 'member' }, requestId);
        return true;
      });
    },

    async share(companyId: string, userId: string, input: unknown): Promise<OrgSource> {
      const requestId = validateRequestId((input as { requestId?: unknown } | null)?.requestId);
      const validated = validateShare(input);
      const sourceKey = `share:${requestId}`;

      let contentBase64: string | null = null;
      let byteLength: number | null = null;
      let sha256: string | null = null;

      if (validated.kind === 'file' || validated.kind === 'note') {
        const bytes = validated.kind === 'file' ? validated.bytes : new TextEncoder().encode(validated.text);
        contentBase64 = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
        byteLength = bytes.length;
        sha256 = await sha256Hex(bytes);
      }

      const source: OrgSource = {
        companyId,
        sourceKey,
        kind: validated.kind,
        title: validated.title,
        url: validated.kind === 'link' ? validated.url : null,
        mediaType: validated.kind === 'file' ? validated.mediaType : (validated.kind === 'note' ? 'text/plain' : null),
        byteLength,
        sha256,
        sharedBy: userId,
        audience: 'members',
        hidden: null,
        pins: 0,
        createdAt: clock().toISOString()
      };

      await audited(companyId, requestId, { actor: userId, action: 'source.share', subject: sourceKey, reason: '' }, async () => {
        await requireRole(companyId, userId, 'share');
        await store.insertSource(source, contentBase64, requestId);
        return true;
      });

      return (await store.readSource(companyId, sourceKey)) ?? source;
    },

    async sources(companyId: string, userId: string, opts: { kind?: 'link' | 'file' | 'note' | 'objective'; hidden: boolean }): Promise<Array<OrgSource & { feeds: { tasks: number } }>> {
      await requireRole(companyId, userId, 'sources.view');

      const sharedSources = opts.kind === 'objective'
        ? []
        : await store.listSources(companyId, {
          includeHidden: opts.hidden,
          ...(opts.kind ? { kind: opts.kind } : {}),
          limit: 1000
        });

      const objectiveSources = opts.kind === undefined || opts.kind === 'objective'
        ? await store.listObjectiveSources(companyId, 1000)
        : [];

      const allSources: Array<OrgSource & { feeds: { tasks: number } }> = [
        ...sharedSources.map(s => ({ ...s, feeds: { tasks: 0 } })),
        ...objectiveSources
          .filter(obj => opts.hidden || !obj.hidden)
          .map(obj => ({
            companyId,
            sourceKey: `objective:${obj.key}`,
            kind: 'objective' as const,
            title: clean(obj.title, 1000, 'Untitled source'),
            url: null,
            mediaType: null,
            byteLength: null,
            sha256: null,
            sharedBy: clean(obj.sourceSystem, 200, 'intake'),
            audience: objectiveAudience(obj.audience),
            hidden: obj.hidden,
            pins: obj.pins,
            createdAt: obj.updatedAt,
            feeds: { tasks: obj.nativeIssueId ? 1 : 0 }
          }))
      ];

      return allSources;
    },

    async hide(companyId: string, userId: string, input: Op & { sourceKey: string; reason: string }): Promise<void> {
      const requestId = validateRequestId(input?.requestId);
      const sourceKey = validateSourceKey(input.sourceKey);
      const reason = validateText(input.reason, 'reason');

      await audited(companyId, requestId, { actor: userId, action: 'source.hide', subject: sourceKey, reason }, async () => {
        await requireRole(companyId, userId, 'sources.moderate');
        if (!(await store.setHidden(companyId, sourceKey, { by: userId, at: clock().toISOString(), reason }, requestId))) {
          throw notFound();
        }
        return true;
      });
    },

    async restore(companyId: string, userId: string, input: Op & { sourceKey: string; reason: string }): Promise<void> {
      const requestId = validateRequestId(input?.requestId);
      const sourceKey = validateSourceKey(input.sourceKey);
      const reason = validateText(input.reason, 'reason');

      await audited(companyId, requestId, { actor: userId, action: 'source.restore', subject: sourceKey, reason }, async () => {
        await requireRole(companyId, userId, 'sources.moderate');
        if (!(await store.setHidden(companyId, sourceKey, null, requestId))) {
          throw notFound();
        }
        return true;
      });
    },

    async pin(companyId: string, userId: string, input: Op & { sourceKey: string }): Promise<void> {
      const requestId = validateRequestId(input?.requestId);
      const sourceKey = validateSourceKey(input.sourceKey);

      await audited(companyId, requestId, { actor: userId, action: 'source.pin', subject: sourceKey, reason: '' }, async () => {
        const role = await requireRole(companyId, userId, 'pin');
        const isModerator = role === 'founder' || role === 'moderator';
        let visible: boolean;
        if (sourceKey.startsWith('objective:')) {
          const objective = await store.readObjectiveSource(companyId, sourceKey.slice('objective:'.length));
          visible = !!objective && (isModerator || (!objective.hidden && objectiveAudience(objective.audience) === 'members'));
        } else {
          const source = await store.readSource(companyId, sourceKey);
          visible = !!source && (isModerator || !source.hidden);
        }
        if (!visible) {
          throw notFound();
        }
        // A second pin by the same user changes nothing and records nothing.
        return store.addPin(companyId, sourceKey, userId, requestId);
      });
    },

    async open(companyId: string, userId: string, input: { sourceKey: string }): Promise<OpenedSource> {
      const role = await requireRole(companyId, userId, 'view');
      const sourceKey = validateSourceKey(input?.sourceKey);
      if (sourceKey.startsWith('objective:')) {
        throw new OrgError('invalid', 'Open this source from its task.');
      }

      const isModerator = role === 'founder' || role === 'moderator';
      const source = await store.readSource(companyId, sourceKey);
      // Hidden and missing read the same to a member, so a hidden item's existence never leaks.
      if (!source || source.kind === 'objective' || (!isModerator && (source.hidden !== null || source.audience !== 'members'))) {
        throw notFound();
      }

      const title = clean(source.title, 1000, 'Untitled source');
      if (source.kind === 'link') {
        if (!source.url) throw notFound();
        return { kind: 'link', title, url: source.url };
      }

      const content = await store.readContent(companyId, sourceKey);
      if (!content) {
        throw notFound();
      }
      if (source.kind === 'note') {
        return { kind: 'note', title, text: Buffer.from(content.base64, 'base64').toString('utf8') };
      }
      return { kind: 'file', title, mediaType: content.mediaType ?? 'application/octet-stream', base64: content.base64 };
    },

    async overview(companyId: string, userId: string): Promise<null | OrgOverviewData> {
      const profileData = await store.readProfile(companyId);
      if (!profileData) {
        return null;
      }

      const role = await requireRole(companyId, userId, 'view');
      const isModerator = role === 'founder' || role === 'moderator';

      const allLog = await store.listLog(companyId, 50);
      const hiddenKeys = new Set((await store.listHidden(companyId)).keys());
      const allSources = await store.listSources(companyId, { includeHidden: true, limit: 1000 });

      const feed = allLog.filter(entry => isModerator || !hiddenKeys.has(entry.subject));

      // Names only for what this viewer may see: members never get hidden or moderator-only titles.
      const names = new Map<string, string>();
      for (const member of await store.listMembers(companyId)) {
        names.set(member.userId, clean(member.displayName, 200, member.userId));
      }
      for (const source of allSources) {
        if (isModerator || (!source.hidden && source.audience === 'members')) {
          names.set(source.sourceKey, clean(source.title, 1000, 'Untitled source'));
        }
      }
      if (feed.some(entry => entry.subject.startsWith('objective:'))) {
        for (const objective of await store.listObjectiveSources(companyId, 1000)) {
          if (isModerator || (!objective.hidden && objectiveAudience(objective.audience) === 'members')) {
            names.set(`objective:${objective.key}`, clean(objective.title, 1000, 'Untitled source'));
          }
        }
      }
      const labels: Record<string, string> = {};
      for (const entry of feed) {
        for (const key of [entry.actor, entry.subject]) {
          const name = names.get(key);
          if (name !== undefined) labels[key] = name;
        }
      }

      const visibleSources = allSources.filter(s => !s.hidden);
      const sourcesWithScore = visibleSources.map(s => ({
        sourceKey: s.sourceKey,
        title: s.title,
        score: significance({ citations: 0, pins: s.pins })
      }));

      sourcesWithScore.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const aSource = allSources.find(s => s.sourceKey === a.sourceKey)!;
        const bSource = allSources.find(s => s.sourceKey === b.sourceKey)!;
        return aSource.createdAt.localeCompare(bSource.createdAt);
      });

      return {
        profile: profileData,
        role,
        feed,
        labels,
        keyDocuments: sourcesWithScore.slice(0, 5),
        initiatives: []
      };
    },

    async isHidden(companyId: string, sourceKey: string): Promise<boolean> {
      return store.isHidden(companyId, sourceKey);
    }
  };

  return service;
}
