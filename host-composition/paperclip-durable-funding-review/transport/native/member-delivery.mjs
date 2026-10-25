/** Manual member v2 delivery over the existing SDK. No scheduler, source deletion,
 * archival acknowledgement, cancellation, provider submission or identity store. */
import {createMemberPacketOutcomeReader} from './member-outcome.mjs';
import {MEMBER_MOUNT,MEMBER_DOMAIN_MOUNT,MAX_REQUEST_BYTES,MAX_PAGE_SIZE,UUID,exact,need,snapshotMemberScope,snapshotMemberCursor,compareMemberCursor,trustedEndpoint,boundedMemberJson} from './member-protocol.mjs';
export const memberDeliveryJob=Object.freeze({jobKey:'reconcile-member-packets',displayName:'Reconcile accepted member packets',description:'Manually deliver exact native member acceptances to their owning service.'});

export function createMemberPacketDelivery(ctx,config={}){
 if(config.enabled!==true)return Object.freeze({async readOutcome(){return null;},async reconcile(){return{state:'disabled',applied:0,pending:0,complete:false};}});
 const scope=snapshotMemberScope(config.scope),contracts=config.contracts;
 need(contracts&&['canonical','hash','parseIntent','accessProof','target','timestamp'].every(k=>typeof contracts[k]==='function'));
 const c=Object.freeze(Object.fromEntries(['canonical','hash','parseIntent','accessProof','target','timestamp'].map(k=>[k,contracts[k].bind(contracts)])));
 const scopeJson=c.canonical(scope),scopeDigest=c.hash(scope);
 const nativeUrl=trustedEndpoint(config.nativeUrl,MEMBER_MOUNT,config.fixtureLoopback),fundingUrl=trustedEndpoint(config.fundingUrl,MEMBER_DOMAIN_MOUNT,config.fixtureLoopback);
 const refs=[config.nativeSecretRef,config.fundingSecretRef].map(raw=>{const ref=exact(structuredClone(raw),['type','secretId']);need(ref.type==='secret_ref'&&typeof ref.secretId==='string'&&ref.secretId.length>0&&ref.secretId.length<=256);return Object.freeze(ref);});
 const pageSize=config.pageSize??MAX_PAGE_SIZE,maxPages=config.maxPages??5;
 need(Number.isSafeInteger(pageSize)&&pageSize>=1&&pageSize<=MAX_PAGE_SIZE&&Number.isSafeInteger(maxPages)&&maxPages>=1&&maxPages<=20);
 need(typeof ctx?.http?.fetch==='function'&&typeof ctx.secrets?.resolve==='function'&&typeof ctx.state?.get==='function'&&typeof ctx.state?.set==='function');
 const http=ctx.http.fetch.bind(ctx.http),resolve=ctx.secrets.resolve.bind(ctx.secrets),get=ctx.state.get.bind(ctx.state),set=ctx.state.set.bind(ctx.state),remove=ctx.state.delete?.bind(ctx.state);
 const cursorKey=Object.freeze({scopeKind:'company',scopeId:scope.companyId,namespace:'member-packet-transport-v2',stateKey:`scan:${scopeDigest}`});
 const sameScope=value=>c.canonical(snapshotMemberScope(value))===scopeJson;
 async function request(native,path,method='GET'){
  const secret=await resolve(refs[native?0:1],{companyId:scope.companyId});
  need(typeof secret==='string'&&secret.length>0&&Buffer.byteLength(secret,'utf8')<=4096&&!/[\x00-\x1f\x7f]/.test(secret));
  const headers={'X-Member-Packet-Scope':scopeDigest,Accept:'application/json','Accept-Encoding':'identity'};
  headers[native?'Authorization':'X-Admin-Token']=native?`Bearer ${secret}`:secret;
  const url=(native?nativeUrl:fundingUrl)+path;
  need(Buffer.byteLength(JSON.stringify({url,init:{method,headers}}),'utf8')<=MAX_REQUEST_BYTES);
  // The additive owning-host mount enables the existing SDK absolute pre-DNS
  // deadline and pre-buffer/RPC limits. AbortSignal alone is not that guarantee.
  return boundedMemberJson(await http(url,{method,headers,redirect:'error',signal:AbortSignal.timeout(15000)}));
 }
 const project=result=>createMemberPacketOutcomeReader({enabled:true,scope,contracts:c,readEnvelope:async()=>result});
 const validateAcceptance=project({scope,envelope:{state:'terminal_missing'}});
 const readOutcome=createMemberPacketOutcomeReader({enabled:true,scope,contracts:c,readEnvelope:sourceId=>request(false,`/acceptances/${sourceId}/outcome`)});
 let running=false;
 return Object.freeze({readOutcome,async reconcile(){
  if(running)return{state:'busy',applied:0,pending:0,complete:false};running=true;
  let applied=0,pending=0,calls=0,unresolved=false;
  const progress=complete=>({state:unresolved?'pending':'ready',applied,pending:unresolved?Math.max(1,pending):0,complete});
  const call=(...args)=>{need(calls<6);calls++;return request(...args);};
  try{
   for(const native of [true,false]){const handshake=exact(await call(native,'/scope'),['scope']);need(sameScope(handshake.scope));}
   let cursor=null;const saved=await get(cursorKey);try{if(saved!==null&&saved!==undefined){exact(saved,['after','unresolved']);need(typeof saved.unresolved==='boolean');cursor=saved.after===null?null:snapshotMemberCursor(saved.after);unresolved=saved.unresolved;}}catch{cursor=null;unresolved=false;}
   const checkpoint=()=>set(cursorKey,{after:cursor,unresolved});
   for(let pageIndex=0;pageIndex<maxPages;pageIndex++){
    if(calls>=6)return progress(false);
    const page=exact(await call(true,`/acceptances?limit=${pageSize}${cursor?`&afterId=${cursor.id}&afterCreatedAt=${encodeURIComponent(cursor.createdAt)}`:''}`),['scope','entries','nextCursor']);
    need(sameScope(page.scope)&&Array.isArray(page.entries)&&page.entries.length<=pageSize);
    const next=page.nextCursor===null?null:snapshotMemberCursor(page.nextCursor);let previous=cursor;const ids=new Set();
    for(const entry of page.entries){exact(entry,['cursor','envelope','ambiguous']);need(typeof entry.ambiguous==='boolean'&&(!entry.ambiguous||entry.envelope!==null));entry.cursor=snapshotMemberCursor(entry.cursor);need(!previous||compareMemberCursor(entry.cursor,previous)>0);need(!ids.has(entry.cursor.id));ids.add(entry.cursor.id);previous=entry.cursor;
     if(entry.envelope!==null){const value=exact(entry.envelope,['scope','acceptance','acceptedDigest']);need(sameScope(value.scope)&&await validateAcceptance(value.acceptance)===null&&c.hash(value.acceptance)===value.acceptedDigest&&value.acceptance.source.id===entry.cursor.id);}
    }
    need(next===null||page.entries.length>0&&compareMemberCursor(next,page.entries.at(-1).cursor)===0);
    for(const entry of page.entries){
     const value=entry.envelope;
     if(entry.ambiguous){pending++;unresolved=true;await checkpoint();return progress(false);}
     if(value===null){pending++;unresolved=true;cursor=entry.cursor;await checkpoint();continue;}
     if(calls+2>6)return progress(false); // Reserve uncertain-result readback.
     let outcome=null;const path=`/acceptances/${entry.cursor.id}`;
     try{outcome=await project(await call(false,path+'/apply','POST'))(value.acceptance);}catch{}
     if(outcome?.state!=='applied')try{outcome=await project(await call(false,path+'/outcome'))(value.acceptance);}catch{}
     if(outcome?.state!=='applied'){
      // Do not let a later dependent transition overtake an unresolved real action.
      pending++;unresolved=true;await checkpoint();return progress(false);
     }
     applied++;cursor=entry.cursor;await checkpoint();
    }
    cursor=next;
    if(cursor===null){if(remove)await remove(cursorKey);else await set(cursorKey,{after:null,unresolved:false});return progress(true);}
    await checkpoint();
   }
   return progress(false);
  }catch{return{state:'pending',applied,pending,complete:false};}
  finally{running=false;}
 }});
}

export function registerMemberPacketDeliveryJob(ctx,config={}){
 if(config.enabled!==true)return;
 need(typeof ctx?.jobs?.register==='function');const delivery=createMemberPacketDelivery(ctx,config);
 ctx.jobs.register(memberDeliveryJob.jobKey,async job=>{
  need(job?.trigger==='manual','Member packet delivery requires explicit manual invocation');
  const result=await delivery.reconcile();need(result.state==='ready'&&result.complete,'Member packet delivery remains pending; invoke manually again');return result;
 });
}
