import {expect,it} from 'vitest';
import {dfwFixture} from '../dfw-fixture.js';
import {mkdtemp,writeFile,readFile,rm,realpath} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {validatePacketArtifacts,validatePacketArtifactChunk} from '../../src/case-work/artifacts.js';
const {enabled,backend,python}=dfwFixture();
it.skipIf(!enabled)('accepts actual DFW generated DOCX, markdown and final field payload through exact-manifest chunks',{timeout:60000},async()=>{
 const dir=await realpath(await mkdtemp(join(tmpdir(),'packet-artifacts-cold-')));
 try{
  const script=join(dir,'fixture.py'),output=join(dir,'packet.json');
  await writeFile(script,[
   'import sys,json,pytest','from pathlib import Path','sys.path[:0]=['+JSON.stringify(backend+'/src')+','+JSON.stringify(backend+'/tests')+']',
   'from test_native_packet import fixture','from test_public_drafting import payload','from dfw_incentives.native_packet import producer_packet_artifact_chunk,producer_packet_artifacts,regenerate',
   'with pytest.MonkeyPatch.context() as monkeypatch:',
   ' db,public,service,binding,_,_,_=fixture(Path(sys.argv[1]),monkeypatch)',
   ' workspace=public.workspace()',' proposal=payload(workspace.to_dict())',' public.save(workspace.workspace_hash,[proposal])',' regenerate(public,service,binding)',
   " packet={**producer_packet_artifacts(public,binding),'case_binding_id':'binding','business_complete':False}",
   ' chunks={}'," for artifact in packet['artifacts']:","  chunks[artifact['key']]=[];offset=0",'  while True:',
   "   chunk={**producer_packet_artifact_chunk(public,binding,manifest_hash=packet['manifest_hash'],artifact_key=artifact['key'],offset=offset),'case_binding_id':'binding','business_complete':False}",
   "   chunks[artifact['key']].append(chunk)","   if chunk['next_offset'] is None:break","   offset=chunk['next_offset']",
   " Path(sys.argv[2]).write_text(json.dumps({'packet':packet,'chunks':chunks,'expected':proposal['value']}))"
  ].join('\n'));
  const built=spawnSync(python,[script,dir,output],{encoding:'utf8'});expect(built.status,built.stderr).toBe(0);
  const fixture=JSON.parse(await readFile(output,'utf8')),packet=fixture.packet;
  const verified=validatePacketArtifacts(packet,{companyId:'company',issueId:packet.manifest.scope.issue_id,caseBindingId:'binding'});
  expect(verified.manifest_hash).toBe(packet.manifest_hash);
  const bytes=new Map<string,Buffer>();
  for(const artifact of packet.artifacts){
   const bodies=[];
   for(const chunk of fixture.chunks[artifact.key]){validatePacketArtifactChunk(chunk,{manifest_hash:packet.manifest_hash,artifact_key:artifact.key,offset:chunk.offset},'binding');bodies.push(Buffer.from(chunk.base64,'base64'));}
   const body=Buffer.concat(bodies);expect(createHash('sha256').update(body).digest('hex')).toBe(artifact.hash);bytes.set(artifact.key,body);
  }
  expect(bytes.get('application_packet_markdown')!.toString('utf8')).toContain(fixture.expected);
  expect(bytes.get('application_packet_docx')!.subarray(0,2).toString()).toBe('PK');
  expect(JSON.parse(bytes.get('packet_data')!.toString('utf8')).final_field_payload.fields[0].value).toBe(fixture.expected);
 }finally{await rm(dir,{recursive:true,force:true});}
});
