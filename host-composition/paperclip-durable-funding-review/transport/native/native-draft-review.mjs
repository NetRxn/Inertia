/** Exact independent editorial critique. Never source admission or packet approval. */
import {createHash} from 'node:crypto';
import {sourceHash} from './native-source-review.mjs';
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>object(v)&&Object.keys(v).sort().join()===keys.sort().join();
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const text=(v,n=20000)=>typeof v==='string'&&v.trim().length>0&&v.length<=n;
const deny=()=>{throw Error('native_draft_review_scope_denied');};
const normalize=p=>object(p)&&Array.isArray(p.projectIds)&&Array.isArray(p.issueIds)?{...p,projectIds:[...p.projectIds].sort(),issueIds:[...p.issueIds].sort()}:p;
export const EDITORIAL_CONTRACT='inertia-editorial-draft-v1';
export const editorialDraftHash=value=>createHash('sha256').update(value,'utf8').digest('hex');
export const editorialRequestKey=(caseId,bodyHash)=>sourceHash([EDITORIAL_CONTRACT,caseId,bodyHash]);
export const EDITORIAL_DOCUMENT_PREFIX='funding-'+createHash('sha256').update(JSON.stringify('case-editorial-draft-v1')).digest('hex').slice(0,32)+'-';
export function draftReviewBodyHash(issue,parentId){const prefix=`paperclip-runner:create-task:${parentId}:draft-review:v1:`;if(issue?.originKind!=='manual'||!String(issue.originId??'').startsWith(prefix))return null;const value=issue.originId.slice(prefix.length);return hash(value)?value:null;}
export function validateEditorialResult(input,subject){
 if(!exact(input,['outcome','findings','rationale','documentId','revisionId','bodySha256'])||Buffer.byteLength(JSON.stringify(input))>128*1024||!['changes_requested','no_changes_required'].includes(input.outcome)||!text(input.rationale)||!Array.isArray(input.findings)||input.findings.length>100||input.findings.some(f=>!text(f,5000))||input.outcome==='changes_requested'&&!input.findings.length||input.outcome==='no_changes_required'&&input.findings.length||['documentId','revisionId','bodySha256'].some(k=>input[k]!==subject[k]))deny();
 return {...structuredClone(input),contract_version:EDITORIAL_CONTRACT,packet_approval:false,business_complete:false};
}
export function selectDraftReviewAdmission(rows,binding,policy,nativeReview,context,root,parent){
 if(nativeReview)return null;
 const all=rows.filter(r=>r.pluginKey==='netrxn.inertia'&&r.config?.nativeCaseWork?.enabled===true);
 if(!all.length)return null;if(all.length!==1)deny();
 const row=all[0],c=row.config.nativeCaseWork,a=context.actor,i=context.issue,r=context.run;
 if(!String(i.originId??'').includes(':draft-review:'))return null;
 const bodySha256=draftReviewBodyHash(i,parent?.id),prefix=`paperclip-runner:create-task:${c.rootIssueId}:case:`;
 if(![c.researcher?.agentId,c.researcher?.principalId,c.producer?.agentId,c.producer?.principalId,c.reviewer?.agentId,c.reviewer?.principalId].every(v=>text(v,128))||!c.reviewer?.agentId||!c.reviewer?.principalId||new Set([c.researcher?.agentId,c.producer?.agentId,c.reviewer.agentId]).size!==3||new Set([c.researcher?.principalId,c.producer?.principalId,c.reviewer.principalId]).size!==3
 ||row.status!=='ready'||row.companyId!==binding.companyId||row.enabled===false
 ||a.id!==c.reviewer.agentId||a.id!==binding.agentId||a.companyId!==binding.companyId||a.role!=='general'||a.adapterType!=='paperclip_runner'||!['idle','running'].includes(a.status)
 ||a.adapterConfig?.provider!=='codex'||a.adapterConfig?.engine!=='cli'||a.adapterConfig?.disableCommandExecution!==true||a.adapterConfig?.codexPermissionMode!=='never'||a.adapterConfig?.dangerouslyBypassApprovalsAndSandbox!==false||a.adapterConfig?.dangerouslyBypassSandbox===true||a.adapterConfig?.nativeCoordinator!==undefined||Object.hasOwn(a.adapterConfig,'args')||Object.hasOwn(a.adapterConfig,'extraArgs')
 ||policy?.version!==1||policy.role!=='worker'||sourceHash(normalize(policy))!==sourceHash(normalize(a.adapterConfig.nativeFunding))||policy.portfolioRootIssueId!==c.rootIssueId||!policy.issueIds?.includes(c.rootIssueId)||!policy.projectIds?.includes(c.rootProjectId)||!policy.projectIds?.includes(c.projectId)
 ||!root||root.id!==c.rootIssueId||root.companyId!==binding.companyId||root.projectId!==c.rootProjectId||root.hiddenAt||['done','cancelled'].includes(root.status)
 ||!parent||parent.companyId!==binding.companyId||parent.projectId!==c.projectId||parent.parentId!==root.id||parent.hiddenAt||!['todo','in_progress','blocked'].includes(parent.status)||parent.workMode!=='standard'||parent.assigneeAgentId!==c.producer.agentId||parent.originKind!=='manual'||!parent.originId?.startsWith(prefix)
 ||!bodySha256||i.createdByAgentId!==c.producer.agentId||!text(i.originRunId,128)||i.id!==binding.issueId||i.parentId!==parent.id||i.companyId!==binding.companyId||i.projectId!==c.projectId||i.hiddenAt||i.workMode!=='standard'||i.status!=='in_progress'||i.executionRunId!==binding.runId||i.assigneeAgentId!==binding.agentId
 ||r.id!==binding.runId||r.companyId!==binding.companyId||r.agentId!==binding.agentId||r.nativeIssueId!==binding.issueId||r.runtimeMode!=='native'||r.status!=='running'||r.finishedAt)deny();
 const caseBindingId=parent.originId.slice(prefix.length);if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(caseBindingId))deny();
 return Object.freeze({version:1,kind:'draft-review',role:'reviewer',companyId:binding.companyId,projectId:i.projectId,issueId:i.id,agentId:a.id,runId:r.id,rootIssueId:root.id,producerIssueId:parent.id,caseBindingId,bodySha256,producerRunId:i.originRunId,reviewContractVersion:EDITORIAL_CONTRACT,bindingHash:sourceHash(c),adapterHash:sourceHash(a.adapterConfig)});
}
const stableAdmission=a=>{
 if(!object(a))deny();const keys=['version','kind','role','companyId','projectId','issueId','agentId','rootIssueId','producerIssueId','caseBindingId','bodySha256','producerRunId','reviewContractVersion'];
 if(keys.some(k=>a[k]===undefined))deny();return Object.fromEntries(keys.map(k=>[k,a[k]]));
};
export async function readEditorialSubject(db,parentId,bodySha256,input,{allowHistorical=false}={}){
 const {documentService}=await import('../documents.js');const api=documentService(db);
 const rows=(await api.listIssueDocuments(parentId)).filter(d=>d.key.startsWith(EDITORIAL_DOCUMENT_PREFIX));
 if(!rows.length||rows.length>1000)deny();
 for(const row of rows)if(!/^\d{10}$/.test(row.key.slice(EDITORIAL_DOCUMENT_PREFIX.length)))deny();
 rows.sort((a,b)=>a.key.localeCompare(b.key));
 const latest=await api.getIssueDocumentByKey(parentId,rows.at(-1).key);
 if(!latest||typeof latest.body!=='string'||!allowHistorical&&editorialDraftHash(latest.body)!==bodySha256)deny();
 const documents=[];
 for(const row of rows){
  const d=await api.getIssueDocumentByKey(parentId,row.key);if(!d)deny();
  const revisions=await api.listIssueDocumentRevisions(parentId,row.key);
  for(const revision of revisions.sort((a,b)=>a.revisionNumber-b.revisionNumber))if(editorialDraftHash(revision.body)===bodySha256)documents.push({document:d,revision});
 }
 const original=documents[0];if(!original||original.document.issueId!==parentId||!original.revision.id||!Number.isSafeInteger(original.revision.revisionNumber)||original.revision.revisionNumber<1||Buffer.byteLength(original.revision.body)>524288)deny();
 if(input&&!documents.some(d=>d.document.id===input.documentId&&d.revision.id===input.revisionId))deny();
 return {currentBodySha256:editorialDraftHash(latest.body),appliesToCurrent:editorialDraftHash(latest.body)===bodySha256,documentId:original.document.id,revisionId:original.revision.id,revisionNumber:original.revision.revisionNumber,key:original.document.key,companyId:original.document.companyId,bodySha256,bodyBytes:Buffer.byteLength(original.revision.body),body:original.revision.body};
}
export function draftReviewTaskInput(a,input,subject,c){
 if(a?.kind!=='case-work'||a.role!=='producer'||!exact(input,['purpose','documentId','revisionId','bodySha256'])||input.purpose!=='draft_review'||!hash(input.bodySha256)||subject.bodySha256!==input.bodySha256||subject.companyId!==a.companyId||!c.reviewer?.agentId||c.reviewer.agentId===a.agentId)deny();
 return {idempotencyKey:'draft-review:v1:'+subject.bodySha256,title:'Independent application draft review '+subject.bodySha256.slice(0,12),description:JSON.stringify({contract_version:EDITORIAL_CONTRACT,case_binding_id:a.caseBindingId,producer_issue_id:a.issueId,document_id:subject.documentId,revision_id:subject.revisionId,body_sha256:subject.bodySha256,instruction:'Read every draft page and verify its complete UTF-8 hash. Use the authorized own/ancestor native documents for sponsor requirements and context; distinguish cited facts, proposed assumptions and unresolved private decisions. Critique actual application prose, numerical budget consistency, milestones, eligibility representations and source citations. Record actionable changes or truthful no_changes_required only for this exact draft. This is not source, eligibility, packet or submission approval.'}),projectId:a.projectId,assigneeActorId:c.reviewer.agentId,status:'todo'};
}
async function facts(db,binding,{completion=false,producer=false}={}){
 const [{and,eq},{plugins,pluginConfig,pluginCompanySettings,agents,issues,heartbeatRuns}]=await Promise.all([import('drizzle-orm'),import('@paperclipai/db')]);
 const [context]=await db.select({actor:agents,issue:issues,run:heartbeatRuns}).from(heartbeatRuns).innerJoin(issues,eq(issues.id,binding.issueId)).innerJoin(agents,eq(agents.id,binding.agentId)).where(and(eq(heartbeatRuns.id,binding.runId),eq(heartbeatRuns.companyId,binding.companyId))).limit(1);if(!context)deny();
 const rows=await db.select({pluginKey:plugins.pluginKey,status:plugins.status,companyId:pluginConfig.companyId,config:pluginConfig.configJson,enabled:pluginCompanySettings.enabled}).from(plugins).innerJoin(pluginConfig,and(eq(pluginConfig.pluginId,plugins.id),eq(pluginConfig.companyId,binding.companyId))).leftJoin(pluginCompanySettings,and(eq(pluginCompanySettings.pluginId,plugins.id),eq(pluginCompanySettings.companyId,binding.companyId))).where(eq(plugins.pluginKey,'netrxn.inertia')).limit(2);
 const c=rows[0]?.config?.nativeCaseWork;if(!c)deny();
 const [root]=await db.select().from(issues).where(and(eq(issues.id,c.rootIssueId),eq(issues.companyId,binding.companyId))).limit(1);
 const [parent]=await db.select().from(issues).where(and(eq(issues.id,producer?binding.issueId:context.issue.parentId),eq(issues.companyId,binding.companyId))).limit(1);
 if(completion){if(!['running','succeeded'].includes(context.run.status))deny();context.run={...context.run,status:'running',finishedAt:null};}
 let a;
 if(producer){const{readTaskProjectAdmission}=await import('./native-case-work-tools.mjs');a=await readTaskProjectAdmission(db,binding,context.actor.adapterConfig.nativeFunding,null,context);if(a?.kind!=='case-work'||a.role!=='producer')deny();}
 else a=selectDraftReviewAdmission(rows,binding,context.actor.adapterConfig.nativeFunding,null,context,root,parent);
 if(!a||!completion&&sourceHash(a)!==sourceHash(binding.nativeTaskProjectAdmission))deny();
 if(!producer){const [origin]=await db.select().from(heartbeatRuns).where(and(eq(heartbeatRuns.id,a.producerRunId),eq(heartbeatRuns.companyId,binding.companyId),eq(heartbeatRuns.agentId,c.producer.agentId),eq(heartbeatRuns.nativeIssueId,parent.id))).limit(1);if(!origin||origin.runtimeMode!=='native')deny();}
 const {authorizationService}=await import('../authorization.js');
 const actor={type:'agent',source:'agent_jwt',companyId:binding.companyId,agentId:binding.agentId,runId:binding.runId,onBehalfOfUserId:context.run.responsibleUserId};
 for(const issue of [root,parent,context.issue]){if(!issue||!(await authorizationService(db).decide({actor,action:'issue:read',resource:{type:'issue',companyId:binding.companyId,issueId:issue.id,projectId:issue.projectId,parentIssueId:issue.parentId,assigneeAgentId:issue.assigneeAgentId,assigneeUserId:issue.assigneeUserId,status:issue.status}})).allowed)deny();}
 const {toolAccessPolicyService}=await import('../tool-access-policy.js');
 const access=await toolAccessPolicyService(db).decide({companyId:binding.companyId,actor:{actorType:'agent',actorId:binding.agentId,agentId:binding.agentId},runContext:{heartbeatRunId:binding.runId,issueId:binding.issueId,projectId:a.projectId},request:{toolName:'netrxn.inertia:funding_case_work',providerType:'paperclip_plugin',arguments:{operation:'context',parameters:{}},sideEffecting:false},consumeRateLimit:false});
 if(access?.allowed!==true||access.decision!=='allow')deny();
 return{admission:a,config:c,context,parent};
}
export async function readDraftReviewRequest(db,binding,input){
 const{admission,config}=await facts(db,binding,{producer:true});
 const subject=await readEditorialSubject(db,binding.issueId,input?.bodySha256,input);
 return{subject,config,input:draftReviewTaskInput(admission,input,subject,config)};
}
export const DRAFT_REVIEW_CREATE_DEFINITION={name:'create_task',description:'Create or recover an independent source_review proposal child or draft_review editorial child. Editorial input must use the actual whole-draft native document descriptor returned by render; it never approves a packet.',inputSchema:{type:'object',properties:{purpose:{enum:['source_review','draft_review']},proposalHash:{type:'string',pattern:'^[a-f0-9]{64}$'},documentId:{type:'string',format:'uuid'},revisionId:{type:'string',format:'uuid'},bodySha256:{type:'string',pattern:'^[a-f0-9]{64}$'}},required:['purpose'],additionalProperties:false,oneOf:[{type:'object',properties:{purpose:{const:'source_review'},proposalHash:{type:'string',pattern:'^[a-f0-9]{64}$'}},required:['purpose','proposalHash'],additionalProperties:false},{type:'object',properties:{purpose:{const:'draft_review'},documentId:{type:'string',format:'uuid'},revisionId:{type:'string',format:'uuid'},bodySha256:{type:'string',pattern:'^[a-f0-9]{64}$'}},required:['purpose','documentId','revisionId','bodySha256'],additionalProperties:false}]}};
export const DRAFT_REVIEW_DEFINITIONS=[{name:'read_draft',description:'Read the exact independently assigned application draft in complete ordered UTF-8 byte pages. Read and reconstruct every UTF-8 text page; byte offsets preserve complete characters. Check bodySha256 before recording editorial findings. No source or packet approval.',inputSchema:{type:'object',properties:{offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:4,maximum:16000}},additionalProperties:false}},{name:'record_draft_review',description:'Persist your independent editorial findings on this exact draft. Both changes_requested and no_changes_required remain editorial-only, not packet approval. Complete this review task after the receipt is saved.',inputSchema:{type:'object',properties:{documentId:{type:'string',format:'uuid'},revisionId:{type:'string',format:'uuid'},bodySha256:{type:'string',pattern:'^[a-f0-9]{64}$'},outcome:{enum:['changes_requested','no_changes_required']},rationale:{type:'string',minLength:1,maxLength:20000},findings:{type:'array',maxItems:100,items:{type:'string',minLength:1,maxLength:5000}}},required:['documentId','revisionId','bodySha256','outcome','rationale','findings'],additionalProperties:false}}];
export function editorialTextPage(body,offset,limit){
 const bytes=Buffer.from(body,'utf8');if(!Number.isSafeInteger(offset)||offset<0||offset>bytes.length||offset<bytes.length&&(bytes[offset]&0xc0)===0x80||!Number.isSafeInteger(limit)||limit<4||limit>16000)deny();
 let end=Math.min(bytes.length,offset+limit);while(end<bytes.length&&(bytes[end]&0xc0)===0x80)end--;
 return {offset,end,nextOffset:end<bytes.length?end:null,text:bytes.subarray(offset,end).toString('utf8')};
}
export function hasCompleteDraftRead(ranges,total){
 if(!Number.isSafeInteger(total)||total<1||!Array.isArray(ranges)||ranges.some(r=>!Number.isSafeInteger(r.offset)||!Number.isSafeInteger(r.end)||r.offset<0||r.end<r.offset||r.end>total))return false;
 let end=0;for(const r of [...ranges].sort((a,b)=>a.offset-b.offset)){if(r.offset>end)return false;end=Math.max(end,r.end);}return end===total;
}
export async function executeDraftReview(db,binding,call,mutate){
 const read=async tx=>{const f=await facts(tx,binding);return{...f,subject:await readEditorialSubject(tx,f.parent.id,f.admission.bodySha256,undefined,{allowHistorical:true})};};
 if(call.tool==='read_draft'){
  const input=call.arguments??{};if(!object(input)||Object.keys(input).some(k=>!['offset','limit'].includes(k))||!Number.isSafeInteger(input.offset??0)||(input.offset??0)<0||!Number.isSafeInteger(input.limit??16000)||(input.limit??16000)<4||(input.limit??16000)>16000)deny();
  const before=await read(db),bytes=Buffer.from(before.subject.body),page=editorialTextPage(before.subject.body,input.offset??0,input.limit??16000),{offset,end}=page;
  const metadata=Object.fromEntries(Object.entries(before.subject).filter(([key])=>key!=='body'));const data={...metadata,producerIssueId:before.parent.id,rootIssueId:before.admission.rootIssueId,caseBindingId:before.admission.caseBindingId,offset,nextOffset:page.nextOffset,encoding:'utf8',text:page.text};const after=await read(db);if(sourceHash(before.subject)!==sourceHash(after.subject))deny();
  const{activityLog}=await import('@paperclipai/db');await db.insert(activityLog).values({companyId:binding.companyId,actorType:'system',actorId:'inertia.draft-review',agentId:binding.agentId,runId:binding.runId,action:'inertia.draft_review_page_read',entityType:'issue',entityId:binding.issueId,details:{version:1,bodySha256:before.subject.bodySha256,documentId:before.subject.documentId,revisionId:before.subject.revisionId,total:bytes.length,offset,end}});
  return data;
 }
 if(call.tool!=='record_draft_review')deny();
 const f=await read(db),value=validateEditorialResult(call.arguments,f.subject),key='editorial-result:'+editorialRequestKey(f.parent.id,value.bodySha256);
 const result=await mutate('record_draft_review',key,value,async(tx)=>{
  const current=await read(tx),receipt=validateEditorialResult(call.arguments,current.subject);
  const [{and,eq},{activityLog},{documentService}]=await Promise.all([import('drizzle-orm'),import('@paperclipai/db'),import('../documents.js')]);
  const prior=await tx.select().from(activityLog).where(and(eq(activityLog.companyId,binding.companyId),eq(activityLog.entityId,binding.issueId),eq(activityLog.action,'inertia.draft_review_recorded'),eq(activityLog.actorType,'system'),eq(activityLog.actorId,'inertia.draft-review'))).limit(2);
  if(prior.length){if(prior.length!==1||!object(prior[0].details?.receipt)||prior[0].agentId!==binding.agentId||sourceHash(stableAdmission(prior[0].details.admission))!==sourceHash(stableAdmission(current.admission))||sourceHash(Object.fromEntries(Object.keys(receipt).map(k=>[k,prior[0].details.receipt[k]])))!==sourceHash(receipt))deny();return {commandId:key,disposition:'duplicate',entityRefs:[binding.issueId,current.parent.id],receipt:prior[0].details.receipt,queued:false};}
  const pages=await tx.select().from(activityLog).where(and(eq(activityLog.companyId,binding.companyId),eq(activityLog.entityId,binding.issueId),eq(activityLog.runId,binding.runId),eq(activityLog.agentId,binding.agentId),eq(activityLog.action,'inertia.draft_review_page_read'),eq(activityLog.actorType,'system'),eq(activityLog.actorId,'inertia.draft-review'))).limit(501);
  const ranges=pages.filter(p=>p.details?.version===1&&p.details.bodySha256===receipt.bodySha256&&p.details.documentId===receipt.documentId&&p.details.revisionId===receipt.revisionId&&p.details.total===current.subject.bodyBytes).map(p=>({offset:p.details.offset,end:p.details.end}));
  if(pages.length>500||!hasCompleteDraftRead(ranges,current.subject.bodyBytes))throw Error('native_draft_review_content_unread');
  const feedback={...receipt,current_body_sha256_at_record:current.subject.currentBodySha256,applies_to_current_at_record:current.subject.appliesToCurrent,case_binding_id:current.admission.caseBindingId,producer_issue_id:current.parent.id,review_issue_id:binding.issueId,reviewer_agent_id:binding.agentId,reviewer_run_id:binding.runId,producer_agent_id:current.config.producer.agentId,producer_run_id:current.admission.producerRunId,producer_principal_id:current.config.producer.principalId,reviewer_principal_id:current.config.reviewer.principalId};
  const docKey='editorial-feedback-'+editorialRequestKey(current.parent.id,receipt.bodySha256).slice(0,32);
  const api=documentService(tx);for(const issueId of [binding.issueId,current.parent.id])await api.upsertIssueDocument({issueId,key:docKey,title:'Independent editorial review '+receipt.bodySha256.slice(0,12),format:'markdown',body:JSON.stringify(feedback,null,2),createdByAgentId:binding.agentId});
  await tx.insert(activityLog).values({companyId:binding.companyId,actorType:'system',actorId:'inertia.draft-review',agentId:binding.agentId,runId:binding.runId,action:'inertia.draft_review_recorded',entityType:'issue',entityId:binding.issueId,details:{version:1,admission:{...current.admission,runId:null},receipt:feedback,receiptHash:sourceHash(feedback)}});
  return {commandId:key,disposition:'applied',entityRefs:[binding.issueId,current.parent.id],receipt:feedback,queued:false,instruction:'Editorial evidence is saved. Finish this review task; native dependency completion owns the held-safe producer callback.'};
 },{editorialReview:true,beforeReceiptReplay:async(tx)=>{await read(tx);}});
 return result;
}
export async function assertDraftReviewCompletion(db,{issue,toStatus,runId}){
 if(toStatus!=='done'||issue.status==='done'||!draftReviewBodyHash(issue,issue.parentId))return;
 const binding={companyId:issue.companyId,issueId:issue.id,agentId:issue.assigneeAgentId,runId};const f=await facts(db,binding,{completion:true});
 const[{and,eq},{activityLog}]=await Promise.all([import('drizzle-orm'),import('@paperclipai/db')]);
 const rows=await db.select().from(activityLog).where(and(eq(activityLog.companyId,binding.companyId),eq(activityLog.entityId,binding.issueId),eq(activityLog.action,'inertia.draft_review_recorded'),eq(activityLog.actorId,'inertia.draft-review'))).limit(2);
 if(rows.length!==1||!object(rows[0].details?.receipt)||rows[0].agentId!==binding.agentId||rows[0].details.receiptHash!==sourceHash(rows[0].details.receipt)||sourceHash(stableAdmission(rows[0].details.admission))!==sourceHash(stableAdmission(f.admission)))deny();
 const {heartbeatRuns}=await import('@paperclipai/db');const [originalRun]=await db.select().from(heartbeatRuns).where(and(eq(heartbeatRuns.id,rows[0].runId),eq(heartbeatRuns.companyId,binding.companyId),eq(heartbeatRuns.agentId,binding.agentId),eq(heartbeatRuns.nativeIssueId,binding.issueId))).limit(1);if(!originalRun||originalRun.runtimeMode!=='native'||rows[0].details.receipt.reviewer_run_id!==originalRun.id)deny();
 const subject=await readEditorialSubject(db,f.parent.id,f.admission.bodySha256,undefined,{allowHistorical:true});const r=rows[0].details.receipt;if(r.reviewer_principal_id!==f.config.reviewer.principalId||r.producer_principal_id!==f.config.producer.principalId)deny();validateEditorialResult(Object.fromEntries(['documentId','revisionId','bodySha256','outcome','rationale','findings'].map(k=>[k,r[k]])),subject);
}
/** Lock root -> producer -> document/config before the caller's child/run lock.
 * Parent FOR UPDATE excludes a new document's FK key-share; document locks
 * exclude revisions of existing snapshots. No SDK or HTTP runs under these locks. */
