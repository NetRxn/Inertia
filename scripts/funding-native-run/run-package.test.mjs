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
