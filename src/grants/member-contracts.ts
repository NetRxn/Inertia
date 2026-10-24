import type {PacketIdentity,ReviewedGrantExport} from './contracts.js';
/** V2 is opt-in and separate from legacy role signoffs. Instances are built by trusted host code only. */
export interface MemberReviewPolicy {
 readonly schema:'inertia.member-review-policy.v2';readonly id:string;readonly version:number;
 readonly mode:'verified_member_application_access';
 readonly scope:{readonly companyId:string;readonly applicantId:string;readonly applicationId:string;readonly opportunityNamespace:string;readonly opportunityExternalId:string;readonly sourceScope:string};
 readonly authorityRefs:readonly string[];
 readonly additionalRequirements:readonly {readonly id:string;readonly kind:'human_signoff'|'signature'|'certification'|'governance';readonly sourceRef:string}[];
}
export interface MemberPolicySnapshot {readonly policy:MemberReviewPolicy;readonly policyHash:string}
export interface MemberPacketTarget {readonly packetId:string;readonly packetVersion:number;readonly packetContentHash:string}
export interface SubmissionEvidence {readonly kind:'reference'|'image'|'email';readonly reference:string;readonly sha256:string|null}
interface IntentBase {readonly schema:'inertia.member-packet-action.v2';readonly policyHash:string;readonly target:MemberPacketTarget}
export type MemberPacketIntent=IntentBase&(
 {readonly action:'approve_packet'|'changes_requested';readonly payload:{readonly note:string}}|
 {readonly action:'record_submission';readonly payload:{readonly submittedAt:string;readonly declaredSubmitter:string|null;readonly note:string;readonly evidence:SubmissionEvidence|null}}|
 {readonly action:'attach_submission_evidence';readonly payload:{readonly submissionId:string;readonly evidence:SubmissionEvidence}}|
 {readonly action:'correct_submission';readonly payload:{readonly submissionId:string;readonly submittedAt:string;readonly declaredSubmitter:string|null;readonly note:string}}
);
/** Returned only by the trusted identity/application ACL adapter, never by a form or agent. */
export interface MemberApplicationAccessProof {
 readonly actorUserId:string;readonly actorType:'human';readonly authenticatedHuman:true;
 readonly verifiedDaoMember:true;readonly applicationActionAllowed:true;readonly nativeActionAllowed:true;
 readonly membershipVersion:string;readonly applicationAccessVersion:string;
}
export interface AcceptedMemberPacketAction {
 readonly schema:'inertia.member-packet-acceptance.v2';
 readonly source:{readonly kind:'paperclip'|'buzz';readonly id:string};readonly acceptedAt:string;
 readonly actor:{readonly type:'human';readonly userId:string};readonly authorization:MemberApplicationAccessProof;
 readonly intent:MemberPacketIntent;readonly intentHash:string;
}
export interface MemberApplicationAccessPort {
 /** Resolve the original verified native/Buzz source and CURRENT DAO membership/application action rights in the owning transaction. Missing adapter means disabled. Read/public visibility is not an allow. */
 authorizeCurrent(originalAuthenticatedContext:unknown,request:Readonly<{policy:MemberPolicySnapshot;intent:MemberPacketIntent}>):Promise<MemberApplicationAccessProof|null>;
}
export interface MemberPacketReview {
 readonly schema:'inertia.member-packet-review.v2';readonly policyHash:string;readonly target:MemberPacketTarget;
 readonly decision:'approved'|'changes_requested';readonly actorUserId:string;readonly source:{readonly kind:'paperclip'|'buzz';readonly id:string};
 readonly recordedAt:string;readonly authorization:MemberApplicationAccessProof;readonly note:string;
}
export interface MemberReviewedExport {
 readonly schema:'inertia.member-reviewed-export.v2';readonly policy:MemberReviewPolicy;readonly policyHash:string;
 readonly packet:ReviewedGrantExport['packet'];readonly artifacts:ReviewedGrantExport['artifacts'];
 readonly packetContentHash:string;readonly opportunity:ReviewedGrantExport['opportunity'];readonly lifecycle:ReviewedGrantExport['lifecycle'];
 readonly preparation:Pick<ReviewedGrantExport['handoff'],'technically_ready'|'technical_blockers'|'placeholders'|'open_questions'|'unverified_forms'|'requirement_gates'>;
 readonly memberReview:MemberPacketReview|null;
 readonly additionalRequirements:readonly {readonly id:string;readonly kind:'human_signoff'|'signature'|'certification'|'governance';readonly sourceRef:string;readonly satisfied:boolean;readonly evidenceRef:string|null}[];
 readonly submission:{readonly state:'not_reported'|'member_attested';readonly providerVerified:false};
}
export interface MemberReviewedSource {
 /** Trusted exporter must read current engine policy, packet/artifact inventory, preparation and exact review together. No caller-supplied approval export is authoritative. */
 readMemberReviewedExport(identity:PacketIdentity):Promise<MemberReviewedExport>;
 readArtifact(identity:PacketIdentity,key:string):Promise<Uint8Array>;
}
export interface FrozenMemberReviewedPacket extends PacketIdentity {
 readonly schema:'inertia-member-grant-v2';readonly version:number;readonly policyHash:string;readonly packetContentHash:string;
 readonly contentHash:string;readonly canonicalContent:string;readonly formalRequirementsComplete:boolean;
 /** A review/freeze is never provider verification, formal governance approval or a submission action. */
 readonly submissionAuthority:false;
}
