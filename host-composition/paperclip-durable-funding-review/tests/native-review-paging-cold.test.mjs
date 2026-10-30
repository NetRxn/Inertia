/** Real public packet context/artifact views through the pinned reviewer protocol. */
import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs/promises';import os from'node:os';import path from'node:path';import{createHash}from'node:crypto';import{createNativeReviewStdio}from'../transport/native/native-review-stdio.mjs';
const backend=process.env.INERTIA_DFW_ROOT,python=process.env.INERTIA_DFW_PYTHON,fixture=process.env.INERTIA_NATIVE_PAGING_FIXTURE;
test('actual reviewer protocol pages complete large UTF8 and ordered DOCX semantics under one exact binding',{timeout:120000,skip:!(backend&&python&&fixture)},async()=>{
 const f=JSON.parse(await fs.readFile(fixture,'utf8')),dir=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'review-paging-cold-')));
 try{
  const entrypoint=dir+'/entry.py',configurationPath=dir+'/config.json';await fs.writeFile(entrypoint,'import sys\nsys.path.insert(0,'+JSON.stringify(backend+'/src')+')\nfrom dfw_incentives.native_review_stdio import main\nmain()\n');await fs.writeFile(configurationPath,JSON.stringify(f.config),{mode:0o600});
  const pins=await Promise.all([entrypoint,configurationPath].map(async path=>({path,sha256:createHash('sha256').update(await fs.readFile(path)).digest('hex')})));
  const bridge=createNativeReviewStdio({executable:python,args:[entrypoint,'--config',configurationPath],entrypoint,configurationPath,cwd:dir,pins,timeoutMs:30000,maxOutputBytes:1048576}),actor=Object.fromEntries(Object.entries(f.actor).filter(([,v])=>v!==null));let revoked=false;
  const callbacks={context:async()=>{if(revoked)throw Error('reviewer revoked');return actor;},nativeAssignment:async()=>f.assignment};
  const catalog=await bridge.call('context',{},callbacks);assert.equal(catalog.context.packet.delivery,'paged');assert.deepEqual(catalog.binding,f.context.binding);
  const exported={context:catalog,views:{}};
  for(const key of['review','application_packet_docx']){
   let offset=0,semanticHash,descriptor,text='';
   while(true){const result=await bridge.call('artifact_view',{manifest_hash:catalog.binding.manifest_hash,artifact_key:key,offset,limit:32000},callbacks);assert.deepEqual(result.binding,catalog.binding);const v=result.view;if(semanticHash)assert.equal(v.semantic_hash,semanticHash);semanticHash=v.semantic_hash;if(descriptor)assert.deepEqual(v.artifact,descriptor);descriptor=v.artifact;text+=v.text;if(v.next_offset===null){assert.equal([...text].length,v.text_length);break;}offset=v.next_offset;}
   assert.equal(createHash('sha256').update(text).digest('hex'),semanticHash);
   if(key==='review'){assert(descriptor.size_bytes>1048576);assert(text.length>1000000);}else{const doc=JSON.parse(text);assert(doc.blocks.some(b=>b.type==='paragraph'));const table=doc.blocks.find(b=>b.type==='table');assert(table);assert(table.rows.some(row=>row.some(cell=>cell.some(block=>block.type==='table'))));assert.equal(doc.blocks[0].type,'paragraph');assert.equal(doc.blocks.at(-1).type,'paragraph');}
   exported.views[key]={text,semantic_hash:semanticHash,artifact:descriptor,format:key==='application_packet_docx'?'docx_semantic_json':'utf8'};
   const eof=await bridge.call('artifact_view',{manifest_hash:catalog.binding.manifest_hash,artifact_key:key,offset:[...text].length,limit:1},callbacks);assert.equal(eof.view.text,'');assert.equal(eof.view.next_offset,null);
  }
  await assert.rejects(()=>bridge.call('artifact_view',{manifest_hash:'f'.repeat(64),artifact_key:'review'},callbacks));
  await assert.rejects(()=>bridge.call('artifact_view',{manifest_hash:catalog.binding.manifest_hash,artifact_key:'foreign-case-artifact'},callbacks));
  if(process.env.INERTIA_NATIVE_PAGING_EXPORT)await fs.writeFile(process.env.INERTIA_NATIVE_PAGING_EXPORT,JSON.stringify(exported));
  await assert.rejects(()=>bridge.call('artifact_view',{manifest_hash:catalog.binding.manifest_hash,artifact_key:'review'},{...callbacks,context:async()=>({...actor,principal_id:'foreign-principal'})}));
  revoked=true;await assert.rejects(()=>bridge.call('artifact_view',{manifest_hash:catalog.binding.manifest_hash,artifact_key:'review'},callbacks));
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
