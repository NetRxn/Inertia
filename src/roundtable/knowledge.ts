import type { Notes, Source } from './ingestion.js';
import { sha256 } from './codec.js';

export const CONTRACT_VERSION = 'dao-knowledge-v1';

/** Extraction labels are unverified; only the receiving trusted service can admit them. */
export interface KnowledgeCandidate {
  contract_version: typeof CONTRACT_VERSION;
  candidate_id: string;
  kind: 'fact' | 'decision' | 'commitment';
  value: string;
  source_id: string;
  source_revision: string;
  source_locator: { meeting_id: string; line_start: number; line_end: number };
  source_hash: string;
  audience: string;
  status: 'candidate';
  owner: null;
  verification: 'unverified';
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Expected structured input');
  return value as Record<string, unknown>;
}

function text(value: unknown, maximum: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum
    || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) throw Error('Invalid text');
  return value;
}

/**
 * Pure candidate extraction, not source admission or publication. The receiving
 * service must resolve organization/scope and recheck current source authority.
 */
export function extractKnowledgeCandidates(source: Source, notes: Notes): KnowledgeCandidate[] {
  object(source);
  if (source.ready !== true) throw Error('Source is not ready');
  if (source.kind !== 'transcript') throw Error('Missing transcript: summary-only knowledge is unsupported');
  for (const value of [source.meetingId, source.sourceId, source.revision, source.audience]) text(value, 500);
  text(source.text, 2_000_000);

  // Must match ingestion normalization exactly; hashing still binds the raw text.
  const lines = source.text.replace(/\r\n?/g, '\n').trim().split('\n');
  const sourceHash = sha256(source.text);
  const collections = object(notes);
  const candidates = new Map<string, KnowledgeCandidate>();
  const categories = [
    ['notes', 'fact'], ['decisions', 'decision'], ['actions', 'commitment'],
  ] as const;

  for (const [category, kind] of categories) {
    const excerpts = collections[category];
    if (!Array.isArray(excerpts) || excerpts.length > 1000) throw Error('Invalid notes collection');
    for (const excerpt of excerpts) {
      const row = object(excerpt);
      const quote = text(row.text, 10000);
      const line = row.line;
      if (typeof line !== 'number' || !Number.isSafeInteger(line) || line < 1
        || lines[line - 1] !== quote || /[<>]/.test(quote)) throw Error('Unsupported or unsafe excerpt');
      if (category === 'actions' && row.owner != null) {
        throw Error('Owner attribution requires trusted admission; extraction must leave owner unknown');
      }

      const candidateId = sha256(JSON.stringify([
        CONTRACT_VERSION, source.meetingId, source.sourceId, source.revision,
        sourceHash, source.audience, kind, line, quote,
      ]));
      candidates.set(candidateId, {
        contract_version: CONTRACT_VERSION, candidate_id: candidateId, kind, value: quote,
        source_id: source.sourceId, source_revision: source.revision,
        source_locator: { meeting_id: source.meetingId, line_start: line, line_end: line },
        source_hash: sourceHash, audience: source.audience,
        status: 'candidate', owner: null, verification: 'unverified',
      });
    }
  }

  // Fixed ASCII kind ordering avoids locale-dependent IDs/order and input-order drift.
  return [...candidates.values()].sort((left, right) =>
    left.source_locator.line_start - right.source_locator.line_start
    || (left.kind < right.kind ? -1 : left.kind > right.kind ? 1 : 0));
}
