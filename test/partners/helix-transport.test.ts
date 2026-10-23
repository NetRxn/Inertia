import { afterEach, expect, it, vi } from 'vitest';
import { Client, QueryRequest, type ReadBatch, type WriteBatch } from '@helix-db/helix-db';
import { createHelixProjection } from '../../src/partners/helix.js';
import type { ProjectionSnapshot } from '../../src/partners/types.js';
const clients: Client[]=[];
afterEach(async()=>{vi.unstubAllGlobals();for(const c of clients.splice(0))await c.close();});
const lease={organization_id:'dao',owner:'one',epoch:1,expires_at:'2030-01-01T00:00:00Z'};
const snapshot:ProjectionSnapshot={contract_version:'partner-graph-v1',organization_id:'dao',assertion_id:'a',revision:1,deleted:false,subject:{entity_id:'member-opaque',entity_type:'Person'},predicate:'WORK_CONTACT',value:'work@example.org',qualifiers:{kind:'work_email'},evidence:[{knowledge_id:'k',knowledge_revision:1,audience:'public',scope_kind:'organization',scope_id:'dao',source_id:'official',source_revision:'1',source_hash:'a'.repeat(64),source_locator:{line:1},observed_at:'2026-10-23T00:00:00Z',effective_from:null,effective_until:null}]};
it('sends writer/durability headers and reconciles a lost HTTP write response against real Helix receipts',async()=>{
  const embedded=await Client.embedded({kind:'inMemory',database:crypto.randomUUID()});clients.push(embedded);
  let loseNextWrite=false,writes=0,readbacks=0;
  vi.stubGlobal('fetch',async(url:string,init:RequestInit)=>{
    expect(url).toBe('http://localhost:6969/v2/query');
    const body=JSON.parse(String(init.body));const headers=new Headers(init.headers);
    expect(headers.get('x-helix-require-writer')).toBe('true');
    const write=body.request_type==='write';
    expect(headers.get('x-helix-await-durable')).toBe(write?'true':null);
    const request=write?QueryRequest.write(body.query.write as WriteBatch):QueryRequest.read(body.query.read as ReadBatch);
    const result=await embedded.query(request).send();
    if(write && loseNextWrite){loseNextWrite=false;writes++;throw Error('Response lost after real commit');}
    if(!write)readbacks++;
    return new Response(JSON.stringify(result),{status:200});
  });
  const graph=createHelixProjection(Client.server('http://localhost:6969'));await graph.initialize();await graph.advanceFence(lease);
  loseNextWrite=true;
  const receipt=await graph.apply(lease,snapshot);
  expect(receipt.revision).toBe(1);expect(writes).toBe(1);expect(readbacks).toBeGreaterThan(1);
  expect(await graph.apply(lease,snapshot)).toEqual(receipt);
});
it('concurrent old-writer activity cannot survive a newer fence and deletion',async()=>{
  const embedded=await Client.embedded({kind:'inMemory',database:crypto.randomUUID()});clients.push(embedded);
  const graph=createHelixProjection(embedded,{embedded:true});await graph.initialize();await graph.advanceFence(lease);await graph.apply(lease,snapshot);
  const next={...lease,owner:'two',epoch:2};
  await Promise.allSettled([graph.apply(lease,{...snapshot,revision:2}),graph.advanceFence(next)]);
  // Retrying fence is a readback-confirmed idempotent acquisition, not stale write retry.
  await graph.advanceFence(next);await graph.apply(next,{...snapshot,revision:3,deleted:true,evidence:[]});
  const results=await Promise.allSettled([2,4,9].map(revision=>graph.apply(lease,{...snapshot,revision})));
  expect(results.every(r=>r.status==='rejected')).toBe(true);
  expect((await graph.receipt('dao','a'))?.deleted).toBe(true);expect((await graph.receipt('dao','a'))?.revision).toBe(3);
});
