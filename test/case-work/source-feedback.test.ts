import {expect,it} from 'vitest';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createHash} from 'node:crypto';
import {createBoundedContextBridge} from '../../src/bridge/duplex.js';
async function rejected(frame:unknown,op='source_propose'){
 const cwd=await mkdtemp(join(tmpdir(),'case-source-feedback-')),entrypoint=join(cwd,'child.cjs'),configurationPath=join(cwd,'config.json');
 try{
  await writeFile(entrypoint,`console.log(JSON.stringify(${JSON.stringify(frame)}));`);await writeFile(configurationPath,'{}');
  const pins=await Promise.all([entrypoint,configurationPath].map(async path=>({path,sha256:createHash('sha256').update(await readFile(path)).digest('hex')})));
  const result=await createBoundedContextBridge({cwd,entrypoint,configurationPath,executable:process.execPath,args:[entrypoint,configurationPath],pins,timeoutMs:2000,maxOutputBytes:8192},'dfw-native-case-work-v1').call(op,{}, {context:async()=>({})}).catch(error=>error);
  if(!(result instanceof Error))throw Error('Expected source protocol rejection');
  return result;
 }finally{await rm(cwd,{recursive:true,force:true});}
}
const failure={type:'result',ok:false,error:'case_source_validation_failed',details:{issues:[{path:['fields',0,'evidence',0,'source_document_id'],code:'missing'}],truncated:false}};
it('preserves only finite source-schema correction paths in source facade errors',async()=>{
 expect((await rejected(failure)).message).toContain('case_source_validation_failed');
 expect((await rejected(failure)).message).toContain('source_document_id');
 for(const frame of [{...failure,details:{...failure.details,issues:[{path:['PRIVATE-CANARY'],code:'missing'}]}},{...failure,details:{...failure.details,issues:[{path:['fields'],code:'missing',input:'PRIVATE-CANARY'}]}},{...failure,details:{...failure.details,issues:[{path:['fields'],code:'PRIVATE-CANARY'}]}}])expect((await rejected(frame)).message).toBe('DFW drafting rejected request');
 expect((await rejected(failure,'save')).message).toBe('DFW drafting rejected request');
});
