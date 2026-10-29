import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { adaptOwnerNotesExport, groupNotesActions } from '../../src/roundtable/notes.js';
const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
function fixture(change: Record<string, unknown> = {}) {
  const payload = { kind: 'notes', provenance: 'owner-export', meetingId: 'meeting-1', sourceId: 'owner:notes-1', revision: 'export-7', title: 'Synthetic roundtable', blocks: [
    { kind: 'quick-notes', text: 'Quick Notes\r\n[Ari] Prepare  demo.\r\nDo not publish.' },
    { kind: 'notes', text: 'Full Notes\n[Ari] Prepare demo.\n[Bo] Prepare demo.\nPublish.\nDo not publish.' },
  ], ...change };
  const raw = Buffer.from(JSON.stringify(payload));
  const expected = { companyId: 'company-1', meetingId: 'meeting-1', sourceId: 'owner:notes-1', revision: 'export-7', exportSha256: sha(raw) };
  return { raw, expected };
}
function excerpt(blockIndex: number, text: string, whole: string) {
  const start = whole.indexOf(text); if (start < 0) throw Error('Bad synthetic fixture');
  return { excerpt: text, locator: { blockIndex, start, end: start + text.length } };
}
it('preserves exact ordered Quick/full Unicode and large text without transcript claims or truncation', () => {
  const text = '  Heading\r\n| café 🧭 | value |\n' + 'x'.repeat(410_000) + '\n';
  const f = fixture({ blocks: [{ kind: 'quick-notes', text: '' }, { kind: 'notes', text }] });
  const source = adaptOwnerNotesExport(f.raw, f.expected);
  expect(source).toMatchObject({ kind: 'notes', provenance: 'owner-export', companyId: 'company-1', revision: 'export-7', exportSha256: sha(f.raw) });
  expect(source.blocks.map((b: { text: string }) => b.text)).toEqual(['', text]);
  expect(source.blocks[1]!.textSha256).toBe(sha(text));
  expect(source.blocks[0]).not.toHaveProperty('originalTabId');
  expect(source).not.toHaveProperty('transcript');
});
it('retains only supplied original tab IDs and does not mutate input or trusted mapping', () => {
  const f = fixture({ blocks: [{ kind: 'notes', text: 'Synthetic notes', originalTabId: 't.real-export-id' }] });
  const before = f.raw.toString(); const source = adaptOwnerNotesExport(f.raw, f.expected);
  expect(source.blocks[0]!.originalTabId).toBe('t.real-export-id');
  expect(f.raw.toString()).toBe(before);
});
it('rejects mismatched trusted hash, meeting, revision, source and invalid binding', () => {
  const f = fixture();
  for (const change of [{ exportSha256: 'a'.repeat(64) }, { meetingId: 'other' }, { sourceId: 'other' }, { revision: 'other' }, { companyId: '' }]) {
    expect(() => adaptOwnerNotesExport(f.raw, { ...f.expected, ...change })).toThrow();
  }
});
it('rejects tenant routing, unknown keys, relabelled transcripts and invalid block structures even with matching hashes', () => {
  for (const change of [{ companyId: 'sender-company' }, { tenant: 'other' }, { kind: 'transcript' }, { provenance: 'google-verified' }, { blocks: [] }, { blocks: [{ kind: 'notes', text: 'x', inferredOwner: 'Ari' }] }, { blocks: [{ kind: 'notes', text: 'x', originalTabId: '' }] }]) {
    const f = fixture(change); expect(() => adaptOwnerNotesExport(f.raw, f.expected)).toThrow();
  }
});
it('rejects malformed UTF8, malformed JSON and lone surrogate text without normalization', () => {
  for (const raw of [Buffer.from([0xc3, 0x28]), Buffer.from('{'), fixture({ blocks: [{ kind: 'notes', text: '\ud800' }] }).raw]) {
    const f = fixture(); expect(() => adaptOwnerNotesExport(raw, { ...f.expected, exportSha256: sha(raw) })).toThrow();
  }
});
it('groups only whitespace-identical actions across Quick/full and retains every exact evidence locator', () => {
  const f = fixture(); const source = adaptOwnerNotesExport(f.raw, f.expected);
  const quick = excerpt(0, '[Ari] Prepare  demo.', source.blocks[0]!.text);
  const full = excerpt(1, '[Ari] Prepare demo.', source.blocks[1]!.text);
  const candidate = groupNotesActions(source, [quick, full, quick])[0]!;
  expect(candidate.normalizedText).toBe('[Ari] Prepare demo.');
  expect(candidate.proposedOwner).toBeNull();
  expect(candidate.evidence).toHaveLength(2);
  expect(candidate.evidence.map((e: { excerpt: string }) => e.excerpt)).toEqual(['[Ari] Prepare  demo.', '[Ari] Prepare demo.']);
  expect(candidate.evidence[0]).toMatchObject({ sourceId: 'owner:notes-1', revision: 'export-7', exportSha256: sha(f.raw), locator: quick.locator });
});
it('keeps different wording, negation and proposed owners distinct', () => {
  const f = fixture(); const source = adaptOwnerNotesExport(f.raw, f.expected); const text = source.blocks[1]!.text;
  const action = excerpt(1, 'Prepare demo.', text);
  const ari = excerpt(1, '[Ari]', text), bo = excerpt(1, '[Bo]', text);
  const result = groupNotesActions(source, [{ ...action, owner: ari }, { ...action, owner: bo }, excerpt(1, 'Publish.', text), excerpt(1, 'Do not publish.', text)]);
  expect(result).toHaveLength(4);
  expect(result.map((x: { proposedOwner: string | null }) => x.proposedOwner)).toEqual(['[Ari]', '[Bo]', null, null]);
});
it('rejects invented/partial/mislocated excerpts, invalid offsets and unsupported candidate fields', () => {
  const f = fixture(); const source = adaptOwnerNotesExport(f.raw, f.expected); const valid = excerpt(1, '[Ari] Prepare demo.', source.blocks[1]!.text);
  for (const invalid of [{ ...valid, excerpt: 'Approve demo.' }, { ...valid, locator: { ...valid.locator, blockIndex: 99 } }, { ...valid, locator: { ...valid.locator, start: -1 } }, { ...valid, locator: { ...valid.locator, end: valid.locator.end - 1 } }, { ...valid, assigneeAgentId: 'injected' }, { ...valid, owner: { excerpt: 'Nobody', locator: valid.locator } }]) {
    expect(() => groupNotesActions(source, [invalid])).toThrow();
  }
});
it('keeps candidate identity stable across correction while retaining revision-specific provenance', () => {
  const f = fixture(), s = adaptOwnerNotesExport(f.raw, f.expected); const action = excerpt(1, '[Ari] Prepare demo.', s.blocks[1]!.text);
  const corrected = fixture({ revision: 'export-8', title: 'Corrected title' });
  const next = adaptOwnerNotesExport(corrected.raw, { ...corrected.expected, revision: 'export-8' });
  const a = groupNotesActions(s, [action])[0]!, b = groupNotesActions(next, [action])[0]!;
  expect(a.id).toBe(b.id); expect(a.evidence[0]!.exportSha256).not.toBe(b.evidence[0]!.exportSha256);
  const foreign = adaptOwnerNotesExport(f.raw, { ...f.expected, companyId: 'company-2' });
  expect(groupNotesActions(foreign, [action])[0]!.id).not.toBe(a.id);
});