export async function lockDraftReviewMutation(tx,binding){
 const a=binding.nativeTaskProjectAdmission;if(a?.kind!=='draft-review')deny();
 const[{and,eq},{issues,plugins,pluginCompanySettings,pluginConfig,documents,issueDocuments,principalPermissionGrants,toolPolicies}]=await Promise.all([import('drizzle-orm'),import('@paperclipai/db')]);
 for(const id of[a.rootIssueId,a.producerIssueId])await tx.select({id:issues.id}).from(issues).where(and(eq(issues.id,id),eq(issues.companyId,binding.companyId))).for('update');
 await tx.select({id:documents.id}).from(documents).innerJoin(issueDocuments,eq(issueDocuments.documentId,documents.id)).where(and(eq(issueDocuments.issueId,a.producerIssueId),eq(documents.companyId,binding.companyId))).for('update',{of:[documents]});
}
export async function lockDraftReviewPolicy(tx,binding){
 if(binding.nativeTaskProjectAdmission?.kind!=='draft-review')deny();
 const[{and,eq},{plugins,pluginCompanySettings,pluginConfig,principalPermissionGrants,toolPolicies}]=await Promise.all([import('drizzle-orm'),import('@paperclipai/db')]);
 await tx.select({id:plugins.id}).from(plugins).innerJoin(pluginConfig,eq(pluginConfig.pluginId,plugins.id)).where(eq(pluginConfig.companyId,binding.companyId)).for('update',{of:[plugins]});
 await tx.select().from(pluginCompanySettings).where(eq(pluginCompanySettings.companyId,binding.companyId)).for('no key update');
 await tx.select().from(principalPermissionGrants).where(and(eq(principalPermissionGrants.companyId,binding.companyId),eq(principalPermissionGrants.principalType,'agent'),eq(principalPermissionGrants.principalId,binding.agentId))).for('no key update');
 await tx.select().from(toolPolicies).where(eq(toolPolicies.companyId,binding.companyId)).for('no key update');
 await tx.select().from(pluginConfig).where(eq(pluginConfig.companyId,binding.companyId)).for('no key update');
}

