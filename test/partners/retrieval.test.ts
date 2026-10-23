import { expect, it } from 'vitest';
import { queryPartnerFacts, type AuthorizedFact, type PartnerReadSource } from '../../src/partners/retrieval.js';
import type { PartnerScope, ProjectionTarget } from '../../src/partners/types.js';
const scope: PartnerScope = { organization_id:'dao',principal_id:'member',audiences:['public'],project_ids:[],opportunity_ids:[],as_of:'2026-10-23T00:00:00Z' };
const fact: AuthorizedFact = {assertion_id:'a',revision:2,subject_id:'org',predicate:'CONTACT_FOR',value:'public@example.org',evidence:[]};
function setup() {
  const source: PartnerReadSource={projectionCurrent:async()=>true,revalidate:async()=>[fact],fallback:async()=>[fact]};
  const graph: ProjectionTarget={advanceFence:async()=>{},apply:async()=>{throw Error('unused');},receipt:async()=>null,candidates:async()=>[{assertion_id:'a',revision:1,subject_id:'org',object_id:'',predicate:'CONTACT_FOR'}]};
  return {source,graph};
}
it('returns authoritative current facts instead of graph values or revisions',async()=>{
  const f=setup(); const result=await queryPartnerFacts(f.source,f.graph,scope,{predicate:'CONTACT_FOR',limit:20});
  expect(result.facts).toEqual([fact]);expect(result.coverage).toBe('graph_revalidated');
});
it('immediately withholds a revoked contact despite a stale available projection',async()=>{
  const f=setup(); f.source.revalidate=async()=>[]; f.source.fallback=async()=>[];
  expect((await queryPartnerFacts(f.source,f.graph,scope,{predicate:'CONTACT_FOR',limit:20})).facts).toEqual([]);
});
it('uses bounded PG fallback during graph outage but never bypasses unavailable authorization',async()=>{
  const f=setup();f.graph.candidates=async()=>{throw Error('Helix offline');};
  expect(await queryPartnerFacts(f.source,f.graph,scope,{predicate:'CONTACT_FOR',limit:20})).toEqual({facts:[fact],coverage:'pg_fallback',next_cursor:null});
  f.source.fallback=async()=>{throw Error('PG offline');};
  await expect(queryPartnerFacts(f.source,f.graph,scope,{predicate:'CONTACT_FOR',limit:20})).rejects.toThrow('PG offline');
});
it('does not convert PG authorization errors into fallback success',async()=>{
  const f=setup();f.source.revalidate=async()=>{throw Error('Access revoked');};
  await expect(queryPartnerFacts(f.source,f.graph,scope,{predicate:'CONTACT_FOR',limit:20})).rejects.toThrow('Access revoked');
});
it('rejects a source that returns a fact outside the requested graph pointer set',async()=>{
  const f=setup();f.source.revalidate=async()=>[{...fact,assertion_id:'other'}];
  await expect(queryPartnerFacts(f.source,f.graph,scope,{predicate:'CONTACT_FOR',limit:20})).rejects.toThrow(/pointer/);
});
it('bounds refill work when a full candidate page has been revoked',async()=>{
  const f=setup();let calls=0;
  f.graph.candidates=async(_scope,query)=>Array.from({length:query.limit},(_,i)=>({assertion_id:String(++calls).padStart(5,'0'),revision:1,subject_id:'org',object_id:'',predicate:'CONTACT_FOR'}));
  f.source.revalidate=async()=>[];
  const result=await queryPartnerFacts(f.source,f.graph,scope,{predicate:'CONTACT_FOR',limit:2});
  expect(result.facts).toEqual([]);expect(result.coverage).toBe('partial');expect(calls).toBeLessThanOrEqual(200);expect(result.next_cursor).not.toBeNull();
});
it('uses authoritative fallback when graph is reachable but behind durable evidence',async()=>{
  const f=setup();f.source.projectionCurrent=async()=>false;f.graph.candidates=async()=>{throw Error('Graph must not be consulted');};
  expect((await queryPartnerFacts(f.source,f.graph,scope,{predicate:'CONTACT_FOR',limit:20})).coverage).toBe('pg_fallback');
});
it('does not reuse cursors for another principal or query',async()=>{
  const f=setup();const one=await queryPartnerFacts(f.source,f.graph,scope,{predicate:'CONTACT_FOR',limit:1});
  expect(one.next_cursor).not.toBeNull();
  await expect(queryPartnerFacts(f.source,f.graph,{...scope,principal_id:'other'},{predicate:'CONTACT_FOR',limit:1,cursor:one.next_cursor!})).rejects.toThrow(/cursor/);
});
