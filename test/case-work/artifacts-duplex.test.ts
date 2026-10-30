import {expect,it} from 'vitest';
import {mkdtemp,writeFile,readFile,rm,realpath} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {createBoundedContextBridge} from '../../src/bridge/duplex.js';
import {validatePacketArtifacts,validatePacketArtifactChunk} from '../../src/case-work/artifacts.js';
const backend=process.env.INERTIA_DFW_SOURCE_ROOT??'/tmp/inertia-delivery-20261028/dfw/government-funding-dfw';
const python=process.env.INERTIA_DFW_PYTHON??'/Users/johnroehm/Programming/PythonEnvironments/DFW-Gov-Fund/DFW-Gov-Fund/government-funding-dfw/.venv/bin/python';
it('real exact-case Python duplex transfers a current attachment above 4MiB through manifest-pinned chunks',{timeout:120000},async()=>{
 const dir=await realpath(await mkdtemp(join(tmpdir(),'packet-chunk-duplex-')));
 try{
  const built=spawnSync(python,[fileURLToPath(new URL('./packet-large-fixture.py',import.meta.url)),backend,dir],{encoding:'utf8'});expect(built.status,built.stderr).toBe(0);
  const meta=JSON.parse(await readFile(join(dir,'metadata.json'),'utf8')),entrypoint=join(dir,'entry.py'),configurationPath=join(dir,'case-config.json');
  await writeFile(entrypoint,'import sys\nsys.path.insert(0,'+JSON.stringify(backend+'/src')+')\nfrom dfw_incentives.native_case_work_stdio import main\nmain()\n');
  const pins=await Promise.all([entrypoint,configurationPath].map(async path=>({path,sha256:createHash('sha256').update(await readFile(path)).digest('hex')})));
  const bridge=createBoundedContextBridge<any>({executable:python,args:[entrypoint,'--config',configurationPath],entrypoint,configurationPath,cwd:dir,pins,timeoutMs:30000,maxOutputBytes:1048576},'dfw-native-case-work-v1');
  const callbacks={context:async()=>meta.actor,caseTask:async()=>meta.task};
  const catalog:any=await bridge.call('packet_artifacts',{},callbacks);
  validatePacketArtifacts(catalog,{companyId:meta.actor.company_id,issueId:meta.actor.issue_id,caseBindingId:meta.actor.case_binding_id});
  const artifact=catalog.artifacts.find((row:any)=>row.key==='supporting_document');expect(artifact.size_bytes).toBeGreaterThan(4*1024*1024);
  const pages:Buffer[]=[];let offset=0;
  while(true){
   const selectors={manifest_hash:catalog.manifest_hash,artifact_key:artifact.key,offset,limit:196608};
   const part:any=await bridge.call('packet_artifact_chunk',selectors,callbacks);validatePacketArtifactChunk(part,selectors,meta.actor.case_binding_id);expect(part.artifact).toEqual(artifact);
   pages.push(Buffer.from(part.base64,'base64'));if(part.next_offset===null)break;offset=part.next_offset;
  }
  const body=Buffer.concat(pages);expect(body.length).toBe(meta.size);expect(createHash('sha256').update(body).digest('hex')).toBe(meta.hash);
  const after:any=await bridge.call('packet_artifacts',{},callbacks);expect(after.manifest_hash).toBe(catalog.manifest_hash);
  await expect(bridge.call('packet_artifact_chunk',{manifest_hash:'f'.repeat(64),artifact_key:artifact.key,offset:0},callbacks)).rejects.toThrow();
 }finally{await rm(dir,{recursive:true,force:true});}
});
