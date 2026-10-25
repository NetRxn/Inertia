import {checkMemberHook} from './check-member-hook.mjs';
/** Disposable real native auth/PostgreSQL proof. No live enrollment or provider. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import express from 'express';
import {execFileSync} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import {createContributionIngress} from './plugin/dist/src/contributions/ingress.js';
import {createContributionBoundary} from './plugin/dist/src/contributions/service.js';
import {createContributionJournal} from './plugin/dist/src/contributions/journal.js';
import {createNativeContributionReader,nativeTaskRevision} from './plugin/dist/src/contributions/native.js';
import {contributionHash} from './plugin/dist/src/contributions/artifacts.js';
import {BRIDGE_NAMESPACE} from './plugin/dist/src/store/postgres.js';
import {boardAuthService} from './node_modules/@paperclipai/server/dist/services/board-auth.js';
import {issueRoutes} from './node_modules/@paperclipai/server/dist/routes/issues.js';
import {actorMiddleware,memberAttemptPreparseGuard} from './node_modules/@paperclipai/server/dist/middleware/auth.js';
import {createLocalAgentJwt,verifyLocalAgentJwt} from './node_modules/@paperclipai/server/dist/agent-auth-jwt.js';
import {legacyControllerBootId,legacyControllerClaim} from './node_modules/@paperclipai/server/dist/services/legacy-controller-lease.js';
const attemptsModule=await import('./member/attempt-authority.mjs').catch(e=>e.code==='ERR_MODULE_NOT_FOUND'?{}:Promise.reject(e));
const authModule=await import('./member/native-auth.mjs').catch(e=>e.code==='ERR_MODULE_NOT_FOUND'?{}:Promise.reject(e));
export async function checkMemberIngress({db,sql,companyId,services,issueService,pluginDatabase,pluginId}) {
 const oldSecret=process.env.PAPERCLIP_AGENT_JWT_SECRET;
 process.env.PAPERCLIP_AGENT_JWT_SECRET=randomBytes(32).toString('hex');
 const native=issueService(db),projectId=randomUUID(),scopes=[],fixtures=[];
 await sql`INSERT INTO projects(id,company_id,name) VALUES (${projectId},${companyId},'Synthetic HTTP member project')`;
 let sourceCalls=0,nativeCalls=0;
 const ctx={issues:{get:async(issueId,companyId)=>{nativeCalls++;return services.issues.get({issueId,companyId});},summaries:{getOrchestration:p=>services.issues.getOrchestrationSummary(p)}},agents:{get:(agentId,companyId)=>services.agents.get({agentId,companyId})}};
 const journal=createContributionJournal({namespace:BRIDGE_NAMESPACE,query:(s,p)=>pluginDatabase.query(pluginId,s,p),execute:(s,p)=>pluginDatabase.execute(pluginId,s,p)});
 for(let i=0;i<2;i++) {
  const memberId='synthetic-http-'+randomUUID(),agentId=randomUUID(),runId=randomUUID();
  await sql`INSERT INTO "user"(id,name,email,email_verified,created_at,updated_at) VALUES (${memberId},'Synthetic member',${memberId+'@example.invalid'},false,now(),now())`;
  await sql`INSERT INTO company_memberships(company_id,principal_type,principal_id,status,membership_role) VALUES (${companyId},'user',${memberId},'active','member')`;
  await sql`INSERT INTO agents(id,company_id,name,status,adapter_type,adapter_config,runtime_config) VALUES (${agentId},${companyId},'Synthetic HTTP agent','idle','process','{}','{}')`;
  const issue=await native.create(companyId,{title:'Private native title',description:'Do not export raw records',projectId,status:'todo',priority:'medium',responsibleUserId:memberId,createdByUserId:memberId});
  await sql`INSERT INTO heartbeat_runs(id,company_id,agent_id,status,responsible_user_id,controller_boot_id,controller_lease_expires_at,runtime_mode,context_snapshot) VALUES (${runId},${companyId},${agentId},'running',${memberId},${legacyControllerBootId},now()+interval '10 minutes','legacy',${sql.json({issueId:issue.id})}::jsonb)`;
  const checked=await native.checkout(issue.id,agentId,['todo'],runId);
  const scope={companyId,projectId,issueId:issue.id,agentId,memberId};scopes.push(scope);
  fixtures.push({scope,runId,issue:checked,lifecycle:'active',enrollmentActive:true,expiresAt:Date.now()+600000});
 }
 const [a,b]=fixtures;
 const baseToken=createLocalAgentJwt(a.scope.agentId,companyId,'process',a.runId,a.scope.memberId);
 assert.ok(baseToken);assert.equal(verifyLocalAgentJwt(baseToken).jti,undefined,'default token remains unchanged');
 const requestedJti=randomUUID();const optedToken=createLocalAgentJwt(a.scope.agentId,companyId,'process',a.runId,a.scope.memberId,{kind:'standard'},requestedJti);
 assert.equal(verifyLocalAgentJwt(optedToken).jti,requestedJti,'opt-in native signed jti round-trips');
 assert.equal(typeof attemptsModule.createMemberAttemptAuthority,'function','concrete native PG attempt authority exists');
 const authority=attemptsModule.createMemberAttemptAuthority({db,scopes});
 a.attempt=await authority.begin({companyId,agentId:a.scope.agentId,runId:a.runId,issueId:a.scope.issueId});
 b.attempt=await authority.begin({companyId,agentId:b.scope.agentId,runId:b.runId,issueId:b.scope.issueId});
 const token=f=>createLocalAgentJwt(f.scope.agentId,companyId,'process',f.runId,f.scope.memberId,{kind:'standard'},f.attempt.authorityEpoch);
 let loseInsert=true;
 const boundary=createContributionBoundary({enabled:()=>true,clock:Date.now,loadEnrollment:async(actor,issueId)=>{
  sourceCalls++;const current=await authority.readCurrent(actor,issueId);if(!current)return null;const f=fixtures.find(x=>x.scope.issueId===issueId);if(!f)return null;
  return {...f.scope,authorityEpoch:current.authorityEpoch,enabled:true,active:f.enrollmentActive,runId:f.runId,checkoutRunId:f.runId,taskRevision:nativeTaskRevision(f.issue),providerLeaseId:'synthetic-native-provider-lease',lifecycleGeneration:'synthetic-X',lifecycleDisposition:f.lifecycle,enrollmentRevision:'synthetic-approved-enrollment',expiresAt:f.expiresAt,dataClass:'approved-public',artifactClass:'text-evidence',input:'Approved public task only'};
 },readNative:async binding=>{const f=fixtures.find(x=>x.scope.issueId===binding.issueId);return f?createNativeContributionReader(ctx,f.scope)(binding):null;},journal:{...journal,put:async c=>{await journal.put(c);if(loseInsert){loseInsert=false;throw Error('Synthetic committed response loss');}}}});
 const authenticate=authModule.createNativeMemberAuthenticator({db,authority});
 const handler=createContributionIngress({enabled:()=>true,boundary,authenticate});
 const app=express();let parsedBodies=0,raceNativeCheckout=false;app.use((req,_res,next)=>{req.actor={type:'agent',source:'agent_jwt',agentId:a.scope.agentId,companyId,runId:a.runId,onBehalfOfUserId:a.scope.memberId};next();});
 app.use('/api/member-contributions',(req,res)=>void handler(req,res));
 app.use(memberAttemptPreparseGuard(db,{deploymentMode:'authenticated',memberAttemptAuthority:authority}));
 app.use(express.json({limit:4096,verify:()=>{parsedBodies++;}}));
 app.use('/api',actorMiddleware(db,{deploymentMode:'authenticated',memberAttemptAuthority:authority}),async(req,_res,next)=>{try{if(raceNativeCheckout&&req.path===`/issues/${a.scope.issueId}/checkout`){raceNativeCheckout=false;a.attempt=await authority.begin({companyId,agentId:a.scope.agentId,runId:a.runId,issueId:a.scope.issueId});}next();}catch(error){next(error);}},issueRoutes(db,undefined,{memberAttemptAuthority:authority}));
 app.use((error,_req,res,_next)=>res.status(error.status??500).json({error:'native_request_rejected'}));const server=createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin=`http://127.0.0.1:${server.address().port}`,url=origin+'/api/member-contributions';
 const request=(path,body,bearer=token(a),headers={})=>fetch(url+path,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+bearer,...headers},body:JSON.stringify(body)});
 try {
  for(const bearer of ['',baseToken,baseToken+'.forged'])assert.notEqual((await request('/export',{issueId:a.scope.issueId},bearer)).status,200);
  assert.equal((await request('/export',{issueId:a.scope.issueId},token(a),{'x-paperclip-run-id':b.runId})).status,403,'signed native run cannot be replaced by a request header');
  const emptyApp=express();let emptyParsed=0,emptyActions=0;emptyApp.use(memberAttemptPreparseGuard(db,{deploymentMode:'authenticated'}));emptyApp.use(express.json({verify:()=>emptyParsed++}));emptyApp.post('/api/issues/:id/checkout',(_req,res)=>{emptyActions++;res.status(204).end();});emptyApp.use((error,_req,res,_next)=>res.status(error.status??500).json({error:'native_request_rejected'}));
  const emptyServer=createServer(emptyApp);await new Promise(r=>emptyServer.listen(0,'127.0.0.1',r));try{const response=await fetch(`http://127.0.0.1:${emptyServer.address().port}/api/issues/${a.scope.issueId}/checkout`,{method:'POST',headers:{authorization:'Bearer '+token(a),'content-type':'application/json'},body:'{malformed'});assert.equal(response.status,403);assert.equal(emptyParsed,0);assert.equal(emptyActions,0);}finally{await new Promise(r=>{emptyServer.closeAllConnections();emptyServer.close(r);});}
  const boardKey=await boardAuthService(db).createNamedBoardApiKey({userId:a.scope.memberId,name:'Disposable synthetic unsupported member identity'});assert.equal((await request('/export',{issueId:a.scope.issueId},boardKey.token)).status,403,'native board key is not member attempt authority');
  const agentKey='synthetic-'+randomUUID();await sql`INSERT INTO agent_api_keys(agent_id,company_id,name,key_hash,responsible_user_id,scope_config) VALUES (${a.scope.agentId},${companyId},'Disposable synthetic agent key',${contributionHash(agentKey)},${a.scope.memberId},${sql.json({kind:'standard'})}::jsonb)`;assert.equal((await request('/export',{issueId:a.scope.issueId},agentKey,{'x-paperclip-run-id':a.runId})).status,403,'native reusable agent key plus run header is not attempt authority');
  const count=sourceCalls;assert.equal((await request('/export',{issueId:a.scope.issueId},baseToken)).status,403);assert.equal(sourceCalls,count,'absent jti denied before enrollment/native boundary access');
  assert.equal((await fetch(origin+'/api/issues/'+a.scope.issueId,{headers:{authorization:'Bearer '+token(a)}})).status,403,'marked member token cannot read broad native API');
  assert.equal((await fetch(origin+'/api/issues/'+a.scope.issueId,{headers:{authorization:'Bearer '+baseToken}})).status,200,'unmarked native JWT behavior remains unchanged');
  const beforeRejectedBodies=parsedBodies;
  for(const [method,path] of [['POST','/api/issues/'+b.scope.issueId+'/checkout'],['POST','/api/issues/'+a.scope.issueId+'/checkout?target='+b.scope.issueId],['POST','/api/issues/%'+a.scope.issueId.charCodeAt(0).toString(16)+a.scope.issueId.slice(1)+'/checkout'],['POST','/api/issues/'+a.scope.issueId+'/checkout/'],['POST','/api/companies/'+companyId+'/settings'],['DELETE','/api/issues/'+a.scope.issueId+'/checkout']]) {
   assert.equal((await fetch(origin+path,{method,headers:{authorization:'Bearer '+token(a),'content-type':'application/json'},body:'{malformed'})).status,403,'canonical native route/method scope: '+path);
  }
  assert.equal(parsedBodies,beforeRejectedBodies,'rejected paths cannot trigger native JSON parsing');
  const wrongAgent=await fetch(origin+'/api/issues/'+a.scope.issueId+'/checkout',{method:'POST',headers:{authorization:'Bearer '+token(a),'content-type':'application/json'},body:JSON.stringify({agentId:b.scope.agentId,expectedStatuses:['in_progress'],companyId:randomUUID()})});assert.equal(wrongAgent.status,403,'native checkout body cannot change authenticated target agent');
  const input=await (await request('/export',{issueId:a.scope.issueId})).json();assert.equal(input.state,'input');assert.equal(input.input,'Approved public task only');assert.ok(!JSON.stringify(input).includes('Private native title'));
  assert.equal((await request('/export',{issueId:b.scope.issueId})).status,403);
  for(const key of ['memberId','agentId','authorityEpoch','companyId'])assert.equal((await request('/export',{issueId:a.scope.issueId,[key]:'forged'})).status,400);
  const text='Untrusted HTTP evidence',artifact={name:'evidence.txt',mediaType:'text/plain',text,sha256:contributionHash(text)},body={binding:input.binding,artifacts:[artifact]};
  const results=await Promise.all([request('/submit',body).then(r=>r.json()),request('/submit',body).then(r=>r.json())]);assert.equal(results[0].state,'candidate-for-review');assert.deepEqual(results[1],results[0]);
  assert.equal((await request('/submit',{...body,artifacts:[{...artifact,text:'changed',sha256:contributionHash('changed')}]})).status,409);
  assert.equal((await request('/submit',{...body,binding:{...body.binding,companyId:randomUUID()}})).status,403);
  assert.equal((await request('/submit',{...body,artifacts:[{...artifact,name:'../run.sh'}]})).status,400);
  const beforeRace=await native.getById(a.scope.issueId),racingToken=token(a);raceNativeCheckout=true;
  assert.equal((await fetch(origin+'/api/issues/'+a.scope.issueId+'/checkout',{method:'POST',headers:{authorization:'Bearer '+racingToken,'content-type':'application/json'},body:JSON.stringify({agentId:a.scope.agentId,expectedStatuses:['in_progress']})})).status,403,'supersession after auth cannot race native checkout commit');
  assert.equal(String((await native.getById(a.scope.issueId)).updatedAt),String(beforeRace.updatedAt),'late stale checkout makes no native mutation');
  const oldToken=token(a),oldAttempt=a.attempt;
  const concurrentResults=await Promise.allSettled([authority.begin({companyId,agentId:a.scope.agentId,runId:a.runId,issueId:a.scope.issueId}),authority.begin({companyId,agentId:a.scope.agentId,runId:a.runId,issueId:a.scope.issueId})]);
  const concurrent=concurrentResults.filter(r=>r.status==='fulfilled').map(r=>r.value);assert.ok(concurrent.length>=1);
  const current=[];for(const attempt of concurrent){if(await authority.readCurrent(attempt,a.scope.issueId))current.push(attempt);}assert.equal(current.length,1,'concurrent supersession has one current epoch');a.attempt=current[0];
  let loseBegin=true;
  const faultDb=new Proxy(db,{get(target,property){if(property==='transaction')return async(...args)=>{const result=await target.transaction(...args);if(loseBegin){loseBegin=false;throw Error('Synthetic response lost after committed issuance');}return result;};const value=target[property];return typeof value==='function'?value.bind(target):value;}});
  const lossy=attemptsModule.createMemberAttemptAuthority({db:faultDb,scopes});
  a.attempt=await lossy.begin({companyId,agentId:a.scope.agentId,runId:a.runId,issueId:a.scope.issueId});assert.ok(await authority.readCurrent(a.attempt,a.scope.issueId),'lost begin response reconciles immutable epoch');
  const beforeNativeCheckout=(await native.getById(a.scope.issueId)).checkoutRunId,priorParsed=parsedBodies;assert.equal((await fetch(origin+'/api/issues/'+a.scope.issueId+'/checkout',{method:'POST',headers:{authorization:'Bearer '+oldToken,'content-type':'application/json'},body:'{malformed'})).status,403,'old attempt cannot use ordinary native checkout');assert.equal(parsedBodies,priorParsed,'stale native request denied before body parsing');assert.equal((await native.getById(a.scope.issueId)).checkoutRunId,beforeNativeCheckout,'stale token cannot mutate native checkout');
  const bClaims=verifyLocalAgentJwt(token(b)),checkoutContext={claims:bClaims,issueId:b.scope.issueId,agentId:b.scope.agentId,runId:b.runId};
  const beforeRollback=await native.getById(b.scope.issueId);
  await assert.rejects(authority.withNativeCheckout(checkoutContext,async tx=>{await issueService(tx).checkout(b.scope.issueId,b.scope.agentId,['in_progress'],b.runId);throw Error('Synthetic checkout rollback');}),/Synthetic checkout rollback/);
  assert.equal(String((await native.getById(b.scope.issueId)).updatedAt),String(beforeRollback.updatedAt),'native checkout transaction rolls back all native writes');
  let entered,release;const enteredPromise=new Promise(r=>entered=r),releasePromise=new Promise(r=>release=r);
  const heldCheckout=authority.withNativeCheckout(checkoutContext,async tx=>{const result=await issueService(tx).checkout(b.scope.issueId,b.scope.agentId,['in_progress'],b.runId);entered();await releasePromise;return result;});
  await enteredPromise;const waitingSupersession=authority.begin({companyId,agentId:b.scope.agentId,runId:b.runId,issueId:b.scope.issueId});await new Promise(r=>setTimeout(r,50));release();const [,nextB]=await Promise.all([heldCheckout,waitingSupersession]);b.attempt=nextB;assert.ok(await authority.readCurrent(nextB,b.scope.issueId),'checkout/supersession serialize without deadlock');
  const before=nativeCalls;assert.equal((await request('/export',{issueId:a.scope.issueId},oldToken)).status,403);assert.equal(nativeCalls,before,'old epoch denied before native task projection');
  await authority.finish(oldAttempt);assert.ok(await authority.readCurrent(a.attempt,a.scope.issueId),'old finish cannot retire successor');
  // A process reconstruction gets a distinct native boot UUID, even if provider X resumes.
  const restartCode=`import {createDb} from '@paperclipai/db';import {createMemberAttemptAuthority} from './member/attempt-authority.mjs';const db=createDb(process.env.QUALIFICATION_DATABASE_URL);try{const authority=createMemberAttemptAuthority({db,scopes:${JSON.stringify(scopes)}});if(await authority.readCurrent(${JSON.stringify(a.attempt)},${JSON.stringify(a.scope.issueId)}))process.exitCode=1;}finally{await db.$client.end();}`;
  execFileSync(process.execPath,['--input-type=module','-e',restartCode],{env:process.env,stdio:'pipe',timeout:30000});
  a.lifecycle='unknown';assert.equal((await request('/export',{issueId:a.scope.issueId})).status,403);a.lifecycle='active';
  for(const disposition of ['lost','fenced','superseded']){a.lifecycle=disposition;assert.equal((await request('/export',{issueId:a.scope.issueId})).status,403);}a.lifecycle='active';
  a.expiresAt=Date.now()-1;assert.equal((await request('/export',{issueId:a.scope.issueId})).status,403);a.expiresAt=Date.now()+600000;
  await sql`UPDATE company_memberships SET membership_role='viewer' WHERE company_id=${companyId} AND principal_id=${a.scope.memberId}`;assert.equal((await request('/export',{issueId:a.scope.issueId})).status,403);await sql`UPDATE company_memberships SET membership_role='member' WHERE company_id=${companyId} AND principal_id=${a.scope.memberId}`;
  await sql`UPDATE company_memberships SET status='inactive' WHERE company_id=${companyId} AND principal_id=${a.scope.memberId}`;
  assert.equal((await request('/export',{issueId:a.scope.issueId})).status,403);await sql`UPDATE company_memberships SET status='active' WHERE company_id=${companyId} AND principal_id=${a.scope.memberId}`;
  await sql`UPDATE heartbeat_runs SET result_json=${sql.json({executionCancellation:{state:'requested'}})}::jsonb WHERE id=${a.runId}`;
  assert.equal((await request('/export',{issueId:a.scope.issueId})).status,403);await sql`UPDATE heartbeat_runs SET result_json=NULL WHERE id=${a.runId}`;
  await authority.finish(a.attempt);assert.equal((await request('/export',{issueId:a.scope.issueId})).status,403);
  for(const f of fixtures)assert.equal((await native.getById(f.scope.issueId)).status,'in_progress');
  await checkMemberHook({db,sql,companyId,services,issueService,journal});
  console.log('NATIVE_MEMBER_HTTP_ATTEMPT_PASSED',JSON.stringify({syntheticMembers:2,actualNativeJwt:true,signedJti:true,nativePostgresFencing:true,oldAndAbsentJtiDenied:true,concurrentSupersession:true,staleFinishDenied:true,reconstructedOwnerDenied:true,providerEvidence:'synthetic-only',candidateReplayAndConflict:true,nativeCheckoutAtomicFence:true,nativeCheckoutRollback:true,nativeCheckoutRaceDenied:true,markedNativeRoutesRestricted:true,completionMutations:0,liveEnrollment:false,providerExecution:false,atomicAcceptance:false}));
 }finally{await new Promise(r=>{server.closeAllConnections();server.close(r);});if(oldSecret===undefined)delete process.env.PAPERCLIP_AGENT_JWT_SECRET;else process.env.PAPERCLIP_AGENT_JWT_SECRET=oldSecret;}
}
