import type { OrgRole } from './contracts.js';

export type OrgAction = 'view' | 'share' | 'pin' | 'members.edit' | 'moderators.edit' | 'sources.view' | 'sources.moderate';

export function allowed(role: OrgRole | null, action: OrgAction): boolean {
  if (role === null) return false;
  if (role === 'member') return action === 'view' || action === 'share' || action === 'pin';
  return true;
}
