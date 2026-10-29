import {expect,it} from 'vitest';
import {registerCaseWork,type CaseWorkBinding} from '../../src/case-work/host.js';
const proposal='d'.repeat(64),contextHash='e'.repeat(64);
function fixture(){
 const tools=new Map<string,any>(),docs=new Map<string,any>();let authorized=true;
 const rows:any[]=[{id:'root',companyId:'company',projectId:'portfolio',status:'in_progress',assigneeAgentId:'co'},
 {id:'case',companyId:'company',projectId:'cases',parentId:'root',status:'in_progress',assigneeAgentId:'beta',executionRunId:'producer-run',originKind:'manual',originId:'paperclip-runner:create-task:root:case:binding'},
 {id:'review',companyId:'company',projectId:'cases',parentId:'case',status:'in_progress',assigneeAgentId:'charlie',executionRunId:'reviewer-run',originKind:'manual',originId:'paperclip-runner:create-task:case:source-review:'+proposal}];
 const ctx:any={tools:{register:(n:string,_d:any,fn:any)=>tools.set(n,fn)},issues:{get:async(id:string)=>rows.find(r=>r.id===id)??null,getSubtree:async(id:string)=>({companyId:'company',rootIssueId:id,issues:rows,issueIds:rows.map(r=>r.id),activeRuns:Object.fromEntries(rows.filter(r=>r.executionRunId).map(r=>[r.id,[{id:r.executionRunId,issueId:r.id,agentId:r.assigneeAgentId,status:'running',finishedAt:null}]])),assignees:{beta:{id:'beta',status:'running'},charlie:{id:'charlie',status:'running'}}}),documents:{list:async(id:string)=>[...docs.values()].filter(r=>r.issueId===id),get:async(id:string,key:string)=>docs.get(id+':'+key)??null,upsert:async(v:any)=>{docs.set(v.issueId+':'+v.key,v);return v;}}}};
 const calls:any[]=[];
 const binding:CaseWorkBinding={companyId:'company',researchProjectId:'research',projectId:'cases',rootIssueId:'root',rootProjectId:'portfolio',applicantSlug:'dao',researcher:{agentId:'alpha',principalId:'alpha-principal'},producer:{agentId:'beta',principalId:'beta-principal'},reviewer:{agentId:'charlie',principalId:'charlie-principal'},policyRevision:'v1',authorize:async()=>authorized,bridge:{call:async(op,params,callbacks)=>{const actor=await callbacks.context();calls.push({op,params,actor});if(actor.role==='reviewer'){const assignment=await (callbacks as any).sourceAssignment({case_binding_id:'binding',proposal_hash:proposal});return{business_complete:false,case_binding_id:'binding',proposal_hash:proposal,state:op==='source_settlement'?'settled_source_drift':'accepted',assignment};}await callbacks.caseTask!({case_binding_id:'binding'});return{business_complete:false,case_binding_id:'binding',proposal_hash:proposal,state:'awaiting_independent_review',record_id:'record',producer_issue_id:'case',producer_run_id:'producer-run',review_task:{idempotencyKey:'source-review:'+proposal,parentIssueId:'case',projectId:'cases',assigneeAgentId:'charlie',title:'Review exact source proposal'}};}}};
 registerCaseWork(ctx,[binding],{own:async(_s:any,fn:any)=>fn()});
 return{rows,docs,calls,binding,revoke:()=>authorized=false,invoke:(operation:string,parameters:any,review=false)=>tools.get('funding_case_work')({operation,parameters},{companyId:'company',projectId:'cases',agentId:review?'charlie':'beta',runId:review?'reviewer-run':'producer-run'})};
}
const sourceProposal={context_hash:contextHash,fields:[],requirements:[{requirement:{key:'narrative'},evidence:{source_document_id:'source',start:0,end:20,quote:'Grounded requirement'}}]};
it('persists exact original producer provenance and returns truthful unqueued source review handoff',async()=>{
 const f=fixture();const r=await f.invoke('source_propose',sourceProposal);
 expect(r.data.case_binding_id).toBe('binding');expect(f.docs.size).toBe(1);
 expect(r.data.source_review_guidance.queued).toBe(false);
 expect(r.data.source_review_guidance.create_task).toEqual({purpose:'source_review',proposalHash:proposal});
 expect([...f.docs.values()][0].body).toContain('producer-run');
});
it('binds Charlie ordinary child to original producer proposal despite a later blocked producer run',async()=>{
 const f=fixture();await f.invoke('source_propose',sourceProposal);f.rows[1].status='blocked';f.rows[1].executionRunId='later-run';
 const r=await f.invoke('source_review',{proposal_hash:proposal,decision:'accept',findings:[]},true);
 expect(r.data.assignment).toMatchObject({company_id:'company',project_id:'cases',case_binding_id:'binding',case_issue_id:'case',parent_issue_id:'case',producer_run_id:'producer-run',reviewer_issue_id:'review',reviewer_run_id:'reviewer-run',reviewer_principal_id:'charlie-principal'});
 expect(f.calls.at(-1).actor.role).toBe('reviewer');
});
it.each(['parent','origin','assignee','root','document'])('rejects mismatched reviewer %s before domain review',async(kind)=>{
 const f=fixture();await f.invoke('source_propose',sourceProposal);f.calls.length=0;
 if(kind==='parent')f.rows[2].parentId='root';if(kind==='origin')f.rows[2].originId='paperclip-runner:create-task:case:source-review:'+'f'.repeat(64);if(kind==='assignee')f.rows[1].assigneeAgentId='other';if(kind==='root')f.rows[0].status='done';if(kind==='document')f.docs.clear();
 await expect(f.invoke('source_review',{proposal_hash:proposal,decision:'accept',findings:[]},true)).rejects.toThrow();
 expect(f.calls).toHaveLength(0);
});
it('rejects model-selected records, invalid pagination, reviewer mutation, and empty rejection findings',async()=>{
 const f=fixture();for(const [op,p]of [['source_context',{record_id:'foreign'}],['source_links',{offset:-1}],['source_capture',{url:'https://example.org',record_id:'foreign'}],['source_propose',{...sourceProposal,case_binding_id:'foreign'}],['source_receipt',{proposal_hash:'bad'}]])await expect(f.invoke(String(op),p)).rejects.toThrow();
 await expect(f.invoke('source_capture',{url:'https://example.org'},true)).rejects.toThrow();
 await expect(f.invoke('source_review',{proposal_hash:proposal,decision:'reject',findings:[]},true)).rejects.toThrow();expect(f.calls).toHaveLength(0);
});
it('advertises the actual domain field, passage and sponsor-requirement schemas before a commandless proposal',async()=>{
 const {caseWorkTool}=await import('../../src/case-work/host.js');
 const schema:any=caseWorkTool.parametersSchema;
 const params=schema.oneOf.find((v:any)=>v.properties.operation.const==='source_propose').properties.parameters;
 const definitions=schema.$defs;
 expect(definitions?.FieldAssertion.properties.field.enum).toContain('application_package');
 expect(definitions?.Passage.required).toEqual(['source_document_id','start','end','quote']);
 expect(definitions?.RequirementAssertion.properties.requirement.$ref).toBe('#/$defs/SponsorFieldRequirement');
 expect(params.properties.fields.items.$ref).toBe('#/$defs/FieldAssertion');
 expect(params.additionalProperties).toBe(false);
});
