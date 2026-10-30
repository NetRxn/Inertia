import {createHash,randomUUID} from 'node:crypto';
import {describe,expect,it} from 'vitest';
import {registerCaseWork,type CaseWorkBinding} from '../../src/case-work/host.js';
const sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
function rendered(body:string){return {state:'preliminary_rendered',case_binding_id:'binding-a',business_complete:false,readiness_admitted:false,draft_markdown:body,artifacts:[{key:'preliminary_markdown',type:'preliminary_markdown',hash:sha(body),size_bytes:Buffer.byteLength(body),base64:Buffer.from(body).toString('base64'),readiness_admitted:false}]};}
function fixture(body='UNREVIEWED\n\n'+('A complete funding draft — κόσμος.\n'.repeat(1200))){
 const docs=new Map<string,any>(),tools=new Map<string,any>();let authorized=true,lostAck=false;
 const rows:any[]=[{id:'root',companyId:'company',projectId:'P',status:'in_progress',assigneeAgentId:'co'},{id:'case-a',companyId:'company',projectId:'Q',parentId:'root',status:'in_progress',assigneeAgentId:'beta',executionRunId:'run-a',originKind:'manual',originId:'paperclip-runner:create-task:root:case:binding-a'}];
 const ctx:any={tools:{register:(n:string,_d:any,f:any)=>tools.set(n,f)},issues:{get:async(id:string)=>rows.find(r=>r.id===id)??null,getSubtree:async(id:string)=>({companyId:'company',rootIssueId:id,issues:rows,issueIds:rows.map(r=>r.id),activeRuns:{'case-a':[{id:'run-a',issueId:'case-a',agentId:'beta',status:'running',finishedAt:null}]},assignees:{beta:{id:'beta',status:'running'}}}),documents:{list:async(id:string)=>[...docs.values()].filter(d=>d.issueId===id),get:async(id:string,k:string)=>docs.get(id+':'+k)??null,upsert:async(v:any)=>{if(docs.has(v.issueId+':'+v.key))throw Error('baseRevisionId required');const d={...v,id:randomUUID(),latestRevisionId:randomUUID(),latestRevisionNumber:1};docs.set(v.issueId+':'+v.key,d);if(lostAck){lostAck=false;throw Error('ack lost');}return d;}}}};
 let value:any=rendered(body);
 const b:CaseWorkBinding={companyId:'company',researchProjectId:'R',projectId:'Q',rootIssueId:'root',rootProjectId:'P',applicantSlug:'dao',researcher:{agentId:'alpha',principalId:'a'},producer:{agentId:'beta',principalId:'b'},reviewer:{agentId:'charlie',principalId:'c'},policyRevision:'v1',authorize:async()=>authorized,bridge:{call:async(_op,_p,callbacks)=>{await callbacks.context();return value;}}};
 registerCaseWork(ctx,[b],{own:async(_s:any,fn:any)=>fn()});
 return {docs,ctx,rows,body,b,setValue:(v:any)=>value=v,revoke:()=>authorized=false,loseAck:()=>lostAck=true,invoke:(op='render')=>tools.get('funding_case_work')({operation:op,parameters:{}},{companyId:'company',projectId:'Q',agentId:'beta',runId:'run-a'})};
}
describe('trusted preliminary render publication',()=>{
 it('publishes the entire exact UTF-8 draft as an owned native snapshot and returns actual immutable revision identity',async()=>{
  const f=fixture(),result=await f.invoke(),d=result.data.native_draft_document;
  expect(d).toEqual({contract_version:'inertia-editorial-draft-v1',document_id:expect.any(String),key:expect.stringMatching(/^funding-[a-f0-9]{32}-0000000001$/),revision_id:expect.any(String),revision_number:1,body_sha256:sha(f.body),body_bytes:Buffer.byteLength(f.body),case_binding_id:'binding-a',producer_issue_id:'case-a'});
  expect(f.docs.get('case-a:'+d.key)).toMatchObject({id:d.document_id,latestRevisionId:d.revision_id,body:f.body,issueId:'case-a',companyId:'company'});
  expect(result.data.business_complete).toBe(false);expect(result.data.readiness_admitted).toBe(false);expect(f.rows[1].status).toBe('in_progress');
 });
 it('reuses the same body snapshot across replay and a lost create acknowledgement; changed bodies preserve history',async()=>{
  const f=fixture();f.loseAck();await expect(f.invoke()).rejects.toThrow('ack lost');const first=(await f.invoke()).data.native_draft_document;
  expect((await f.invoke()).data.native_draft_document).toEqual(first);expect(f.docs.size).toBe(1);
  const changed=f.body+'\nA new supported correction.\n';f.setValue(rendered(changed));const second=(await f.invoke()).data.native_draft_document;
  expect(second.key).toMatch(/0000000002$/);expect(second.body_sha256).toBe(sha(changed));expect(f.docs.get('case-a:'+first.key).body).toBe(f.body);expect(f.docs.size).toBe(2);
 });
 it.each(['hash','size','bytes','readiness','duplicate','foreign','forged'])('withholds a misleading draft descriptor (%s) before document publication',async(kind)=>{
  const f=fixture(),v:any=rendered(f.body);
  if(kind==='hash')v.artifacts[0].hash='f'.repeat(64);if(kind==='size')v.artifacts[0].size_bytes++;
  if(kind==='bytes')v.artifacts[0].base64=Buffer.from('foreign bytes').toString('base64');if(kind==='readiness')v.readiness_admitted=true;
  if(kind==='duplicate')v.artifacts.push({...v.artifacts[0]});if(kind==='foreign')v.case_binding_id='binding-b';if(kind==='forged')v.native_draft_document={document_id:'foreign'};
  f.setValue(v);await expect(f.invoke()).rejects.toThrow();expect(f.docs.size).toBe(0);
 });
 it('preserves selected render behavior and never publishes non-render responses',async()=>{
  const f=fixture();f.setValue({case_binding_id:'binding-a',business_complete:false,result:{state:'selected_rendered'}});expect((await f.invoke()).data.native_draft_document).toBeUndefined();
  f.setValue(rendered(f.body));expect((await f.invoke('workspace')).data.native_draft_document).toBeUndefined();expect(f.docs.size).toBe(0);
 });
 it('denies configuration revocation after domain execution without publishing',async()=>{
  const f=fixture();f.b.bridge.call=async()=>{f.revoke();return rendered(f.body);};await expect(f.invoke()).rejects.toThrow('configuration changed');expect(f.docs.size).toBe(0);
 });
});
it('never returns a descriptor for foreign, changed or mutable document readback',async()=>{
 for(const patch of [{companyId:'foreign'},{issueId:'case-b'},{body:'truncated draft'},{latestRevisionNumber:0},{latestRevisionId:null}]){
  const f=fixture(),get=f.ctx.issues.documents.get;f.ctx.issues.documents.get=async(...args:any[])=>{const d=await get(...args);return d?{...d,...patch}:null;};
  await expect(f.invoke()).rejects.toThrow('Exact preliminary draft document unavailable');
 }
});
it('withholds publication evidence if assignment changes during a native document write',async()=>{
 const f=fixture(),upsert=f.ctx.issues.documents.upsert;f.ctx.issues.documents.upsert=async(v:any)=>{const d=await upsert(v);f.rows[1].assigneeAgentId='foreign';return d;};
 const outcome=await f.invoke().then(()=>false,()=>true);expect(outcome).toBe(true);expect(f.docs.size).toBe(1);expect([...f.docs.values()][0].body).toBe(f.body);
});
it('fails an oversized native snapshot explicitly instead of publishing a truncated review subject',async()=>{
 const f=fixture('UNREVIEWED\n'+'x'.repeat(524288));const rejected=await f.invoke().then(()=>false,()=>true);expect(rejected).toBe(true);expect(f.docs.size).toBe(0);
});

it('retains byte-identical document revision continuity without changing the review body identity',async()=>{
 const f=fixture(),first=(await f.invoke()).data.native_draft_document,doc=f.docs.get('case-a:'+first.key);
 doc.latestRevisionId=randomUUID();doc.latestRevisionNumber=2;
 const same=(await f.invoke()).data.native_draft_document;
 expect(same.body_sha256).toBe(first.body_sha256);expect(same.document_id).toBe(first.document_id);expect(same.revision_id).toBe(doc.latestRevisionId);expect(same.revision_number).toBe(2);expect(f.docs.size).toBe(1);
});
