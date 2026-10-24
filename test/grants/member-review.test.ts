import {describe,expect,it} from 'vitest';
import * as member from '../../src/grants/member-review.js';
const rawPolicy=()=>({schema:'inertia.member-review-policy.v2',id:'pilot-policy',version:1,mode:'verified_member_application_access',scope:{companyId:'company',applicantId:'applicant',applicationId:'application',opportunityNamespace:'fixture',opportunityExternalId:'opportunity',sourceScope:'members'},authorityRefs:['synthetic:member-pilot'],additionalRequirements:[]});
const target={packetId:'packet',packetVersion:1,packetContentHash:'a'.repeat(64)};
describe('member pilot v2 contract, not a role administration policy',()=>{
 it('requires an explicit trusted policy and no default specialist handoffs',()=>{
  const snapshot=member.snapshotMemberPolicy(rawPolicy());expect(snapshot.policy.additionalRequirements).toEqual([]);expect(snapshot.policyHash).toMatch(/^[a-f0-9]{64}$/);expect(Object.isFrozen(snapshot.policy.scope)).toBe(true);
  for(const bad of [undefined,{...rawPolicy(),mode:'owner'},{...rawPolicy(),requiredRoles:['program']},{...rawPolicy(),authorityRefs:[]},{...rawPolicy(),version:0}])expect(()=>member.snapshotMemberPolicy(bad)).toThrow();
 });
 it('binds policy requirements to trusted references, version and exact application scope',()=>{
  const p=rawPolicy();const a=member.snapshotMemberPolicy(p);expect(member.snapshotMemberPolicy({...p,version:2}).policyHash).not.toBe(a.policyHash);
  expect(()=>member.snapshotMemberPolicy({...p,additionalRequirements:[{id:'actual-certification',kind:'certification',sourceRef:'missing'}]})).toThrow();
  expect(member.snapshotMemberPolicy({...p,additionalRequirements:[{id:'actual-certification',kind:'certification',sourceRef:'synthetic:member-pilot'}]}).policy.additionalRequirements).toHaveLength(1);
 });
 it('parses only exact member intents, never accepts caller asserted actor/authority/roles',()=>{
  const p=member.snapshotMemberPolicy(rawPolicy());const intent={schema:'inertia.member-packet-action.v2',policyHash:p.policyHash,target,action:'approve_packet',payload:{note:'Reviewed the exact artifact.'}};
  expect(member.parseMemberIntent(intent,p).action).toBe('approve_packet');
  for(const bad of [{...intent,actorUserId:'spoof'},{...intent,authorized:true},{...intent,reviewerRole:'program'},{...intent,target:{...target,packetVersion:0}},{...intent,policyHash:'b'.repeat(64)},{...intent,payload:{note:'ok',roles:['program']}}])expect(()=>member.parseMemberIntent(bad,p)).toThrow();
 });
 it('allows receipt-free submission attestations and bounded later evidence without provider verification claims',()=>{
  const p=member.snapshotMemberPolicy(rawPolicy());const base={schema:'inertia.member-packet-action.v2',policyHash:p.policyHash,target};
  expect(member.parseMemberIntent({...base,action:'record_submission',payload:{submittedAt:'2026-10-24T12:00:00Z',declaredSubmitter:null,note:'Reported external submission.',evidence:null}},p).action).toBe('record_submission');
  expect(member.parseMemberIntent({...base,action:'attach_submission_evidence',payload:{submissionId:'submission-event',evidence:{kind:'reference',reference:'vault://synthetic-receipt',sha256:null}}},p).action).toBe('attach_submission_evidence');
  expect(()=>member.parseMemberIntent({...base,action:'record_submission',payload:{submittedAt:'2026-10-24',declaredSubmitter:null,note:'Reported.',evidence:null}},p)).toThrow();
  expect(()=>member.parseMemberIntent({...base,action:'attach_submission_evidence',payload:{submissionId:'event',evidence:{kind:'provider_verified',reference:'unchecked',sha256:null}}},p)).toThrow();
 });
});

it('matches the shared language-neutral policy and exact-intent digest fixture',async()=>{
 const {readFile}=await import('node:fs/promises');const vector=JSON.parse(await readFile(new URL('../../fixtures/member-review-v2-contract.json',import.meta.url),'utf8'));
 const snapshot=member.snapshotMemberPolicy(vector.policy);expect(snapshot.policyHash).toBe(vector.policyHash);expect(member.memberHash(member.parseMemberIntent(vector.intent,snapshot))).toBe(vector.intentHash);
});
it('bounds member intent text by UTF-8 bytes consistently across host languages',()=>{
 const p=member.snapshotMemberPolicy(rawPolicy());expect(()=>member.parseMemberIntent({schema:'inertia.member-packet-action.v2',policyHash:p.policyHash,target,action:'approve_packet',payload:{note:'😀'.repeat(600)}},p)).toThrow();
});

it.each(['policy','evidence'] as const)('rejects shared non-string %s discriminants without coercion',async boundary=>{
 const {readFile}=await import('node:fs/promises');const vector=JSON.parse(await readFile(new URL('../../fixtures/member-review-v2-contract.json',import.meta.url),'utf8'));
 const p=member.snapshotMemberPolicy(vector.policy);
 for(const kind of vector.invalidDiscriminants){
  if(boundary==='policy')expect(()=>member.snapshotMemberPolicy({...vector.policy,additionalRequirements:[{id:'actual-signature',kind,sourceRef:vector.policy.authorityRefs[0]}]})).toThrow(member.MemberPacketBoundaryError);
  else expect(()=>member.parseMemberIntent({...vector.intent,action:'attach_submission_evidence',payload:{submissionId:'submission',evidence:{kind,reference:'synthetic:receipt',sha256:null}}},p)).toThrow(member.MemberPacketBoundaryError);
 }
});
it('rejects timestamps outside the common Python/TypeScript calendar and precision domain',async()=>{
 const {readFile}=await import('node:fs/promises');const vector=JSON.parse(await readFile(new URL('../../fixtures/member-review-v2-contract.json',import.meta.url),'utf8'));
 for(const value of vector.invalidTimestamps)expect(()=>member.memberTimestamp(value)).toThrow(member.MemberPacketBoundaryError);
});