export async function readCommittedDraftReviewWake(db,scope){
 const[{and,eq,inArray},{agentWakeupRequests,issues,statusDecisionEffects,statusDecisions,activityLog}]=await Promise.all([import('drizzle-orm'),import('@paperclipai/db')]);
 const [wake]=await db.select().from(agentWakeupRequests).where(and(eq(agentWakeupRequests.id,scope.intentId),eq(agentWakeupRequests.companyId,scope.companyId),eq(agentWakeupRequests.agentId,scope.agentId))).limit(1);
 if(!wake||wake.requestedByActorType!=='system'||wake.requestedByActorId!=='native-status-committer'||wake.source!=='automation'||wake.triggerDetail!=='system'||!['issue_children_completed','issue_blockers_resolved'].includes(wake.reason)||wake.payload?.issueId!==scope.issueId) return false;
 const childId=wake.payload.completedChildIssueId??wake.payload.resolvedBlockerIssueId;
 const[parent]=await db.select().from(issues).where(and(eq(issues.id,scope.issueId),eq(issues.companyId,scope.companyId))).limit(1);
 const[child]=await db.select().from(issues).where(and(eq(issues.id,childId),eq(issues.companyId,scope.companyId))).limit(1);
 const bodyHash=draftReviewBodyHash(child,parent?.id);
 if(!parent||parent.assigneeAgentId!==scope.agentId||!child||child.parentId!==parent.id||child.projectId!==parent.projectId||child.hiddenAt||child.status!=='done'||!bodyHash||wake.idempotencyKey!==`${wake.reason}:${parent.id}:${child.id}`)return false;
 const effects=await db.select({effect:statusDecisionEffects,decision:statusDecisions}).from(statusDecisionEffects).innerJoin(statusDecisions,and(eq(statusDecisions.id,statusDecisionEffects.decisionId),eq(statusDecisions.companyId,statusDecisionEffects.companyId))).where(and(eq(statusDecisionEffects.companyId,scope.companyId),eq(statusDecisionEffects.targetId,wake.id),eq(statusDecisionEffects.targetType,'agent_wakeup_request'),inArray(statusDecisionEffects.effectKind,['parent_dependency_wake','parent_wake','dependency_wake']))).limit(4);
 const reviews=await db.select().from(activityLog).where(and(eq(activityLog.companyId,scope.companyId),eq(activityLog.entityId,child.id),eq(activityLog.action,'inertia.draft_review_recorded'),eq(activityLog.actorType,'system'),eq(activityLog.actorId,'inertia.draft-review'))).limit(2);
 if(reviews.length!==1)return false;const log=reviews[0],r=log.details?.receipt,a=log.details?.admission;
 if(!r||r.bodySha256!==bodyHash||r.packet_approval!==false||r.producer_issue_id!==parent.id||r.producer_agent_id!==scope.agentId||r.producer_run_id!==child.originRunId||r.review_issue_id!==child.id||r.reviewer_agent_id!==child.assigneeAgentId||r.reviewer_agent_id===scope.agentId||log.details.receiptHash!==sourceHash(r)||a?.bodySha256!==bodyHash||a.producerIssueId!==parent.id)return false;
 return effects.some(({effect,decision})=>effect.deliveryState==='delivered'&&decision.applicationState==='applied'&&decision.toStatus==='done'&&decision.issueId===child.id&&decision.runId&&decision.companyId===scope.companyId);
}
/** One completed editorial child is fresh feedback even while siblings remain.
 * This creates only the existing committer outbox intent. Normal queue admission
 * still owns every human/dependency/recovery hold on the producer. */
