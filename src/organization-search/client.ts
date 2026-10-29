/** Bounded reader transport. Source passages remain unverified evidence, never authority. */
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const id=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
export interface OrganizationPassage{sourceId:string;passageId:string;title:string;kind:string;location:string;text:string;contentHash:string;status:'active'}
export function parseOrganizationSearch(value:unknown):OrganizationPassage[]{
 if(!object(value)||value.version!=='member-organization-read-v1'||value.audience!=='organization_shared'||value.evidenceStatus!=='unverified_source_context'||!Array.isArray(value.results)||value.results.length>8)throw Error('organization_reader_response_invalid');
 return value.results.map(v=>{if(!object(v)||!id(v.sourceId)||!id(v.passageId)||typeof v.contentHash!=='string'||!/^[a-f0-9]{64}$/.test(v.contentHash)||v.status!=='active'||!['website','meeting','document','note','chat-export','link'].includes(String(v.kind))||['title','location','text'].some(k=>typeof v[k]!=='string')||String(v.title).length>200||String(v.text).length>4000)throw Error('organization_reader_evidence_invalid');return{sourceId:v.sourceId,passageId:v.passageId,title:v.title as string,kind:v.kind as string,location:v.location as string,text:v.text as string,contentHash:v.contentHash,status:'active'};});
}
export function createOrganizationReader(input:{endpoint:string;authorize:()=>Promise<boolean>;resolveReadToken:()=>Promise<string>;fetch:typeof fetch}){
 const url=new URL(input.endpoint);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/api/org/knowledge')throw Error('organization_reader_endpoint_invalid');
 return{async search(query:string,signal?:AbortSignal){
  if(typeof query!=='string'||!query.trim()||query.length>200)throw Error('organization_reader_query_invalid');
  if(signal?.aborted||!await input.authorize())throw Error('organization_reader_scope_revoked');
  const token=await input.resolveReadToken();if(!token||signal?.aborted||!await input.authorize())throw Error('organization_reader_scope_revoked');
  const response=await input.fetch(url,{method:'POST',redirect:'error',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({operation:'search',query}),...(signal?{signal}:{})});
  if(response.status!==200)throw Error('organization_reader_unavailable');const reader=response.body?.getReader();if(!reader)throw Error('organization_reader_response_invalid');const parts:Uint8Array[]=[];let size=0;
  try{while(true){const item=await reader.read();if(item.done)break;size+=item.value.byteLength;if(size>262144){await reader.cancel();throw Error('organization_reader_response_too_large');}parts.push(item.value);}}finally{reader.releaseLock();}
  const result=parseOrganizationSearch(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts))));if(signal?.aborted||!await input.authorize())throw Error('organization_reader_scope_revoked');return result;
 }};
}
export function proposedOrganizationField(input:{targetKey:string;value:string;rationale:string},evidence:OrganizationPassage){
 if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(input.targetKey)||!input.value||input.value.length>16000||!input.rationale)throw Error('organization_field_invalid');
 const [verified]=parseOrganizationSearch({version:'member-organization-read-v1',audience:'organization_shared',evidenceStatus:'unverified_source_context',results:[evidence]});
 if(!verified)throw Error('organization_field_invalid');
 const citation=JSON.stringify({system:'member_organization',sourceId:verified.sourceId,passageId:verified.passageId,location:verified.location,contentHash:verified.contentHash});const rationale=input.rationale+'\nUnverified organization-shared citation: '+citation;if(rationale.length>4000)throw Error('organization_field_invalid');
 return{target_type:'preliminary_field' as const,target_key:input.targetKey,value:input.value,rationale,evidence_ids:[] as string[],concerns:['Organization-shared context is not independent applicant-fact verification, eligibility or a commitment.']};
}
