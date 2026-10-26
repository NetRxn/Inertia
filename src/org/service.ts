import type { OrgStore } from './store.js';
import type { OrgProfile, OrgMember, OrgRole, OrgSource, OrgLogEntry } from './contracts.js';
import { OrgError } from './contracts.js';
import { allowed } from './policy.js';
import { validateShare, significance } from './sources.js';
import { webcrypto } from 'node:crypto';

export interface OrgService {
  actorRole(companyId: string, userId: string): Promise<OrgRole | null>;
  setup(companyId: string, userId: string, input: { name: string; displayName: string }): Promise<OrgProfile>;
  profile(companyId: string, userId: string): Promise<{ profile: OrgProfile; role: OrgRole; memberCount: number; syncSource: null }>;
  members(companyId: string, userId: string): Promise<OrgMember[]>;
  addMember(companyId: string, userId: string, input: { userId: string; displayName: string; reason: string }): Promise<void>;
  removeMember(companyId: string, userId: string, input: { userId: string; reason: string }): Promise<void>;
  setModerator(companyId: string, userId: string, input: { userId: string; moderator: boolean; reason: string }): Promise<void>;
  share(companyId: string, userId: string, input: unknown): Promise<OrgSource>;
  sources(companyId: string, userId: string, opts: { kind?: 'link' | 'file' | 'note' | 'objective'; hidden: boolean }): Promise<Array<OrgSource & { feeds: { tasks: number } }>>;
  hide(companyId: string, userId: string, input: { sourceKey: string; reason: string }): Promise<void>;
  restore(companyId: string, userId: string, input: { sourceKey: string; reason: string }): Promise<void>;
  pin(companyId: string, userId: string, input: { sourceKey: string }): Promise<void>;
  overview(companyId: string, userId: string): Promise<null | { profile: OrgProfile; role: OrgRole; feed: OrgLogEntry[]; keyDocuments: Array<{ sourceKey: string; title: string; score: number }>; initiatives: Array<{ issueId: string; title: string; openTasks: number }> }>;
  isHidden(companyId: string, sourceKey: string): Promise<boolean>;
}

function validateText(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 200 || /[\x00-\x1F\x7F]/.test(trimmed)) {
    throw new OrgError('invalid', `${fieldName} must be 1-200 characters without control characters.`);
  }
  return trimmed;
}