export async function editorialFeedbackParent(db,completedIssue){
 const bodyHash=draftReviewBodyHash(completedIssue,completedIssue.parentId);if(!bodyHash)return null;
 const[{and,eq},{issues,activityLog}]=await Promise.all([import('drizzle-orm'),import('@paperclipai/db')]);
 const [child]=await db.select().from(issues).where(and(eq(issues.id,completedIssue.id),eq(issues.companyId,completedIssue.companyId))).limit(1);
 const[parent]=await db.select().from(issues).where(and(eq(issues.id,completedIssue.parentId),eq(issues.companyId,completedIssue.companyId))).limit(1);
 const rows=await db.select().from(activityLog).where(and(eq(activityLog.companyId,completedIssue.companyId),eq(activityLog.entityId,completedIssue.id),eq(activityLog.action,'inertia.draft_review_recorded'),eq(activityLog.actorType,'system'),eq(activityLog.actorId,'inertia.draft-review'))).limit(2);
 if(!child||child.status!=='done'||child.hiddenAt||!parent||parent.hiddenAt||!parent.assigneeAgentId||['done','cancelled','backlog'].includes(parent.status)||parent.conversationAgentId)return null;
 if(rows.length!==1||rows[0].details?.version!==1||!object(rows[0].details.receipt)||rows[0].details.receiptHash!==sourceHash(rows[0].details.receipt))deny();
 const r=rows[0].details.receipt;if(r.bodySha256!==bodyHash||r.review_issue_id!==child.id||r.reviewer_agent_id!==child.assigneeAgentId||r.producer_issue_id!==parent.id||r.producer_agent_id!==parent.assigneeAgentId||r.packet_approval!==false)deny();
 return{id:parent.id,assigneeAgentId:parent.assigneeAgentId,childIssueIds:[child.id],childIssueSummaries:[{issueId:child.id,summary:'Independent editorial draft review '+r.outcome+'; read the version-linked feedback document. Funding case remains unfinished.'}],onboardingCompletion:null,childIssueSummaryTruncated:false};
}
/** Reuse the existing native outbox retry loop while a genuine producer hold is
 * present. This does not clear a hold, synthesize an execution, or add a timer. */
