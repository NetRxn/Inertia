import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { createContributionBoundary } from '../../src/contributions/service.js';
import { validateArtifacts } from '../../src/contributions/artifacts.js';
import type { Enrollment, Candidate } from '../../src/contributions/contracts.js';
const hash = (v: string) => createHash('sha256').update(v).digest('hex');
function fixture() {
  let enrollment: Enrollment = {enabled:true, memberId:'member-a',agentId:'agent-a',authorityEpoch:'attempt-a',companyId:'company-a',projectId:'project-a',issueId:'issue-a',taskRevision:'revision-a',runId:'run-a',checkoutRunId:'run-a',providerLeaseId:'lease-a',lifecycleDisposition:'active',lifecycleGeneration:'generation-a',enrollmentRevision:'enrollment-a',expiresAt:2000,dataClass:'approved-public',artifactClass:'text-evidence',active:true, input:'Approved minimal task only'};
  let native = {companyId:'company-a',projectId:'project-a',issueId:'issue-a',taskRevision:'revision-a',agentId:'agent-a',runId:'run-a',checkoutRunId:'run-a',running:true};
  const journal = new Map<string,Candidate>();
  const dependencies = {enabled:()=>true, clock:()=>1000, loadEnrollment:vi.fn(async()=>structuredClone(enrollment)), readNative:vi.fn(async()=>structuredClone(native)), journal:{get:vi.fn(async(id:string)=>journal.get(id)??null),put:vi.fn(async(c:Candidate)=>{ if(!journal.has(c.operationId)) journal.set(c.operationId,structuredClone(c)); })}};
  const boundary=createContributionBoundary(dependencies);
  const actor={memberId:'member-a',agentId:'agent-a',authorityEpoch:'attempt-a'};
  const artifact={name:'evidence.txt',mediaType:'text/plain',text:'Evidence, not approval.',sha256:hash('Evidence, not approval.')};
  return {boundary,dependencies,actor,artifact,journal,setEnrollment:(v:Partial<Enrollment>)=>Object.assign(enrollment,v),setNative:(v:Partial<typeof native>)=>Object.assign(native,v)};
}
describe('member candidate boundary',()=>{
 it('exports only curated input and stores an untrusted candidate, never completion',async()=>{const f=fixture(); const b=await f.boundary.exportInput(f.actor,'issue-a');expect(b.state).toBe('input'); if(b.state!=='input')throw Error(); expect(JSON.stringify(b)).not.toMatch(/secret|description/);const r=await f.boundary.submit(f.actor,b.binding,[f.artifact]);expect(r.state).toBe('candidate-for-review');expect(f.journal.size).toBe(1);});
 it('disabled is zero export and zero source calls',async()=>{const f=fixture();f.dependencies.enabled=()=>false;expect(await f.boundary.exportInput(f.actor,'issue-a')).toEqual({state:'disabled'});expect(f.dependencies.loadEnrollment).not.toHaveBeenCalled();});
 it.each([{memberId:'member-b',agentId:'agent-a'},{memberId:'member-a',agentId:'agent-b'}])('denies cross member/agent',async(actor)=>{const f=fixture();expect((await f.boundary.exportInput({...actor,authorityEpoch:'attempt-a'},'issue-a')).state).toBe('denied');});
 it.each([{active:false},{expiresAt:1000},{enabled:false},{companyId:'foreign'},{projectId:'foreign'},{runId:'other'},{checkoutRunId:'other'}])('denies revoked/expired/foreign enrollment %j',async(change)=>{const f=fixture();f.setEnrollment(change);expect((await f.boundary.exportInput(f.actor,'issue-a')).state).toBe('denied');});
 it('denies guessed task before native reads',async()=>{const f=fixture();expect((await f.boundary.exportInput(f.actor,'guessed')).state).toBe('denied');expect(f.dependencies.readNative).not.toHaveBeenCalled();});
 it.each([{enrollmentRevision:'new'},{lifecycleGeneration:'new'},{providerLeaseId:'other'},{lifecycleDisposition:'unknown' as const},{lifecycleDisposition:'fenced' as const},{lifecycleDisposition:'lost' as const},{lifecycleDisposition:'superseded' as const},{active:false},{expiresAt:999}])('fences current enrollment changes %j',async(change)=>{const f=fixture();const b=await f.boundary.exportInput(f.actor,'issue-a');if(b.state!=='input')throw Error();f.setEnrollment(change);expect((await f.boundary.submit(f.actor,b.binding,[f.artifact])).state).toBe('denied');expect(f.journal.size).toBe(0);});
 it.each([{taskRevision:'new'},{runId:'new'},{checkoutRunId:'new'},{running:false},{agentId:'other'}])('fences native changes %j',async(change)=>{const f=fixture();const b=await f.boundary.exportInput(f.actor,'issue-a');if(b.state!=='input')throw Error();f.setNative(change);expect((await f.boundary.submit(f.actor,b.binding,[f.artifact])).state).toBe('denied');});
 it('identical retries converge; conflicting second result fails',async()=>{const f=fixture();const b=await f.boundary.exportInput(f.actor,'issue-a');if(b.state!=='input')throw Error();const first=await f.boundary.submit(f.actor,b.binding,[f.artifact]);expect(await f.boundary.submit(f.actor,b.binding,[f.artifact])).toEqual(first);expect((await f.boundary.submit(f.actor,b.binding,[{...f.artifact,text:'other',sha256:hash('other')}])).state).toBe('conflict');});
 it('reconciles lost journal response by immutable operation identity',async()=>{const f=fixture();const b=await f.boundary.exportInput(f.actor,'issue-a');if(b.state!=='input')throw Error();const put=f.dependencies.journal.put;f.dependencies.journal.put=vi.fn(async(c)=>{await put(c);throw Error('lost response')});expect((await f.boundary.submit(f.actor,b.binding,[f.artifact])).state).toBe('candidate-for-review');expect(f.journal.size).toBe(1);});
 it('unresolved storage outcome is uncertain, never accepted',async()=>{const f=fixture();const b=await f.boundary.exportInput(f.actor,'issue-a');if(b.state!=='input')throw Error();f.dependencies.journal.put=vi.fn(async()=>{throw Error('offline')});expect((await f.boundary.submit(f.actor,b.binding,[f.artifact])).state).toBe('uncertain');});
});
describe('hostile artifacts',()=>{
 it.each([{name:'../evidence.txt'},{name:'script.sh'},{name:'Evidence.txt.exe'},{mediaType:'application/zip'},{sha256:'0'.repeat(64)},{text:'#!/bin/sh\necho bad',sha256:hash('#!/bin/sh\necho bad')},{text:'x'.repeat(65537)},{url:'https://example.invalid/private'},{text:'<script>alert(1)</script>',sha256:hash('<script>alert(1)</script>')}])('rejects %j',(change)=>{const f=fixture();expect(()=>validateArtifacts([{...f.artifact,...change}])).toThrow();});
 it('rejects excessive count and duplicate names',()=>{const f=fixture();expect(()=>validateArtifacts(Array(9).fill(f.artifact))).toThrow();expect(()=>validateArtifacts([f.artifact,f.artifact])).toThrow();});
});