export function createOrgService(
  store: OrgStore,
  clock: () => Date,
  newId: () => string
): OrgService {
  return {
    async actorRole(companyId: string, userId: string): Promise<OrgRole | null> {
      const member = await store.readMember(companyId, userId);
      if (!member || member.status === 'removed') return null;
      return member.role;
    },

    async setup(companyId: string, userId: string, input: { name: string; displayName: string }): Promise<OrgProfile> {
      const name = validateText(input.name, 'name');
      const displayName = validateText(input.displayName, 'displayName');

      const now = clock().toISOString();
      const profile: OrgProfile = {
        companyId,
        name,
        createdBy: userId,
        createdAt: now
      };

      const founder: OrgMember = {
        companyId,
        userId,
        displayName,
        role: 'founder',
        status: 'active',
        joinedAt: now
      };

      const created = await store.createProfile(profile, founder);
      if (!created) {
        throw new OrgError('conflict', 'Organization profile already exists.');
      }

      await store.appendLog({
        companyId,
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

      const role = await this.actorRole(companyId, userId);
      if (!role) {
        throw new OrgError('forbidden', 'Access denied.');
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
      const role = await this.actorRole(companyId, userId);
      if (!allowed(role, 'view')) {
        throw new OrgError('forbidden', 'Access denied.');
      }
      return store.listMembers(companyId);
    },

    async addMember(companyId: string, userId: string, input: { userId: string; displayName: string; reason: string }): Promise<void> {
      const role = await this.actorRole(companyId, userId);
      if (!allowed(role, 'members.edit')) {
        throw new OrgError('forbidden', 'Access denied.');
      }

      const displayName = validateText(input.displayName, 'displayName');
      const reason = validateText(input.reason, 'reason');

      const now = clock().toISOString();
      const newMember: OrgMember = {
        companyId,
        userId: input.userId,
        displayName,
        role: 'member',
        status: 'active',
        joinedAt: now
      };

      await store.upsertMember(newMember);
      await store.appendLog({
        companyId,
        actor: userId,
        action: 'member.add',
        subject: input.userId,
        reason
      });
    },

    async removeMember(companyId: string, userId: string, input: { userId: string; reason: string }): Promise<void> {
      const role = await this.actorRole(companyId, userId);
      if (!allowed(role, 'members.edit')) {
        throw new OrgError('forbidden', 'Access denied.');
      }

      const reason = validateText(input.reason, 'reason');

      const targetMember = await store.readMember(companyId, input.userId);
      if (!targetMember || targetMember.status === 'removed') {
        throw new OrgError('invalid', 'Member not found.');
      }

      if (targetMember.role === 'founder' || targetMember.role === 'moderator') {
        const modCount = await store.countModerators(companyId);
        if (modCount <= 1) {
          throw new OrgError('conflict', 'Cannot remove the last moderator.');
        }
      }

      const updated: OrgMember = {
        ...targetMember,
        status: 'removed'
      };

      await store.upsertMember(updated);
      await store.appendLog({
        companyId,
        actor: userId,
        action: 'member.remove',
        subject: input.userId,
        reason
      });
    },

    async setModerator(companyId: string, userId: string, input: { userId: string; moderator: boolean; reason: string }): Promise<void> {
      const role = await this.actorRole(companyId, userId);
      if (!allowed(role, 'moderators.edit')) {
        throw new OrgError('forbidden', 'Access denied.');
      }

      const reason = validateText(input.reason, 'reason');

      const targetMember = await store.readMember(companyId, input.userId);
      if (!targetMember || targetMember.status === 'removed') {
        throw new OrgError('invalid', 'Member not found.');
      }

      if (targetMember.role === 'founder') {
        throw new OrgError('conflict', 'Cannot change founder role.');
      }

      const targetRole: OrgRole = input.moderator ? 'moderator' : 'member';

      if (!input.moderator && targetMember.role === 'moderator') {
        const modCount = await store.countModerators(companyId);
        if (modCount <= 1) {
          throw new OrgError('conflict', 'Cannot demote the last moderator.');
        }
      }

      // Concurrent demotions may race past the countModerators check; acceptable for v1.

      const updated: OrgMember = {
        ...targetMember,
        role: targetRole
      };

      await store.upsertMember(updated);
      await store.appendLog({
        companyId,
        actor: userId,
        action: 'moderator.set',
        subject: input.userId,
        reason
      });
    },

    async share(companyId: string, userId: string, input: unknown): Promise<OrgSource> {
      const role = await this.actorRole(companyId, userId);
      if (!allowed(role, 'share')) {
        throw new OrgError('forbidden', 'Access denied.');
      }

      const validated = validateShare(input);
      const now = clock().toISOString();
      const sourceKey = `share:${newId()}`;

      let content: Uint8Array | null = null;
      let byteLength: number | null = null;
      let sha256: string | null = null;

      if (validated.kind === 'file') {
        content = validated.bytes;
        byteLength = validated.bytes.length;
        const hashBuffer = await webcrypto.subtle.digest('SHA-256', validated.bytes);
        sha256 = Array.from(new Uint8Array(hashBuffer))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      } else if (validated.kind === 'note') {
        content = new TextEncoder().encode(validated.text);
        byteLength = content.length;
        const hashBuffer = await webcrypto.subtle.digest('SHA-256', content);
        sha256 = Array.from(new Uint8Array(hashBuffer))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
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
        createdAt: now
      };

      await store.insertSource(source, content);
      await store.appendLog({
        companyId,
        actor: userId,
        action: 'source.share',
        subject: sourceKey,
        reason: ''
      });

      return source;
    },

    async sources(companyId: string, userId: string, opts: { kind?: 'link' | 'file' | 'note' | 'objective'; hidden: boolean }): Promise<Array<OrgSource & { feeds: { tasks: number } }>> {
      const role = await this.actorRole(companyId, userId);
      if (!allowed(role, 'sources.view')) {
        throw new OrgError('forbidden', 'Access denied.');
      }

      const kindFilter = opts.kind && opts.kind !== 'objective' ? opts.kind : undefined;
      const sharedSources = await store.listSources(companyId, {
        includeHidden: opts.hidden,
        ...(kindFilter ? { kind: kindFilter } : {}),
        limit: 1000
      });

      const objectiveSources = opts.kind === undefined || opts.kind === 'objective'
        ? await store.listObjectiveSources(companyId, 1000)
        : [];

      const hiddenKeys = new Set<string>();
      for (const objSource of objectiveSources) {
        const key = `objective:${objSource.key}`;
        if (await store.isHidden(companyId, key)) {
          hiddenKeys.add(key);
        }
      }

      const allSources: Array<OrgSource & { feeds: { tasks: number } }> = [
        ...sharedSources.map(s => ({ ...s, feeds: { tasks: 0 } })),
        ...objectiveSources
          .filter(obj => {
            const key = `objective:${obj.key}`;
            return opts.hidden || !hiddenKeys.has(key);
          })
          .map(obj => {
            const key = `objective:${obj.key}`;
            return {
              companyId,
              sourceKey: key,
              kind: 'objective' as const,
              title: obj.title,
              url: null,
              mediaType: null,
              byteLength: null,
              sha256: null,
              sharedBy: '',
              audience: obj.audience as 'members' | 'moderators',
              hidden: hiddenKeys.has(key) ? { by: '', at: '', reason: '' } : null,
              pins: 0,
              createdAt: '',
              feeds: { tasks: obj.nativeIssueId ? 1 : 0 }
            };
          })
      ];

      return allSources;
    },

    async hide(companyId: string, userId: string, input: { sourceKey: string; reason: string }): Promise<void> {
      const role = await this.actorRole(companyId, userId);
      if (!allowed(role, 'sources.moderate')) {
        throw new OrgError('forbidden', 'Access denied.');
      }

      const reason = validateText(input.reason, 'reason');
      const now = clock().toISOString();

      const updated = await store.setHidden(companyId, input.sourceKey, {
        by: userId,
        at: now,
        reason
      });

      if (!updated) {
        throw new OrgError('invalid', 'Source not found.');
      }

      await store.appendLog({
        companyId,
        actor: userId,
        action: 'source.hide',
        subject: input.sourceKey,
        reason
      });
    },

    async restore(companyId: string, userId: string, input: { sourceKey: string; reason: string }): Promise<void> {
      const role = await this.actorRole(companyId, userId);
      if (!allowed(role, 'sources.moderate')) {
        throw new OrgError('forbidden', 'Access denied.');
      }

      const reason = validateText(input.reason, 'reason');

      await store.setHidden(companyId, input.sourceKey, null);

      await store.appendLog({
        companyId,
        actor: userId,
        action: 'source.restore',
        subject: input.sourceKey,
        reason
      });
    },

    async pin(companyId: string, userId: string, input: { sourceKey: string }): Promise<void> {
      const role = await this.actorRole(companyId, userId);
      if (!allowed(role, 'pin')) {
        throw new OrgError('forbidden', 'Access denied.');
      }

      await store.addPin(companyId, input.sourceKey, userId);

      await store.appendLog({
        companyId,
        actor: userId,
        action: 'source.pin',
        subject: input.sourceKey,
        reason: ''
      });
    },

    async overview(companyId: string, userId: string): Promise<null | { profile: OrgProfile; role: OrgRole; feed: OrgLogEntry[]; keyDocuments: Array<{ sourceKey: string; title: string; score: number }>; initiatives: Array<{ issueId: string; title: string; openTasks: number }> }> {
      const profileData = await store.readProfile(companyId);
      if (!profileData) {
        return null;
      }

      const role = await this.actorRole(companyId, userId);
      if (!allowed(role, 'view')) {
        throw new OrgError('forbidden', 'Access denied.');
      }

      const allLog = await store.listLog(companyId, 50);

      const hiddenKeys = new Set<string>();
      const allSources = await store.listSources(companyId, { includeHidden: true, limit: 1000 });
      for (const source of allSources) {
        if (source.hidden) {
          hiddenKeys.add(source.sourceKey);
        }
      }

      const objectiveSources = await store.listObjectiveSources(companyId, 1000);
      for (const obj of objectiveSources) {
        const key = `objective:${obj.key}`;
        if (await store.isHidden(companyId, key)) {
          hiddenKeys.add(key);
        }
      }

      const isModerator = role === 'founder' || role === 'moderator';
      const feed = allLog.filter(entry => {
        if (isModerator) {
          return true;
        }
        return !hiddenKeys.has(entry.subject);
      });

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

      const keyDocuments = sourcesWithScore.slice(0, 5);

      return {
        profile: profileData,
        role: role!,
        feed,
        keyDocuments,
        initiatives: []
      };
    },

    async isHidden(companyId: string, sourceKey: string): Promise<boolean> {
      return store.isHidden(companyId, sourceKey);
    }
  };
}
