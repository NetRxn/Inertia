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
/** Validate the existing DFW packet payload. Only the native composition may register its bytes. */
export function validatePacketArtifacts(value:Record<string,unknown>,expected:{companyId:string;issueId:string;caseBindingId:string}):Record<string,unknown>{
 const reject=():never=>{throw Error('Current exact packet artifact integrity unavailable');};
 if(!keys(value,['manifest','manifest_hash','packet_data','packet_data_canonical','artifacts','case_binding_id','business_complete'])||value.case_binding_id!==expected.caseBindingId||value.business_complete!==false||!object(value.manifest)||!digest(value.manifest_hash)||!object(value.packet_data)||typeof value.packet_data_canonical!=='string'||!Array.isArray(value.artifacts)||value.artifacts.length<4||value.artifacts.length>100||Buffer.byteLength(JSON.stringify(value))>4*1024*1024)return reject();
 const manifest=value.manifest;
 if(!keys(manifest,['schema','scope','packet_id','packet_version','packet_data_hash','artifacts','coverage_targets','native_producer_run_id'])||manifest.schema!=='dfw-packet-machine-manifest-v1'||!object(manifest.scope)||!text(manifest.packet_id)||!Number.isSafeInteger(manifest.packet_version)||Number(manifest.packet_version)<1||!digest(manifest.packet_data_hash)||!text(manifest.native_producer_run_id,200)||!Array.isArray(manifest.artifacts)||manifest.artifacts.length!==value.artifacts.length||!Array.isArray(manifest.coverage_targets)||manifest.coverage_targets.length<1||manifest.coverage_targets.length>256||manifest.coverage_targets.some(v=>!text(v,200))||sha(canonical(manifest))!==value.manifest_hash)return reject();
 if(!keys(manifest.scope,['company_id','issue_id','applicant_id','opportunity_namespace','opportunity_external_id'])||Object.values(manifest.scope).some(v=>!text(v))||manifest.scope.company_id!==expected.companyId||manifest.scope.issue_id!==expected.issueId)return reject();
 try{
  if(canonical(JSON.parse(value.packet_data_canonical))!==canonical(value.packet_data)||sha(value.packet_data_canonical)!==manifest.packet_data_hash)return reject();
 }catch{return reject();}
 const seen=new Set<string>();let total=0;
 for(const artifact of value.artifacts){
  if(!object(artifact)||Object.keys(artifact).some(k=>!['key','type','hash','size_bytes','placeholders','base64','text','document_text'].includes(k))||!text(artifact.key,128)||!text(artifact.type,128)||!digest(artifact.hash)||!Number.isSafeInteger(artifact.size_bytes)||Number(artifact.size_bytes)<1||Number(artifact.size_bytes)>4*1024*1024||!Array.isArray(artifact.placeholders)||artifact.placeholders.length>1000||artifact.placeholders.some(v=>!text(v,10000))||typeof artifact.base64!=='string'||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(artifact.base64)||seen.has(artifact.key))return reject();
  const descriptor=manifest.artifacts.find(v=>object(v)&&v.key===artifact.key);
  if(!object(descriptor)||!keys(descriptor,['key','type','hash','size_bytes','placeholders'])||canonical(descriptor)!==canonical({key:artifact.key,type:artifact.type,hash:artifact.hash,size_bytes:artifact.size_bytes,placeholders:artifact.placeholders}))return reject();
  const body=Buffer.from(artifact.base64,'base64');total+=body.length;
  if(total>4*1024*1024||body.length!==artifact.size_bytes||body.toString('base64')!==artifact.base64||sha(body)!==artifact.hash)return reject();
  if(artifact.text!==undefined){try{if(typeof artifact.text!=='string'||new TextDecoder('utf-8',{fatal:true}).decode(body)!==artifact.text)return reject();}catch{return reject();}}
  if(artifact.document_text!==undefined){const d=artifact.document_text;if(!object(d)||!keys(d,['paragraphs','tables'])||!Array.isArray(d.paragraphs)||d.paragraphs.some(v=>typeof v!=='string')||!Array.isArray(d.tables)||d.tables.some(t=>!Array.isArray(t)||t.some(row=>!Array.isArray(row)||row.some(cell=>typeof cell!=='string'))))return reject();}
  seen.add(artifact.key);
 }
 if(requiredArtifacts.some(k=>!seen.has(k)))return reject();
 return value;
}
