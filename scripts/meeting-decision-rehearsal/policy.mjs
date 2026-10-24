/** Isolated configured rehearsal policy. Not a public endpoint or production ACL. */
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
export const meetingDigest = card => createHash('sha256').update(JSON.stringify(card)).digest('hex');
export function validateMeetingAnswer({card,policy,membership,scope}) {
 const deny=()=>{throw Error('Meeting source or scoped human authority is not current');};
 if(!card||!policy||!membership)deny();
 if(card.id!==policy.interactionId||card.companyId!==policy.companyId||card.issueId!==policy.issueId||
   card.kind!=='ask_user_questions'||card.status!=='answered'||card.requestedResolverPolicy!=='human_only'||
   card.effectiveResolverPolicy!=='human_only'||card.addresseeUserId!==policy.actorId||
   card.resolvedByUserId!==policy.actorId||card.resolvedByAgentId||!card.resolvedAt)deny();
 if(membership.company_id!==policy.companyId||membership.principal_type!=='user'||membership.principal_id!==policy.actorId||
   membership.status!=='active'||membership.membership_role!==policy.role||policy.role!=='member')deny();
 if(scope!==policy.opportunityId||policy.audience!=='public'||!policy.organizationId||!policy.policyId||
   String(card.resolvedAt)!==policy.sourceRevision||meetingDigest(card)!==policy.sourceHash)deny();
 if(card.payload?.questions?.length!==1||!isDeepStrictEqual(card.payload.questions[0],policy.question)||
   policy.question.selectionMode!=='single'||policy.question.allowOther!==false||policy.question.required!==true)deny();
 const answers=card.result?.answers;
 if(!answers||answers.length!==1||answers[0].questionId!==policy.question.id||answers[0].optionIds?.length!==1||
   answers[0].optionIds[0]!=='defer'||answers[0].otherText)deny();
 return Object.freeze({authority:'authorized_human',actorId:policy.actorId,policyId:policy.policyId,
   organizationId:policy.organizationId,scopeKind:'opportunity',scopeId:policy.opportunityId,audience:policy.audience,
   sourceId:card.id,sourceRevision:policy.sourceRevision,sourceHash:policy.sourceHash,
   option:'defer',question:policy.question.prompt,adoptedMotion:false});
}
