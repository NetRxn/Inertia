/** Trusted native activity reader. Two existing immutable producers, one cursor.
 * Projection bounds are enforced in PostgreSQL before JSON reaches this process.
 * This reads acceptance-time evidence, never claims current member authority. */
import {Router} from 'express';
import {sql} from 'drizzle-orm';
import {MAX_RESPONSE_BYTES,MAX_SOURCE_BYTES,MAX_PAGE_SIZE,UUID,exact,identifier,need,snapshotMemberScope,policyScope,snapshotMemberCursor} from './member-protocol.mjs';
const REVIEW='member.packet.review.accepted',ACTION='member.packet.action.accepted';
export function createMemberPacketSource(config={}){
 if(config.enabled!==true)return Object.freeze({enabled:false,async readEnvelope(){return null;},async listEnvelopes(){return{entries:[],nextCursor:null};}});
 const db=config.db,scope=snapshotMemberScope(config.scope),names=['hash','canonical','snapshotBinding','acceptance','snapshotPolicy','parseIntent','accessProof','timestamp','target'];
 need(db&&typeof db.transaction==='function'&&typeof db.rollback!=='function');need(config.contracts&&names.every(key=>typeof config.contracts[key]==='function'));
 const c=Object.freeze(Object.fromEntries(names.map(key=>[key,config.contracts[key].bind(config.contracts)]))),scopeJson=c.canonical(policyScope(scope));
 function actionBinding(raw){const b=exact(raw,['schema','companyId','issueId','policy','policyHash']),p=c.snapshotPolicy(b.policy);need(b.schema==='inertia.member-packet-route.v2'&&UUID.test(b.companyId)&&UUID.test(b.issueId)&&p.policyHash===b.policyHash&&b.companyId===p.policy.scope.companyId);return{...b,...p};}
 function scoped(b){need(c.canonical(b.policy.scope)===scopeJson&&b.companyId===scope.companyId);return b;}
 need(Array.isArray(config.reviewBindings)&&Array.isArray(config.actionBindings)&&config.reviewBindings.length+config.actionBindings.length>0&&config.reviewBindings.length+config.actionBindings.length<=128);
 const reviews=config.reviewBindings.map(b=>scoped(c.snapshotBinding(structuredClone(b)))),actions=config.actionBindings.map(b=>scoped(actionBinding(structuredClone(b))));
 const reviewKey=b=>c.canonical([b.companyId,b.issueId,b.interactionId,b.itemId]);
 need(new Set(reviews.map(reviewKey)).size===reviews.length&&new Set(actions.map(b=>b.issueId)).size===actions.length);
 const reviewBindings=new Set(reviews.map(b=>c.canonical(b))),actionBindings=new Set(actions.map(b=>c.canonical(b)));
 function decode(row){
  need(row&&UUID.test(row.id)&&row.companyId===scope.companyId&&row.actorType==='user'&&!row.agentId&&!row.runId&&row.entityType==='issue'&&row.responsibleUserId===row.actorId);identifier(row.actorId);
  const d=row.details,review=row.action===REVIEW;need(review||row.action===ACTION);
  exact(d,review?['schema','binding','intent','intentHash','memberAccess','nativeDecisionKey']:['schema','binding','intent','intentHash','memberAccess','requestId','requestKey','selectionVersion']);
  need(d.schema===(review?'inertia.member-native-storage.v2':'inertia.member-native-action-storage.v2'));
  const b=scoped(review?c.snapshotBinding(d.binding):actionBinding(d.binding));
  need((review?reviewBindings:actionBindings).has(c.canonical(b))&&row.entityId===b.issueId);
  exact(d.memberAccess,['schema','decision']);need(d.memberAccess.schema==='inertia.native-member-access-decision.v2');
  const authorization=c.accessProof(d.memberAccess.decision,row.actorId),intent=c.parseIntent(d.intent,b);need(c.canonical(intent)===c.canonical(d.intent)&&c.hash(intent)===d.intentHash);
  const acceptedAt=c.timestamp(new Date(row.createdAt).toISOString());
  if(review){need(d.nativeDecisionKey===c.hash(reviewKey(b)));return c.acceptance(b,{sourceId:row.id,acceptedAt,actorUserId:row.actorId,authorization,intent});}
  need(['record_submission','attach_submission_evidence','correct_submission'].includes(intent.action)&&d.requestKey===c.hash([b.companyId,b.issueId,row.actorId,identifier(d.requestId)])&&typeof d.selectionVersion==='string'&&/^[a-f0-9]{64}$/.test(d.selectionVersion));
  return{schema:'inertia.member-packet-acceptance.v2',source:{kind:'paperclip',id:row.id},acceptedAt,actor:{type:'human',userId:row.actorId},authorization,intent,intentHash:d.intentHash};
 }
 const issueIds=[...new Set([...reviews,...actions].map(b=>b.issueId))];
 const registeredIssue=sql`(entity_id in (${sql.join(issueIds.map(i=>sql`${i}`),sql`, `)}) or details #>> '{binding,issueId}' in (${sql.join(issueIds.map(i=>sql`${i}`),sql`, `)}))`;
 const scopeKeys=Object.keys(policyScope(scope));
 // Only a complete, well-formed foreign scope is excluded. Corrupt/missing scope
 // on a registered issue remains visible for reconciliation, never false missing.
 function foreignScope(details){
  const object=sql`(${details} #> '{binding,policy,scope}')`;
  return sql`case when jsonb_typeof(${object})='object' then
   ${object} ?& array[${sql.join(scopeKeys.map(k=>sql`${k}`),sql`, `)}] and
   (${object} - array[${sql.join(scopeKeys.map(k=>sql`${k}`),sql`, `)}])='{}'::jsonb and
   ${sql.join(scopeKeys.map(k=>sql`(jsonb_typeof(${object}->${k})='string' and (${object}->>${k}) ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$')`),sql` and `)}
   and ${object} <> ${scopeJson}::jsonb else false end`;
 }
 async function candidates({id=null,after=null,limit=1}){
  return db.transaction(async tx=>{
   await tx.execute(sql`set local statement_timeout = '2000ms'`);await tx.execute(sql`set local lock_timeout = '500ms'`);
   const rows=await tx.execute(sql`select id, to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "createdAt", ambiguous,
    case when octet_length(source_row::text) <= ${MAX_SOURCE_BYTES} then source_row else null end as row from (
    select id, created_at, exists(select 1 from activity_log peer where peer.company_id=activity_log.company_id and peer.entity_id=activity_log.entity_id and peer.created_at=activity_log.created_at and peer.id<>activity_log.id and peer.action in (${REVIEW},${ACTION}) and not (${foreignScope(sql`peer.details`)})) as ambiguous,
     jsonb_build_object('id',id,'companyId',company_id,'actorType',actor_type,'actorId',actor_id,'agentId',agent_id,'runId',run_id,'action',action,'entityType',entity_type,'entityId',entity_id,'responsibleUserId',responsible_user_id,'createdAt',created_at,'details',details) as source_row
    from activity_log where company_id=${scope.companyId}::uuid and ${registeredIssue} and action in (${REVIEW},${ACTION})
    and not (${foreignScope(sql`details`)})
    ${id?sql`and id=${id}::uuid`:sql``} ${after?sql`and (created_at,id)>(${after.createdAt}::timestamptz,${after.id}::uuid)`:sql``}
    order by created_at,id limit ${limit}
   ) as bounded_member_source order by created_at,id`);
   return rows.rows??rows;
  });
 }
 const envelope=row=>{const acceptance=decode(row);return{scope,acceptance,acceptedDigest:c.hash(acceptance)};};
 return Object.freeze({enabled:true,db,scope,
  async readEnvelope(id){need(typeof id==='string'&&UUID.test(id));const rows=await candidates({id});if(!rows.length)return null;try{return envelope(rows[0].row);}catch{throw Error('Member source unavailable');}},
  async listEnvelopes({after=null,limit=MAX_PAGE_SIZE}={}){
   if(after!==null)after=snapshotMemberCursor(after);need(Number.isSafeInteger(limit)&&limit>=1&&limit<=MAX_PAGE_SIZE);
   const rows=await candidates({after,limit}),entries=[];let bytes=0;
   for(const row of rows){const cursor=snapshotMemberCursor({createdAt:row.createdAt,id:row.id});let value=null;
    try{value=envelope(row.row);const size=Buffer.byteLength(c.canonical(value),'utf8');need(bytes+size<=MAX_RESPONSE_BYTES-8192);bytes+=size;}catch{value=null;}
    entries.push({cursor,envelope:value,ambiguous:value!==null&&row.ambiguous===true});
   }
   return{entries,nextCursor:rows.length===limit?entries.at(-1).cursor:null};
  },
 });
}

/** Mount after real actor middleware; pre-parser only rejects body framing. */
export function createMemberPacketSourceRouter(config={}){
 if(config.enabled!==true)return Object.freeze({enabled:false,appOptions:Object.freeze({})});
 const source=config.source,scope=snapshotMemberScope(config.scope),principal=Object.freeze({...config.principal});
 need(source?.enabled===true&&source.db===config.db&&JSON.stringify(source.scope)===JSON.stringify(scope)&&typeof source.readEnvelope==='function'&&typeof source.listEnvelopes==='function');
 identifier(principal.userId);identifier(principal.keyId);need(typeof config.lifecycle?.assertReadable==='function');
 const assertReadable=config.lifecycle.assertReadable.bind(config.lifecycle),read=source.readEnvelope.bind(source),list=source.listEnvelopes.bind(source);
 // Source owns the fixed canonical codec; digest is computed from the same exact scope.
 const router=Router();
 const beforeBodyParser=(req,res,next)=>{
  if(req.get('content-encoding')&&req.get('content-encoding')!=='identity')return res.status(415).json({error:'unsupported_encoding'});
  if(req.get('transfer-encoding')||req.get('content-length')&&req.get('content-length')!=='0')return res.status(400).json({error:'body_not_allowed'});next();
 };
 router.use((req,res,next)=>{
  res.set('Cache-Control','no-store');const actor=req.actor;
  if(actor?.type!=='board'||actor.source!=='board_key'||actor.userId!==principal.userId||actor.keyId!==principal.keyId||!actor.companyIds?.includes(scope.companyId)||req.get('X-Member-Packet-Scope')!==memberScopeDigest(scope))return res.status(403).json({error:'transport_access_denied'});
  if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});next();
 });
 const send=(res,value)=>{const body=JSON.stringify(value);need(Buffer.byteLength(body,'utf8')<=MAX_RESPONSE_BYTES);res.type('application/json').send(body);};
 const guarded=fn=>async(req,res)=>{try{await fn(req,res);}catch{res.status(503).json({error:'member_source_unavailable'});}};
 const retained=async value=>{need(await assertReadable({scope,acceptance:structuredClone(value.acceptance),acceptedDigest:value.acceptedDigest})===true);return value;};
 router.get('/scope',(req,res)=>Object.keys(req.query).length?res.status(400).json({error:'invalid_query'}):send(res,{scope}));
 router.get('/acceptances',guarded(async(req,res)=>{
  const {afterId,afterCreatedAt,limit=String(MAX_PAGE_SIZE)}=req.query;
  if(Object.keys(req.query).some(k=>!['afterId','afterCreatedAt','limit'].includes(k))||typeof limit!=='string'||!/^([1-9]|[12][0-9]|3[0-2])$/.test(limit)||((afterId===undefined)!==(afterCreatedAt===undefined)))return res.status(400).json({error:'invalid_query'});
  let after=null;try{if(afterId!==undefined)after=snapshotMemberCursor({id:afterId,createdAt:afterCreatedAt});}catch{return res.status(400).json({error:'invalid_query'});}
  const page=await list({after,limit:Number(limit)});for(const entry of page.entries)if(entry.envelope)await retained(entry.envelope);send(res,{scope,...page});
 }));
 router.get('/acceptances/:id',guarded(async(req,res)=>{
  if(!UUID.test(req.params.id)||Object.keys(req.query).length)return res.status(400).json({error:'invalid_source'});
  const value=await read(req.params.id);if(value===null)return res.status(404).json({error:'source_not_found'});send(res,await retained(value));
 }));
 return Object.freeze({enabled:true,appOptions:Object.freeze({memberPacketTransport:Object.freeze({db:config.db,beforeBodyParser,router})})});
}
import {digestJson as memberScopeDigest} from './acceptance-routes.mjs';
