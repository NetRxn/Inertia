import {canonicalJson,sha256,verifyPacketArtifactInventory,GrantBoundaryError} from './engine.js';
import {snapshotMemberPolicy,memberTarget,memberTimestamp,validateMemberAccessProof} from './member-review.js';
import type {PacketIdentity} from './contracts.js';
import type {FrozenMemberReviewedPacket,MemberReviewedExport,MemberReviewedSource} from './member-contracts.js';
function requireThat(value:unknown,message:string):asserts value {if(!value)throw new GrantBoundaryError(message);}
function exactKeys(value:unknown,keys:readonly string[]):void {requireThat(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k)),'Invalid member-reviewed record fields');}
function empty(value:unknown):boolean{return Array.isArray(value)&&value.length===0;}
function timestampMilliseconds(raw:unknown):number {
 const value=memberTimestamp(raw);
 // Preserve accepted Python ISO microseconds, as v1 does, beyond Date.parse precision.
 const fraction=(/\.(\d{1,6})(?:Z|[+-]\d\d:\d\d)$/.exec(value)?.[1]??'').padEnd(6,'0');
 return Date.parse(value)+Number(fraction.slice(3))/1000;
}
/** Additive member pilot freeze. V1 role gates and all historical v1 receipts remain unchanged. */
export async function freezeMemberReviewedPacket(source:MemberReviewedSource,identity:PacketIdentity,now:Date):Promise<FrozenMemberReviewedPacket>{
 const at=new Date(now.getTime()),request=Object.freeze({packetId:identity.packetId,applicantId:identity.applicantId});
 const read=source.readMemberReviewedExport.bind(source),readArtifact=source.readArtifact.bind(source);
 const record=JSON.parse(canonicalJson(await read(request))) as MemberReviewedExport;
 exactKeys(record,['schema','policy','policyHash','packet','artifacts','packetContentHash','opportunity','lifecycle','preparation','memberReview','additionalRequirements','submission']);
 const policy=snapshotMemberPolicy(record.policy);
 requireThat(record.schema==='inertia.member-reviewed-export.v2'&&record.policyHash===policy.policyHash,'Explicit member policy/export v2 required');
 const p=record.packet,l=record.lifecycle,o=record.opportunity,h=record.preparation,review=record.memberReview;
 requireThat(Number.isFinite(at.getTime())&&p.id===request.packetId&&p.applicant_id===request.applicantId&&policy.policy.scope.applicantId===request.applicantId,'Member packet identity mismatch');
 requireThat(Number.isSafeInteger(p.version)&&p.version>0&&p.status==='submission_ready','Member packet is not final preparation');
 requireThat(l.is_latest_version===true&&l.source_available===true&&l.cycle_state==='current'&&l.availability==='open_now'&&empty(l.authorization_blockers),'Refresh current application source and access');
 requireThat(l.submission_mode==='direct_application'&&p.packet_data.submission_mode===l.submission_mode,'Only the existing direct-application freeze is qualified');
 requireThat(o.namespace===p.opportunity_namespace&&o.external_id===p.opportunity_external_id&&o.namespace===policy.policy.scope.opportunityNamespace&&o.external_id===policy.policy.scope.opportunityExternalId&&o.status==='open','Application scope/source mismatch');
 requireThat(typeof o.source_url==='string'&&new URL(o.source_url).protocol==='https:','Authoritative HTTPS source required');
 requireThat(typeof o.close_date==='string'&&/^\d{4}-\d\d-\d\d$/.test(o.close_date)&&new Date(o.close_date+'T00:00:00Z').toISOString().slice(0,10)===o.close_date&&o.close_date>=at.toISOString().slice(0,10),'Known current opportunity deadline required');
 const verified=timestampMilliseconds(o.current_cycle_verified_at);requireThat(verified<=at.getTime()&&at.getTime()-verified<=86_400_000,'Refresh source verification (maximum age 24 hours)');
 exactKeys(h,['technically_ready','technical_blockers','placeholders','open_questions','unverified_forms','requirement_gates']);
 requireThat(h.technically_ready===true&&[h.technical_blockers,h.placeholders,h.open_questions,h.unverified_forms,h.requirement_gates].every(empty),'Complete technical preparation before member approval freeze');
 const match=p.packet_data.match;requireThat(match&&typeof match==='object'&&!Array.isArray(match)&&empty(match.unknowns)&&empty(match.disqualifiers),'Eligibility/evidence uncertainty remains');
 requireThat(typeof record.packetContentHash==='string'&&/^[a-f0-9]{64}$/.test(record.packetContentHash)&&review,'Exact authoritative member review required');
 exactKeys(review,['schema','policyHash','target','decision','actorUserId','source','recordedAt','authorization','note']);
 requireThat(typeof review.note==='string'&&Buffer.byteLength(review.note,'utf8')<=2000,'Invalid member feedback note');
 const target=memberTarget(review.target);requireThat(review.schema==='inertia.member-packet-review.v2'&&review.policyHash===policy.policyHash&&review.decision==='approved'&&target.packetId===p.id&&target.packetVersion===p.version&&target.packetContentHash===record.packetContentHash,'Member decision targets a different policy or packet');
 validateMemberAccessProof(review.authorization,review.actorUserId);exactKeys(review.source,['kind','id']);requireThat(['paperclip','buzz'].includes(review.source.kind)&&typeof review.source.id==='string'&&review.source.id.length>0&&review.source.id.length<=256,'Verified human action source required');
 requireThat(timestampMilliseconds(review.recordedAt)<=at.getTime(),'Member review timestamp is in the future');
 requireThat(Array.isArray(record.additionalRequirements)&&record.additionalRequirements.length===policy.policy.additionalRequirements.length,'Required formal obligations cannot be dropped');
 const seen=new Set<string>();let formalRequirementsComplete=true;
 for(const requirement of record.additionalRequirements){exactKeys(requirement,['id','kind','sourceRef','satisfied','evidenceRef']);const trusted=policy.policy.additionalRequirements.find(r=>r.id===requirement.id);requireThat(trusted&&!seen.has(requirement.id)&&trusted.kind===requirement.kind&&trusted.sourceRef===requirement.sourceRef&&typeof requirement.satisfied==='boolean','Formal requirement policy mismatch');seen.add(requirement.id);requireThat(!requirement.satisfied||typeof requirement.evidenceRef==='string'&&requirement.evidenceRef.length>0&&requirement.evidenceRef.length<=2000,'Formal fulfillment requires authoritative evidence');formalRequirementsComplete&&=requirement.satisfied;}
 exactKeys(record.submission,['state','providerVerified']);requireThat(['not_reported','member_attested'].includes(record.submission.state)&&record.submission.providerVerified===false,'An attestation is not independent provider verification');
 await verifyPacketArtifactInventory(record,request,readArtifact);
 record.artifacts.sort((a,b)=>a.artifact_key<b.artifact_key?-1:a.artifact_key>b.artifact_key?1:0);
 const {current_cycle_verified_at:_observedAt,...opportunity}=record.opportunity;
 const canonicalContent=canonicalJson({...record,opportunity});
 return Object.freeze({...request,version:p.version,schema:'inertia-member-grant-v2',policyHash:policy.policyHash,packetContentHash:record.packetContentHash,canonicalContent,contentHash:sha256('inertia-member-grant-v2\n'+canonicalContent),formalRequirementsComplete,submissionAuthority:false});
}
