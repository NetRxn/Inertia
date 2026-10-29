import {expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import {registerCaseWork,type CaseWorkBinding} from '../../src/case-work/host.js';
const sha=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
const canonical=(v:any):string=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
function packet(large=false){
 const files=[['application_packet_markdown','markdown',large?'Useful source-grounded text\n'.repeat(200000):'# Useful prepared application'],['application_packet_docx','docx','fictional unit-test binary bytes'],['packet_data','json','{"submission":"not_submitted"}'],['review','json','{"status":"machine_reviewed"}']];
 const artifacts=files.map(([key,type,body])=>({key:key!,type:type!,hash:sha(body!),size_bytes:Buffer.byteLength(body!),placeholders:[]}));
 const manifest={schema:'dfw-packet-machine-manifest-v1',scope:{company_id:'company',issue_id:'case',applicant_id:'applicant',opportunity_namespace:'program',opportunity_external_id:'one'},packet_id:'packet',packet_version:1,packet_data_hash:artifacts[2]!.hash,artifacts,coverage_targets:['section:sponsor_answers',...files.map(v=>'artifact:'+v[0]),'cross_section_consistency'],native_producer_run_id:'render-run'};
 const catalog={manifest,manifest_hash:sha(canonical(manifest)),artifacts:structuredClone(artifacts),case_binding_id:'binding',business_complete:false};
 const chunk=(key:string,offset=0,limit=131072)=>{const index=artifacts.findIndex(row=>row.key===key),body=Buffer.from(files[index]![2]!),end=Math.min(body.length,offset+limit);return {manifest_hash:catalog.manifest_hash,artifact:structuredClone(artifacts[index]),offset,end,next_offset:end<body.length?end:null,base64:body.subarray(offset,end).toString('base64'),case_binding_id:'binding',business_complete:false};};
 return {catalog,chunk};
}
function fixture(value:any){
 let handler:any;const issue:any={id:'case',companyId:'company',projectId:'cases',parentId:'root',assigneeAgentId:'beta',status:'in_progress',executionRunId:'producer-run',originKind:'manual',originId:'paperclip-runner:create-task:root:case:binding'},root:any={id:'root',companyId:'company',projectId:'portfolio',status:'in_progress'};
 const ctx:any={tools:{register:(_n:any,_d:any,fn:any)=>handler=fn},issues:{get:async(id:string)=>id==='case'?issue:root,getSubtree:async(id:string)=>({companyId:'company',rootIssueId:id,issues:[root,issue],issueIds:['root','case'],activeRuns:{case:[{id:'producer-run',issueId:'case',agentId:'beta',status:'running',finishedAt:null}]},assignees:{beta:{id:'beta',status:'running'}}})}};
 const binding:CaseWorkBinding={companyId:'company',researchProjectId:'research',projectId:'cases',rootIssueId:'root',rootProjectId:'portfolio',applicantSlug:'dao',researcher:{agentId:'alpha',principalId:'a'},producer:{agentId:'beta',principalId:'b'},reviewer:{agentId:'charlie',principalId:'c'},policyRevision:'v1',authorize:async()=>true,bridge:{call:async(op,params,callbacks)=>{await callbacks.context();await callbacks.caseTask!({case_binding_id:'binding'});return typeof value==='function'?value(op,params):value;}}};
 registerCaseWork(ctx,[binding],{own:async(_s:any,fn:any)=>fn()});
 return (operation='packet_artifacts',parameters={})=>handler({operation,parameters},{companyId:'company',projectId:'cases',agentId:'beta',runId:'producer-run'});
}
it('lists exact current artifact descriptors without imposing a total 4MiB packet cap',async()=>{
 const {catalog}=packet(true),result=await fixture(catalog)();expect(result.data.artifacts).toHaveLength(4);expect(result.data.artifacts[0].size_bytes).toBeGreaterThan(4*1024*1024);expect(result.data.artifacts[0].base64).toBeUndefined();expect(result.data.manifest.scope.issue_id).toBe('case');expect(result.data.attachments).toBeUndefined();
});
it.each(['manifest','scope','missing','size','duplicate'])('rejects corrupted catalog %s before native transfer',async(kind)=>{
 const {catalog:v}=packet();if(kind==='manifest')v.manifest_hash='a'.repeat(64);if(kind==='scope'){v.manifest.scope.issue_id='foreign';v.manifest_hash=sha(canonical(v.manifest));}if(kind==='missing')v.artifacts.pop();if(kind==='size')v.artifacts[0]!.size_bytes+=1;if(kind==='duplicate')v.artifacts[1]!.key=v.artifacts[0]!.key;
 await expect(fixture(v)()).rejects.toThrow();
});
it('returns exact bounded chunks and an empty EOF page under the selected manifest',async()=>{
 const p=packet(true),key='application_packet_markdown',call=fixture((_op:string,params:any)=>p.chunk(key,params.offset,params.limit));
 const start=await call('packet_artifact_chunk',{manifest_hash:p.catalog.manifest_hash,artifact_key:key,offset:0,limit:196608});expect(Buffer.from(start.data.base64,'base64').length).toBe(196608);expect(start.data.next_offset).toBe(196608);
 const size=p.catalog.artifacts[0]!.size_bytes,last=await call('packet_artifact_chunk',{manifest_hash:p.catalog.manifest_hash,artifact_key:key,offset:size});expect(last.data.base64).toBe('');expect(last.data.next_offset).toBeNull();
});
it.each(['hash','key','offset','end','next','base64','size','case'])('rejects wrong chunk %s before native reconstruction',async(kind)=>{
 const p=packet(true),key='application_packet_markdown',v:any=p.chunk(key,0,100);
 if(kind==='hash')v.manifest_hash='a'.repeat(64);if(kind==='key')v.artifact.key='review';if(kind==='offset')v.offset=1;if(kind==='end')v.end=50;if(kind==='next')v.next_offset=null;if(kind==='base64')v.base64+='\n';if(kind==='size')v.artifact.size_bytes=50;if(kind==='case')v.case_binding_id='foreign';
 await expect(fixture(v)('packet_artifact_chunk',{manifest_hash:p.catalog.manifest_hash,artifact_key:key,offset:0,limit:100})).rejects.toThrow();
});
it('rejects caller paths and unbounded or malformed chunk selectors',async()=>{
 const p=packet();let calls=0;const call=fixture(()=>{calls++;throw Error('Transport should not be called');});await expect(call('packet_artifacts',{path:'/private/data'})).rejects.toThrow();
 const valid={manifest_hash:p.catalog.manifest_hash,artifact_key:'review',offset:0};
 for(const params of [{...valid,limit:196609},{...valid,limit:0},{...valid,offset:-1},{...valid,limit:null},{...valid,path:'/tmp/file'},{...valid,manifest_hash:'bad'}])await expect(call('packet_artifact_chunk',params)).rejects.toThrow();expect(calls).toBe(0);
});