export async function editorialFeedbackHold(db,scope){
 const[{and,eq,inArray},{issues,companies,issueThreadInteractions,issueApprovals,approvals,toolActionRequests},{continuationHold},{issueRecoveryActionService},{getExecutionBlocker},{issueTreeControlService},{issueService}]=await Promise.all([import('drizzle-orm'),import('@paperclipai/db'),import('./native-task-continuation.mjs'),import('../issue-recovery-actions.js'),import('../execution-blocker.js'),import('../issue-tree-control.js'),import('../issues.js')]);
 const[target]=await db.select().from(issues).where(and(eq(issues.id,scope.issueId),eq(issues.companyId,scope.companyId))).limit(1);if(!target||target.assigneeAgentId!==scope.agentId)return 'ownership_changed';
 const[company]=await db.select().from(companies).where(eq(companies.id,scope.companyId)).limit(1);if(company?.status!=='active')return 'company_held';
 if(await issueTreeControlService(db).getActivePauseHoldGate(scope.companyId,target.id))return 'subtree_paused';
 if((await issueService(db).getDependencyReadiness(target.id)).unresolvedBlockerCount>0)return 'dependency_held';
 const[interaction]=await db.select({id:issueThreadInteractions.id}).from(issueThreadInteractions).where(and(eq(issueThreadInteractions.companyId,scope.companyId),eq(issueThreadInteractions.issueId,target.id),eq(issueThreadInteractions.status,'pending'))).limit(1);
 const[approval]=await db.select({id:approvals.id}).from(issueApprovals).innerJoin(approvals,eq(issueApprovals.approvalId,approvals.id)).where(and(eq(issueApprovals.companyId,scope.companyId),eq(issueApprovals.issueId,target.id),inArray(approvals.status,['pending','revision_requested']))).limit(1);
 const[review]=await db.select({id:toolActionRequests.id}).from(toolActionRequests).where(and(eq(toolActionRequests.companyId,scope.companyId),eq(toolActionRequests.issueId,target.id),inArray(toolActionRequests.status,['pending','approved','executing']))).limit(1);
 return continuationHold(target,{pendingInteraction:!!interaction,pendingApproval:!!approval,pendingToolReview:!!review,recovery:!!(await issueRecoveryActionService(db).getActiveForIssue(scope.companyId,target.id)),executionBlocker:!!(await getExecutionBlocker(db,scope.companyId,target.id))});
}
export async function recordedEditorialResult(db,companyId,childId,parentId,bodySha256){
 const[{and,eq},{activityLog}]=await Promise.all([import('drizzle-orm'),import('@paperclipai/db')]);
 const rows=await db.select().from(activityLog).where(and(eq(activityLog.companyId,companyId),eq(activityLog.entityId,childId),eq(activityLog.action,'inertia.draft_review_recorded'),eq(activityLog.actorType,'system'),eq(activityLog.actorId,'inertia.draft-review'))).limit(2);
 if(!rows.length)return null;if(rows.length!==1)deny();const row=rows[0],r=row.details?.receipt;
 if(!r||row.details.version!==1||row.details.receiptHash!==sourceHash(r)||r.review_issue_id!==childId||r.producer_issue_id!==parentId||r.bodySha256!==bodySha256||r.packet_approval!==false||r.business_complete!==false)deny();return structuredClone(r);
}
