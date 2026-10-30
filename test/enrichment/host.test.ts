import {it,expect} from 'vitest';
import {registerEnrichment} from '../../src/enrichment/host.js';
function fixture(){
 let admitted=true,callbackRevoke=false;const tools=new Map<string,any>(),calls:any[]=[];
 const root:any={id:'root',companyId:'company',projectId:'P',status:'in_progress'};
 const child:any={id:'child',parentId:'root',companyId:'company',projectId:'Q',assigneeAgentId:'alpha',executionRunId:'run',status:'in_progress'};
 const active:any={id:'run',issueId:'child',agentId:'alpha',status:'running',finishedAt:null};
 const ctx:any={tools:{register:(n:string,_:any,h:any)=>tools.set(n,h)},issues:{get:async(id:string)=>id==='root'?root:child,getSubtree:async(id:string)=>({companyId:'company',rootIssueId:id,issueIds:id==='root'?['root','child']:['child'],issues:id==='root'?[root,child]:[child],activeRuns:{child:[active]},assignees:{alpha:{id:'alpha',status:'running'},beta:{id:'beta',status:'running'}}})}};
 const binding:any={companyId:'company',applicantSlug:'dao',projectId:'Q',rootProjectId:'P',rootIssueId:'root',producer:{agentId:'alpha',principalId:'a'},reviewer:{agentId:'beta',principalId:'b'},authorize:async()=>admitted,bridge:{call:async(op:string,p:any,callbacks:any)=>{calls.push({op,p,actor:await callbacks.context()});if(callbackRevoke)admitted=false;return{receipt:'stored'};}}};
 registerEnrichment(ctx,[binding],{own:async(_:any,f:any)=>f()} as any);
 const run:any={companyId:'company',projectId:'Q',agentId:'alpha',runId:'run'};
 return{tools,root,child,active,run,calls,revoke:()=>{admitted=false;},revokeAfterResult:()=>{callbackRevoke=true;},call:(op:string,p:any={})=>tools.get('funding_enrichment')({operation:op,parameters:p},run)};
}
it('binds actual direct-child identity and parameters without accepting model scope',async()=>{const f=fixture();await f.call('context',{});expect(f.calls[0].actor).toEqual({company_id:'company',applicant_slug:'dao',project_id:'Q',issue_id:'child',root_issue_id:'root',root_project_id:'P',agent_id:'alpha',principal_id:'a',run_id:'run',role:'researcher'});expect(f.calls[0].p).toEqual({});});
it('requires independent configured reviewer and denies producer review before process I/O',async()=>{const f=fixture();await expect(f.call('review',{proposal_hash:'a'.repeat(64)})).rejects.toThrow(/role denied/);expect(f.calls).toEqual([]);f.run.agentId=f.child.assigneeAgentId=f.active.agentId='beta';await f.call('review',{proposal_hash:'a'.repeat(64)});expect(f.calls[0].actor.role).toBe('reviewer');expect(f.calls[0].actor.principal_id).toBe('b');await expect(f.call('propose')).rejects.toThrow(/role denied/);await expect(f.call('capture',{record_id:'record',url:'https://official.example/notice'})).rejects.toThrow(/role denied/);});
it('rejects foreign ancestry, hidden root, reassignment, completed run and changed config before process I/O',async()=>{for(const mutate of[(f:any)=>{f.child.parentId='other';},(f:any)=>{f.root.hiddenAt=new Date();},(f:any)=>{f.child.assigneeAgentId='beta';},(f:any)=>{f.active.finishedAt=new Date();},(f:any)=>f.revoke()]){const f=fixture();mutate(f);await expect(f.call('propose')).rejects.toThrow();expect(f.calls).toEqual([]);}});
it('does not return an admitted-looking result after authority is revoked during process execution',async()=>{const f=fixture();f.revokeAfterResult();await expect(f.call('propose')).rejects.toThrow(/configuration changed/);expect(f.calls).toHaveLength(1);});
it('rejects arbitrary operation or outer scope fields without process I/O',async()=>{const f=fixture();for(const input of[{operation:'call_api',parameters:{}},{operation:'context',parameters:{},companyId:'other'}])await expect(f.tools.get('funding_enrichment')(input,f.run)).rejects.toThrow(/Invalid enrichment/);expect(f.calls).toEqual([]);});
it('routes explicit compact context views unchanged through the same fresh native identity',async()=>{
 for(const p of[{}, {view:'inventory',offset:100,limit:100},{view:'record',record_id:'record'},{view:'proposal',proposal_hash:'a'.repeat(64)},{view:'contract'},{view:'profile'}]){
  const f=fixture();await f.call('context',p);expect(f.calls[0].p).toEqual(p);expect(f.calls[0].actor.issue_id).toBe('child');
 }
});
it('rejects invalid context view selectors or model scope before process I/O',async()=>{
 for(const p of[{view:'private'},{view:'inventory',record_id:'record'},{view:'record'},{view:'proposal'},{view:'contract',offset:1},{view:'profile',company_id:'other'},{view:'contract',limit:true}]){
  const f=fixture();await expect(f.call('context',p)).rejects.toThrow(/Invalid enrichment context/);expect(f.calls).toEqual([]);
 }
});
it('accepts real UUID-shaped record IDs and rejects whitespace/control selectors before I/O',async()=>{
 for(const record_id of['c790de20-12fa-4057-b753-a31bf38d9838','source_x0s']){
  const f=fixture();await f.call('context',{record_id});expect(f.calls[0].p).toEqual({record_id});
 }
 for(const record_id of['record with space','record\nline','record\u0000id','record\u007fid']){
  const f=fixture();await expect(f.call('context',{view:'record',record_id})).rejects.toThrow(/Invalid enrichment context/);expect(f.calls).toEqual([]);
 }
});
it('admits full triage only to researcher and permits scoped reviewer reads',async()=>{
 const f=fixture();await f.call('triage_scan',{});expect(f.calls[0].op).toBe('triage_scan');
 f.run.agentId=f.child.assigneeAgentId=f.active.agentId='beta';
 await expect(f.call('triage_scan',{})).rejects.toThrow(/role denied/);
 await f.call('triage_page',{scan_hash:'a'.repeat(64),limit:100});
 await f.call('triage_page',{scan_hash:'a'.repeat(64),record_id:'c790de20-12fa-4057-b753-a31bf38d9838'});
 expect(f.calls.at(-1).actor.role).toBe('reviewer');
});
it('rejects triage parameter scope, malformed digests and Boolean counts before process I/O',async()=>{
 for(const [op,p]of[['triage_scan',{company_id:'other'}],['triage_page',{scan_hash:'invalid'}],['triage_page',{scan_hash:'a'.repeat(64),limit:true}],['triage_page',{scan_hash:'a'.repeat(64),actor:'other'}]] as const){
  const f=fixture();await expect(f.call(op,p)).rejects.toThrow(/Invalid enrichment triage/);expect(f.calls).toEqual([]);
 }
});

it('navigates bounded current official links and rejects URL or noninteger selectors before bridge',async()=>{const f=fixture();await f.call('links',{record_id:'c790de20-12fa-4057-b753-a31bf38d9838',limit:20});expect(f.calls[0].op).toBe('links');for(const p of [{record_id:'id',url:'https://evil.example'},{record_id:'id',limit:1.5},{record_id:'id',offset:-1},{record_id:'id',context_hash:'bad'},{record_id:'id',limit:51}])await expect(f.call('links',p)).rejects.toThrow(/Invalid enrichment links/);expect(f.calls).toHaveLength(1);});
