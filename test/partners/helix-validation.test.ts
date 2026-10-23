import { afterEach, expect, it } from 'vitest';
import { Client } from '@helix-db/helix-db';
import { createHelixProjection } from '../../src/partners/helix.js';
import type { ProjectionSnapshot } from '../../src/partners/types.js';
const clients:Client[]=[];afterEach(async()=>{for(const c of clients.splice(0))await c.close();});
const lease={organization_id:'dao',owner:'worker',epoch:1,expires_at:'2030-01-01T00:00:00Z'};
const fact:ProjectionSnapshot={contract_version:'partner-graph-v1',organization_id:'dao',assertion_id:'a',revision:1,deleted:false,subject:{entity_id:'e',entity_type:'Organization'},predicate:'HAS_CAPABILITY',value:'manufacturing',qualifiers:{},evidence:[{knowledge_id:'k',knowledge_revision:1,audience:'public',scope_kind:'organization',scope_id:'dao',source_id:'official',source_revision:'1',source_hash:'a'.repeat(64),source_locator:{line:1},observed_at:'2026-10-23T00:00:00Z',effective_from:null,effective_until:null}]};
async function setup(){const client=await Client.embedded({kind:'inMemory',database:crypto.randomUUID()});clients.push(client);const graph=createHelixProjection(client,{embedded:true});await graph.initialize();await graph.advanceFence(lease);return graph;}
it('rejects untyped values, ambiguous value/object assertions and invalid predicate/type strings',async()=>{
  const graph=await setup();
  await expect(graph.apply(lease,{...fact,value:Number.NaN})).rejects.toThrow(/value/);
  await expect(graph.apply(lease,{...fact,object:{entity_id:'c',entity_type:'Capability'}})).rejects.toThrow(/object|value/);
  await expect(graph.apply(lease,{...fact,predicate:'UNREVIEWED' as never})).rejects.toThrow(/predicate/);
  await expect(graph.apply(lease,{...fact,subject:{entity_id:'e',entity_type:'Secret' as never}})).rejects.toThrow(/entity/);
});
it('does not let an existing canonical entity change its type during reprojection',async()=>{
  const graph=await setup();await graph.apply(lease,fact);
  await expect(graph.apply(lease,{...fact,revision:2,subject:{entity_id:'e',entity_type:'Person'}})).rejects.toThrow(/identity|type/);
  expect((await graph.receipt('dao','a'))?.revision).toBe(1);
});
it('does not project expired freshness evidence even when an old exporter supplies it',async()=>{
  const graph=await setup();
  const stale={...fact, predicate:'STATUS' as const, evidence:[{...fact.evidence[0]!,checked_at:'2026-01-01T00:00:00Z',freshness_seconds:60}]};
  await graph.apply(lease,stale);
  expect(await graph.candidates({organization_id:'dao',principal_id:'member',audiences:['public'],project_ids:[],opportunity_ids:[],as_of:'2026-10-23T00:00:00Z'},{predicate:'STATUS',limit:20})).toEqual([]);
});
it('does not expose evidence captured after the requested as-of time',async()=>{
  const graph=await setup();await graph.apply(lease,fact);
  expect(await graph.candidates({organization_id:'dao',principal_id:'member',audiences:['public'],project_ids:[],opportunity_ids:[],as_of:'2026-10-22T00:00:00Z'},{predicate:'HAS_CAPABILITY',limit:20})).toEqual([]);
});
it('filters future freshness checks and accepts already-expired historical freshness without blocking replay',async()=>{
  const graph=await setup();
  await graph.apply(lease,{...fact,evidence:[{...fact.evidence[0]!,observed_at:'2026-10-20T00:00:00Z',checked_at:'2026-10-25T00:00:00Z',freshness_seconds:86400}]});
  const scope={organization_id:'dao',principal_id:'member',audiences:['public'] as ('public')[],project_ids:[],opportunity_ids:[],as_of:'2026-10-23T00:00:00Z'};
  expect(await graph.candidates(scope,{predicate:'HAS_CAPABILITY',limit:20})).toEqual([]);
  await expect(graph.apply(lease,{...fact,revision:2,evidence:[{...fact.evidence[0]!,effective_from:'2026-10-24T00:00:00Z',checked_at:'2026-01-01T00:00:00Z',freshness_seconds:60}]})).resolves.toMatchObject({revision:2});
  expect(await graph.candidates(scope,{predicate:'HAS_CAPABILITY',limit:20})).toEqual([]);
});
it('records explicit oversized-evidence omission without leaving stale hits or blocking unrelated work',async()=>{
  const graph=await setup();await graph.apply(lease,fact);
  const omitted={...fact,revision:2,deleted:true,value:null,evidence:[],projection_omitted:true,omission_reason:'evidence_limit' as const,evidence_count:101};
  expect(await graph.apply(lease,omitted)).toMatchObject({revision:2,deleted:true,projection_omitted:true});
  await expect(graph.apply(lease,{...fact,assertion_id:'b'})).resolves.toMatchObject({revision:1});
  const scope={organization_id:'dao',principal_id:'member',audiences:['public'] as ('public')[],project_ids:[],opportunity_ids:[],as_of:'2026-10-24T00:00:00Z'};
  expect((await graph.candidates(scope,{predicate:'HAS_CAPABILITY',limit:20})).map(x=>x.assertion_id)).toEqual(['b']);
  await expect(graph.apply(lease,{...fact,revision:3})).resolves.toMatchObject({revision:3,deleted:false});
});
