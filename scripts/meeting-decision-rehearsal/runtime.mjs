/** Actual official native services + real DFW domain bridge. Synthetic records only. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {writeFile,readFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {meetingDigest,validateMeetingAnswer} from './policy.mjs';
const here=dirname(fileURLToPath(import.meta.url));
if(!process.env.MEETING_CONFIG_PATH)throw Error('Launch only through run.mjs');
const config=JSON.parse(await readFile(process.env.MEETING_CONFIG_PATH,'utf8'));
const moduleAt=relative=>import(pathToFileURL(join(config.hostRoot,'node_modules',relative)).href);
const {createDb}=await moduleAt('@paperclipai/db/dist/index.js');
const {default:postgres}=await moduleAt('postgres/src/index.js');
const {companyService}=await moduleAt('@paperclipai/server/dist/services/companies.js');
const {goalService}=await moduleAt('@paperclipai/server/dist/services/goals.js');
const {issueService}=await moduleAt('@paperclipai/server/dist/services/issues.js');
const {issueThreadInteractionService}=await moduleAt('@paperclipai/server/dist/services/issue-thread-interactions.js');
const {authorizationService}=await moduleAt('@paperclipai/server/dist/services/authorization.js');
const {documentService}=await moduleAt('@paperclipai/server/dist/services/documents.js');
const {prepareOpportunityBrief}=await import(pathToFileURL(join(config.inertiaRoot,'dist/src/grants/brief.js')).href);
const work=process.env.MEETING_WORK,out=process.env.MEETING_OUT,url=process.env.QUALIFICATION_DATABASE_URL;
if(!work||!out||!url)throw Error('Only launch via owned disposable runner');
const python=config.python;
function host(mode,input={}) {
 const env={...process.env,PYTHONPYCACHEPREFIX:join(work,'python-cache'),PYTHONPATH:join(config.dfwRoot,'government-funding-dfw/src')+':'+join(config.dfwRoot,'government-funding-dfw/tests')+':'+here};
 delete env.QUALIFICATION_DATABASE_URL;delete env.HTTP_PROXY;delete env.HTTPS_PROXY;delete env.ALL_PROXY;
 const r=spawnSync(python,[join(here,'host.py'),mode,join(work,'domain')],{input:JSON.stringify(input),encoding:'utf8',env,timeout:30000});
 if(r.status!==0)throw Error(`DFW ${mode} failed: ${r.stderr}`);return JSON.parse(r.stdout);
}
async function save(name,value){await writeFile(join(out,name),typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');}
const db=createDb(url),sql=postgres(url);const issues=issueService(db),interactions=issueThreadInteractionService(db),documents=documentService(db);
const actorId='synthetic-human-'+randomUUID(),agentId=randomUUID(),agentRunId=randomUUID();
let receipt={result:'running',native:'official Paperclip 2026.1012.0 services / PostgreSQL 18',domain:'actual DFW services / SQLite',syntheticOnly:true,httpServer:false,productionAuthority:false,externalResearch:false,applicationPreparation:false,externalSubmission:false,daoMotion:false};
try{
 host('init');
 const company=await companyService(db).create({name:'Synthetic meeting decision rehearsal',description:'Disposable fixture; no real organization authority'});
 await sql`INSERT INTO "user" (id,name,email,email_verified,created_at,updated_at) VALUES (${actorId},'Synthetic triage member',${actorId+'@example.invalid'},false,now(),now())`;
 await sql`INSERT INTO company_memberships (company_id,principal_type,principal_id,status,membership_role) VALUES (${company.id},'user',${actorId},'active','member')`;
 await sql`INSERT INTO agents (id,company_id,name,status,adapter_type,adapter_config,runtime_config) VALUES (${agentId},${company.id},'Synthetic CEO intake owner','idle','process','{}','{}')`;
 await sql`INSERT INTO heartbeat_runs (id,company_id,agent_id,status) VALUES (${agentRunId},${company.id},${agentId},'running')`;
 const goal=await goalService(db).create(company.id,{title:'Evaluate community learning support',description:'Synthetic existing objective; not a new queue',level:'company',status:'active'});
 const parent=await issues.create(company.id,{title:'Evaluate synthetic learning objective',status:'todo',priority:'medium',goalId:goal.id,assigneeAgentId:agentId});
 const knowledge={begin:async(run_id,query)=>host('begin',{run_id,query}),commit:async input=>host('commit',input)};
 const run=id=>({run_id:id,idempotency_key:id+'-delta',query:{capabilities:[],opportunity_id:'fund:1'}});
 const research=expected=>async saved=>{
   assert.equal(saved.saved_knowledge.some(r=>r.record_id==='meeting-decision'),expected);
   assert.ok(saved.saved_knowledge.some(r=>r.record_id==='record'));
   return {answer:expected?'Reuse the admitted opportunity-only deferral and compare higher value against application and delivery effort.':'Use existing admitted affiliation evidence; ask the scoped pursuit question.',candidates:[],no_change_reason:expected?'Existing admitted meeting decision and affiliation evidence reused. Deferral adds no partner capability or relationship facts; no external research is warranted before the comparison.':'Existing admitted affiliation evidence reused; the pursuit question remains unanswered. No new partner facts found or invented.',opportunity_outcome:'unknown'};
 };
 const before=await prepareOpportunityBrief(run('before-meeting'),{knowledge,research:research(false),readBrief:async()=>host('brief')});
 assert.equal(before.brief.sources.length,2);
 const initialDoc=(await documents.upsertIssueDocument({issueId:parent.id,key:'opportunity-brief',title:'Synthetic opportunity brief',format:'markdown',body:before.markdown,createdByUserId:actorId})).document;
 await save('brief-before.json',before.brief);await save('brief-before.md',before.markdown);
 const question={id:'pursuit',prompt:'Defer this opportunity and compare higher-value options against application and delivery effort?',selectionMode:'single',required:true,allowOther:false,options:[{id:'defer',label:'Defer and compare'},{id:'revise',label:'Revise the question'}]};
 const card=await interactions.create(parent,{kind:'ask_user_questions',resolverPolicy:'human_only',addresseeUserId:actorId,idempotencyKey:'synthetic-meeting-question-v1',continuationPolicy:'none',payload:{version:1,questions:[question]}},{userId:actorId});
 await assert.rejects(()=>interactions.answerQuestions(parent,card.id,{answers:[{questionId:'pursuit',optionIds:['defer']}]},{agentId,runId:agentRunId}),/human|user|resolver|address/i);
 const permission=await authorizationService(db).decide({actor:{type:'board',userId:actorId,source:'session'},action:'issue:mutate',resource:{type:'issue',companyId:company.id,issueId:parent.id,...parent}});
 assert.equal(permission.allowed,true);
 await interactions.answerQuestions(parent,card.id,{answers:[{questionId:'pursuit',optionIds:['defer']}]},{userId:actorId});
 await assert.rejects(()=>interactions.answerQuestions(parent,card.id,{answers:[{questionId:'pursuit',optionIds:['revise']}]},{userId:actorId}),/resolved|answered|terminal/i);
 const answered=await interactions.getById(card.id);
 const policy={companyId:company.id,issueId:parent.id,interactionId:card.id,actorId,role:'member',question,organizationId:'dao',opportunityId:'fund:1',audience:'public',sourceRevision:String(answered.resolvedAt),sourceHash:meetingDigest(answered),policyId:'synthetic-opportunity-triage-v1'};
 // JSON timestamps are the exported opaque native source revision; canonicalize
 // the whole resolved export once and re-read identically for each admission.
 policy.sourceRevision=new Date(answered.resolvedAt).toISOString();
 const normalize=card=>JSON.parse(JSON.stringify(card));
 policy.sourceHash=meetingDigest(normalize(answered));
 async function underNativeFence(effect,overrides={}) {
   return sql.begin(async tx=>{
     // Share locks fence membership revocation/card mutation during the cross-language
     // local domain call. This is not a deployed cross-service protocol.
     await tx`SELECT id FROM issue_thread_interactions WHERE id=${card.id} FOR SHARE`;
     const rows=await tx`SELECT company_id,principal_type,principal_id,status,membership_role FROM company_memberships WHERE company_id=${company.id} AND principal_type='user' AND principal_id=${actorId} FOR SHARE`;
     const current=normalize(await interactions.getById(card.id));
     const verified=validateMeetingAnswer({card:current,policy:{...policy,...overrides},membership:rows[0],scope:'fund:1'});
     return effect(verified);
   });
 }
 const refresh=id=>underNativeFence(async verified=>{host('admit',verified);return prepareOpportunityBrief(run(id),{knowledge,research:research(true),readBrief:async()=>host('brief')});});
 const binding=await underNativeFence(async verified=>verified);
 await writeFile(join(work,'domain/binding.json'),JSON.stringify(binding));
 const admitted=await underNativeFence(async verified=>host('admit',verified));
 assert.equal(admitted.scope_id,'fund:1');assert.equal(admitted.revision,2);
 assert.deepEqual(await underNativeFence(async verified=>host('admit',verified)),admitted);
 await assert.rejects(()=>underNativeFence(async verified=>host('admit',verified),{sourceHash:'f'.repeat(64)}),/current/);
 await sql`UPDATE company_memberships SET membership_role='viewer' WHERE company_id=${company.id} AND principal_id=${actorId}`;
 await assert.rejects(()=>underNativeFence(async verified=>host('admit',verified)),/current/);
 await assert.rejects(()=>refresh('denied-viewer-refresh'),/current/);
 await sql`UPDATE company_memberships SET membership_role='member',status='inactive' WHERE company_id=${company.id} AND principal_id=${actorId}`;
 await assert.rejects(()=>underNativeFence(async verified=>host('admit',verified)),/current/);
 await assert.rejects(()=>refresh('denied-revoked-refresh'),/current/);
 await sql`UPDATE company_memberships SET status='active' WHERE company_id=${company.id} AND principal_id=${actorId}`;
 const followupData={title:'Compare higher-value learning opportunities',description:'Synthetic scoped deferral '+card.id+'. Compare expected value with application, delivery and reporting effort; no dollar cutoff. No application preparation or submission.',status:'todo',priority:'medium',parentId:parent.id,goalId:goal.id,assigneeAgentId:agentId,originKind:'plugin:netrxn.inertia:meeting-followup',originId:card.id,idempotencyKey:'meeting-followup:'+card.id};
 const followup=await underNativeFence(async verified=>{host('admit',verified);return issues.create(company.id,followupData);});
 const repeat=await underNativeFence(async verified=>{host('admit',verified);return issues.create(company.id,followupData);});
 assert.equal(repeat.id,followup.id);assert.equal(followup.parentId,parent.id);assert.equal(followup.goalId,goal.id);
 const matching=await issues.list(company.id,{originKind:followupData.originKind,originId:card.id,includePluginOperations:true});assert.equal(matching.length,1);
 await writeFile(join(work,'domain/native-links.json'),JSON.stringify({followupId:followup.id,parentId:parent.id,goalId:goal.id}));
 const after=await refresh('after-meeting');
 const repeated=await refresh('after-meeting');
 assert.deepEqual(repeated.knowledge_receipt,after.knowledge_receipt);
 assert.ok(after.brief.sources.some(s=>s.id==='meeting-decision'&&s.source_hash===policy.sourceHash));
 assert.ok(after.brief.next_action.includes(followup.id));assert.equal(after.brief.decisions.some(d=>d.id==='pursuit'),false);
 const publish=()=>underNativeFence(async verified=>{
   host('admit',verified);assert.deepEqual(host('brief'),after.brief);
   return (await documents.upsertIssueDocument({issueId:parent.id,key:'opportunity-brief',title:'Synthetic opportunity brief',format:'markdown',body:after.markdown,baseRevisionId:initialDoc.latestRevisionId,createdByUserId:actorId})).document;
 });
 await sql`UPDATE company_memberships SET status='inactive' WHERE company_id=${company.id} AND principal_id=${actorId}`;
 await assert.rejects(publish,/current/);
 assert.equal((await documents.getIssueDocumentByKey(parent.id,'opportunity-brief')).latestRevisionId,initialDoc.latestRevisionId);
 await sql`UPDATE company_memberships SET status='active' WHERE company_id=${company.id} AND principal_id=${actorId}`;
 const revisedDoc=await publish();
 assert.notEqual(revisedDoc.latestRevisionId,initialDoc.latestRevisionId);
 assert.match((await documents.getIssueDocumentByKey(parent.id,'opportunity-brief')).body,/meeting.decision/);
 const guardChecks=host('guard_checks'),counts=host('counts');
 assert.equal(counts.knowledge,2);assert.equal(counts.decision_revision,2);assert.equal(counts.query_receipts,2);assert.equal(counts.delta_receipts,2);
 await save('native-answer.json',normalize(answered));await save('admission.json',admitted);await save('brief-after.json',after.brief);await save('brief-after.md',after.markdown);
 await save('knowledge-receipts.json',{before:before.knowledge_receipt,after:after.knowledge_receipt,replayed:repeated.knowledge_receipt,counts});
 await save('native-links.json',{companyId:company.id,parentId:parent.id,goalId:goal.id,followupId:followup.id,followupStatus:followup.status,documentId:revisedDoc.id,beforeRevisionId:initialDoc.latestRevisionId,afterRevisionId:revisedDoc.latestRevisionId});
 receipt={...receipt,result:'passed',nativeHumanAnswer:true,currentMemberRoleChecked:true,sourceAndMemberShareLocks:true,admissionAuthority:'authorized_human',scope:'fund:1',savedKnowledgeQueriedBeforeResearch:true,newExternalResearch:0,explainedReuseReceipts:2,replayDuplicateAdmissions:0,replayDuplicateFollowups:0,replayDuplicateReceipts:0,nativeFollowupSameGoalAndParent:true,nativeDocumentRevised:true,postAdmissionRevocationBlocksRefresh:true,postAdmissionRevocationBlocksPublication:true,guardChecks};
 console.log('MEETING_RETURN_LOOP_PASSED',JSON.stringify(receipt));
}catch(error){receipt.result='failed';receipt.error=error.message;throw error;}
finally{await save('integration.json',receipt);await sql.end();await db.$client.end();}
