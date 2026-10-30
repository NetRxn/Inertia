import {createHash} from 'node:crypto';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown,max=320):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=max&&!/[\x00-\x1f\x7f]/.test(v);
const digest=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const keys=(v:Record<string,unknown>,expected:string[])=>Object.keys(v).sort().join()===expected.sort().join();
const sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
// The DFW manifest contains string identities and safe integer versions/sizes.
function canonical(v:unknown):string {
 if(v===null||typeof v!=='object')return JSON.stringify(v);
 if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
 return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical((v as Record<string,unknown>)[k])).join(',')+'}';
}
const requiredArtifacts=['application_packet_markdown','application_packet_docx','packet_data','review'];
function descriptor(v:unknown):v is Record<string,unknown>{
 return object(v)&&keys(v,['key','type','hash','size_bytes','placeholders'])&&text(v.key,128)&&text(v.type,128)&&digest(v.hash)&&Number.isSafeInteger(v.size_bytes)&&Number(v.size_bytes)>=0&&Array.isArray(v.placeholders)&&v.placeholders.length<=1000&&v.placeholders.every(item=>text(item,10000));
}
/** Validate the current DFW catalog. File/total sizes are domain/native attachment concerns. */
export function validatePacketArtifacts(value:Record<string,unknown>,expected:{companyId:string;issueId:string;caseBindingId:string}):Record<string,unknown>{
 const reject=():never=>{throw Error('Current exact packet artifact integrity unavailable');};
 if(!keys(value,['manifest','manifest_hash','artifacts','case_binding_id','business_complete'])||value.case_binding_id!==expected.caseBindingId||value.business_complete!==false||!object(value.manifest)||!digest(value.manifest_hash)||!Array.isArray(value.artifacts)||value.artifacts.length<4||value.artifacts.length>256)return reject();
 const manifest=value.manifest;
 if(!keys(manifest,['schema','scope','packet_id','packet_version','packet_data_hash','artifacts','coverage_targets','native_producer_run_id'])||manifest.schema!=='dfw-packet-machine-manifest-v1'||!object(manifest.scope)||!text(manifest.packet_id)||!Number.isSafeInteger(manifest.packet_version)||Number(manifest.packet_version)<1||!digest(manifest.packet_data_hash)||!text(manifest.native_producer_run_id,200)||!Array.isArray(manifest.artifacts)||manifest.artifacts.length!==value.artifacts.length||!Array.isArray(manifest.coverage_targets)||manifest.coverage_targets.length<1||manifest.coverage_targets.length>256||manifest.coverage_targets.some(v=>!text(v,200))||sha(canonical(manifest))!==value.manifest_hash)return reject();
 if(!keys(manifest.scope,['company_id','issue_id','applicant_id','opportunity_namespace','opportunity_external_id'])||Object.values(manifest.scope).some(v=>!text(v))||manifest.scope.company_id!==expected.companyId||manifest.scope.issue_id!==expected.issueId)return reject();
 const seen=new Set<string>();
 for(const artifact of value.artifacts){
  if(!descriptor(artifact)||seen.has(String(artifact.key)))return reject();
  const bound=manifest.artifacts.find(v=>object(v)&&v.key===artifact.key);
  if(!descriptor(bound)||canonical(bound)!==canonical(artifact))return reject();
  seen.add(String(artifact.key));
 }
 if(requiredArtifacts.some(k=>!seen.has(k)))return reject();
 return value;
}
/** Check one finite transport response; native reconstruction verifies the final descriptor hash. */
export function validatePacketArtifactChunk(value:Record<string,unknown>,request:Record<string,unknown>,caseBindingId:string):Record<string,unknown>{
 const reject=():never=>{throw Error('Current exact packet artifact chunk integrity unavailable');};
 if(!keys(value,['manifest_hash','artifact','offset','end','next_offset','base64','case_binding_id','business_complete'])||value.case_binding_id!==caseBindingId||value.business_complete!==false||value.manifest_hash!==request.manifest_hash||!descriptor(value.artifact)||value.artifact.key!==request.artifact_key||value.offset!==request.offset||!Number.isSafeInteger(value.end)||Number(value.end)<Number(value.offset)||Number(value.end)>Number(value.artifact.size_bytes)||typeof value.base64!=='string'||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.base64))return reject();
 const length=Number(value.end)-Number(value.offset),limit=Number(request.limit??131072);
 // Bound encoded size before decoding; there is no aggregate packet transfer budget here.
 if(length>limit||value.base64.length>4*Math.ceil(limit/3))return reject();
 const body=Buffer.from(value.base64,'base64');
 if(body.length!==length||body.toString('base64')!==value.base64||value.next_offset!==(Number(value.end)<Number(value.artifact.size_bytes)?value.end:null)||length===0&&value.offset!==value.artifact.size_bytes)return reject();
 if(value.offset===0&&value.end===value.artifact.size_bytes&&sha(body)!==value.artifact.hash)return reject();
 return value;
}
