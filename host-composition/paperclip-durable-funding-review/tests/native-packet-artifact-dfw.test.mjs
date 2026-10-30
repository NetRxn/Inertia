/** Actual DFW rendered/registered bytes through the actual bounded duplex protocol. */
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {pathToFileURL} from 'node:url';
import {readPacketArtifact} from '../transport/native/native-packet-artifact-handoff.mjs';
const fixture=process.env.INERTIA_DFW_ARTIFACT_FIXTURE,host=process.env.INERTIA_HOST_SOURCE;
test('actual DFW canonical artifacts and large attachment pass native chunk integrity without total caps',async()=>{
 assert(fixture&&host,'explicit isolated DFW fixture and matching host source required');
 const processConfig=JSON.parse(await fs.readFile(fixture+'/process.json')),metadata=JSON.parse(await fs.readFile(fixture+'/metadata.json'));
 const{createBoundedContextBridge}=await import(pathToFileURL(host+'/src/bridge/duplex.ts'));
 const bridge=createBoundedContextBridge(processConfig,'dfw-native-case-work-v1'),fetch=(operation,parameters)=>bridge.call(operation,parameters,{context:async()=>metadata.actor,caseTask:async()=>metadata.task});
 const a=metadata.actor,admission={kind:'case-work',role:'producer',companyId:a.company_id,issueId:a.issue_id,caseBindingId:a.case_binding_id};
 for(const artifactKey of['application_packet_markdown','application_packet_docx','packet_data','review','supporting_document']){
  const result=await readPacketArtifact(admission,{artifactKey},fetch,10*1024*1024);
  assert(result.byteSize>0);assert.equal(result.catalog.manifest.scope.issue_id,a.issue_id);
  if(artifactKey==='supporting_document'){assert.equal(result.byteSize,metadata.size);assert.equal(result.sha256,metadata.hash);assert.equal(result.filename,'supporting_document.bin');assert.equal(result.contentType,'application/octet-stream');}
 }
});
