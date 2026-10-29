import {expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import {registerCaseWork,type CaseWorkBinding} from '../../src/case-work/host.js';
const sha=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
const canonical=(v:any):string=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
function packet(){
 const packet_data={sponsor_answers:{NARRATIVE:'Applicant-specific grounded response'},submission:'not_submitted'},packet_data_canonical=canonical(packet_data);
 const files=[['application_packet_markdown','markdown','# Useful prepared application'],['application_packet_docx','docx','fictional unit-test binary bytes'],['packet_data','json',packet_data_canonical],['review','json','{"status":"machine_reviewed"}']];
 const artifacts=files.map(([key,type,body])=>({key:key!,type:type!,hash:sha(body!),size_bytes:Buffer.byteLength(body!),placeholders:[],base64:Buffer.from(body!).toString('base64')}));
 const manifest={schema:'dfw-packet-machine-manifest-v1',scope:{company_id:'company',issue_id:'case',applicant_id:'applicant',opportunity_namespace:'program',opportunity_external_id:'one'},packet_id:'packet',packet_version:1,packet_data_hash:sha(packet_data_canonical),artifacts:artifacts.map(({base64,...v})=>v),coverage_targets:['section:sponsor_answers',...files.map(v=>'artifact:'+v[0]),'cross_section_consistency'],native_producer_run_id:'render-run'};
 return{manifest,manifest_hash:sha(canonical(manifest)),packet_data,packet_data_canonical,artifacts,case_binding_id:'binding',business_complete:false};
}
function fixture(value:any){
 let handler:any;const issue:any={id:'case',companyId:'company',projectId:'cases',parentId:'root',assigneeAgentId:'beta',status:'in_progress',executionRunId:'producer-run',originKind:'manual',originId:'paperclip-runner:create-task:root:case:binding'},root:any={id:'root',companyId:'company',projectId:'portfolio',status:'in_progress'};
 const ctx:any={tools:{register:(_n:any,_d:any,fn:any)=>handler=fn},issues:{get:async(id:string)=>id==='case'?issue:root,getSubtree:async(id:string)=>({companyId:'company',rootIssueId:id,issues:[root,issue],issueIds:['root','case'],activeRuns:{case:[{id:'producer-run',issueId:'case',agentId:'beta',status:'running',finishedAt:null}]},assignees:{beta:{id:'beta',status:'running'}}})}};
 const binding:CaseWorkBinding={companyId:'company',researchProjectId:'research',projectId:'cases',rootIssueId:'root',rootProjectId:'portfolio',applicantSlug:'dao',researcher:{agentId:'alpha',principalId:'a'},producer:{agentId:'beta',principalId:'b'},reviewer:{agentId:'charlie',principalId:'c'},policyRevision:'v1',authorize:async()=>true,bridge:{call:async(_op,_params,callbacks)=>{await callbacks.context();await callbacks.caseTask!({case_binding_id:'binding'});return value;}}};
 registerCaseWork(ctx,[binding],{own:async(_s:any,fn:any)=>fn()});
 return (params={})=>handler({operation:'packet_artifacts',parameters:params},{companyId:'company',projectId:'cases',agentId:'beta',runId:'producer-run'});
}
it('exports exact current packet artifact bytes without relabeling them as native attachments',async()=>{
 const result=await fixture(packet())();expect(result.data.artifacts).toHaveLength(4);expect(result.data.manifest.scope.issue_id).toBe('case');expect(result.data.business_complete).toBe(false);expect(result.data.attachments).toBeUndefined();
});
it.each(['bytes','manifest','scope','missing','canonical','size','duplicate'])('rejects corrupted packet artifact %s before native registration',async(kind)=>{
 const v=packet();if(kind==='bytes')v.artifacts[0]!.base64=Buffer.from('changed').toString('base64');if(kind==='manifest')v.manifest_hash='a'.repeat(64);if(kind==='scope'){v.manifest.scope.issue_id='foreign';v.manifest_hash=sha(canonical(v.manifest));}if(kind==='missing')v.artifacts.pop();if(kind==='canonical')v.packet_data_canonical='{}';if(kind==='size')v.artifacts[0]!.size_bytes+=1;if(kind==='duplicate')v.artifacts[1]!.key=v.artifacts[0]!.key;
 await expect(fixture(v)()).rejects.toThrow();
});
it('does not accept caller-selected packet manifests, files or paths',async()=>{await expect(fixture(packet())({path:'/private/data'})).rejects.toThrow();});
