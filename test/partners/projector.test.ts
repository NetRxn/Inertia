import { expect, it } from 'vitest';
import { projectPending, type ProjectionSource } from '../../src/partners/projector.js';
import type { ProjectionEvent, ProjectionLease, ProjectionSnapshot, ProjectionTarget } from '../../src/partners/types.js';
const lease: ProjectionLease = { organization_id: 'dao', owner: 'worker', epoch: 2, expires_at: '2030-01-01T00:00:00Z' };
const event: ProjectionEvent = { contract_version: 'partner-graph-v1', organization_id: 'dao', sequence: 1, assertion_id: 'a', revision: 1, operation: 'refresh' };
const snapshot: ProjectionSnapshot = { contract_version: 'partner-graph-v1', organization_id: 'dao', assertion_id: 'a', revision: 2, deleted: true, subject: {entity_id:'e',entity_type:'Organization'},predicate:'NAME',value:null,qualifiers:{},evidence:[] };
const receipt = { assertion_id: 'a', revision: 2, snapshot_hash: 'a'.repeat(64), deleted: true };
function setup() {
  let ack = 0, outage = false; const calls: string[] = [];
  const source: ProjectionSource = {
    pending: async () => ack ? [] : [event], hydrate: async () => snapshot,
    acknowledge: async (_lease, seq, readback) => { expect(readback).toEqual(receipt); ack = seq; calls.push('ack'); },
  };
  const target: ProjectionTarget = {
    advanceFence: async () => { calls.push('fence'); },
    apply: async () => { calls.push('apply'); if(outage) throw Error('outage'); return receipt; },
    receipt: async () => { calls.push('readback'); return receipt; }, candidates: async () => [],
  };
  return {source,target,calls,ack:()=>ack,outage:(value:boolean)=>{outage=value;}};
}
it('hydrates current authoritative tombstone, fences and reads back before durable ack', async () => {
  const f=setup(); expect(await projectPending(f.source,f.target,lease)).toBe(1);
  expect(f.calls).toEqual(['fence','apply','readback','ack']); expect(f.ack()).toBe(1);
  expect(await projectPending(f.source,f.target,lease)).toBe(0);
});
it('leaves outbox pending on outage and safely replays after recovery', async () => {
  const f=setup(); f.outage(true); await expect(projectPending(f.source,f.target,lease)).rejects.toThrow('outage');
  expect(f.ack()).toBe(0); f.outage(false); expect(await projectPending(f.source,f.target,lease)).toBe(1);
});
it('does not ack after readback mismatch or a cross-tenant event', async () => {
  const f=setup(); f.target.receipt=async()=>({...receipt,revision:1});
  await expect(projectPending(f.source,f.target,lease)).rejects.toThrow(/readback/); expect(f.ack()).toBe(0);
  f.source.pending=async()=>[{...event,organization_id:'other'}];
  await expect(projectPending(f.source,f.target,lease)).rejects.toThrow(/tenant|event/); expect(f.ack()).toBe(0);
});
it('does not skip a sequence gap and rejects unbounded batch requests', async () => {
  const f=setup(); f.source.pending=async()=>[event,{...event,sequence:3}];
  await expect(projectPending(f.source,f.target,lease)).rejects.toThrow(/sequence/); expect(f.ack()).toBe(0);
  await expect(projectPending(f.source,f.target,lease,1001)).rejects.toThrow(/limit/);
});
it('crash after target commit but before acknowledgment replays the same durable event', async () => {
  const f=setup(); const ack=f.source.acknowledge; f.source.acknowledge=async()=>{throw Error('PG crash');};
  await expect(projectPending(f.source,f.target,lease)).rejects.toThrow('PG crash'); expect(f.ack()).toBe(0);
  f.source.acknowledge=ack; expect(await projectPending(f.source,f.target,lease)).toBe(1);
});
