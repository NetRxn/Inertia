import type { OrgRole, OrgMember, OrgSource, OrgLogEntry, SourceKind } from '../org/contracts.js';

export class OrgClientError extends Error {
  constructor(readonly kind: 'session' | 'forbidden' | 'invalid' | 'unavailable', message: string) {
    super(message);
  }
}

function check(ok: unknown): asserts ok {
  if (!ok) throw new OrgClientError('invalid', 'Invalid org response');
}

function row(raw: unknown, keys: string[]): Record<string, unknown> {
  check(raw && typeof raw === 'object' && !Array.isArray(raw));
  const r = raw as Record<string, unknown>;
  check(Object.keys(r).length === keys.length && keys.every(k => Object.hasOwn(r, k)));
  return r;
}

function text(raw: unknown, max = 2000, empty = false): string {
  check(
    typeof raw === 'string' &&
      (empty || raw.length > 0) &&
      new TextEncoder().encode(raw).length <= max &&
      raw.trim() === raw &&
      !/[\u0000-\u001f\u007f]/.test(raw)
  );
  return raw;
}

function id(raw: unknown): string {
  const s = text(raw, 128);
  check(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(s));
  return s;
}

function timestamp(raw: unknown): string {
  const s = text(raw, 50);
  // Accept both ISO 8601 (T separator, Z or +HH:MM) and PostgreSQL format (space separator, +HH or +HH:MM)
  check(
    /^\d{4}-\d\d-\d\d[T ]([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{1,6})?(Z|[+-](?:[01]\d|2[0-3])(?::[0-5]\d)?)$/.test(s) &&
      Number.isFinite(Date.parse(s))
  );
  check(Number(s.slice(0, 4)) > 0 && new Date(s.slice(0, 10) + 'T00:00:00Z').toISOString().slice(0, 10) === s.slice(0, 10));
  return s;
}

function list<T>(raw: unknown, parse: (x: unknown) => T, max = 128): T[] {
  check(Array.isArray(raw) && raw.length <= max);
  return raw.map(parse);
}

function role(raw: unknown): OrgRole {
  check(raw === 'founder' || raw === 'moderator' || raw === 'member');
  return raw;
}

function sourceKind(raw: unknown): SourceKind {
  check(raw === 'link' || raw === 'file' || raw === 'note' || raw === 'objective');
  return raw;
}

export interface OrgOverview {
  profile: { companyId: string; name: string; createdBy: string; createdAt: string };
  role: OrgRole;
  memberCount: number;
  feed: OrgLogEntry[];
  /** Display names and source titles for feed ids; an id without one is shown as is. */
  labels: Record<string, string>;
  keyDocuments: Array<{ sourceKey: string; title: string; score: number }>;
  initiatives: Array<{ issueId: string; title: string; openTasks: number }>;
}

export function parseOrgOverview(raw: unknown): OrgOverview {
  const r = row(raw, ['profile', 'role', 'memberCount', 'feed', 'labels', 'keyDocuments', 'initiatives']);
  check(Number.isSafeInteger(r.memberCount) && Number(r.memberCount) >= 0);

  const profile = row(r.profile, ['companyId', 'name', 'createdBy', 'createdAt']);

  const feed = list(r.feed, x => {
    const l = row(x, ['companyId', 'seq', 'actor', 'action', 'subject', 'reason', 'at']);
    check(Number.isSafeInteger(l.seq) && Number(l.seq) > 0);
    check(
      l.action === 'org.setup' ||
        l.action === 'member.add' ||
        l.action === 'member.remove' ||
        l.action === 'moderator.set' ||
        l.action === 'source.share' ||
        l.action === 'source.hide' ||
        l.action === 'source.restore' ||
        l.action === 'source.pin'
    );
    return {
      companyId: id(l.companyId),
      seq: Number(l.seq),
      actor: id(l.actor),
      action: l.action as OrgLogEntry['action'],
      subject: text(l.subject, 1000, true),
      reason: text(l.reason, 2000, true),
      at: timestamp(l.at),
    };
  });

  check(r.labels && typeof r.labels === 'object' && !Array.isArray(r.labels));
  const labelEntries = Object.entries(r.labels as Record<string, unknown>);
  check(labelEntries.length <= 200);
  const labels: Record<string, string> = Object.create(null);
  for (const [key, value] of labelEntries) {
    labels[text(key, 1000)] = text(value, 1000);
  }

  const keyDocuments = list(r.keyDocuments, x => {
    const d = row(x, ['sourceKey', 'title', 'score']);
    check(Number.isSafeInteger(d.score) && Number(d.score) >= 0);
    return {
      sourceKey: id(d.sourceKey),
      title: text(d.title),
      score: Number(d.score),
    };
  }, 10);

  const initiatives = list(r.initiatives, x => {
    const i = row(x, ['issueId', 'title', 'openTasks']);
    check(Number.isSafeInteger(i.openTasks) && Number(i.openTasks) >= 0);
    return {
      issueId: id(i.issueId),
      title: text(i.title),
      openTasks: Number(i.openTasks),
    };
  }, 20);

  return {
    profile: {
      companyId: id(profile.companyId),
      name: text(profile.name, 200),
      createdBy: id(profile.createdBy),
      createdAt: timestamp(profile.createdAt),
    },
    role: role(r.role),
    memberCount: Number(r.memberCount),
    feed,
    labels,
    keyDocuments,
    initiatives,
  };
}

export function parseOrgMembers(raw: unknown): OrgMember[] {
  return list(raw, x => {
    const m = row(x, ['companyId', 'userId', 'displayName', 'role', 'status', 'joinedAt']);
    check(m.status === 'active' || m.status === 'removed');
    return {
      companyId: id(m.companyId),
      userId: id(m.userId),
      displayName: text(m.displayName, 200),
      role: role(m.role),
      status: m.status as 'active' | 'removed',
      joinedAt: timestamp(m.joinedAt),
    };
  }, 1000);
}

export interface OrgSourceWithFeeds extends OrgSource {
  feeds: { tasks: number };
}

export function parseOrgSources(raw: unknown): OrgSourceWithFeeds[] {
  return list(raw, x => {
    const s = row(x, ['companyId', 'sourceKey', 'kind', 'title', 'url', 'mediaType', 'byteLength', 'sha256', 'sharedBy', 'audience', 'hidden', 'pins', 'createdAt', 'feeds']);
    check(s.audience === 'members' || s.audience === 'moderators');
    check(Number.isSafeInteger(s.pins) && Number(s.pins) >= 0);

    const hidden = s.hidden === null ? null : (() => {
      const h = row(s.hidden, ['by', 'at', 'reason']);
      return {
        by: id(h.by),
        at: timestamp(h.at),
        reason: text(h.reason, 2000),
      };
    })();

    const feeds = row(s.feeds, ['tasks']);
    check(Number.isSafeInteger(feeds.tasks) && Number(feeds.tasks) >= 0);

    return {
      companyId: id(s.companyId),
      sourceKey: id(s.sourceKey),
      kind: sourceKind(s.kind),
      title: text(s.title, 1000, true),
      url: s.url === null ? null : text(s.url, 2048),
      mediaType: s.mediaType === null ? null : text(s.mediaType, 200),
      byteLength: s.byteLength === null ? null : (() => { check(Number.isSafeInteger(s.byteLength) && Number(s.byteLength) >= 0); return Number(s.byteLength); })(),
      sha256: s.sha256 === null ? null : (() => { check(typeof s.sha256 === 'string' && /^[a-f0-9]{64}$/.test(s.sha256)); return s.sha256; })(),
      sharedBy: text(s.sharedBy, 200),
      audience: s.audience as 'members' | 'moderators',
      hidden,
      pins: Number(s.pins),
      createdAt: timestamp(s.createdAt),
      feeds: { tasks: Number(feeds.tasks) },
    };
  }, 1000);
}

export interface OrgShared {
  sourceKey: string;
  kind: 'link' | 'file' | 'note';
  title: string;
}

/** What org.source.share returns: the new item's key, kind and title only. */
export function parseOrgShared(raw: unknown): OrgShared {
  const r = row(raw, ['sourceKey', 'kind', 'title']);
  check(r.kind === 'link' || r.kind === 'file' || r.kind === 'note');
  const sourceKey = id(r.sourceKey);
  check(sourceKey.startsWith('share:'));
  return { sourceKey, kind: r.kind as OrgShared['kind'], title: text(r.title, 1000) };
}

export type OrgSourceOpen =
  | { kind: 'link'; title: string; url: string }
  | { kind: 'note'; title: string; text: string }
  | { kind: 'file'; title: string; mediaType: string; base64: string };

const mediaTypePattern = /^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/;
const base64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export function parseOrgSourceOpen(raw: unknown): OrgSourceOpen {
  check(raw && typeof raw === 'object' && !Array.isArray(raw));
  const kind = (raw as Record<string, unknown>).kind;
  if (kind === 'link') {
    const r = row(raw, ['kind', 'title', 'url']);
    const url = text(r.url, 2048);
    check(/^https?:\/\//i.test(url));
    let parsed: URL | null = null;
    try { parsed = new URL(url); } catch { parsed = null; }
    check(parsed && (parsed.protocol === 'https:' || parsed.protocol === 'http:'));
    return { kind, title: text(r.title, 1000), url };
  }
  if (kind === 'note') {
    const r = row(raw, ['kind', 'title', 'text']);
    check(typeof r.text === 'string' && r.text.length <= 20000);
    return { kind, title: text(r.title, 1000), text: r.text as string };
  }
  check(kind === 'file');
  const r = row(raw, ['kind', 'title', 'mediaType', 'base64']);
  const mediaType = text(r.mediaType, 200);
  check(mediaTypePattern.test(mediaType));
  check(typeof r.base64 === 'string' && r.base64.length <= Math.ceil(1048576 / 3) * 4 && base64Pattern.test(r.base64));
  return { kind: 'file', title: text(r.title, 1000), mediaType, base64: r.base64 as string };
}

export interface TrailStep {
  label: string;
  detail: string;
  available: boolean;
}

export interface TaskTrail {
  summary: string;
  steps: TrailStep[];
  alsoUsed: string[];
}

export interface TaskTrailResponse {
  title: string;
  status: string;
  assignee: string | null;
  doneWhen: string | null;
  nextStep: string | null;
  trail: TaskTrail;
}

export function parseTaskTrailResponse(raw: unknown): TaskTrailResponse {
  const r = row(raw, ['title', 'status', 'assignee', 'doneWhen', 'nextStep', 'trail']);

  const trail = row(r.trail, ['summary', 'steps', 'alsoUsed']);
  const steps = list(trail.steps, x => {
    const s = row(x, ['label', 'detail', 'available']);
    check(typeof s.available === 'boolean');
    return {
      label: text(s.label, 200),
      detail: text(s.detail, 2000),
      available: s.available,
    };
  });

  const alsoUsed = list(trail.alsoUsed, x => text(x, 2000));

  return {
    title: text(r.title),
    status: text(r.status, 200),
    assignee: r.assignee === null ? null : id(r.assignee),
    doneWhen: r.doneWhen === null ? null : text(r.doneWhen, 2000),
    nextStep: r.nextStep === null ? null : text(r.nextStep, 2000),
    trail: {
      summary: text(trail.summary, 2000),
      steps,
      alsoUsed,
    },
  };
}
