/** Trusted in-process native host composition. No plugin/worker/caller authority. */
import express from 'express';
import {and,asc,desc,eq,gt,sql} from 'drizzle-orm';
import {activityLog,assets,authUsers,companies,companyMemberships,documentRevisions,documents,issueAttachments,issueDocuments,issues} from '@paperclipai/db';
import {getAccessibleResource} from '../../node_modules/@paperclipai/server/dist/routes/authz.js';
import {accessService} from '../../node_modules/@paperclipai/server/dist/services/access.js';
import {persistActivity,publishActivity} from '../../node_modules/@paperclipai/server/dist/services/activity-log.js';
import {HttpError} from '../../node_modules/@paperclipai/server/dist/errors.js';
import {receiptProjection,receiptProvenance,receiptApplicationScope,receiptRow,receiptPage} from '../../node_modules/@paperclipai/server/dist/services/activity-receipt-read.js';
const ACTION='member.packet.action.accepted',SCHEMA='inertia.member-native-action-storage.v2',UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
function need(ok,status,message){if(!ok)throw new HttpError(status,message);}
function exact(raw,keys){need(raw&&typeof raw==='object'&&!Array.isArray(raw)&&Object.keys(raw).length===keys.length&&keys.every(k=>Object.hasOwn(raw,k)),400,'Unknown or missing action fields');return raw;}
function identifier(raw){need(typeof raw==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(raw),400,'Invalid request identity');return raw;}
function frozen(raw){const value=structuredClone(raw);const freeze=v=>{if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;};return freeze(value);}

/** Authority, source preparation, current preview/outcome and retention are
 * server-owned ports. Missing production composition is absent/disabled. Ports
 * called in a native transaction must not perform network/provider I/O. */
