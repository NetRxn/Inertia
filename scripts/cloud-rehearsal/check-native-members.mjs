/** Disposable native-service assertions. No provider, runner, scheduler or account login. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function checkNativeMembers({ db, sql, companyId, services, issueService }) {
  const issues = issueService(db);
  const member = `fixture-${randomUUID()}`;
  await sql`INSERT INTO "user" (id,name,email,email_verified,created_at,updated_at)
    VALUES (${member},'Synthetic member two',${member+'@example.invalid'},false,now(),now())`;
  await sql`INSERT INTO company_memberships (company_id,principal_type,principal_id,status,membership_role)
    VALUES (${companyId},'user',${member},'active','member')`;
  const issue = await issues.create(companyId, {title:'Synthetic member execution and review',status:'todo',priority:'medium'});
  const comment = await services.issues.createComment({companyId,issueId:issue.id,actorUserId:member,body:'Synthetic review evidence, not approval or submission.'});
  assert.equal(comment.authorUserId,member);
  await sql`UPDATE company_memberships SET membership_role='viewer' WHERE principal_id=${member}`;
  await assert.rejects(()=>services.issues.createComment({companyId,issueId:issue.id,actorUserId:member,body:'MUST NOT WRITE'}),/viewer/i);
  await sql`UPDATE company_memberships SET membership_role='member',status='inactive' WHERE principal_id=${member}`;
  await assert.rejects(()=>services.issues.createComment({companyId,issueId:issue.id,actorUserId:member,body:'MUST NOT WRITE'}),/active human member/i);
  assert.equal((await issues.listComments(issue.id)).length,1);

  const agentIds = [randomUUID(),randomUUID()];
  const runs = [randomUUID(),randomUUID(),randomUUID()];
  for (const [i,id] of agentIds.entries())
    await sql`INSERT INTO agents (id,company_id,name,status,adapter_type,adapter_config,runtime_config)
      VALUES (${id},${companyId},${'Synthetic member runner '+i},'idle','process','{}','{}')`;
  for (const [i,id] of runs.entries())
    await sql`INSERT INTO heartbeat_runs (id,company_id,agent_id,status)
      VALUES (${id},${companyId},${agentIds[i===1?1:0]},'running')`;
  const outcomes=await Promise.allSettled(agentIds.map((id,i)=>issues.checkout(issue.id,id,['todo'],runs[i])));
  assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(outcomes.filter(x=>x.status==='rejected').length,1);
  const winner=outcomes.findIndex(x=>x.status==='fulfilled'),loser=1-winner;
  const checked=outcomes[winner].value;
  assert.equal(checked.checkoutRunId,runs[winner]);
  assert.equal((await issues.checkout(issue.id,agentIds[winner],['todo','in_progress'],runs[winner])).id,issue.id);
  await assert.rejects(()=>issues.release(issue.id,agentIds[loser],runs[loser]),/assignee/i);
  await assert.rejects(()=>issues.release(issue.id,agentIds[winner],runs[loser]),/checkout run/i);
  // Authoritative terminal run record models a crashed executor. Native release and
  // checkout own recovery; no replacement task queue or lease implementation.
  await sql`UPDATE heartbeat_runs SET status='failed',finished_at=now() WHERE id=${runs[winner]}`;
  assert.equal((await issueService(db).release(issue.id,agentIds[winner],runs[winner])).status,'todo');
  const recovered=await issueService(db).checkout(issue.id,agentIds[loser],['todo'],runs[loser]);
  assert.equal(recovered.assigneeAgentId,agentIds[loser]);
  await assert.rejects(()=>issues.release(issue.id,agentIds[winner],runs[winner]),/assignee/i);
  await issues.release(issue.id,agentIds[loser],runs[loser]);
  await sql`UPDATE agents SET status='terminated' WHERE id=${agentIds[loser]}`;
  await assert.rejects(()=>issues.checkout(issue.id,agentIds[loser],['todo'],runs[loser]),/terminated/i);
  const crossCompany=await sql`INSERT INTO companies (name,issue_prefix) VALUES ('Other synthetic company',${'X'+randomUUID().slice(0,5)}) RETURNING id`;
  const foreign=await issues.create(crossCompany[0].id,{title:'Foreign synthetic task',status:'todo',priority:'medium'});
  await assert.rejects(()=>issues.checkout(foreign.id,agentIds[winner],['todo'],runs[winner]),/same company/i);
  console.log('NATIVE_SECOND_MEMBER_ASSERTIONS_PASSED',JSON.stringify({humanAttribution:true,viewerDenied:true,revocationDenied:true,oneConcurrentCheckout:true,duplicateCheckout:true,wrongHolderDenied:true,terminalRunRecovery:true,staleHolderDenied:true,terminatedRunnerDenied:true,crossCompanyDenied:true,realExecutorContainer:false,liveMemberEnrollment:false}));
}
