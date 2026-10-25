import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { prepare, checkOutcome } from './run-package.mjs';

// These are deliberately synthetic unit-test inputs, never runtime defaults.
const config = () => ({
  runKey: 'unit-test', paperclipApiBase: 'http://127.0.0.1:9999', companyId: 'test-company',
  projectId: 'test-project', memberRef: 'test-member', coordinatorAgentId: 'test-coordinator',
  agents: [
    {agentId:'test-codex', workspaceRef:'test-codex-workspace', roles:['research','partner_discovery'], provider:{adapterType:'codex_local',connectionRef:'test-codex-access',model:'test-model',apiBase:'adapter-managed'}},
    {agentId:'test-claude', workspaceRef:'test-claude-workspace', roles:['assembly','review','member_requests'], provider:{adapterType:'claude_local',connectionRef:'test-claude-access',model:'test-model',apiBase:'adapter-managed'}}
  ],
  objectives: {
    funding:{issueId:'test-funding',origin:'wednesday-meeting',request:'Prepare a current source-backed application'},
    memberRequest:{issueId:'test-member-request',origin:'problem',request:'Investigate an authorized member problem and propose a fix'}
  },
  funding: {profileSlug:'test-profile', matchId:'test-match', fundingSkillRef:'test-skill', scopeBindingRef:'test-real-resolver'},
  tools: { search:'test-search', read:'test-read', knowledgeAdmission:'test-admission', knowledgeQuery:'test-query', correctionReplayDenial:'test-qualified-test' },
  sourceFacts:[{ref:'source:test-fact',kind:'raw-capture',sha256:'a'.repeat(64),status:'self-published'}],
  limits:{maxReworkRounds:2,maxWallClockMinutes:30,maxProviderCostUsd:5}
});

