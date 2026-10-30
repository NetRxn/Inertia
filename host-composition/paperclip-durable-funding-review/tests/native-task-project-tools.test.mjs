import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as m from '../transport/native/native-task-project-tools.mjs';
const id=n=>`${n}1111111-1111-4111-8111-111111111111`;
function fixture(){
 const binding={companyId:id(1),projectId:id(2),issueId:id(3),agentId:id(4),runId:id(5)};
 const policy={version:1,role:'worker',projectIds:[id(8)],issueIds:[id(9)]};
 const adapterConfig={provider:'codex',engine:'cli',disableCommandExecution:true,dangerouslyBypassApprovalsAndSandbox:false,codexPermissionMode:'never',nativeFunding:policy,nativeTaskProjectTools:{version:1,projectIds:[binding.projectId]}};
 const context={actor:{id:binding.agentId,companyId:binding.companyId,role:'general',status:'running',adapterType:'paperclip_runner',adapterConfig},issue:{id:binding.issueId,companyId:binding.companyId,projectId:binding.projectId,status:'in_progress',workMode:'standard',assigneeAgentId:binding.agentId,executionRunId:binding.runId,checkoutRunId:binding.runId,hiddenAt:null},run:{id:binding.runId,companyId:binding.companyId,agentId:binding.agentId,nativeIssueId:binding.issueId,status:'running',runtimeMode:'native'}};
 const config={roundtable:{enabled:true,admission:'synthetic-controlled',origin:'https://website.example',principalId:'synthetic-owner',meetings:[{meetingId:'synthetic-meeting',fileId:'synthetic-file',withdrawn:false,nativeExtraction:{projectId:binding.projectId,issueId:binding.issueId,agentId:binding.agentId}}]}};
 const rows=[{pluginKey:'netrxn.inertia',status:'ready',companyId:binding.companyId,config,settingsPresent:false}];
 return{binding,policy,adapterConfig,context,config,rows,select(){return m.selectTaskProjectAdmission(rows,binding,policy,null,context);}};
}
test('exact opted-in extractor selects finite meeting tools independently of funding task scope',()=>{
 const f=fixture(),a=f.select();assert.equal(a.role,'extractor');assert.equal(m.taskProjectToolNames(a).length,2);
 assert(m.taskProjectToolNames(a).every(n=>n.startsWith('app_netrxn_inertia_')));assert(!JSON.stringify(a).includes('synthetic-owner'));
});
test('old defaults and unrelated tasks retain their ordinary catalog',()=>{
 const f=fixture();delete f.adapterConfig.nativeTaskProjectTools;assert.equal(f.select(),null);
 f.adapterConfig.nativeTaskProjectTools={version:1,projectIds:[f.binding.projectId]};f.config.roundtable.enabled=false;assert.equal(f.select(),null);
});
for(const[name,change]of[
 ['changed assignee',f=>f.context.issue.assigneeAgentId=id(8)],['stale run',f=>f.context.run.status='succeeded'],
 ['paused actor',f=>f.context.actor.status='paused'],['shell permitted',f=>f.adapterConfig.disableCommandExecution=false],
 ['foreign company',f=>f.context.issue.companyId=id(8)],['missing source admission',f=>delete f.config.roundtable.admission],
 ['company plugin disabled',f=>{f.rows[0].settingsPresent=true;f.rows[0].enabled=false;}],
 ['duplicate configured extraction',f=>f.config.roundtable.meetings.push(structuredClone(f.config.roundtable.meetings[0]))],
 ['duplicate plugin',f=>f.rows.push(structuredClone(f.rows[0]))],['withdrawn source',f=>f.config.roundtable.meetings[0].withdrawn=true],
 ['changed policy',f=>f.adapterConfig.nativeFunding={...f.policy,role:'producer'}],
])test('extractor denies '+name,()=>{const f=fixture();change(f);assert.throws(()=>f.select(),/native_task_project_admission_denied/);});
test('native reviewers never receive meeting submission tools',()=>{const f=fixture();assert.equal(m.selectTaskProjectAdmission(f.rows,f.binding,f.policy,{},f.context),null);});
test('fresh catalog revocation denies execution and does not expose shell or raw API',async()=>{
 const f=fixture(),admission=f.select();let checks=0,calls=0;const names=m.taskProjectToolNames(admission);
 let tools=names.map(name=>({name,inputSchema:{type:'object'}}));
 const b={nativeTaskProjectAdmission:admission,assignedMcpTools:{definitionsFresh:async()=>tools,has:n=>names.includes(n),execute:async()=>{calls++;return{synthetic:true};}}};
 const current=async()=>{checks++;};assert.deepEqual((await m.taskProjectDefinitions(b,current)).map(t=>t.name),names);
 for(const tool of['call_api','hire_agent','run_command','search_tools']){assert.equal(m.isTaskProjectTool(b,tool),false);await assert.rejects(()=>m.executeTaskProjectTool(b,{tool},current));}
 await m.executeTaskProjectTool(b,{tool:names[0]},current);assert.equal(calls,1);assert(checks>=4);
 tools=tools.slice(0,1);await assert.rejects(()=>m.executeTaskProjectTool(b,{tool:names[0]},current));assert.equal(calls,1);
});
function readerFixture(){
 const f=fixture();delete f.adapterConfig.nativeFunding;
 f.adapterConfig.nativeCoordinator={version:1,projectIds:[f.binding.projectId]};f.context.actor.role='ceo';
 const c=f.config.roundtable;
 c.meetings[0].nativeExtraction={projectId:f.binding.projectId,issueId:id(7),agentId:id(8)};
 c.nativeIntake={organizationId:'org',projectId:f.binding.projectId,intakeAgentId:f.binding.agentId,referenceOnly:true,sourceAccess:true};
 const [key]=m.taskProjectMappingKeys(f.binding.companyId,c),marker='b'.repeat(64);
 const sourceId=createHash('sha256').update(JSON.stringify([f.binding.companyId,c.origin,c.principalId,c.meetings[0].meetingId])).digest('hex');
 const mapping={key,companyId:f.binding.companyId,nativeIssueId:f.binding.issueId,pending:false,marker,snapshot:{organizationId:'org',sourceSystem:'inertia-roundtable',sourceId,audience:'restricted',withdrawn:false}};
 Object.assign(f.context.issue,{originKind:'plugin:netrxn.inertia:objective',originId:key,description:'Objective source revision: '+marker});
 return{...f,mapping,select(){return m.selectTaskProjectAdmission(f.rows,f.binding,null,null,f.context,[mapping]);}};
}
test('GENERAL Coordinator receives only source context on the current mapped meeting follow-up',()=>{
 const f=readerFixture(),a=f.select();assert.equal(a.role,'reader');assert.equal(m.taskProjectToolNames(a).length,1);
 assert(m.taskProjectToolNames(a)[0].includes('meeting_source_context'));assert(!m.taskProjectToolNames(a)[0].includes('submit'));
});
for(const[name,change]of[
 ['pending mapping',f=>f.mapping.pending=true],['withdrawal',f=>f.mapping.snapshot.withdrawn=true],
 ['foreign mapping',f=>f.mapping.companyId=id(7)],['stale marker',f=>f.mapping.marker='c'.repeat(64)],
 ['reader revoked',f=>f.config.roundtable.nativeIntake.intakeAgentId=id(7)],
 ['source access revoked',f=>f.config.roundtable.nativeIntake.sourceAccess=false],
 ['changed origin',f=>f.context.issue.originId='d'.repeat(64)],
])test('reader fences '+name,()=>{const f=readerFixture();change(f);let result;try{result=f.select();}catch(e){assert.match(e.message,/native_task_project_admission_denied/);return;}assert.equal(result,null);});
test('explicit reader admission follows only current native descendants of the mapped root',()=>{
 const f=readerFixture(),parent=structuredClone(f.context.issue);
 f.mapping.nativeIssueId=parent.id;f.context.issue={...parent,id:id(6),parentId:parent.id,originKind:null,originId:null,description:null};f.binding.issueId=f.context.issue.id;f.context.run.nativeIssueId=f.context.issue.id;
 const selected=m.selectTaskProjectAdmission(f.rows,f.binding,null,null,f.context,[f.mapping],[parent]);assert.equal(selected.role,'reader');
 f.context.issue.parentId=id(9);assert.equal(m.selectTaskProjectAdmission(f.rows,f.binding,null,null,f.context,[f.mapping],[parent]),null);
});
function notesReaderFixture(){
 const f=readerFixture();
 const c=structuredClone(f.config.roundtable);delete c.meetings[0].nativeExtraction;delete c.meetings[0].withdrawn;
 Object.assign(c.meetings[0],{sourceId:'owner:synthetic',revision:'sha256:'+'a'.repeat(64),exportSha256:'b'.repeat(64),ownerFile:'/private/tmp/fixture.json'});
 f.config.ownerNotes=c;delete f.config.roundtable;
 return f;
}
test('ownerNotes mapped Coordinator gets read-only context without transcript configuration',()=>{
 const f=notesReaderFixture(),a=f.select();assert.equal(a?.role,'reader');assert.equal(m.taskProjectToolNames(a).length,1);
 assert(m.taskProjectToolNames(a)[0].includes('meeting_source_context'));
});
test('ownerNotes and unrelated transcript configuration coexist, with ambiguous mapping denied',()=>{
 const f=notesReaderFixture();f.config.roundtable=fixture().config.roundtable;f.config.roundtable.meetings[0].nativeExtraction.issueId=id(7);
 assert.equal(f.select()?.role,'reader');
 f.config.roundtable=structuredClone(f.config.ownerNotes);f.config.roundtable.meetings[0].withdrawn=false;
 assert.throws(()=>f.select(),/native_task_project_admission_denied/);
});
for(const [name,change] of [
 ['disabled notes',f=>f.config.ownerNotes.enabled=false],['pending notes mapping',f=>f.mapping.pending=true],
 ['changed assignee',f=>f.context.issue.assigneeAgentId=id(9)],['stale run',f=>f.context.run.status='succeeded'],
 ['read grant removed',f=>f.config.ownerNotes.nativeIntake.sourceAccess=false],['foreign actor',f=>f.context.actor.companyId=id(9)],
])test('ownerNotes denies '+name,()=>{const f=notesReaderFixture();change(f);try{assert.equal(f.select(),null);}catch(e){assert.match(e.message,/native_task_project_admission_denied/);}});
test('ownerNotes never gains transcript extractor authority from nativeExtraction-shaped input',()=>{
 const f=notesReaderFixture();f.config.ownerNotes.meetings[0].nativeExtraction={projectId:f.binding.projectId,issueId:f.binding.issueId,agentId:f.binding.agentId};
 assert.throws(()=>f.select(),/native_task_project_admission_denied/);
});
test('ownerNotes revision changes invalidate the frozen admission hash',()=>{
 const f=notesReaderFixture(),a=f.select();f.config.ownerNotes.meetings[0].exportSha256='c'.repeat(64);
 assert.notEqual(f.select().bindingHash,a.bindingHash);
});
test('notes configuration cannot affect the catalog of an actor without explicit opt-in',()=>{
 const f=notesReaderFixture();delete f.adapterConfig.nativeTaskProjectTools;f.config.ownerNotes.meetings=null;
 assert.equal(f.select(),null);
});
test('enabled empty notes batch preserves unrelated valid transcript admission',()=>{
 const f=readerFixture();f.config.ownerNotes={...structuredClone(f.config.roundtable),meetings:[]};
 assert.equal(f.select()?.role,'reader');
});
