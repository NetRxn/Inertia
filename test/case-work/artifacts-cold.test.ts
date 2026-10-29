import {expect,it} from 'vitest';
import {mkdtemp,writeFile,readFile,rm,realpath} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawnSync} from 'node:child_process';
import {validatePacketArtifacts} from '../../src/case-work/artifacts.js';
const backend=process.env.INERTIA_DFW_SOURCE_ROOT??'/tmp/inertia-delivery-20261028/dfw/government-funding-dfw';
const python=process.env.INERTIA_DFW_PYTHON??'/Users/johnroehm/Programming/PythonEnvironments/DFW-Gov-Fund/DFW-Gov-Fund/government-funding-dfw/.venv/bin/python';
it('accepts actual DFW generated DOCX, markdown and final field payload bytes under the exact manifest',{timeout:60000},async()=>{
 const dir=await realpath(await mkdtemp(join(tmpdir(),'packet-artifacts-cold-')));
 try{
  const script=join(dir,'fixture.py'),output=join(dir,'packet.json');
  await writeFile(script,[
   'import sys,json,pytest','from pathlib import Path','sys.path[:0]=['+JSON.stringify(backend+'/src')+','+JSON.stringify(backend+'/tests')+']',
   'from test_native_packet import fixture','from test_public_drafting import payload','from dfw_incentives.native_packet import producer_packet_artifacts,regenerate',
   'with pytest.MonkeyPatch.context() as monkeypatch:',
   ' db,public,service,binding,_,_,_=fixture(Path(sys.argv[1]),monkeypatch)',
   ' workspace=public.workspace()',' proposal=payload(workspace.to_dict())',' public.save(workspace.workspace_hash,[proposal])',' regenerate(public,service,binding)',
   " packet={**producer_packet_artifacts(public,binding),'case_binding_id':'binding','business_complete':False}",
   " Path(sys.argv[2]).write_text(json.dumps({'packet':packet,'expected':proposal['value']}))"
  ].join('\n'));
  const built=spawnSync(python,[script,dir,output],{encoding:'utf8'});expect(built.status,built.stderr).toBe(0);
  const fixture=JSON.parse(await readFile(output,'utf8')),packet=fixture.packet;
  const verified=validatePacketArtifacts(packet,{companyId:'company',issueId:packet.manifest.scope.issue_id,caseBindingId:'binding'});
  expect(verified.manifest_hash).toBe(packet.manifest_hash);
  const markdown=packet.artifacts.find((row:any)=>row.key==='application_packet_markdown');
  expect(Buffer.from(markdown.base64,'base64').toString('utf8')).toContain(fixture.expected);
  const docx=packet.artifacts.find((row:any)=>row.key==='application_packet_docx');expect(Buffer.from(docx.base64,'base64').subarray(0,2).toString()).toBe('PK');
  expect(packet.packet_data.final_field_payload.fields[0].value).toBe(fixture.expected);
 }finally{await rm(dir,{recursive:true,force:true});}
});