test('prepare reports unknown runtime inputs rather than inventing provider or identities', () => {
  const c=config(); c.companyId=null; c.tools.knowledgeAdmission=null; c.agents[0].provider.model=null;
  const result=prepare(c);
  assert.deepEqual(result.missing,['companyId','tools.knowledgeAdmission','agents.0.provider.model']);
  assert.deepEqual(result.files,{});
});
test('prepares both objectives for the existing native coordinator without hard-coding handoffs', () => {
  const result=prepare(config());
  assert.deepEqual(result.missing,[]);
  assert.equal(result.tasks.funding.issueId,'test-funding');
  assert.equal(result.tasks.memberRequest.issueId,'test-member-request');
  assert.equal(result.tasks.funding.agentId,'test-coordinator');
  assert.equal(result.tasks.funding.wake.payload.issueId,'test-funding');
  assert.deepEqual(Object.keys(result.tasks),['funding','memberRequest']);
  assert.ok(result.files['funding.md'].includes('test-profile'));
});
test('provider assignments remain configurable by role rather than fixed writer/checker', () => {
  const c=config(); [c.agents[0].provider,c.agents[1].provider]=[c.agents[1].provider,c.agents[0].provider];
  assert.deepEqual(prepare(c).missing,[]);
});
function candidate(kind='funding', provider='codex_local') {
  const c=config(); c.stage='candidate'; c.objective=kind;
  c.agents=c.agents.filter(agent=>agent.provider.adapterType===provider);
  c.coordinatorAgentId=c.agents[0].agentId;
  delete c.objectives[kind==='funding'?'memberRequest':'funding'];
  delete c.tools.knowledgeAdmission; delete c.tools.correctionReplayDenial;
  if (kind==='memberRequest') delete c.funding;
  return c;
}
test('Codex-only candidate renders only the selected original native objective without claiming collaboration', () => {
  const c=candidate(); const result=prepare(c);
  assert.deepEqual(result.missing,[]);
  assert.deepEqual(Object.keys(result.tasks),['funding']);
  assert.deepEqual(Object.keys(result.files),['funding.md']);
  assert.equal(result.tasks.funding.issueId,'test-funding');
  assert.equal(result.tasks.funding.agentId,'test-codex');
  assert.equal(result.tasks.funding.stage,'candidate');
  assert.deepEqual(result.tasks.funding.wake.payload,{issueId:'test-funding'});
  const text=result.files['funding.md'];
  assert.ok(text.includes('Original objective: Prepare a current source-backed application'));
  assert.match(text,/candidate preparation only/i);
  assert.match(text,/independent.*review.*pending/i);
  assert.match(text,/not.*(?:collaboration|collaborative).*complete/i);
  assert.doesNotMatch(text,/test-claude|undefined|Independently critique exact artifact|Perform only the existing operator-approved/);
});
test('candidate task keys cannot collide with full rehearsal on the same original issue and run key', () => {
  const partial=prepare(candidate()).tasks.funding,full=prepare(config()).tasks.funding;
  assert.ok(partial);
  assert.notEqual(partial.documentKey,full.documentKey);
  assert.notEqual(partial.wake.idempotencyKey,full.wake.idempotencyKey);
});
test('member candidate needs no unrelated funding objective and provider roles remain configurable', () => {
  const c=candidate('memberRequest','claude_local'); c.agents[0].roles=['research','assembly'];
  const result=prepare(c);
  assert.deepEqual(result.missing,[]);
  assert.deepEqual(Object.keys(result.tasks),['memberRequest']);
  assert.equal(result.tasks.memberRequest.agentId,'test-claude');
  assert.ok(result.files['memberRequest.md'].includes('Original objective: Investigate an authorized member problem and propose a fix'));
  assert.match(result.files['memberRequest.md'],/roles research, assembly/);
  assert.doesNotMatch(result.files['memberRequest.md'],/test-codex|undefined/);
});
test('full rehearsal still reports unavailable Claude for a Codex-only roster', () => {
  const c=config(); c.agents=[c.agents[0]];
  const result=prepare(c);
  assert.ok(result.missing.includes('agents.provider.claude_local'));
  assert.deepEqual(result.files,{});
  c.agents.push({...c.agents[0],agentId:'another-codex',workspaceRef:'another-workspace'});
  assert.ok(prepare(c).missing.includes('agents.provider.claude_local'));
});
test('stage and candidate objective must be explicit and valid instead of silently broadening work', () => {
  for (const stage of ['partial','',null]) {
    const c=config(); c.stage=stage;
    assert.throws(()=>prepare(c),/stage/);
  }
  for (const objective of [undefined,'both','',null]) {
    const c=candidate(); c.objective=objective;
    assert.throws(()=>prepare(c),/objective/);
  }
});
test('candidate retains real input validation and requires an available coordinator', () => {
  const c=candidate(); c.coordinatorAgentId='unavailable'; c.funding.scopeBindingRef=null;
  c.objectives.funding.request=null; c.agents[0].provider.connectionRef=null;
  const result=prepare(c);
  for (const missing of ['agents.coordinatorAgentId','funding.scopeBindingRef','objectives.funding.request','agents.0.provider.connectionRef'])
    assert.ok(result.missing.includes(missing),missing);
  assert.deepEqual(result.files,{});
  for (const mutate of [c=>c.sourceFacts[0].kind='finished-narrative',c=>c.sourceFacts[0].sha256='invalid',c=>c.agents[0].provider.token='forbidden']) {
    const invalid=candidate(); mutate(invalid); assert.throws(()=>prepare(invalid));
  }
});

