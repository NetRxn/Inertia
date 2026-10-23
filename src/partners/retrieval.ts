import { createHash } from 'node:crypto';
import type { CandidateQuery, Json, PartnerScope, Pointer, ProjectionTarget } from './types.js';
export interface AuthorizedFact { assertion_id: string; revision: number; subject_id: string; predicate: string; value: Json; evidence: Json[] }
export interface PartnerReadSource {
  /** Authoritative outbox/generation health at the requested source boundary. */
  projectionCurrent(scope: PartnerScope): Promise<boolean>;
  /** Must atomically revalidate principal, every source/version/scope/validity, then hydrate. Fail closed. */
  revalidate(scope: PartnerScope, pointers: Pointer[]): Promise<AuthorizedFact[]>;
  /** Bounded indexed authoritative fallback, not a web search or unauthenticated whole-table scan. */
  fallback(scope: PartnerScope, query: CandidateQuery): Promise<AuthorizedFact[]>;
}
export interface PartnerReadResult { facts: AuthorizedFact[]; coverage: 'graph_revalidated' | 'pg_fallback' | 'partial'; next_cursor: string | null }
export type PartnerQuery = Omit<CandidateQuery, 'after'> & { cursor?: string };
/** Every fact comes from the owning service. Helix supplies IDs, never authority. */
export async function queryPartnerFacts(source: PartnerReadSource, graph: ProjectionTarget, scope: PartnerScope, query: PartnerQuery): Promise<PartnerReadResult> {
  if (!Number.isSafeInteger(query.limit) || query.limit < 1 || query.limit > 100) throw Error('Invalid partner query limit');
  const { cursor, ...selection } = query;
  const binding = createHash('sha256').update(JSON.stringify([scope,selection])).digest('hex');
  let after: string | undefined;
  if (cursor) {
    try {
      if (cursor.length > 2048) throw Error();
      const decoded: unknown = JSON.parse(Buffer.from(cursor,'base64url').toString());
      if (!decoded || typeof decoded !== 'object') throw Error();
      const item = decoded as Record<string,unknown>;
      if (item.version !== 1 || item.binding !== binding || typeof item.after !== 'string' || item.after.length > 512) throw Error();
      after = item.after;
    } catch { throw Error('Invalid partner query cursor'); }
  }
  const next = (last: string) => Buffer.from(JSON.stringify({version:1,binding,after:last})).toString('base64url');
  const fallback = async (): Promise<PartnerReadResult> => {
    const facts = await source.fallback(scope,{...selection,...(after ? {after} : {}),limit:query.limit});
    if (facts.length > query.limit) throw Error('Unbounded authoritative fallback');
    return {facts,coverage:'pg_fallback',next_cursor: facts.length === query.limit ? next(facts.at(-1)!.assertion_id) : null};
  };
  // This check is deliberately outside graph-failure recovery. PG errors fail closed.
  if (!await source.projectionCurrent(scope)) return fallback();
  const facts: AuthorizedFact[] = [], seen = new Set<string>();
  let scanned = 0;
  while (scanned < 200) {
    const pageLimit = Math.min(200-scanned, Math.max(20, query.limit));
    let pointers: Pointer[];
    try { pointers = await graph.candidates(scope,{...selection,...(after ? {after} : {}),limit:pageLimit}); }
    catch { return scanned ? {facts,coverage:'partial',next_cursor:after ? next(after) : null} : fallback(); }
    if (pointers.length > pageLimit) throw Error('Unbounded graph response');
    if (!pointers.length) return {facts,coverage:'graph_revalidated',next_cursor:null};
    if (pointers.some((p,i) => (i > 0 && p.assertion_id <= pointers[i-1]!.assertion_id) || (after !== undefined && p.assertion_id <= after))) throw Error('Invalid graph keyset order');
    // Revalidate BEFORE hydrating any fields, separately for every evidence binding.
    const permitted = await source.revalidate(scope,pointers);
    const ids = new Set(pointers.map(p=>p.assertion_id));
    if (permitted.some(f=>!ids.has(f.assertion_id))) throw Error('Authoritative result outside requested pointer set');
    const admitted = new Map(permitted.map(f=>[f.assertion_id,f]));
    for (const pointer of pointers) {
      after = pointer.assertion_id; scanned++;
      const fact = admitted.get(pointer.assertion_id);
      if (fact && !seen.has(fact.assertion_id)) { facts.push(fact); seen.add(fact.assertion_id); }
      if (facts.length === query.limit) return {facts,coverage:'graph_revalidated',next_cursor:next(after)};
    }
    if (pointers.length < pageLimit) return {facts,coverage:'graph_revalidated',next_cursor:null};
  }
  return {facts,coverage:'partial',next_cursor:after ? next(after) : null};
}
