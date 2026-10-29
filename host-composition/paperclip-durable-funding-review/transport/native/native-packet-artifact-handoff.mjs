/** Reuses native registration; all bytes and names derive from current DFW output. */
import {createHash} from 'node:crypto';
const object=v=>v&&typeof v==='object'&&!Array.isArray(v),canonical=v=>object(v)?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':Array.isArray(v)?'['+v.map(canonical).join(',')+']':JSON.stringify(v),sha=v=>createHash('sha256').update(v).digest('hex'),deny=()=>{throw Error('native_packet_artifact_handoff_denied');};
const files={application_packet_markdown:['md','text/markdown'],application_packet_docx:['docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document'],packet_data:['json','application/json'],review:['json','application/json']};
export const PACKET_ARTIFACT_DEFINITION=Object.freeze({name:'register_deliverable',description:'Attach one exact current DFW-rendered file to this case. The server retrieves bounded chunks, verifies the manifest and bytes, derives its filename and storage path, and invokes native file handoff. This is preparation only; it never accepts or submits the packet.',inputSchema:{type:'object',properties:{artifactKey:{type:'string',pattern:'^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'}},required:['artifactKey'],additionalProperties:false}});
export async function readPacketArtifact(a,input,fetch,maxBytes){
 if(a?.kind!=='case-work'||a.role!=='producer'||!object(input)||Object.keys(input).join()!=='artifactKey'||typeof input.artifactKey!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(input.artifactKey)||!Number.isSafeInteger(maxBytes)||maxBytes<1)deny();
 const catalog=await fetch('packet_artifacts',{}),m=catalog?.manifest;
 if(!object(catalog)||catalog.case_binding_id!==a.caseBindingId||catalog.business_complete!==false||m?.schema!=='dfw-packet-machine-manifest-v1'||m.scope?.company_id!==a.companyId||m.scope?.issue_id!==a.issueId||!Number.isSafeInteger(m.packet_version)||m.packet_version<1||typeof m.native_producer_run_id!=='string'||!m.native_producer_run_id||!Array.isArray(m.artifacts)||!Array.isArray(catalog.artifacts)||canonical(m.artifacts)!==canonical(catalog.artifacts)||sha(canonical(m))!==catalog.manifest_hash||new Set(m.artifacts.map(d=>d.key)).size!==m.artifacts.length)deny();
 const read=async key=>{
  const d=m.artifacts.find(d=>d.key===key);if(!d||!/^[a-f0-9]{64}$/.test(d.hash)||!Number.isSafeInteger(d.size_bytes)||d.size_bytes<1||d.size_bytes>maxBytes)deny();
  const bytes=Buffer.alloc(d.size_bytes);let offset=0;
  while(offset<bytes.length){
   const limit=Math.min(131072,bytes.length-offset),chunk=await fetch('packet_artifact_chunk',{manifest_hash:catalog.manifest_hash,artifact_key:key,offset,limit});
   if(!object(chunk)||chunk.manifest_hash!==catalog.manifest_hash||chunk.case_binding_id!==a.caseBindingId||chunk.business_complete!==false||canonical(chunk.artifact)!==canonical(d)||chunk.offset!==offset||!Number.isSafeInteger(chunk.end)||chunk.end!==Math.min(offset+limit,bytes.length)||chunk.next_offset!==(chunk.end===bytes.length?null:chunk.end)||typeof chunk.base64!=='string')deny();
   const part=Buffer.from(chunk.base64,'base64');if(part.length!==chunk.end-offset||part.toString('base64')!==chunk.base64)deny();part.copy(bytes,offset);offset=chunk.end;
  }
  if(sha(bytes)!==d.hash)deny();return{bytes,descriptor:d};
 };
 const packet=await read('packet_data');let canonicalData;try{canonicalData=canonicalPacketData(new TextDecoder('utf-8',{fatal:true}).decode(packet.bytes));}catch{deny();}
 if(sha(canonicalData)!==m.packet_data_hash)deny();
 const selected=input.artifactKey==='packet_data'?packet:await read(input.artifactKey);
 const current=await fetch('packet_artifacts',{});if(canonical(current)!==canonical(catalog))deny();
 const known=Object.hasOwn(files,input.artifactKey),[extension,contentType]=known?files[input.artifactKey]:['bin','application/octet-stream'];return{bytes:selected.bytes,manifestHash:catalog.manifest_hash,filename:input.artifactKey+'.'+extension,contentType,sha256:selected.descriptor.hash,byteSize:selected.bytes.length,artifactKey:input.artifactKey,originalFilenameKnown:false,contentTypeDerivedFrom:known?'canonical_artifact_key':'opaque_bytes',catalog};
}
export async function stagePacketArtifact(workspaceRoot,runId,artifact){
 const fs=await import('node:fs/promises'),path=await import('node:path');
 if(typeof workspaceRoot!=='string'||!path.isAbsolute(workspaceRoot)||!/^[a-f0-9-]{36}$/.test(runId))deny();
 const root=await fs.realpath(workspaceRoot);if(root!==path.resolve(workspaceRoot))deny();
 const relative='.inertia-packet-'+runId,dir=path.join(root,relative);await fs.mkdir(dir,{mode:0o700}).catch(e=>{if(e.code!=='EEXIST')throw e;});
 const st=await fs.lstat(dir);if(!st.isDirectory()||st.isSymbolicLink()||await fs.realpath(dir)!==dir)deny();
 const filename=artifact.manifestHash+'-'+artifact.filename,absolute=path.join(dir,filename);await fs.writeFile(absolute,artifact.bytes,{flag:'wx',mode:0o600}).catch(e=>{if(e.code!=='EEXIST')throw e;});
 return{input:{idempotencyKey:'packet:'+artifact.manifestHash+':'+artifact.artifactKey,filename:artifact.filename,contentType:artifact.contentType,byteSize:artifact.byteSize,sha256:artifact.sha256,contentRef:relative+'/'+filename,title:'Prepared funding '+artifact.artifactKey},cleanup:async()=>{await fs.unlink(absolute).catch(()=>{});await fs.rmdir(dir).catch(()=>{});}};
}
export function assertPacketArtifactCurrent(artifact,current){if(canonical(current)!==canonical(artifact.catalog))deny();}

/** DFW writes both artifact JSON and canonical JSON with Python json.dumps.
 * Preserve its validated numeric tokens (0.0, large integers, exponent spelling)
 * instead of rounding through JavaScript Number while ordering object keys. */
export function canonicalPacketData(text){
 class NumberToken{constructor(source){this.source=source;}}
 const parsed=JSON.parse(text,function(_key,value,context){if(typeof value!=='number')return value;if(typeof context?.source!=='string')deny();return new NumberToken(context.source);});
 const compare=(a,b)=>{const x=[...a],y=[...b];for(let i=0;i<Math.min(x.length,y.length);i++){const d=x[i].codePointAt(0)-y[i].codePointAt(0);if(d)return d;}return x.length-y.length;};
 const encode=value=>value instanceof NumberToken?value.source:Array.isArray(value)?'['+value.map(encode).join(',')+']':object(value)?'{'+Object.keys(value).sort(compare).map(k=>JSON.stringify(k)+':'+encode(value[k])).join(',')+'}':JSON.stringify(value);
 return encode(parsed);
}