test('finished narratives cannot be admitted as generation facts', () => {
  const c=config(); c.sourceFacts[0].kind='finished-narrative';
  assert.throws(()=>prepare(c),/sourceFacts/);
});
test('distinct agents cannot silently share identity or execution workspace', () => {
  for (const key of ['agentId','workspaceRef']) {
    const c=config(); c.agents[1][key]=c.agents[0][key];
    assert.throws(()=>prepare(c),/distinct/);
  }
});
test('credentials are not accepted as runtime configuration fields', () => {
  const c=config(); c.agents[0].provider.apiKey='not-a-real-secret';
  assert.throws(()=>prepare(c),/secret|credential/i);
});
test('CLI prepares protected offline files and refuses to overwrite an existing output', async () => {
  const root=await mkdtemp(join(tmpdir(),'native-run-unit-'));
  try {
    const input=join(root,'config.json'),out=join(root,'output');
    await writeFile(input,JSON.stringify(config()));
    const script=new URL('./run-package.mjs',import.meta.url).pathname;
    const run=()=>spawnSync(process.execPath,[script,'prepare',input,out],{encoding:'utf8'});
    assert.equal(run().status,0);
    assert.deepEqual((await readdir(out)).sort(),['funding.md','memberRequest.md','tasks.json']);
    assert.equal((await stat(out)).mode&0o777,0o700);
    assert.equal((await stat(join(out,'funding.md'))).mode&0o777,0o600);
    const before=await readFile(join(out,'tasks.json'),'utf8');
    assert.equal(run().status,2);
    assert.equal(await readFile(join(out,'tasks.json'),'utf8'),before);
  } finally { await rm(root,{recursive:true,force:true}); }
});

function output() {
  const workspace = { workspace_hash: 'b'.repeat(64), allowed_evidence_ids: ['E1'], allowed_targets: { narrative_section: ['project.summary','project.workplan'] } };
  const saved = { count: 2, suggestions: ['project.summary','project.workplan'].map((key,i)=>({
    id: `suggestion-${i}`, target_type: 'narrative_section', target_key: key, value: `Supported prepared section ${key} using source-backed proposed work.`,
    workspace_hash: 'b'.repeat(64), status: 'suggested', evidence_ids:['E1']
  })) };
  const packet = { artifactRef: 'artifact:test', version: '1', runRef: 'run:test-draft', agentRef: 'agent:test-draft',
    sections: Object.fromEntries(['opportunity_status','applicant_role','eligibility','narrative_workplan','budget_cost_share','forms_attachments','partner_preparation','intake_gaps','source_appendix','review_warnings'].map(k=>[k,{ text: `Prepared ${k} with factual status and source support.`, evidence_ids: ['E1'] }])),
    unresolvedTargets: [],
    critique: { runRef:'run:test-review', agentRef:'agent:test-review', artifactRef:'artifact:test', version:'1', conclusion:'Review identifies source support and missing applicant-specific facts.', findings:[] },
    knowledge: { admittedEvidenceIds:['E1'], admissionRefs:['admission:test'], reuseRunRef:'run:test-reuse', retrievedEvidenceIds:['E1'], queryBeforeResearch:true, correctionReplayDenialRefs:['test:correction','test:replay','test:denial'] }
  };
  return {workspace,saved,packet};
}
test('checks a complete prepared packet without claiming runtime or semantic qualification', () => {
  const {workspace,saved,packet}=output(); const result=checkOutcome(workspace,saved,packet);
  assert.equal(result.readyForHumanQualityReview,true); assert.equal(result.qualified,false);
});
test('one supported paragraph is not a substantial application outcome', () => {
  const {workspace,saved,packet}=output(); saved.suggestions.pop(); saved.count=1;
  packet.sections={narrative_workplan:{text:'Hello'}};
  const result=checkOutcome(workspace,saved,packet);
  assert.equal(result.readyForHumanQualityReview,false);
  assert.ok(result.errors.some(x=>x.startsWith('uncovered target:')));
  assert.ok(result.errors.includes('missing section: budget_cost_share'));
});
test('rejects stale workspaces, fabricated citations and self-approved proposals', () => {
  for (const mutate of [s=>s.workspace_hash='old',s=>s.evidence_ids=['PARTNER:unknown'],s=>s.status='accepted']) {
    const {workspace,saved,packet}=output(); mutate(saved.suggestions[0]);
    assert.equal(checkOutcome(workspace,saved,packet).readyForHumanQualityReview,false);
  }
});
test('explicit evidence gaps preserve target coverage without pretending all sections are draftable', () => {
  const {workspace,saved,packet}=output(); saved.suggestions.pop(); saved.count=1;
  packet.unresolvedTargets=[{target_type:'narrative_section',target_key:'project.workplan',reason:'Delivery schedule evidence is unavailable',owner:'applicant',nextAction:'Provide approved schedule'}];
  const result=checkOutcome(workspace,saved,packet);
  assert.equal(result.readyForHumanQualityReview,true);
  assert.equal(result.unresolvedTargets,1);
});
test('requires exact-version independent critique and fresh admitted-knowledge reuse', () => {
  for (const mutate of [p=>p.critique.agentRef=p.agentRef,p=>p.critique.version='old',p=>p.knowledge.retrievedEvidenceIds=[],p=>p.knowledge.queryBeforeResearch=false,p=>p.knowledge.reuseRunRef=p.runRef]) {
    const {workspace,saved,packet}=output(); mutate(packet);
    assert.equal(checkOutcome(workspace,saved,packet).readyForHumanQualityReview,false);
  }
});
test('empty structures and placeholder-only narrative drafts are not supported content', () => {
  for (const value of [[],{},false,'[[PROJECT_SUMMARY]]','[[FIRST]]\n[[SECOND]]',{body:'[[MISSING]]'}]) {
    const {workspace,saved,packet}=output(); saved.suggestions[0].value=value;
    assert.equal(checkOutcome(workspace,saved,packet).readyForHumanQualityReview,false);
  }
  const {workspace,saved,packet}=output(); packet.sections.narrative_workplan.text='[[FIRST]]\n[[SECOND]]';
  assert.equal(checkOutcome(workspace,saved,packet).readyForHumanQualityReview,false);
});
test('admission and retrieval cannot be claimed with blank reference arrays', () => {
  const {workspace,saved,packet}=output();
  Object.assign(packet.knowledge,{admissionRefs:[''],admittedEvidenceIds:[''],retrievedEvidenceIds:['']});
  assert.equal(checkOutcome(workspace,saved,packet).readyForHumanQualityReview,false);
});
test('source-backed factual sections need an explicit admitted evidence reference', () => {
  const {workspace,saved,packet}=output(); delete packet.sections.opportunity_status.evidence_ids;
  assert.equal(checkOutcome(workspace,saved,packet).readyForHumanQualityReview,false);
});

