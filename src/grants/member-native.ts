import {canonicalJson} from './engine.js';
import {MemberPacketBoundaryError, memberHash, memberTarget, memberTimestamp, parseMemberIntent, snapshotMemberPolicy, validateMemberAccessProof} from './member-review.js';
import type {AcceptedMemberPacketAction, MemberPacketIntent, MemberPacketTarget, MemberPolicySnapshot} from './member-contracts.js';

/** Trusted host registration only. No named reviewer, role grant or request authority. */
export interface MemberNativeBinding extends MemberPolicySnapshot {
 readonly schema:'inertia.native-member-packet-binding.v2';
 readonly companyId:string; readonly issueId:string; readonly interactionId:string; readonly itemId:string;
 readonly documentId:string; readonly documentKey:string; readonly documentRevisionId:string;
 readonly interactionDigest:string; readonly target:MemberPacketTarget;
}
function requireThat(value:unknown,message:string):asserts value {
 if(!value)throw new MemberPacketBoundaryError(message);
}
function record(raw:unknown,keys:readonly string[]):Record<string,unknown> {
 requireThat(raw&&typeof raw==='object'&&!Array.isArray(raw),'Expected exact native member object');
 requireThat(Object.keys(raw).length===keys.length&&keys.every(key=>Object.hasOwn(raw,key)),'Unknown or missing native member fields');
 return raw as Record<string,unknown>;
}
function identifier(raw:unknown):string {
 requireThat(typeof raw==='string'&&raw.length<=128&&/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(raw),'Invalid native member identifier');
 return raw;
}
export function snapshotMemberNativeBinding(raw:unknown):MemberNativeBinding {
 const r=record(raw,['schema','companyId','issueId','interactionId','itemId','documentId','documentKey','documentRevisionId','interactionDigest','policy','policyHash','target']);
 const policy=snapshotMemberPolicy(r.policy);
 requireThat(r.schema==='inertia.native-member-packet-binding.v2'&&r.policyHash===policy.policyHash&&r.companyId===policy.policy.scope.companyId,'Native member policy/scope mismatch');
 requireThat(typeof r.interactionDigest==='string'&&/^[a-f0-9]{64}$/.test(r.interactionDigest),'Invalid native card digest');
 return Object.freeze({schema:'inertia.native-member-packet-binding.v2',companyId:identifier(r.companyId),issueId:identifier(r.issueId),interactionId:identifier(r.interactionId),itemId:identifier(r.itemId),documentId:identifier(r.documentId),documentKey:identifier(r.documentKey),documentRevisionId:identifier(r.documentRevisionId),interactionDigest:r.interactionDigest,...policy,target:memberTarget(r.target)});
}
export function memberNativeIntent(rawBinding:unknown,rawVerdict:unknown):MemberPacketIntent|null {
 const binding=snapshotMemberNativeBinding(rawBinding), v=record(rawVerdict,['id','verdict','reason']);
 requireThat(v.id===binding.itemId&&['approve','reject','defer'].some(value=>value===v.verdict),'Exact native review item/verdict required');
 if(v.verdict==='defer')return null;
 return parseMemberIntent({schema:'inertia.member-packet-action.v2',policyHash:binding.policyHash,target:binding.target,action:v.verdict==='approve'?'approve_packet':'changes_requested',payload:{note:v.reason}},binding);
}
/** Shape validation for immutable native storage, NOT authorization of a caller's proof. */
export function memberNativeAcceptance(rawBinding:unknown,raw:unknown):AcceptedMemberPacketAction {
 const binding=snapshotMemberNativeBinding(rawBinding), r=record(raw,['sourceId','acceptedAt','actorUserId','authorization','intent']);
 const actor=identifier(r.actorUserId), intent=parseMemberIntent(r.intent,binding);
 requireThat((intent.action==='approve_packet'||intent.action==='changes_requested')&&canonicalJson(intent.target)===canonicalJson(binding.target),'Native member review target/action mismatch');
 return Object.freeze({schema:'inertia.member-packet-acceptance.v2',source:Object.freeze({kind:'paperclip',id:identifier(r.sourceId)}),acceptedAt:memberTimestamp(r.acceptedAt),actor:Object.freeze({type:'human',userId:actor}),authorization:validateMemberAccessProof(r.authorization,actor),intent,intentHash:memberHash(intent)});
}
/** Fixed v2 codecs injected by trusted in-process host bootstrap, never plugin/request JSON. */
export const memberNativeCodec=Object.freeze({snapshotBinding:snapshotMemberNativeBinding,intentForVerdict:memberNativeIntent,acceptance:memberNativeAcceptance,accessProof:validateMemberAccessProof,hash:memberHash,canonical:canonicalJson});
