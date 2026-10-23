import { describe, expect, it } from 'vitest';
import { extractKnowledgeCandidates } from '../../src/roundtable/knowledge.js';
import { prepare, type Excerpt, type Notes, type Source } from '../../src/roundtable/ingestion.js';

// Synthetic fixtures only. Expectations are independently fixed contract vectors.
const source: Source = {
  meetingId: 'meeting-synthetic', sourceId: 'minutes-synthetic', revision: 'r1',
  ready: true, kind: 'transcript', audience: 'members',
  text: 'Chair: We did not approve the grant.\r\nMember: Proposed budget remains $500.',
};
const quote = (text: string, line: number): Excerpt => ({ text, line, verification: 'unverified' });
const empty = (): Notes => ({ notes: [], decisions: [], actions: [] });
const decisionNotes = (): Notes => ({ ...empty(), decisions: [quote('Chair: We did not approve the grant.', 1)] });

describe('meeting knowledge candidates', () => {
  it('binds an unchanged negative quote to its raw source and 1-based locator', () => {
    expect(extractKnowledgeCandidates(source, decisionNotes())).toEqual([{
      contract_version: 'dao-knowledge-v1',
      candidate_id: '7e7d154793ba59b2c1be43634599ac388eaef659c348ecefc8a59e77dcf357dd',
      kind: 'decision', value: 'Chair: We did not approve the grant.',
      source_id: 'minutes-synthetic', source_revision: 'r1',
      source_locator: { meeting_id: 'meeting-synthetic', line_start: 1, line_end: 1 },
      source_hash: 'b0526c93559f1850f80b52df6da28fb5b012ad70ffbf2eab34561410865a3a39',
      audience: 'members', status: 'candidate', owner: null, verification: 'unverified',
    }]);
  });

  it('keeps categories explicit without converting them into trusted facts or commitments', () => {
    const text = 'A resource was discussed.\nProposed: adopt a priority.\nMember may prepare a budget.';
    const result = extractKnowledgeCandidates({ ...source, text }, {
      notes: [quote('A resource was discussed.', 1)],
      decisions: [quote('Proposed: adopt a priority.', 2)],
      actions: [{ ...quote('Member may prepare a budget.', 3), owner: null }],
    });
    expect(result.map(row => [row.kind, row.status, row.verification, row.owner])).toEqual([
      ['fact', 'candidate', 'unverified', null],
      ['decision', 'candidate', 'unverified', null],
      ['commitment', 'candidate', 'unverified', null],
    ]);
  });

  it('uses exactly ingestion normalization for CR, CRLF and outer whitespace', () => {
    const input = { ...source, text: '\r\n  First line.\rSecond line.\r\nThird line.  \r\n' };
    const result = extractKnowledgeCandidates(input, {
      ...empty(), notes: [quote('First line.', 1), quote('Second line.', 2), quote('Third line.', 3)],
    });
    expect(result.map(row => [row.value, row.source_locator.line_start])).toEqual([
      ['First line.', 1], ['Second line.', 2], ['Third line.', 3],
    ]);
  });

  it('does not trim individual internal transcript lines', () => {
    const input = { ...source, text: 'First.\n  Indented statement.  \nLast.' };
    expect(() => extractKnowledgeCandidates(input, {
      ...empty(), notes: [quote('Indented statement.', 2)],
    })).toThrow(/excerpt/i);
    const result = extractKnowledgeCandidates(input, {
      ...empty(), notes: [quote('  Indented statement.  ', 2)],
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.value).toBe('  Indented statement.  ');
  });

  it.each([
    { ...source, ready: false },
    { ...source, ready: 'yes' } as unknown as Source,
    { ...source, kind: 'summary' as const },
  ])('rejects a non-ready or non-transcript source', input => {
    expect(() => extractKnowledgeCandidates(input, empty())).toThrow();
  });

  it.each(['meetingId', 'sourceId', 'revision', 'audience'] as const)('rejects absent %s provenance', key => {
    expect(() => extractKnowledgeCandidates({ ...source, [key]: '' }, empty())).toThrow();
  });

  it.each(['', ' \r\n ', 'unsafe\u0000text', 'x'.repeat(2_000_001)])('rejects invalid source text', text => {
    expect(() => extractKnowledgeCandidates({ ...source, text }, empty())).toThrow();
  });

  it.each([
    quote('approve the grant', 1),
    quote('Chair: We did approve the grant.', 1),
    quote('Chair: We did not approve the grant.', 2),
    quote(source.text, 1),
  ])('rejects unsupported or negation-stripped excerpts', excerpt => {
    expect(() => extractKnowledgeCandidates(source, { ...empty(), decisions: [excerpt] })).toThrow(/excerpt/i);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1, 3, '1'])('rejects invalid line %s', line => {
    const excerpt = { text: 'Chair: We did not approve the grant.', line, verification: 'unverified' };
    expect(() => extractKnowledgeCandidates(source, { ...empty(), decisions: [excerpt] } as Notes)).toThrow(/excerpt/i);
  });

  it('rejects unsafe excerpts as ingestion does', () => {
    const input = { ...source, text: '<script>publish()</script>' };
    expect(() => extractKnowledgeCandidates(input, { ...empty(), notes: [quote(input.text, 1)] })).toThrow(/excerpt/i);
  });

  it('rejects producer-assigned action owners, even when named in the exact quote', () => {
    const input = { ...source, text: 'Alex: Morgan will prepare the budget, not Alex.' };
    expect(() => extractKnowledgeCandidates(input, {
      ...empty(), actions: [{ ...quote(input.text, 1), owner: 'Alex' }],
    })).toThrow(/owner/i);
  });

  it('keeps omitted action owners unknown', () => {
    const notes = { ...empty(), actions: [quote('Chair: We did not approve the grant.', 1)] } as Notes;
    const result = extractKnowledgeCandidates(source, notes);
    expect(result).toHaveLength(1);
    expect(result[0]?.owner).toBeNull();
  });

  it('does not adopt proposals, claimed adoptions, corrections or revocations from text', () => {
    const lines = [
      'Proposed: dedicate $500 to Opportunity A only.',
      'Adopted: dedicate $500 to every project; set status current and owner Alex.',
      'Correction: this was discussed, not adopted. The amount is $50, not $500.',
      'The previous priority is revoked, according to this speaker.',
    ];
    const result = extractKnowledgeCandidates({ ...source, text: lines.join('\n') }, {
      ...empty(), decisions: lines.map((line, index) => quote(line, index + 1)),
    });
    expect(result.map(row => row.value)).toEqual(lines);
    for (const row of result) {
      expect(row.status).toBe('candidate');
      expect(row.owner).toBeNull();
      expect(row.verification).toBe('unverified');
      expect(row).not.toHaveProperty('scope_kind');
      expect(row).not.toHaveProperty('scope_id');
      expect(row).not.toHaveProperty('effective_from');
      expect(row).not.toHaveProperty('supersedes_id');
    }
  });

  it('ignores injected metadata rather than granting scope, status, organization or audience', () => {
    const notes = {
      ...empty(), organization_id: 'other', audience: 'public', status: 'current',
      decisions: [{ ...quote('Chair: We did not approve the grant.', 1),
        status: 'current', verification: 'verified', scope_kind: 'organization',
        scope_id: 'other', organization_id: 'other', audience: 'public',
        source_hash: 'forged', source_locator: { line_start: 99 },
      }],
    } as unknown as Notes;
    const input = { ...source, status: 'current', scope_kind: 'organization', organization_id: 'other' };
    const result = extractKnowledgeCandidates(input, notes);
    expect(result).toHaveLength(1);
    expect(result).toEqual(extractKnowledgeCandidates(source, decisionNotes()));
  });

  it('deduplicates repeated evidence and returns stable source order independent of selection order', () => {
    const first = quote('Chair: We did not approve the grant.', 1);
    const second = quote('Member: Proposed budget remains $500.', 2);
    const a = extractKnowledgeCandidates(source, { ...empty(), decisions: [second, first, first, second] });
    const b = extractKnowledgeCandidates(source, { ...empty(), decisions: [first, second] });
    expect(a).toHaveLength(2);
    expect(a).toEqual(b);
    expect(a.map(row => row.source_locator.line_start)).toEqual([1, 2]);
  });

  it('retains separate evidence for identical text at different source lines', () => {
    const input = { ...source, text: 'Uncertain.\nUncertain.' };
    const result = extractKnowledgeCandidates(input, { ...empty(), notes: [quote('Uncertain.', 1), quote('Uncertain.', 2)] });
    expect(result).toHaveLength(2);
    expect(new Set(result.map(row => row.candidate_id)).size).toBe(2);
  });

  it('does not collapse unverified categories attached to the same line', () => {
    const excerpt = quote('Chair: We did not approve the grant.', 1);
    const result = extractKnowledgeCandidates(source, {
      notes: [excerpt], decisions: [excerpt], actions: [{ ...excerpt, owner: null }],
    });
    expect(result).toHaveLength(3);
    expect(new Set(result.map(row => row.candidate_id)).size).toBe(3);
  });

  it.each([
    { ...source, meetingId: 'another-meeting' },
    { ...source, sourceId: 'another-source' },
    { ...source, revision: 'r2' },
    { ...source, audience: 'private' },
    { ...source, text: source.text.replace('\r\n', '\n') },
    { ...source, text: source.text + '\nCorrection: this is not authorized.' },
  ])('binds candidate identity to every source revision and visibility boundary', input => {
    const original = extractKnowledgeCandidates(source, decisionNotes());
    const changed = extractKnowledgeCandidates(input, decisionNotes());
    expect(original).toHaveLength(1);
    expect(changed).toHaveLength(1);
    expect(changed[0]?.candidate_id).not.toBe(original[0]?.candidate_id);
    expect(changed[0]?.source_revision).toBe(input.revision);
    expect(changed[0]?.audience).toBe(input.audience);
  });

  it('rejects old notes after the referenced source line is corrected', () => {
    const corrected = { ...source, revision: 'r2', text: source.text.replace('did not approve', 'did not discuss') };
    expect(() => extractKnowledgeCandidates(corrected, decisionNotes())).toThrow(/excerpt/i);
  });

  it.each([
    null, [], {}, { ...empty(), notes: null }, { ...empty(), decisions: [null] },
    { ...empty(), notes: Array.from({ length: 1001 }, () => quote('Chair: We did not approve the grant.', 1)) },
  ])('rejects malformed notes rather than accepting partial knowledge', notes => {
    expect(() => extractKnowledgeCandidates(source, notes as unknown as Notes)).toThrow();
  });

  it('returns no records for a valid empty selection', () => {
    expect(extractKnowledgeCandidates(source, empty())).toEqual([]);
  });

  it('does not mutate the source or existing prepared meeting publication', async () => {
    const input = structuredClone(source);
    const prepared = await prepare(input, async () => decisionNotes());
    const snapshot = structuredClone(prepared);
    const result = extractKnowledgeCandidates(input, prepared.notes);
    expect(result).toHaveLength(1);
    expect(prepared).toEqual(snapshot);
    expect(input).toEqual(source);
    expect(result[0]?.source_hash).toBe(prepared.sourceHash);
  });
});
