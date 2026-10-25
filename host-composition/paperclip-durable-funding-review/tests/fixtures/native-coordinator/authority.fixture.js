import {beforeAll,beforeEach,afterAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {eq} from 'drizzle-orm';
import {companies,agents,projects,issues,heartbeatRuns,createDb} from '@paperclipai/db';
import {startEmbeddedPostgresTestDatabase} from '../../__tests__/helpers/embedded-postgres.js';
import {documentService} from '../documents.js';
import {PaperclipRunnerToolAuthority} from './paperclip-runner-tool-authority.js';
describe('restricted native coordinator database authorization',()=>{
 let temporary,db,co,actor,root,run,project,otherProject,child,other,foreign,foreignCompany;
 const config=()=>({provider:'codex',nativeCoordinator:{version:1,projectIds:[project]},disableCommandExecution:true,dangerouslyBypassApprovalsAndSandbox:false,codexPermissionMode:'never'});
 const authority=()=>new PaperclipRunnerToolAuthority(db,{companyId:co,agentId:actor,issueId:root,runId:run,nativeCoordinatorPolicy:{version:1,companyId:co,agentId:actor,projectIds:[project]}});
 const call=(tool,args={})=>authority().execute({tool,callId:randomUUID(),arguments:args});
 beforeAll(async()=>{
  temporary=await startEmbeddedPostgresTestDatabase('restricted-coordinator-');db=createDb(temporary.connectionString);
  [co,actor,root,run,project,otherProject,child,other,foreign,foreignCompany]=Array.from({length:10},()=>randomUUID());
  await db.insert(companies).values([{id:co,name:'Synthetic coordinator',issuePrefix:'SC'},{id:foreignCompany,name:'Foreign fixture',issuePrefix:'FC'}]);
  await db.insert(projects).values([{id:project,companyId:co,name:'Allowed fixture'},{id:otherProject,companyId:co,name:'Excluded fixture'}]);
  await db.insert(agents).values({id:actor,companyId:co,name:'Synthetic coordinator',role:'ceo',status:'idle',adapterType:'paperclip_runner',adapterConfig:config()});
  await db.insert(issues).values([{id:root,companyId:co,projectId:project,title:'Coordinate fixture',status:'in_progress',workMode:'standard',assigneeAgentId:actor},{id:child,companyId:co,projectId:project,parentId:root,title:'Allowed result',status:'done'},{id:other,companyId:co,projectId:otherProject,parentId:root,title:'Excluded result',status:'todo'},{id:foreign,companyId:foreignCompany,parentId:root,title:'Foreign result',status:'todo'}]);
  await db.insert(heartbeatRuns).values({id:run,companyId:co,agentId:actor,status:'running',runtimeMode:'native',nativeIssueId:root,invocationSource:'assignment',triggerDetail:'system',contextSnapshot:{issueId:root}});
  await db.update(issues).set({executionRunId:run}).where(eq(issues.id,root));
  await documentService(db).upsertIssueDocument({issueId:child,key:'result',title:'Synthetic result',format:'markdown',body:'Scoped synthetic work result',baseRevisionId:null,createdByAgentId:actor});
 });
 beforeEach(async()=>{await db.update(agents).set({role:'ceo',status:'idle',adapterConfig:config()}).where(eq(agents.id,actor));await db.update(heartbeatRuns).set({status:'running'}).where(eq(heartbeatRuns.id,run));});
 afterAll(async()=>temporary?.cleanup());
 it('reads allowed child context and documents; excludes cross-project/company nested results',async()=>{
  const c=await call('get_task_context');expect(c.childTasks.map(t=>t.id)).toEqual([child]);
  const target=await call('get_task_context',{targetTaskId:child});expect(target.activeTask.id).toBe(child);
  const doc=await call('read_document',{targetTaskId:child,key:'result'});expect(doc.document.body).toBe('Scoped synthetic work result');
  const tasks=await call('search_tasks');expect(tasks.tasks.some(t=>[other,foreign].includes(t.id))).toBe(false);
  const ps=await call('list_projects');expect(ps.projects.map(p=>p.id)).toEqual([project]);
 });
 it('rejects cross-project/company and forged target reads before document access',async()=>{
  for(const targetTaskId of[other,foreign,randomUUID()])for(const tool of['get_task_context','get_task_history','list_documents','read_document','list_document_revisions'])await expect(call(tool,{targetTaskId,key:'result'})).rejects.toThrow(/native_coordination_project_denied/);
 });
 it('rejects cross-project creation, blockers and reassignment before effects',async()=>{
  await expect(call('create_task',{idempotencyKey:'outside',title:'Must not create',projectId:otherProject})).rejects.toThrow(/native_coordination_project_denied/);
  await expect(call('create_task',{idempotencyKey:'outside-blocker',title:'Must not create',blockedByTaskIds:[other]})).rejects.toThrow(/native_coordination_project_denied/);
  await expect(call('set_dependencies',{idempotencyKey:'outside-dependency',blockedByTaskIds:[other]})).rejects.toThrow(/native_coordination_project_denied/);
  await expect(call('reassign_task',{idempotencyKey:'outside-reassign',taskId:other,assigneeActorId:actor,expectedAssigneeActorId:null,expectedStatusVersion:0,reason:'Synthetic test'})).rejects.toThrow(/native_coordination_project_denied/);
  const [unchanged]=await db.select().from(issues).where(eq(issues.id,other));expect(unchanged.assigneeAgentId).toBeNull();
 });
 it('checks current policy before replaying an already applied mutation',async()=>{
  const a=authority(),args={idempotencyKey:'saved-receipt',key:'coordination',title:'Coordination',body:'Synthetic checkpoint',baseRevisionId:null};
  const first=await a.execute({tool:'write_document',callId:'one',arguments:args});expect(first.disposition).toBe('applied');
  await db.update(agents).set({adapterConfig:{...config(),nativeCoordinator:undefined}}).where(eq(agents.id,actor));
  await expect(a.execute({tool:'write_document',callId:'replay',arguments:args})).rejects.toThrow(/native_coordination_scope_revoked/);
 });
 it('revalidates blocker scope before replaying a dependency receipt',async()=>{
  const id=randomUUID();await db.insert(issues).values({id,companyId:co,projectId:project,title:'Mutable blocker',status:'done'});
  const args={idempotencyKey:'moved-blocker',blockedByTaskIds:[id]};await call('set_dependencies',args);
  await db.update(issues).set({projectId:otherProject}).where(eq(issues.id,id));
  await expect(call('set_dependencies',args)).rejects.toThrow(/native_coordination_project_denied/);
 });
 it('revalidates actual created child scope before replaying its creation receipt',async()=>{
  const args={idempotencyKey:'moved-created-child',title:'Moved child fixture',status:'backlog'};const first=await call('create_task',args);
  await db.update(issues).set({projectId:otherProject}).where(eq(issues.id,first.task.id));
  await expect(call('create_task',args)).rejects.toThrow(/native_coordination_project_denied/);
 });
 it('revokes reads after role demotion, pause, project removal or terminal run',async()=>{
  const a=authority();await db.update(agents).set({role:'general'}).where(eq(agents.id,actor));await expect(a.execute({tool:'get_task_context',arguments:{}})).rejects.toThrow(/native_coordination_scope_revoked/);
  await db.update(agents).set({role:'ceo',status:'paused'}).where(eq(agents.id,actor));await expect(a.execute({tool:'get_task_context',arguments:{}})).rejects.toThrow(/binding_not_authorized/);
  await db.update(agents).set({status:'idle',adapterConfig:{...config(),nativeCoordinator:{version:1,projectIds:[otherProject]}}}).where(eq(agents.id,actor));await expect(a.execute({tool:'get_task_context',arguments:{}})).rejects.toThrow(/native_coordination_scope_revoked/);
  await db.update(agents).set({adapterConfig:config()}).where(eq(agents.id,actor));await db.update(heartbeatRuns).set({status:'succeeded'}).where(eq(heartbeatRuns.id,run));await expect(a.execute({tool:'get_task_context',arguments:{}})).rejects.toThrow(/binding_not_authorized/);
 });
 it('does not convert write targets or human interactions into arbitrary task access',async()=>{
  await expect(call('write_document',{targetTaskId:child,idempotencyKey:'target-write',key:'result',title:'No',body:'No'})).rejects.toThrow(/native_coordination_target_denied/);
  await expect(call('request_human_input',{interactionKind:'confirmation',prompt:'Synthetic scope?',idempotencyKey:'target-question',payload:{target:{type:'issue_document',issueId:other,key:'result'}}})).rejects.toThrow(/native_coordination_interaction_target_denied/);
 });
});
