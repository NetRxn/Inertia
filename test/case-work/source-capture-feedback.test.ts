import {expect,it} from 'vitest';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {createHash} from 'node:crypto';
import {createBoundedContextBridge} from '../../src/bridge/duplex.js';
async function rejection(frame:unknown,{operation='source_capture',version='dfw-native-case-work-v1',authenticated=true}={}){
 const cwd=await mkdtemp(join(tmpdir(),'source-capture-feedback-')),entrypoint=join(cwd,'entry.cjs'),configurationPath=join(cwd,'config.json');
 try{
  await writeFile(entrypoint,authenticated?`const rl=require('node:readline').createInterface({input:process.stdin});let n=0;rl.on('line',()=>{if(n++===0)console.log(JSON.stringify({type:'context',id:1}));else{console.log(JSON.stringify(${JSON.stringify(frame)}));rl.close();process.stdin.destroy();}});`:`console.log(JSON.stringify(${JSON.stringify(frame)}));`);
  await writeFile(configurationPath,'{}');const pins=await Promise.all([entrypoint,configurationPath].map(async path=>({path,sha256:createHash('sha256').update(await readFile(path)).digest('hex')})));
  const result=await createBoundedContextBridge({executable:process.execPath,args:[entrypoint,configurationPath],entrypoint,configurationPath,cwd,pins,timeoutMs:3000,maxOutputBytes:8192},version).call(operation,{}, {context:async()=>({})}).catch(e=>e);
  expect(result).toBeInstanceOf(Error);return (result as Error).message;
 }finally{await rm(cwd,{recursive:true,force:true});}
}
const finite={type:'result',ok:false,error:'capture_failed',details:{code:'http_status',http_status:403}};
it('only authenticated exact case capture and unchanged general capture retain finite status',async()=>{
 for(const options of [{},{operation:'capture',version:'dfw-general-enrichment-v1'}])expect(await rejection(finite,options)).toBe('DFW drafting rejected request: {"code":"capture_failed","details":{"code":"http_status","http_status":403}}');
 expect(await rejection({...finite,details:{code:'fetch_failed',http_status:null}})).toContain('"code":"fetch_failed","http_status":null');
});
it('wrong operation, protocol and missing authentication remain generic',async()=>{
 for(const options of [{operation:'source_context'},{operation:'capture'},{version:'dfw-general-enrichment-v1'},{version:'unknown'},{authenticated:false}])expect(await rejection(finite,options)).toBe('DFW drafting rejected request');
});
it('capture errors reject raw content and malformed finite details',async()=>{
 for(const frame of [{...finite,private:'PRIVATE-CANARY'},{...finite,details:{...finite.details,url:'https://private.invalid/secret'}},{...finite,details:{...finite.details,body:'PRIVATE-CANARY'}},{...finite,details:{code:'PRIVATE-CANARY',http_status:403}},{...finite,details:{code:'http_status',http_status:200}},{...finite,details:{code:'http_status',http_status:true}},{...finite,details:{code:'http_status',http_status:'403'}},{...finite,details:{code:'http_status',http_status:600}},{...finite,details:{code:'fetch_failed',http_status:403}},{...finite,error:'case_work_rejected'}])expect(await rejection(frame)).toBe('DFW drafting rejected request');
});