test('candidate packet without independent review and reuse cannot pass the full outcome check', () => {
  const {workspace,saved,packet}=output(); delete packet.critique; delete packet.knowledge;
  const result=checkOutcome(workspace,saved,packet);
  assert.equal(result.readyForHumanQualityReview,false);
  assert.equal(result.qualified,false);
  assert.ok(result.errors.includes('missing exact-version independent critique'));
  assert.ok(result.errors.includes('missing admitted-knowledge next-run reuse'));
});
test('CLI writes only the candidate objective, while missing full-provider input writes nothing', async () => {
  const root=await mkdtemp(join(tmpdir(),'native-candidate-unit-'));
  try {
    const input=join(root,'config.json'),out=join(root,'candidate'),blocked=join(root,'full');
    const script=new URL('./run-package.mjs',import.meta.url).pathname;
    const run=(destination)=>spawnSync(process.execPath,[script,'prepare',input,destination],{encoding:'utf8'});
    await writeFile(input,JSON.stringify(candidate()));
    assert.equal(run(out).status,0);
    assert.deepEqual((await readdir(out)).sort(),['funding.md','tasks.json']);
    const tasks=JSON.parse(await readFile(join(out,'tasks.json'),'utf8'));
    assert.equal(tasks.funding.stage,'candidate');
    assert.equal(tasks.funding.wake.payload.issueId,'test-funding');
    assert.equal((await stat(out)).mode&0o777,0o700);
    assert.equal((await stat(join(out,'funding.md'))).mode&0o777,0o600);
    const c=config(); c.agents=[c.agents[0]];
    await writeFile(input,JSON.stringify(c));
    const result=run(blocked);
    assert.equal(result.status,1);
    assert.ok(JSON.parse(result.stdout).missing.includes('agents.provider.claude_local'));
    await assert.rejects(()=>stat(blocked),{code:'ENOENT'});
  } finally { await rm(root,{recursive:true,force:true}); }
});
