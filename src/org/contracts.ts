export type OrgRole = 'founder' | 'moderator' | 'member';

export interface OrgProfile {
  companyId: string;
  name: string;
  createdBy: string;
  createdAt: string;
}

export interface OrgMember {
  companyId: string;
  userId: string;
  displayName: string;
  role: OrgRole;
  status: 'active' | 'removed';
  joinedAt: string;
}

export type SourceKind = 'link' | 'file' | 'note' | 'objective';

export interface OrgSource {
  companyId: string;
  sourceKey: string;
  kind: SourceKind;
  title: string;
  url: string | null;
  mediaType: string | null;
  byteLength: number | null;
  sha256: string | null;
  sharedBy: string;
  audience: 'members' | 'moderators';
  hidden: null | { by: string; at: string; reason: string };
  pins: number;
  createdAt: string;
}

export interface OrgLogEntry {
  companyId: string;
  seq: number;
  actor: string;
  action: 'org.setup' | 'member.add' | 'member.remove' | 'moderator.set' | 'source.share' | 'source.hide' | 'source.restore' | 'source.pin';
  subject: string;
  reason: string;
  at: string;
}

export class OrgError extends Error {
  constructor(public kind: 'forbidden' | 'conflict' | 'invalid' | 'unavailable', message: string) {
    super(message);
    this.name = 'OrgError';
  }
}