export function createMemberPacketActionRouter(config={}){
 if(config.enabled!==true)return Object.freeze({enabled:false,appOptions:Object.freeze({}),async readAcceptance(){return null;},async listAcceptances(){return{receipts:[],nextCursor:null};}});
 const db=config.db,codec=config.contracts;
 need(db&&typeof db.transaction==='function'&&typeof db.rollback!=='function',500,'Trusted root database required');
 const names=['hash','canonical','snapshotPolicy','parseIntent','accessProof','target','preview','response'];
 need(codec&&names.every(k=>typeof codec[k]==='function'),500,'Fixed member packet codecs required');
 const c=Object.freeze(Object.fromEntries(names.map(k=>[k,codec[k].bind(codec)])));
 const callbacks=['authorizeReadInTransaction','authorizeInTransaction','previewInTransaction','prepareInTransaction','readOutcome'];
 need(callbacks.every(k=>typeof config[k]==='function')&&typeof config.retention?.assertRetentionInTransaction==='function'&&Array.isArray(config.bindings)&&config.bindings.length<=128,500,'Trusted current authority, source and retention ports required');
 const ports=Object.freeze(Object.fromEntries(callbacks.map(k=>[k,config[k].bind(config)]))),retain=config.retention.assertRetentionInTransaction.bind(config.retention);
 function snapshotBinding(raw){const b=exact(raw,['schema','companyId','issueId','policy','policyHash']);need(b.schema==='inertia.member-packet-route.v2'&&UUID.test(b.companyId)&&UUID.test(b.issueId),500,'Invalid trusted native route binding');const p=c.snapshotPolicy(b.policy);need(p.policyHash===b.policyHash&&p.policy.scope.companyId===b.companyId,500,'Trusted route policy mismatch');return frozen({...b,...p});}
 const bindings=config.bindings.map(snapshotBinding),scopes=new Set(bindings.map(b=>c.canonical([b.companyId,b.policy.scope.applicationId])));
 need(new Set(bindings.map(b=>b.issueId)).size===bindings.length,500,'Duplicate trusted issue route');
 function stored(row){try{if(!row||row.action!==ACTION||row.actorType!=='user'||row.agentId||row.runId||row.entityType!=='issue'||row.responsibleUserId!==row.actorId)return null;
  const d=exact(row.details,['schema','binding','intent','intentHash','memberAccess','requestId','requestKey','selectionVersion']);if(d.schema!==SCHEMA)return null;const b=snapshotBinding(d.binding);
  if(row.companyId!==b.companyId||row.entityId!==b.issueId||!scopes.has(c.canonical([b.companyId,b.policy.scope.applicationId])))return null;
  const access=exact(d.memberAccess,['schema','decision']);if(access.schema!=='inertia.native-member-access-decision.v2')return null;
  const proof=c.accessProof(access.decision,row.actorId),intent=c.parseIntent(d.intent,b);if(!['record_submission','attach_submission_evidence','correct_submission'].includes(intent.action)||c.hash(intent)!==d.intentHash||d.requestKey!==c.hash([b.companyId,b.issueId,row.actorId,identifier(d.requestId)])||!/^[a-f0-9]{64}$/.test(d.selectionVersion))return null;
  return{schema:'inertia.member-packet-acceptance.v2',source:{kind:'paperclip',id:row.id},acceptedAt:row.createdAt.toISOString(),actor:{type:'human',userId:row.actorId},authorization:proof,intent,intentHash:d.intentHash};
 }catch{return null;}}
 async function readAcceptance(id){if(typeof id!=='string'||!UUID.test(id))return null;const [row]=await db.select(receiptProjection).from(activityLog).where(and(eq(activityLog.id,id),receiptProvenance(ACTION,bindings.map(b=>b.companyId)),receiptApplicationScope(bindings)));return stored(receiptRow(row));}
 async function listAcceptances({companyId,afterId=null,limit=100}){need(bindings.some(b=>b.companyId===companyId)&&Number.isSafeInteger(limit)&&limit>=1&&limit<=500&&(afterId===null||typeof afterId==='string'&&UUID.test(afterId)),400,'Invalid scoped action page');const rows=await db.select(receiptProjection).from(activityLog).where(and(receiptProvenance(ACTION,[companyId]),receiptApplicationScope(bindings),...(afterId?[gt(activityLog.id,afterId)]:[]))).orderBy(asc(activityLog.id)).limit(limit);return receiptPage(rows,stored,limit);}
 async function outcome(row,context){const acceptance=stored(row);need(acceptance,500,'Accepted action failed exact readback');let state='accepted_pending',effectId=null;
  try{const result=await ports.readOutcome(acceptance,context);if(result!==null){exact(result,['sourceId','intentHash','state','effectId']);need(result.sourceId===acceptance.source.id&&result.intentHash===acceptance.intentHash&&['applied','needs_reconciliation','rejected'].includes(result.state),500,'Outcome identity mismatch');need(result.state==='applied'?typeof result.effectId==='string'&&result.effectId.length>0:result.effectId===null,500,'Invalid outcome effect');state=result.state;effectId=result.effectId;}}catch{state='needs_reconciliation';effectId=null;}
  return c.response({schema:'inertia.member-packet-action-response.v2',requestId:row.details.requestId,sourceId:row.id,actorUserId:row.actorId,intent:acceptance.intent,intentHash:acceptance.intentHash,acceptedAt:acceptance.acceptedAt,state,effectId});
 }
 async function previewAt(tx,context,b){
  const p=c.preview(await ports.previewInTransaction(tx,context,b));
  const attachments=await tx.select({id:issueAttachments.id,label:assets.originalFilename,contentType:assets.contentType,sha256:assets.sha256}).from(issueAttachments).innerJoin(assets,eq(assets.id,issueAttachments.assetId)).where(and(eq(issueAttachments.companyId,b.companyId),eq(issueAttachments.issueId,b.issueId),eq(assets.companyId,b.companyId))).orderBy(asc(issueAttachments.id)).limit(129);
  need(attachments.length<=128,409,'Issue attachment list exceeds the bounded packet view');
  p.attachments=attachments.filter(a=>a.contentType.startsWith('image/')||['message/rfc822','application/vnd.ms-outlook'].includes(a.contentType)).map(a=>({id:a.id,label:(a.label??a.id).replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,150)||a.id,kind:a.contentType.startsWith('image/')?'image':'email',sha256:a.sha256}));
  const {selectionVersion,nativeActions,...selection}=p;
  return c.preview({...p,selectionVersion:c.hash(selection)});
 }
 const router=express.Router();
 // This parser runs before the host's larger generic JSON parser. It performs no
 // authorization/storage work and never expands compressed input.
 const parser=express.json({limit:8192,inflate:false,strict:true});
 const beforeBodyParser=(req,res,next)=>{if(req.get('content-encoding')&&req.get('content-encoding')!=='identity')return res.status(415).json({error:'unsupported_encoding'});if(req.method==='POST'){if(!req.is('application/json'))return res.status(415).json({error:'json_required'});return parser(req,res,error=>error?next(new HttpError(error.type==='entity.too.large'?413:400,error.type==='entity.too.large'?'Packet action exceeds 8192 bytes':'Invalid packet JSON')):next());}if(req.get('transfer-encoding')||req.get('content-length')&&req.get('content-length')!=='0')return res.status(400).json({error:'body_not_allowed'});next();};
 async function withCurrent(req,res,write,operation){
  need(req.actor?.type&&req.actor.type!=='none',401,'Sign in again before continuing.');
  const issueId=req.params.issueId;if(typeof issueId!=='string'||!UUID.test(issueId))return res.status(404).json({error:'Issue not found'});
  const binding=bindings.find(b=>b.issueId===issueId);const [initial]=await db.select().from(issues).where(eq(issues.id,issueId));const issue=await getAccessibleResource(req,res,initial,'Issue not found');if(!issue)return;
  need(binding&&binding.companyId===issue.companyId,404,'Packet actions unavailable');
  need(req.actor.type==='board'&&['session','board_key','cloud_tenant','mcp_oauth'].includes(req.actor.source)&&req.actor.userId&&!req.actor.agentId&&!req.actor.runId,403,'Authenticated native human required');
  const context=frozen({method:req.method,actor:req.actor,companyId:issue.companyId,issueId});
  const result=await db.transaction(async tx=>{
   await tx.execute(sql`set local lock_timeout='2000ms'`);await tx.execute(sql`set local statement_timeout='5000ms'`);
   // Native verdict capture already touches issue before company. Match that
   // ordering; no authority/access writer or global fence is changed here.
   const [current]=await tx.select().from(issues).where(and(eq(issues.id,issueId),eq(issues.companyId,binding.companyId))).for('update');
   const [company]=await tx.select().from(companies).where(eq(companies.id,binding.companyId)).for('update');
   const [human]=await tx.select({id:authUsers.id}).from(authUsers).where(eq(authUsers.id,context.actor.userId)).for('update');
   const [member]=await tx.select().from(companyMemberships).where(and(eq(companyMemberships.companyId,binding.companyId),eq(companyMemberships.principalType,'user'),eq(companyMemberships.principalId,context.actor.userId))).for('update');
   need(current&&company?.status==='active'&&human&&member?.status==='active',403,'Current native membership required');
   const native=accessService(tx),resource={type:'issue',companyId:binding.companyId,issueId,status:current.status,assigneeAgentId:current.assigneeAgentId,assigneeUserId:current.assigneeUserId};
   const read=await native.decide({actor:context.actor,action:'issue:read',resource});need(read.allowed&&await ports.authorizeReadInTransaction(tx,{...context,issue:current},binding)===true,403,'Current application read access required');
   const canWrite=(await native.decide({actor:context.actor,action:'issue:mutate',resource})).allowed;
   if(write)need(canWrite,403,'Current native issue write access required');
   return operation(tx,{...context,issue:current},binding,canWrite);
  });
  if(result.publication)publishActivity(result.publication);if(result.outcomeRow)result.value=await outcome(result.outcomeRow,result.context);res.set('Cache-Control','no-store');res.status(result.status??200).json(result.value);
 }
 router.get('/issues/:issueId',async(req,res)=>withCurrent(req,res,false,async(tx,context,b,canWrite)=>{const p=await previewAt(tx,context,b);need(p.policyHash===b.policyHash,409,'Current policy changed');const rows=await tx.select(receiptProjection).from(activityLog).where(and(receiptProvenance(ACTION,[b.companyId]),eq(activityLog.entityId,b.issueId),receiptApplicationScope([b]))).orderBy(desc(activityLog.createdAt),desc(activityLog.id)).limit(32);p.nativeActions=rows.map(receiptRow).map(stored).filter(Boolean).map(a=>({sourceId:a.source.id,actorUserId:a.actor.userId,action:a.intent.action,target:a.intent.target,acceptedAt:a.acceptedAt}));const value=c.preview({...p,canAct:p.canAct&&canWrite});need(Buffer.byteLength(c.canonical(value),'utf8')<=1024*1024,409,'Packet preview exceeds its bound');return{value};}));
 router.get('/issues/:issueId/requests/:requestId',async(req,res)=>withCurrent(req,res,false,async(tx,context,b)=>{const requestKey=c.hash([b.companyId,b.issueId,context.actor.userId,identifier(req.params.requestId)]);const [projected]=await tx.select(receiptProjection).from(activityLog).where(and(eq(activityLog.companyId,b.companyId),eq(activityLog.action,ACTION),sql`${activityLog.details}->>'requestKey'=${requestKey}`)).limit(1);const row=receiptRow(projected);need(row&&stored(row),404,'Report not found');return{outcomeRow:row,context};}));
 router.post('/issues/:issueId/actions',async(req,res)=>withCurrent(req,res,true,async(tx,context,b)=>{
  const input=exact(req.body,['requestId','selectionVersion','intent']),requestId=identifier(input.requestId);need(typeof input.selectionVersion==='string'&&/^[a-f0-9]{64}$/.test(input.selectionVersion),400,'Invalid packet selection');
  const requestKey=c.hash([b.companyId,b.issueId,context.actor.userId,requestId]);
  const [projectedPrior]=await tx.select(receiptProjection).from(activityLog).where(and(eq(activityLog.companyId,b.companyId),eq(activityLog.action,ACTION),sql`${activityLog.details}->>'requestKey'=${requestKey}`)).limit(1);
  const prior=receiptRow(projectedPrior);
  if(prior){need(stored(prior)&&prior.details.selectionVersion===input.selectionVersion&&c.canonical(prior.details.intent)===c.canonical(input.intent),409,'Request identity already records a different exact action');return{status:202,outcomeRow:prior,context};}
  need(input.intent&&typeof input.intent==='object'&&!Array.isArray(input.intent),400,'Invalid exact member intent');need(input.intent.policyHash===b.policyHash,409,'Current member policy changed');
  let intent;try{intent=c.parseIntent(input.intent,b);}catch{throw new HttpError(400,'Invalid exact member intent');}
  need(['record_submission','attach_submission_evidence','correct_submission'].includes(intent.action),400,'Approval uses the existing native human review card');
  const p=await previewAt(tx,context,b);need(p.policyHash===b.policyHash&&p.selectionVersion===input.selectionVersion,409,'Packet selection or policy changed');
  need(p.canAct,403,'Current application action access required');
  const packet=p.packets.find(x=>c.canonical(x.target)===c.canonical(intent.target));need(packet,409,'Exact historical packet is unavailable');
  if(intent.action!=='record_submission')need(p.submissions.some(s=>s.id===intent.payload.submissionId&&c.canonical(s.target)===c.canonical(intent.target)),409,'Exact original submission is unavailable');
  // Historical document revisions remain selectable when the head is newer.
  const [document]=await tx.select().from(documents).where(and(eq(documents.id,packet.document.id),eq(documents.companyId,b.companyId))).for('update');
  const [link]=await tx.select().from(issueDocuments).where(and(eq(issueDocuments.companyId,b.companyId),eq(issueDocuments.issueId,b.issueId),eq(issueDocuments.key,packet.document.key))).for('update');
  const [revision]=await tx.select({id:documentRevisions.id}).from(documentRevisions).where(and(eq(documentRevisions.id,packet.document.revisionId),eq(documentRevisions.documentId,packet.document.id),eq(documentRevisions.companyId,b.companyId)));
  need(document&&link?.documentId===document.id&&revision,409,'Selected immutable native document is unavailable');
  const e=intent.payload.evidence;
  if(e&&e.kind!=='reference'){
   const match=/^paperclip:attachment:([a-f0-9-]{36})$/.exec(e.reference);need(match&&UUID.test(match[1]),400,'Use an existing native issue attachment for image/email evidence');
   const [attachment]=await tx.select({id:issueAttachments.id,contentType:assets.contentType,sha256:assets.sha256}).from(issueAttachments).innerJoin(assets,eq(assets.id,issueAttachments.assetId)).where(and(eq(issueAttachments.id,match[1]),eq(issueAttachments.companyId,b.companyId),eq(issueAttachments.issueId,b.issueId),eq(assets.companyId,b.companyId))).for('update');
   need(attachment&&e.sha256===attachment.sha256&&(e.kind==='image'?attachment.contentType.startsWith('image/'):['message/rfc822','application/vnd.ms-outlook'].includes(attachment.contentType)),403,'Evidence attachment is not current and scoped to this issue');
  }
  let proof;try{proof=c.accessProof(await ports.authorizeInTransaction(tx,context,b,intent),context.actor.userId);}catch{throw new HttpError(403,'Current verified member application action access required');}
  need(await ports.prepareInTransaction(tx,context,b,intent)===true,409,'Current source/artifact preparation rejected');
  const retained=await retain(tx);need(retained===undefined||retained===true,409,'Immutable action retention unavailable');
  const details={schema:SCHEMA,binding:structuredClone(b),intent,intentHash:c.hash(intent),memberAccess:{schema:'inertia.native-member-access-decision.v2',decision:proof},requestId,requestKey,selectionVersion:input.selectionVersion};
  const written=await persistActivity(tx,{companyId:b.companyId,actorType:'user',actorId:context.actor.userId,responsibleUserIdOverride:context.actor.userId,action:ACTION,entityType:'issue',entityId:b.issueId,details});
  const [row]=await tx.select().from(activityLog).where(eq(activityLog.id,written.activity.id));need(c.canonical(row?.details)===c.canonical(details)&&stored(row),500,'Native redaction or audit changed exact attestation');
  return{status:202,outcomeRow:row,context,publication:written.publication};
 }));
 return Object.freeze({enabled:true,appOptions:Object.freeze({memberPacketActions:Object.freeze({db,beforeBodyParser,router})}),readAcceptance,listAcceptances});
}
