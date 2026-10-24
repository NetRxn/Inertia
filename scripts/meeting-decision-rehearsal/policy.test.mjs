import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {validateMeetingAnswer} from './policy.mjs';
const digest=c=>createHash('sha256').update(JSON.stringify(c)).digest('hex');
function fixture(){
 const card={id:'card',companyId:'company',issueId:'parent',kind:'ask_user_questions',status:'answered',requestedResolverPolicy:'human_only',effectiveResolverPolicy:'human_only',addresseeUserId:'human',resolvedByUserId:'human',resolvedByAgentId:null,resolvedAt:'2026-10-23T12:00:00.000Z',payload:{version:1,questions:[{id:'pursuit',prompt:'Defer this opportunity and compare higher-value options against application and delivery effort?',selectionMode:'single',required:true,allowOther:false,options:[{id:'defer',label:'Defer and compare'},{id:'revise',label:'Revise the question'}]}]},result:{version:1,answers:[{questionId:'pursuit',optionIds:['defer']}]}};
 const policy={companyId:'company',issueId:'parent',interactionId:'card',actorId:'human',role:'member',question:structuredClone(card.payload.questions[0]),organizationId:'dao',opportunityId:'fund:1',audience:'public',sourceRevision:card.resolvedAt,sourceHash:digest(card),policyId:'synthetic-opportunity-triage-v1'};
 return {card,policy,membership:{company_id:'company',principal_type:'user',principal_id:'human',status:'active',membership_role:'member'},scope:'fund:1'};
}
test('exact native human answer produces opportunity-only authorized human evidence',()=>{
 const r=validateMeetingAnswer(fixture()); assert.equal(r.authority,'authorized_human'); assert.equal(r.scopeKind,'opportunity');assert.equal(r.scopeId,'fund:1');assert.equal(r.adoptedMotion,false);assert.equal(r.option,'defer');
});
for(const [name,mutate] of [
 ['viewer',f=>f.membership.membership_role='viewer'],['revocation',f=>f.membership.status='inactive'],
 ['agent resolver',f=>f.card.resolvedByAgentId='agent'],['wrong human',f=>f.card.resolvedByUserId='other'],
 ['wrong company',f=>f.membership.company_id='other'],['wrong scope',f=>f.scope='fund:2'],
 ['pending',f=>f.card.status='pending'],['wrong question',f=>f.card.payload.questions[0].prompt='Spend for the whole organization?'],
 ['wrong revision',f=>f.policy.sourceRevision='old'],['wrong digest',f=>f.policy.sourceHash='f'.repeat(64)],
 ['agent policy',f=>f.card.effectiveResolverPolicy='anyone'],['free text',f=>f.card.result.answers[0].otherText='Approved spending'],
 ['changed answer replay',f=>f.card.result.answers[0].optionIds=['revise']],['broader policy scope',f=>f.policy.opportunityId='organization-wide spending']]) {
 test(`rejects ${name}`,()=>{const f=fixture();mutate(f);assert.throws(()=>validateMeetingAnswer(f));});
}
