import {it,expect} from 'vitest';
import {dfwFixture} from '../dfw-fixture.js';
const {enabled,backend:root,python:executable}=dfwFixture();
import {mkdtempSync,writeFileSync,readFileSync} from 'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';import{createHash}from'node:crypto';
import{createBoundedContextBridge}from'../../src/bridge/duplex.js';
function bridge(frame:unknown,version='dfw-general-enrichment-v1',authenticate=false) {const cwd=mkdtempSync(join(tmpdir(),'enrichment-feedback-')),entrypoint=join(cwd,'child.cjs'),configurationPath=join(cwd,'config.json');writeFileSync(entrypoint,authenticate?`const r=require("node:readline").createInterface({input:process.stdin});let n=0;r.on("line",()=>{if(++n===1)console.log(JSON.stringify({type:"context",id:1}));else{console.log(JSON.stringify(${JSON.stringify(frame)}));r.close();process.stdin.destroy();}});`:`console.log(JSON.stringify(${JSON.stringify(frame)}));`);writeFileSync(configurationPath,'{}');return createBoundedContextBridge({cwd,entrypoint,configurationPath,executable:process.execPath,args:[entrypoint,configurationPath],timeoutMs:2000,maxOutputBytes:8192,pins:[entrypoint,configurationPath].map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}))},version);}
const frame={type:'result',ok:false,error:'enrichment_validation_failed',details:{issues:[{path:['fields',5,0],code:'dict_type'}],truncated:false}};
it('returns enrichment schema paths before authentication, without accepting extra payload',async()=>{await expect(bridge(frame).call('propose',{}, {context:async()=>{throw Error('No callback');}})).rejects.toThrow('"path":["fields",5,0]');for(const f of [{...frame,private:'CANARY'},{...frame,details:{...frame.details,issues:[{path:['CANARY'],code:'dict_type'}]}},{...frame,details:{...frame.details,issues:[{path:['fields'],code:'CANARY'}]}},{...frame,details:{...frame.details,issues:[{path:['fields'],code:'dict_type',input:'CANARY'}]}}])await expect(bridge(f).call('propose',{}, {context:async()=>({})})).rejects.toThrow(/^DFW drafting rejected request$/);await expect(bridge(frame,'other-version').call('propose',{}, {context:async()=>({})})).rejects.toThrow(/^DFW drafting rejected request$/);});
it.skipIf(!enabled)('cold TypeScript client receives real Python nested-value and wrapper schema errors without source values',async()=>{
 const cwd=mkdtempSync(join(tmpdir(),'enrichment-cold-')),entrypoint=join(root,'src/dfw_incentives/general_enrichment_stdio.py'),configurationPath=join(cwd,'config.json');
 writeFileSync(configurationPath,JSON.stringify({database_url:'sqlite:///:memory:',company_id:'company',applicant_slug:'dao',project_id:'Q',root_issue_id:'root',root_project_id:'P',producer:{agent_id:'a',principal_id:'a'},reviewer:{agent_id:'b',principal_id:'b'},source_registry_path:configurationPath,source_ids:['FED'],raw_root:cwd}));
 const old=process.env.PYTHONPATH;process.env.PYTHONPATH=join(root,'src');
 try{const client=createBoundedContextBridge({cwd,entrypoint,configurationPath,executable,args:[entrypoint,'--config',configurationPath],timeoutMs:10000,maxOutputBytes:8192,pins:[entrypoint,configurationPath].map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}))},'dfw-general-enrichment-v1');const evidence={source_document_id:'doc',start:0,end:1,quote:'PRIVATE-CANARY'},bad={record_id:'record',context_hash:'a'.repeat(64),fields:[{field:'required_artifacts',value:['PRIVATE-CANARY'],evidence:[evidence]}],requirements:[{requirement:{key:'K',sponsor_language:'PRIVATE-CANARY'},evidence}]};
 for(const params of [bad,{'PRIVATE-CANARY':bad}]){const e=await client.call('propose',params,{context:async()=>{throw Error('Schema rejection must precede host callbacks');}}).catch(e=>e);expect(e).toBeInstanceOf(Error);if(!(e instanceof Error))throw Error('Expected typed rejection');expect(e.message).toContain('enrichment_validation_failed');expect(e.message).not.toContain('PRIVATE-CANARY');if(params===bad)expect(e.message).toMatch(/dict_type|model_type/);else expect(e.message).toContain('unsupported_field');}
 }finally{if(old===undefined)delete process.env.PYTHONPATH;else process.env.PYTHONPATH=old;}
});

it('keeps known nested title paths actionable and unknown path names generic',async()=>{const known={...frame,details:{issues:[{path:['fields',0,0,'title'],code:'missing'}],truncated:false}};await expect(bridge(known).call('propose',{}, {context:async()=>({})})).rejects.toThrow('\"title\"');const unknown={...frame,details:{issues:[{path:['fields',0,'PRIVATE-CANARY'],code:'missing'}],truncated:false}};await expect(bridge(unknown).call('propose',{}, {context:async()=>({})})).rejects.toThrow(/^DFW drafting rejected request$/);});
it('preserves safe typed triage selectors without allowing source values in rejection frames',async()=>{
 const typed={...frame,details:{issues:[{path:['scan_hash'],code:'string_pattern_mismatch'}],truncated:false}};
 for(const operation of ['triage_scan','triage_page'])await expect(bridge(typed).call(operation,{}, {context:async()=>({})})).rejects.toThrow('"scan_hash"');
 const injected={...typed,details:{...typed.details,issues:[{path:['scan_hash'],code:'string_pattern_mismatch',input:'PRIVATE-CANARY'}]}};
 await expect(bridge(injected).call('triage_page',{}, {context:async()=>({})})).rejects.toThrow(/^DFW drafting rejected request$/);
});

it('returns only authenticated closed capture diagnostics, never remote content',async()=>{
 const frame={type:'result',ok:false,error:'capture_failed',details:{code:'http_status',http_status:403}};
 await expect(bridge(frame,'dfw-general-enrichment-v1',true).call('capture',{}, {context:async()=>({})})).rejects.toThrow('"http_status":403');
 for(const f of [{...frame,details:{...frame.details,body:'PRIVATE-CANARY'}},{...frame,details:{code:'PRIVATE-CANARY',http_status:403}},{...frame,details:{code:'http_status',http_status:200}}])await expect(bridge(f,'dfw-general-enrichment-v1',true).call('capture',{}, {context:async()=>({})})).rejects.toThrow(/^DFW drafting rejected request$/);
 await expect(bridge(frame).call('capture',{}, {context:async()=>({})})).rejects.toThrow(/^DFW drafting rejected request$/);
 await expect(bridge(frame,'dfw-general-enrichment-v1',true).call('context',{}, {context:async()=>({})})).rejects.toThrow(/^DFW drafting rejected request$/);
});