it('rejects invalid UTF-8 and preserves no guessed artifact fetch path',()=>{expect(()=>validateArtifacts([{name:'bad.txt',mediaType:'text/plain',text:'\ud800',sha256:hash('\ud800')}])).toThrow();});
it('fences a stale authenticated attempt even when a provider generation is reused',async()=>{
 const f=fixture(); const actor={...f.actor,authorityEpoch:'attempt-x'};
 f.setEnrollment({authorityEpoch:'attempt-x'} as Partial<Enrollment>);
 const original=await f.boundary.exportInput(actor,'issue-a'); expect(original.state).toBe('input');
 f.setEnrollment({authorityEpoch:'attempt-y',lifecycleGeneration:'generation-y'} as Partial<Enrollment>);
 f.setEnrollment({authorityEpoch:'attempt-z',lifecycleGeneration:'generation-a'} as Partial<Enrollment>);
 expect((await f.boundary.exportInput(actor,'issue-a')).state).toBe('denied');
 if(original.state!=='input')throw Error();
 expect((await f.boundary.submit(actor,original.binding,[f.artifact])).state).toBe('denied');
 expect((await f.boundary.exportInput({...actor,authorityEpoch:'attempt-z'},'issue-a')).state).toBe('input');
});

it('rejects reconstructed stale transport epoch before native reads',async()=>{const f=fixture();const input=await f.boundary.exportInput(f.actor,'issue-a');if(input.state!=='input')throw Error();f.setEnrollment({authorityEpoch:'reconstructed-attempt'});f.dependencies.readNative.mockClear();const restarted=createContributionBoundary(f.dependencies);expect((await restarted.exportInput(f.actor,'issue-a')).state).toBe('denied');expect((await restarted.submit(f.actor,input.binding,[f.artifact])).state).toBe('denied');expect(f.dependencies.readNative).not.toHaveBeenCalled();});
