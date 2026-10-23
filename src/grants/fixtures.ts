import type { GovernanceObservation, GovernanceVerifier, GrantRequest, ReviewedGrantExport, ReviewedGrantSource, ReviewRole } from './contracts.js';
import { sha256 } from './engine.js';

export const NOW=new Date('2026-10-22T12:00:00Z');
export const REQUEST: GrantRequest=Object.freeze({packetId:'fixture-packet',applicantId:'fixture-applicant',network:'fixture-network',proposalId:'fixture-proposal',action:'authorize_manual_submission'});
/** Entirely synthetic reviewed packet: no live applicant, opportunity, or actual signoff. */
export function grantFixture(): ReviewedGrantSource & { record: ReviewedGrantExport; bodies: Record<string,Uint8Array> } {
  const roles: ReviewRole[]=['program','fiscal','legal_compliance','partner','authorized_representative'];
  const bodies: Record<string,Uint8Array>=Object.fromEntries(['application_packet_markdown','application_packet_docx','packet_data','review'].map(key=>[key,new TextEncoder().encode('SYNTHETIC FIXTURE: '+key)]));
  const record: ReviewedGrantExport={
    packet:{id:REQUEST.packetId,applicant_id:REQUEST.applicantId,opportunity_namespace:'fixture',opportunity_external_id:'opportunity',version:1,status:'submission_ready',packet_data:{submission_mode:'direct_application',match:{unknowns:[],disqualifiers:[]},project:{title:'Synthetic demonstration'}}},
    artifacts:Object.entries(bodies).map(([artifact_key,body])=>({packet_id:REQUEST.packetId,artifact_key,artifact_type:artifact_key==='packet_data'?'structured_data':artifact_key==='review'?'quality_review':'narrative',content_hash:sha256(body),placeholders:[]})),
    opportunity:{namespace:'fixture',external_id:'opportunity',source_url:'https://example.org/synthetic-opportunity',status:'open',close_date:'2026-10-30',current_cycle_verified_at:'2026-10-22T11:00:00Z'},
    lifecycle:{is_latest_version:true,availability:'open_now',cycle_state:'current',source_available:true,submission_mode:'direct_application',authorization_blockers:[]},
    handoff:{version:1,submission_mode:'direct_application',state:'approved_for_manual_submission',technically_ready:true,approvals_complete:true,mutation_allowed:true,technical_blockers:[],placeholders:[],open_questions:[],unverified_forms:[],requirement_gates:[],missing_approvals:[],required_approval_roles:roles,approvals:Object.fromEntries(roles.map(role=>[role,{packet_version:1,reviewer_role:role,decision:'approved',reviewer_name:'Synthetic reviewer',note:'Fixture only, not a real approval',recorded_at:'2026-10-22T11:00:00Z'}])),submission:null},
  };
  return {record,bodies,async readReviewedExport(){return record;},async readArtifact(_identity,key){const body=bodies[key];if(!body)throw new Error('Fixture artifact missing');return body;}};
}
export function fixtureVerifier(change: Partial<GovernanceObservation>={}): GovernanceVerifier {
  return {kind:'fixture',async verify(request){return {network:request.network,proposalId:request.proposalId,action:request.action,packetHash:request.packetHash,finalized:true,outcome:'passed',evidenceId:'synthetic-evidence-only',...change};}};
}
