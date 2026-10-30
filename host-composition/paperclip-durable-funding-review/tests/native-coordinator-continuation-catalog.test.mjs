/** Disposable actual native tasks, SQL, catalog and gateway. No providers or live state. */
import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs/promises';import{randomUUID}from'node:crypto';import{pathToFileURL,fileURLToPath}from'node:url';
const native='/opt/host/node_modules',source='/qual/source',root='/tmp/case-native-sql',server=root+'/node_modules/@paperclipai/server';await fs.mkdir(server,{recursive:true});await fs.cp(native+'/@paperclipai/server/dist',server+'/dist',{recursive:true});await fs.copyFile(native+'/@paperclipai/server/package.json',server+'/package.json');await fs.cp('/qual/candidate/dist',server+'/dist',{recursive:true,force:true});
for(const from of[native+'/@paperclipai/server/node_modules',native])for(const name of await fs.readdir(from).catch(()=>[])){if(name==='@paperclipai'||name.startsWith('.'))continue;await fs.symlink(from+'/'+name,root+'/node_modules/'+name).catch(e=>{if(e.code!=='EEXIST')throw e;});}
for(const name of await fs.readdir(native+'/@paperclipai'))if(name!=='server')await fs.symlink(native+'/@paperclipai/'+name,root+'/node_modules/@paperclipai/'+name);
const load=p=>import(pathToFileURL(native+'/'+p)),local=p=>import(pathToFileURL(server+'/dist/'+p)),s=await load('@paperclipai/db/dist/schema/index.js'),{eq}=await load('drizzle-orm/index.js'),{startEmbeddedPostgresTestDatabase,createDb}=await load('@paperclipai/db/dist/index.js');
const{PaperclipRunnerToolAuthority}=await local('services/native-runtime/paperclip-runner-tool-authority.js');
const{CONTINUE_TASK_DEFINITION}=await local('services/native-runtime/native-task-continuation.mjs');
const{taskProjectDefinitions,CASE_PROJECTED_TOOL}=await local('services/native-runtime/native-case-work-tools.mjs');
const{nativeToolContractFingerprintForTarget,rebindNativeSessionCheckpoint,buildNativeExecutionWithCheckpoint}=await local('services/native-runtime/native-session-resume.js');
const{buildNativeExecutionInput}=await local('services/native-runtime/native-execution-input.js');
const{nativeRuntimeContextFixture}=await local('services/native-runtime/runtime-context.test-fixture.js');
const{createHash}=await import('node:crypto');
const legacySource=await fs.readFile('/qual/base/dist/services/native-runtime/native-session-resume.js','utf8');
assert(legacySource.includes('paperclip.native-tool-contract.v16'));
const legacyFunction=legacySource.slice(legacySource.indexOf('export function nativeToolContractFingerprintForTarget('),legacySource.indexOf('/** Default local-target fingerprint'));
const legacyFingerprint=new Function('createHash',legacyFunction.replace('export function','function')+';return nativeToolContractFingerprintForTarget;')(createHash);
const ids={companyId:randomUUID(),issueId:randomUUID(),agentId:randomUUID(),projectId:randomUUID(),previousRunId:randomUUID(),currentRunId:randomUUID(),sessionId:randomUUID()};
test('actual Coordinator catalog advertises exact continuation schema; ordinary worker and reviewer catalogs do not',async()=>{
 const binding={companyId:ids.companyId,issueId:ids.issueId,agentId:ids.agentId,runId:ids.currentRunId,apiToolsEnabled:false};
 const co=new PaperclipRunnerToolAuthority({}, {...binding,nativeCoordinatorPolicy:{version:1,companyId:ids.companyId,agentId:ids.agentId,projectIds:[ids.projectId]}});
 const declarations=await co.definitions(),tool=declarations.find(t=>t.name==='continue_task');assert(tool);assert.equal(declarations.filter(t=>t.name==='continue_task').length,1);assert.deepEqual(tool.inputSchema,CONTINUE_TASK_DEFINITION.inputSchema);
 assert.deepEqual(Object.keys(tool.inputSchema.properties).sort(),['taskId','expectedAssigneeActorId','expectedStatusVersion','idempotencyKey','reason'].sort());assert.equal(tool.inputSchema.additionalProperties,false);
 for(const extra of [{},{nativeReview:{interactionId:randomUUID(),decisionId:randomUUID()}}]){
  const tools=await new PaperclipRunnerToolAuthority({}, {...binding,...extra}).definitions();assert(!tools.some(t=>t.name==='continue_task'));
 }
});
test('actual source-review projection retains the exact proposal/view schema when rebuilt for Charlie',async()=>{
 const proposal='a'.repeat(64);let fresh=0;
 const defs=await taskProjectDefinitions({nativeTaskProjectAdmission:{kind:'source-review',role:'reviewer',proposalHash:proposal},assignedMcpTools:{definitionsFresh:async()=>[{name:CASE_PROJECTED_TOOL,inputSchema:{}}]}},async()=>{fresh++;return {issue:{workMode:'standard'}};});
 assert.equal(fresh,2);assert.equal(defs.length,1);assert(!defs.some(t=>t.name==='continue_task'));
 const context=defs[0].inputSchema.oneOf.find(v=>v.properties.operation.const==='source_context').properties.parameters;
 assert.equal(context.properties.view.const,'proposal');assert.equal(context.properties.proposal_hash.const,proposal);assert.deepEqual(context.required,['view','proposal_hash']);assert.equal(context.additionalProperties,false);
});
function execution(runId,role,sessionId=ids.sessionId,resumedSession=false){
 return buildNativeExecutionInput({companyId:ids.companyId,runId,agentId:ids.agentId,issue:{id:ids.issueId,identifier:'SYN-1',title:'Synthetic persisted task',description:'Unchanged durable task',workMode:'standard'},taskPrompt:resumedSession?'Synthetic compact resume delta':'FULL CURRENT TASK AND ASSIGNED CONTEXT',workspace:{id:runId,cwd:'/workspace',repoUrl:null,repoRef:null,branchName:null},normalizedSessionId:sessionId,provider:'codex',...(role==='Coordinator'?{nativeCoordinatorPolicy:{version:1,projectIds:[ids.projectId]}}:{nativeFundingPolicy:{version:1,role:role==='Charlie'?'reviewer':'producer',projectIds:[ids.projectId],issueIds:[ids.issueId]}}),completionContract:{id:randomUUID(),sha256:'sha256:'+'b'.repeat(64),schemaVersion:'paperclip.run-result.v1',contract:{revision:'1',objective:'Synthetic task remains durable',criteria:[{id:'objective',requirement:'Keep source authority'}]}},runtimeContext:nativeRuntimeContextFixture()});
}
for(const role of ['Coordinator','Beta','Charlie'])test('global v17 rotates valid old-v16 '+role+' checkpoint and rebuilds full context without changing durable task',()=>{
 const previous=execution(ids.previousRunId,role),current=execution(ids.currentRunId,role);current.completionContract=structuredClone(previous.completionContract);
 const checkpoint={backendKind:'runner',driverKind:'codex_app_server',sessionId:'provider-thread-synthetic',providerSessionId:'provider-thread-synthetic',identity:{runId:ids.previousRunId,companyId:ids.companyId,issueId:ids.issueId,agentId:ids.agentId,sessionId:ids.sessionId},cursor:'old',semanticResult:{reportedWorkDisposition:'done'},terminal:null,activeTurnId:null,terminalTurns:[],pendingRuntimeRequests:[]};
 const prior={id:ids.previousRunId,companyId:ids.companyId,agentId:ids.agentId,nativeSessionId:ids.sessionId,runnerProfileJson:{nativeExecutionInput:previous,nativeToolContractFingerprint:nativeToolContractFingerprintForTarget('local'),sessionCheckpoint:checkpoint}};
 assert(rebindNativeSessionCheckpoint({previousRun:prior,currentExecution:current}),'fixture must be a valid current-contract checkpoint before checking old fingerprint');
 const old=structuredClone(prior);old.runnerProfileJson.nativeToolContractFingerprint=legacyFingerprint('local');const unchanged=JSON.stringify(old);
 assert.notEqual(nativeToolContractFingerprintForTarget('local'),legacyFingerprint('local'));assert.notEqual(nativeToolContractFingerprintForTarget('remote'),legacyFingerprint('remote'));
 assert.equal(rebindNativeSessionCheckpoint({previousRun:old,currentExecution:current}),null);
 const calls=[];const result=buildNativeExecutionWithCheckpoint({previousRun:old,normalizedSessionId:ids.sessionId,buildExecution:options=>{calls.push(options);const e=execution(ids.currentRunId,role,options.normalizedSessionId,options.resumedSession);e.completionContract=structuredClone(previous.completionContract);return e;}});
 assert.equal(result.checkpoint,null);assert.notEqual(result.normalizedSessionId,ids.sessionId);assert.deepEqual(calls.map(v=>v.resumedSession),[true,false]);assert.equal(result.execution.binding.issueId,ids.issueId);assert.equal(result.execution.binding.companyId,ids.companyId);assert.deepEqual(result.execution.runtimeContext,nativeRuntimeContextFixture());assert(JSON.stringify(result.execution).includes('FULL CURRENT TASK AND ASSIGNED CONTEXT'));assert.equal(JSON.stringify(old),unchanged);
});
