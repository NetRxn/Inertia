import {qualificationRetention} from './retention.mjs';
// Synthetic local integration harness, never a production ingress.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {eq,and} from 'drizzle-orm';
import {activityLog,principalPermissionGrants,companyMemberships,documents} from '@paperclipai/db';
import {fixture,binding,db,client} from './fixture.mjs';
import {createFundingReviewCapture} from '../node_modules/@paperclipai/server/dist/services/funding-review-capture.js';
import {issueThreadInteractionService} from '../node_modules/@paperclipai/server/dist/services/issue-thread-interactions.js';
const [inputPath,outputPath]=process.argv.slice(2);
if(!inputPath||!outputPath)throw Error('Usage: node capture-dfw-fixture.mjs input.json output.json');
const config=JSON.parse(await fs.readFile(inputPath,'utf8'));
const fundingFields=['applicantId','targetId','targetVersion','kind','reviewerRole','expectedHead','expectedWorkspaceHash','sourceScope','allowedEvidenceIds','allowedTargets'];
try {
 const f=await fixture(); const b=binding(f);
 for(const field of fundingFields)if(Object.hasOwn(config,field))b[field]=config[field];
 if(!Object.hasOwn(config,'allowedTargets'))b.allowedTargets=[b.targetId];
 const permissionKey=`funding.review.${b.reviewerRole}`;
 await db.update(principalPermissionGrants).set({permissionKey,scope:{applicantIds:[b.applicantId],sourceScopes:[b.sourceScope]}}).where(eq(principalPermissionGrants.companyId,f.companyId));
 const capture=createFundingReviewCapture({retention:qualificationRetention,registrations:[b],rolePermissionKeys:{[b.reviewerRole]:permissionKey}});
 const service=issueThreadInteractionService(db,{captureItemVerdictsInTransaction:capture.captureInTransaction});
 await service.submitItemVerdicts(f.issue,f.interactionId,{verdicts:[{id:b.itemId,verdict:config.verdict??'approve',reason:config.reason??'Exact DFW fixture reviewed by native human'}]},f.actor);
 const [row]=await db.select().from(activityLog).where(and(eq(activityLog.companyId,f.companyId),eq(activityLog.action,'funding.review.accepted')));
 if(!row)throw Error('Native human action produced no command');
 const receipt=await capture.readAcceptance(db,row.id);
 if(process.argv.includes('--mutate-after')) {
  await db.update(companyMemberships).set({status:'inactive'}).where(eq(companyMemberships.companyId,f.companyId));
  await db.delete(principalPermissionGrants).where(eq(principalPermissionGrants.companyId,f.companyId));
  await db.update(documents).set({latestBody:'Changed after accepted command',latestRevisionId:randomUUID()}).where(eq(documents.id,f.documentId));
  assert.deepEqual(await capture.readAcceptance(db,row.id),receipt,'accepted snapshot must survive native-only changes');
 }

 await fs.writeFile(outputPath,JSON.stringify(receipt,null,2)+'\n');
 console.log(JSON.stringify({acceptanceId:receipt.acceptanceId,outputPath}));
} finally {await client.end();}
