import {createHash} from 'node:crypto';
import {canonicalJson} from './engine.js';
import type {MemberPacketIntent,MemberPolicySnapshot,MemberReviewPolicy,MemberPacketTarget,SubmissionEvidence,MemberApplicationAccessProof} from './member-contracts.js';
export class MemberPacketBoundaryError extends Error {}
function requireThat(condition:unknown,message:string):asserts condition {if(!condition)throw new MemberPacketBoundaryError(message);}
function record(raw:unknown,keys:readonly string[]):Record<string,unknown>{requireThat(raw&&typeof raw==='object'&&!Array.isArray(raw),'Expected a member packet object');const row=raw as Record<string,unknown>;requireThat(Object.keys(row).length===keys.length&&keys.every(k=>Object.hasOwn(row,k)),'Unknown or missing member packet fields');return row;}
function text(raw:unknown,max=256,empty=false):string{requireThat(typeof raw==='string'&&Buffer.byteLength(raw,'utf8')<=max&&(empty||raw.length>0)&&raw.trim()===raw&&!/[\u0000-\u001f\u007f]/.test(raw),'Invalid bounded text');return raw;}
function id(raw:unknown):string{const value=text(raw,128);requireThat(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(value),'Invalid scoped identifier');return value;}
export function memberHash(value:unknown):string{return createHash('sha256').update(canonicalJson(value),'utf8').digest('hex');}
export function memberTimestamp(raw:unknown):string{const value=text(raw,40);requireThat(/^\d{4}-\d\d-\d\dT([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)&&Number.isFinite(Date.parse(value)),'An exact timestamp with timezone is required');const calendar=value.slice(0,10);requireThat(Number(calendar.slice(0,4))>=1&&new Date(calendar+'T00:00:00Z').toISOString().slice(0,10)===calendar,'Invalid timestamp calendar date');return value;}
function hash(raw:unknown):string{requireThat(typeof raw==='string'&&/^[a-f0-9]{64}$/.test(raw),'Invalid content/policy hash');return raw;}
export function snapshotMemberPolicy(raw:unknown):MemberPolicySnapshot{
 const row=record(raw,['schema','id','version','mode','scope','authorityRefs','additionalRequirements']);
 requireThat(row.schema==='inertia.member-review-policy.v2'&&row.mode==='verified_member_application_access'&&Number.isSafeInteger(row.version)&&Number(row.version)>0,'Explicit member review policy v2 required');
 const scope=record(row.scope,['companyId','applicantId','applicationId','opportunityNamespace','opportunityExternalId','sourceScope']);
 const admittedScope=Object.freeze({companyId:id(scope.companyId),applicantId:id(scope.applicantId),applicationId:id(scope.applicationId),opportunityNamespace:id(scope.opportunityNamespace),opportunityExternalId:id(scope.opportunityExternalId),sourceScope:id(scope.sourceScope)});
 requireThat(Array.isArray(row.authorityRefs)&&row.authorityRefs.length>0&&row.authorityRefs.length<=16,'Trusted policy authority references required');const refs=row.authorityRefs.map(x=>text(x)).sort();requireThat(new Set(refs).size===refs.length,'Duplicate policy references');
 requireThat(Array.isArray(row.additionalRequirements)&&row.additionalRequirements.length<=16,'Invalid additional requirements');const requirements=row.additionalRequirements.map(raw=>{const r=record(raw,['id','kind','sourceRef']);requireThat(typeof r.kind==='string'&&['human_signoff','signature','certification','governance'].includes(r.kind)&&typeof r.sourceRef==='string'&&refs.includes(r.sourceRef),'Requirement needs a trusted policy source');return Object.freeze({id:id(r.id),kind:r.kind as MemberReviewPolicy['additionalRequirements'][number]['kind'],sourceRef:text(r.sourceRef)});}).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);requireThat(new Set(requirements.map(x=>x.id)).size===requirements.length,'Duplicate requirement');
 const policy:MemberReviewPolicy=Object.freeze({schema:'inertia.member-review-policy.v2',id:id(row.id),version:Number(row.version),mode:'verified_member_application_access',scope:admittedScope,authorityRefs:Object.freeze(refs),additionalRequirements:Object.freeze(requirements)});
 return Object.freeze({policy,policyHash:memberHash(policy)});
}
export function memberTarget(raw:unknown):MemberPacketTarget{const r=record(raw,['packetId','packetVersion','packetContentHash']);requireThat(Number.isSafeInteger(r.packetVersion)&&Number(r.packetVersion)>0,'Invalid packet version');return Object.freeze({packetId:id(r.packetId),packetVersion:Number(r.packetVersion),packetContentHash:hash(r.packetContentHash)});}
function evidence(raw:unknown):SubmissionEvidence{const r=record(raw,['kind','reference','sha256']);requireThat(typeof r.kind==='string'&&['reference','image','email'].includes(r.kind),'Evidence is an unverified reference, image or email');return Object.freeze({kind:r.kind as SubmissionEvidence['kind'],reference:text(r.reference,2000),sha256:r.sha256===null?null:hash(r.sha256)});}
export function parseMemberIntent(raw:unknown,policy:MemberPolicySnapshot):MemberPacketIntent{
 const r=record(raw,['schema','policyHash','target','action','payload']);requireThat(r.schema==='inertia.member-packet-action.v2'&&r.policyHash===policy.policyHash,'Member intent policy/schema mismatch');
 const base={schema:'inertia.member-packet-action.v2' as const,policyHash:hash(r.policyHash),target:memberTarget(r.target)};
 if(r.action==='approve_packet'||r.action==='changes_requested'){const p=record(r.payload,['note']);return Object.freeze({...base,action:r.action,payload:Object.freeze({note:text(p.note,2000,true)})});}
 if(r.action==='record_submission'){const p=record(r.payload,['submittedAt','declaredSubmitter','note','evidence']);return Object.freeze({...base,action:r.action,payload:Object.freeze({submittedAt:memberTimestamp(p.submittedAt),declaredSubmitter:p.declaredSubmitter===null?null:text(p.declaredSubmitter,200),note:text(p.note,2000,true),evidence:p.evidence===null?null:evidence(p.evidence)})});}
 if(r.action==='attach_submission_evidence'){const p=record(r.payload,['submissionId','evidence']);return Object.freeze({...base,action:r.action,payload:Object.freeze({submissionId:id(p.submissionId),evidence:evidence(p.evidence)})});}
 if(r.action==='correct_submission'){const p=record(r.payload,['submissionId','submittedAt','declaredSubmitter','note']);return Object.freeze({...base,action:r.action,payload:Object.freeze({submissionId:id(p.submissionId),submittedAt:memberTimestamp(p.submittedAt),declaredSubmitter:p.declaredSubmitter===null?null:text(p.declaredSubmitter,200),note:text(p.note,2000,true)})});}
 throw new MemberPacketBoundaryError('Unknown member packet action');
}
/** This verifies a trusted adapter's output shape, not a user assertion of eligibility. */
export function validateMemberAccessProof(raw:unknown,actorUserId:string):MemberApplicationAccessProof{
 const r=record(raw,['actorUserId','actorType','authenticatedHuman','verifiedDaoMember','applicationActionAllowed','nativeActionAllowed','membershipVersion','applicationAccessVersion']);
 requireThat(r.actorUserId===actorUserId&&r.actorType==='human'&&r.authenticatedHuman===true&&r.verifiedDaoMember===true&&r.applicationActionAllowed===true&&r.nativeActionAllowed===true,'Current verified member application action access required');
 return Object.freeze({actorUserId:id(r.actorUserId),actorType:'human',authenticatedHuman:true,verifiedDaoMember:true,applicationActionAllowed:true,nativeActionAllowed:true,membershipVersion:text(r.membershipVersion),applicationAccessVersion:text(r.applicationAccessVersion)});
}
