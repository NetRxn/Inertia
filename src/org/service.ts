import type { OrgStore } from './store.js';
import type { OrgProfile, OrgMember, OrgRole } from './contracts.js';
import { OrgError } from './contracts.js';
import { allowed } from './policy.js';

export interface OrgService {
  actorRole(companyId: string, userId: string): Promise<OrgRole | null>;
  setup(companyId: string, userId: string, input: { name: string; displayName: string }): Promise<OrgProfile>;
  profile(companyId: string, userId: string): Promise<{ profile: OrgProfile; role: OrgRole; memberCount: number; syncSource: null }>;
  members(companyId: string, userId: string): Promise<OrgMember[]>;
  addMember(companyId: string, userId: string, input: { userId: string; displayName: string; reason: string }): Promise<void>;
  removeMember(companyId: string, userId: string, input: { userId: string; reason: string }): Promise<void>;
  setModerator(companyId: string, userId: string, input: { userId: string; moderator: boolean; reason: string }): Promise<void>;
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
    }
  };
}
