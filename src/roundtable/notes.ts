import { createHash } from 'node:crypto';

/** Trusted operator mapping, not fields chosen by a document sender. The hash pins
 * the exact UTF-8 JSON export bytes, not the original DOCX or a live Google read. */
export interface OwnerNotesBinding {
  companyId: string;
  meetingId: string;
  sourceId: string;
  revision: string;
  exportSha256: string;
}
export interface OwnerNotesBlock {
  readonly kind: 'quick-notes' | 'notes';
  readonly text: string;
  readonly textSha256: string;
  /** Preserve an export-supplied original ID only; absence is not an invented tab. */
  readonly originalTabId?: string;
}
/** Separate from transcript Source/Publication. This is owner-supplied provenance,
 * not verified Gemini finality, a faithful transcript, or publication acceptance. */
export interface OwnerNotesSource extends Readonly<OwnerNotesBinding> {
  readonly kind: 'notes';
  readonly provenance: 'owner-export';
  readonly title: string;
  readonly blocks: readonly OwnerNotesBlock[];
}
/** Half-open UTF-16 offsets into one exact original block, not normalized text. */
export interface NotesLocator {
  readonly blockIndex: number;
  readonly start: number;
  readonly end: number;
}
export interface NotesActionExcerpt {
  readonly excerpt: string;
  readonly locator: NotesLocator;
}
export interface NotesActionEvidence extends NotesActionExcerpt {
  readonly sourceId: string;
  readonly revision: string;
  readonly exportSha256: string;
  readonly blockSha256: string;
  readonly originalTabId?: string;
  readonly owner?: NotesActionExcerpt;
}
export interface NotesActionCandidate {
  readonly id: string;
  readonly normalizedText: string;
  /** Exact quoted proposed attribution, never an authenticated native assignee. */
  readonly proposedOwner: string | null;
  readonly evidence: readonly NotesActionEvidence[];
}
const hash = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
const digest = /^[a-f0-9]{64}$/;
const invalid = (): never => { throw Error('invalid_owner_notes_export'); };
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function keys(row: Record<string, unknown>, required: string[], optional: string[] = []): void {
  if (required.some(k => !Object.hasOwn(row, k)) || Object.keys(row).some(k => !required.includes(k) && !optional.includes(k))) invalid();
}
function text(value: unknown, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim()) ||
    /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value) ||
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)) invalid();
  return value as string;
}
function binding(value: OwnerNotesBinding): void {
  const row = object(value);
  keys(row, ['companyId', 'meetingId', 'sourceId', 'revision', 'exportSha256']);
  for (const k of ['companyId', 'meetingId', 'sourceId', 'revision']) text(row[k]);
  if (typeof row.exportSha256 !== 'string' || !digest.test(row.exportSha256)) invalid();
}
/** Pure, complete validation. No text cleanup, re-summarization, I/O or size-based
 * truncation. Integrating readers must pin bytes and detect revision races first. */
export function adaptOwnerNotesExport(raw: Uint8Array, expected: OwnerNotesBinding): OwnerNotesSource {
  binding(expected);
  if (!(raw instanceof Uint8Array) || hash(raw) !== expected.exportSha256) invalid();
  const row = object(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)) as unknown);
  keys(row, ['kind', 'provenance', 'meetingId', 'sourceId', 'revision', 'title', 'blocks']);
  if (row.kind !== 'notes' || row.provenance !== 'owner-export' ||
    row.meetingId !== expected.meetingId || row.sourceId !== expected.sourceId || row.revision !== expected.revision) invalid();
  const title = text(row.title);
  if (!Array.isArray(row.blocks) || !row.blocks.length) invalid();
  const blocks: OwnerNotesBlock[] = (row.blocks as unknown[]).map(value => {
    const block = object(value); keys(block, ['kind', 'text'], ['originalTabId']);
    if (block.kind !== 'quick-notes' && block.kind !== 'notes') invalid();
    const exact = text(block.text, true);
    return Object.freeze({ kind: block.kind as OwnerNotesBlock['kind'], text: exact, textSha256: hash(exact),
      ...(Object.hasOwn(block, 'originalTabId') ? { originalTabId: text(block.originalTabId) } : {}) });
  });
  if (!blocks.some(b => b.text.trim())) invalid();
  return Object.freeze({ ...expected, kind: 'notes', provenance: 'owner-export', title, blocks: Object.freeze(blocks) });
}
function excerpt(value: unknown, source: OwnerNotesSource): NotesActionExcerpt {
  const row = object(value); keys(row, ['excerpt', 'locator']);
  const quote = text(row.excerpt), at = object(row.locator); keys(at, ['blockIndex', 'start', 'end']);
  const { blockIndex, start, end } = at;
  if (![blockIndex, start, end].every(n => typeof n === 'number' && Number.isSafeInteger(n))) invalid();
  const index = blockIndex as number, from = start as number, to = end as number;
  const block = source.blocks[index];
  if (!block || from < 0 || to <= from || to > block.text.length || block.text.slice(from, to) !== quote) invalid();
  return Object.freeze({ excerpt: quote, locator: Object.freeze({ blockIndex: index, start: from, end: to }) });
}
const normalized = (value: string) => value.replace(/\s+/gu, ' ').trim();
/** Group already selected exact excerpts only. No action discovery, owner
 * inference, fuzzy/semantic matching, or task creation. The caller must pass the
 * operator-bound source returned by adaptOwnerNotesExport. Revision is excluded
 * from candidate identity, but every evidence item retains its exact revision. */
export function groupNotesActions(source: OwnerNotesSource, candidates: unknown): NotesActionCandidate[] {
  binding({ companyId: source.companyId, meetingId: source.meetingId, sourceId: source.sourceId, revision: source.revision, exportSha256: source.exportSha256 });
  if (source.kind !== 'notes' || source.provenance !== 'owner-export' || !Array.isArray(source.blocks) || !Array.isArray(candidates)) invalid();
  for (const block of source.blocks) if (hash(text(block.text, true)) !== block.textSha256) invalid();
  const grouped = new Map<string, { normalizedText: string; proposedOwner: string | null; evidence: NotesActionEvidence[]; seen: Set<string> }>();
  for (const value of candidates as unknown[]) {
    const row = object(value); keys(row, ['excerpt', 'locator'], ['owner']);
    const action = excerpt({ excerpt: row.excerpt, locator: row.locator }, source);
    const owner = row.owner === undefined || row.owner === null ? undefined : excerpt(row.owner, source);
    const normalizedText = normalized(action.excerpt), proposedOwner = owner ? normalized(owner.excerpt) : null;
    const id = 'notes-action:' + hash(JSON.stringify([source.companyId, source.meetingId, normalizedText, proposedOwner]));
    const block = source.blocks[action.locator.blockIndex]!;
    const evidence: NotesActionEvidence = Object.freeze({ ...action, sourceId: source.sourceId, revision: source.revision,
      exportSha256: source.exportSha256, blockSha256: block.textSha256,
      ...(block.originalTabId === undefined ? {} : { originalTabId: block.originalTabId }), ...(owner ? { owner } : {}) });
    let group = grouped.get(id);
    if (!group) { group = { normalizedText, proposedOwner, evidence: [], seen: new Set() }; grouped.set(id, group); }
    const identity = JSON.stringify(evidence);
    if (!group.seen.has(identity)) { group.evidence.push(evidence); group.seen.add(identity); }
  }
  return [...grouped].map(([id, group]) => Object.freeze({ id, normalizedText: group.normalizedText,
    proposedOwner: group.proposedOwner, evidence: Object.freeze(group.evidence) }));
}
