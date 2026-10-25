/** Focused ordinary functional regressions only. No public-route or adversarial HTTP probes. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {and,eq,sql as drizzleSql} from 'drizzle-orm';
import {heartbeatRuns,issues} from '@paperclipai/db';
import {legacyControllerBootId} from './node_modules/@paperclipai/server/dist/services/legacy-controller-lease.js';
import {createMemberAttemptAuthority} from './member/attempt-authority.mjs';
import {createPluginWorkerManager} from './node_modules/@paperclipai/server/dist/services/plugin-worker-manager.js';
import {createApp} from './node_modules/@paperclipai/server/dist/app.js';
export async function checkMemberFunctional({db,sql,companyId,issueService}) {
 const native=issueService(db),memberId='functional-member-'+randomUUID(),agentId=randomUUID(),projectId=randomUUID(),runId=randomUUID();
 await sql`INSERT INTO "user"(id,name,email,email_verified,created_at,updated_at) VALUES (${memberId},'Functional fixture',${memberId+'@example.invalid'},false,now(),now())`;
 await sql`INSERT INTO company_memberships(company_id,principal_type,principal_id,status,membership_role) VALUES (${companyId},'user',${memberId},'active','member')`;
 await sql`INSERT INTO agents(id,company_id,name,status,adapter_type,adapter_config,runtime_config) VALUES (${agentId},${companyId},'Functional agent','idle','process','{}','{}')`;
 await sql`INSERT INTO projects(id,company_id,name) VALUES (${projectId},${companyId},'Functional native transaction fixture')`;
 const issue=await native.create(companyId,{title:'Functional concurrent checkout',projectId,status:'todo',priority:'medium',responsibleUserId:memberId,createdByUserId:memberId});
 await sql`INSERT INTO heartbeat_runs(id,company_id,agent_id,status,responsible_user_id,controller_boot_id,controller_lease_expires_at,runtime_mode,context_snapshot) VALUES (${runId},${companyId},${agentId},'running',${memberId},${legacyControllerBootId},now()+interval '10 minutes','legacy',${sql.json({issueId:issue.id})}::jsonb)`;
 await native.checkout(issue.id,agentId,['todo'],runId);
 const scope={companyId,projectId,issueId:issue.id,agentId,memberId},authority=createMemberAttemptAuthority({db,scopes:[scope]}),attempt=await authority.begin({companyId,agentId,runId,issueId:issue.id});
 const context={claims:{inertia_member_attempt:true,jti:attempt.authorityEpoch,company_id:companyId,sub:agentId,responsible_user_id:memberId,run_id:runId},issueId:issue.id,agentId,runId};
 const namedDb=name=>new Proxy(db,{get(target,property){if(property==='transaction')return callback=>target.transaction(async tx=>{await tx.execute(drizzleSql`select set_config('application_name',${name},true)`);return callback(tx);});const value=target[property];return typeof value==='function'?value.bind(target):value;}});
 const waitBlocked=async name=>{const until=Date.now()+2000;while(Date.now()<until){const rows=await sql`SELECT wait_event_type FROM pg_stat_activity WHERE application_name=${name}`;if(rows.some(r=>r.wait_event_type==='Lock'))return;await new Promise(r=>setTimeout(r,5));}throw Error('Functional fixture did not reach expected database wait');};
 // Two valid same-attempt checkouts must serialize before either starts the
 // native service; compatible shared locks followed by native upgrades do not.
 let firstEntered,releaseFirst;const entered=new Promise(r=>firstEntered=r),release=new Promise(r=>releaseFirst=r);let operations=0;
 const first=authority.withNativeCheckout(context,async tx=>{operations++;firstEntered();await release;return issueService(tx).checkout(issue.id,agentId,['in_progress'],runId);});await entered;
 const secondAuthority=createMemberAttemptAuthority({db:namedDb('member-functional-second-checkout'),scopes:[scope]});
 const second=secondAuthority.withNativeCheckout(context,async tx=>{operations++;return issueService(tx).checkout(issue.id,agentId,['in_progress'],runId);});
 let serialFailure=null;try{await waitBlocked('member-functional-second-checkout');assert.equal(operations,1,'second same-issue checkout waits before native operation/lock upgrades');}catch(error){serialFailure=error;}finally{releaseFirst();}
 const concurrent=await Promise.allSettled([first,second]);if(serialFailure)throw serialFailure;assert.ok(concurrent.every(r=>r.status==='fulfilled'),'both valid native checkouts succeed');assert.equal(operations,2);
 // Actual native clearing code locks issue then run. A current-authority read
 // must use that order too, rather than pinning run while waiting for issue.
 let issueLocked,continueNative;const locked=new Promise(r=>issueLocked=r),proceed=new Promise(r=>continueNative=r);
 const ordinary=db.transaction(async tx=>{await tx.execute(drizzleSql`SET LOCAL lock_timeout='3s'`);await tx.select({id:issues.id}).from(issues).where(eq(issues.id,issue.id)).for('update');issueLocked();await proceed;return issueService(tx).checkout(issue.id,agentId,['in_progress'],runId);});await locked;
 const readerAuthority=createMemberAttemptAuthority({db:namedDb('member-functional-current-reader'),scopes:[scope]});const reader=readerAuthority.readCurrent(attempt,issue.id);
 try{await waitBlocked('member-functional-current-reader');}finally{continueNative();}
 const aligned=await Promise.allSettled([ordinary,reader]);assert.ok(aligned.every(r=>r.status==='fulfilled'),'authority read and ordinary native issue-then-run checkout complete');assert.ok(aligned[1].value);
 // Inspect the actual stock app's registered middleware, without HTTP requests
 // or replacing unavailable environment capabilities. A construction limit is
 // reported as an open full-app qualification gate, never shimmed around.
 let stockAppOrder='unqualified',stockAppBlocker=null,stockApp=null;const stockAppWorkers=createPluginWorkerManager();
 try {
  const app=stockApp=await createApp(db,{uiMode:'none',serverPort:3100,storageService:{},deploymentMode:'authenticated',deploymentExposure:'private',bindHost:'127.0.0.1',allowedHostnames:['127.0.0.1'],memberAttemptAuthority:authority,pluginWorkerManager:stockAppWorkers});
  const stack=app.router?.stack??app._router?.stack??[];
  const admission=stack.find(layer=>layer.handle?.stack?.[0]?.handle?.name==='selectMarkedMemberAttempt');
  assert.ok(admission,'actual stock app registers the marked-only admission router');
  assert.deepEqual(admission.handle.stack.map(layer=>layer.handle.name),['selectMarkedMemberAttempt','checkMemberHostname','checkMemberCloudIdentity','checkMemberWarmStandby','authenticateMarkedMemberAttempt']);
  const index=stack.indexOf(admission),parser=stack.findIndex(layer=>layer.handle.name==='jsonParser');assert.ok(index>=0&&parser>index,'stock marked admission gates precede generic parsing');stockAppOrder='registration-verified';
 } catch(error) {
  if(error?.code==='ERR_SYSTEM_ERROR'&&String(error.message).includes('uv_interface_addresses'))stockAppBlocker='Actual stock app construction failed: uv_interface_addresses system error';else throw error;
 } finally {
  if(stockApp){await stockApp.locals.bundledPluginsStartup;await stockApp.locals.paperclipShutdown();}await stockAppWorkers.stopAll();
 }
 assert.equal((await native.getById(issue.id)).status,'in_progress');
 console.log('MEMBER_FUNCTIONAL_REGRESSIONS_PASSED',JSON.stringify({sameAttemptCheckouts:2,nativeIssueThenRunOrder:true,stockAppOrder,stockAppBlocker,securitySignoff:false,publicRouteProbes:false}));
}
