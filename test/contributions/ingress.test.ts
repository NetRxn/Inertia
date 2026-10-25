import {afterEach,describe,expect,it} from 'vitest';
import {createServer,request as httpRequest,type Server} from 'node:http';
import {createHash} from 'node:crypto';
import {createContributionIngress} from '../../src/contributions/ingress.js';
import {createContributionBoundary} from '../../src/contributions/service.js';
import type {Candidate,Enrollment} from '../../src/contributions/contracts.js';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const servers:Server[]=[];
afterEach(async()=>{await Promise.all(servers.splice(0).map(s=>new Promise<void>(r=>{s.closeAllConnections();s.close(()=>r());})));});
async function fixture(options:Record<string,unknown>={}) {
 const e:Enrollment={enabled:true,active:true,memberId:'member-1',agentId:'agent-1',authorityEpoch:'epoch-1',companyId:'company-1',projectId:'project-1',issueId:'issue-1',taskRevision:'revision-1',runId:'run-1',checkoutRunId:'run-1',providerLeaseId:'lease-1',lifecycleGeneration:'generation-1',lifecycleDisposition:'active',enrollmentRevision:'enrollment-1',expiresAt:Date.now()+60000,dataClass:'approved-public',artifactClass:'text-evidence',input:'Curated public input only'};
 const candidates=new Map<string,Candidate>();let calls=0,authCalls=0;
 const boundary=createContributionBoundary({enabled:()=>true,clock:Date.now,loadEnrollment:async()=>{calls++;return e;},readNative:async()=>{calls++;return {...e,running:true};},journal:{get:async(id)=>{calls++;return candidates.get(id)??null;},put:async c=>{calls++;if(!candidates.has(c.operationId))candidates.set(c.operationId,c);}}});
 const handler=createContributionIngress({enabled:()=>true,boundary,authenticate:async()=>{authCalls++;return {state:'authenticated' as const,actor:{memberId:e.memberId,agentId:e.agentId,authorityEpoch:e.authorityEpoch}};},...options});
 const server=createServer((req,res)=>{void handler(req,res);});servers.push(server);await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const address=server.address();if(!address||typeof address==='string')throw Error('No HTTP address');
 const url=`http://127.0.0.1:${address.port}`;
 const post=(path:string,body:unknown,headers:Record<string,string>={})=>fetch(url+path,{method:'POST',headers:{'content-type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)});
 return {e,url,post,boundary,candidates,calls:()=>calls,authCalls:()=>authCalls};
}
const artifact=(text='Untrusted evidence')=>({name:'evidence.txt',mediaType:'text/plain',text,sha256:hash(text)});

describe('bounded candidate-only HTTP ingress',()=>{
 it('disabled and unconfigured return before auth or source access',async()=>{
  for(const opts of [{enabled:()=>false},{authenticate:undefined},{boundary:undefined}]) {
   const f=await fixture(opts);expect((await f.post('/export',{issueId:'issue-1'})).status).toBe(503);expect(f.calls()).toBe(0);expect(f.authCalls()).toBe(0);
  }
 });
 it('exports curated input and preserves immutable submit retry/conflict semantics',async()=>{
  const f=await fixture();const input=await (await f.post('/export',{issueId:'issue-1'})).json();expect(input.input).toBe('Curated public input only');expect(input.binding.authorityEpoch).toBe('epoch-1');
  const body={binding:input.binding,artifacts:[artifact()]};const response=await f.post('/submit',body);expect(response.status).toBe(200);const result=await response.json();expect(result.state).toBe('candidate-for-review');
  expect(await (await f.post('/submit',body)).json()).toEqual(result);expect((await f.post('/submit',{...body,artifacts:[artifact('changed')]})).status).toBe(409);expect(f.candidates.size).toBe(1);
 });
 it('never derives authenticated actor from request fields or changed bindings',async()=>{
  const f=await fixture();for(const key of ['memberId','agentId','authorityEpoch','actor','companyId'])expect((await f.post('/export',{issueId:'issue-1',[key]:'forged'})).status).toBe(400);
  expect(f.authCalls()).toBe(0);const input=await (await f.post('/export',{issueId:'issue-1'})).json();expect((await f.post('/submit',{binding:{...input.binding,memberId:'member-2'},artifacts:[artifact()]})).status).toBe(403);
 });
 it('rejects aliases, queries, malformed JSON, media encodings, unknown fields and invalid UTF-8 before auth',async()=>{
  const f=await fixture();for(const path of ['/export/','/export?issueId=issue-1','/other'])expect((await f.post(path,{issueId:'issue-1'})).status).toBe(path==='/other'?404:400);
  expect((await fetch(f.url+'/export')).status).toBe(405);
  for(const body of ['{','null','[]','{"issueId":""}','{"issueId":"issue-1","extra":true}'])expect((await f.post('/export',body)).status).toBe(400);
  expect((await f.post('/export','{}',{'content-encoding':'gzip'})).status).toBe(415);expect((await f.post('/export','{}',{'content-type':'text/plain'})).status).toBe(415);
  const invalid=await fetch(f.url+'/export',{method:'POST',headers:{'content-type':'application/json'},body:Uint8Array.of(0xff)});expect(invalid.status).toBe(400);expect(f.authCalls()).toBe(0);
 });
 it('bounds declared and streaming bytes without processing authority',async()=>{
  const f=await fixture();expect((await f.post('/export','x'.repeat(1024*1024+1))).status).toBe(413);
  const status=await new Promise<number>((resolve,reject)=>{const q=httpRequest(f.url+'/export',{method:'POST',headers:{'content-type':'application/json'}},r=>{r.resume();r.on('end',()=>resolve(r.statusCode!));});q.on('error',reject);for(let i=0;i<17;i++)q.write('x'.repeat(65536));q.end();});expect(status).toBe(413);expect(f.calls()).toBe(0);expect(f.authCalls()).toBe(0);
 });
 it('rejects duplicate content type and previously parsed bodies',async()=>{
  const f=await fixture();const status=await new Promise<number>((resolve,reject)=>{const q=httpRequest(f.url+'/export',{method:'POST',headers:['Content-Type','application/json','Content-Type','application/json']},r=>{r.resume();r.on('end',()=>resolve(r.statusCode!));});q.on('error',reject);q.end('{"issueId":"issue-1"}');});expect(status).toBe(400);expect(f.authCalls()).toBe(0);
 });
 it('fails closed on unavailable authentication and boundary exceptions',async()=>{
  for(const authenticate of [async()=>({state:'unavailable' as const}),async()=>{throw Error('do not expose secret');}]){const f=await fixture({authenticate});const response=await f.post('/export',{issueId:'issue-1'});expect(response.status).toBe(503);expect(JSON.stringify(await response.json())).not.toContain('secret');expect(f.calls()).toBe(0);}
 });
});

it('rechecks disablement after body buffering and after boundary work',async()=>{
 let enabled=true;const f=await fixture({enabled:()=>enabled});
 const pending=new Promise<number>((resolve,reject)=>{const q=httpRequest(f.url+'/export',{method:'POST',headers:{'content-type':'application/json'}},r=>{r.resume();r.on('end',()=>resolve(r.statusCode!));});q.on('error',reject);q.write('{"issueId":');enabled=false;q.end('"issue-1"}');});
 expect(await pending).toBe(503);expect(f.authCalls()).toBe(0);
 enabled=true;const g=await fixture({enabled:()=>enabled,boundary:{exportInput:async()=>{enabled=false;return {state:'input',input:'must not escape'};},submit:async()=>({state:'denied'})}});
 const response=await g.post('/export',{issueId:'issue-1'});expect(response.status).toBe(503);expect(JSON.stringify(await response.json())).not.toContain('must not escape');
});

it('rejects a preceding parser instead of accepting its object',async()=>{
 let authCalls=0;const handler=createContributionIngress({enabled:()=>true,authenticate:async()=>{authCalls++;return {state:'denied'};},boundary:{exportInput:async()=>({state:'denied'}),submit:async()=>({state:'denied'})}});
 const server=createServer((req,res)=>{Object.assign(req,{body:{issueId:'issue-1'}});void handler(req,res);});servers.push(server);await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const a=server.address();if(!a||typeof a==='string')throw Error();
 const result=await fetch(`http://127.0.0.1:${a.port}/export`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});expect(result.status).toBe(503);expect(authCalls).toBe(0);
});

it('bounds a slow body and never processes an aborted stream',async()=>{
 const f=await fixture();const response=new Promise<number>((resolve,reject)=>{const q=httpRequest(f.url+'/export',{method:'POST',headers:{'content-type':'application/json'}},r=>{r.resume();r.on('end',()=>resolve(r.statusCode!));});q.on('error',reject);q.write('{');});
 expect(await response).toBe(408);expect(f.authCalls()).toBe(0);
 const q=httpRequest(f.url+'/export',{method:'POST',headers:{'content-type':'application/json'}});q.on('error',()=>{});q.write('{');q.destroy();await new Promise(r=>setTimeout(r,20));expect(f.authCalls()).toBe(0);
},15000);
