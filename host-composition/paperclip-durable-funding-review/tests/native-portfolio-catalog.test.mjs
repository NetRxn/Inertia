/** Executes the actual composed authority method bodies; no provider or native mutation. */
import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';
import{createNativeDomainReviewComposition}from'../transport/native/native-domain-review-composition.mjs';
const candidate=process.env.NATIVE_PORTFOLIO_CANDIDATE;
test('compiled funding reviewer catalog passes trusted current child into whole-packet schema',{skip:!candidate},async()=>{
 const source=await readFile(candidate+'/dist/services/native-runtime/paperclip-runner-tool-authority.js','utf8');
 const scope={companyId:'company',projectId:'project',issueId:'root',portfolioRootIssueId:'root',producerAgentId:'beta',reviewerAgentId:'alpha',producerPrincipalId:'p-beta',reviewerPrincipalId:'p-alpha',wholePacketReview:true};
 const composition=createNativeDomainReviewComposition();composition.install({preparationReviewEnabled:true,scopes:[scope],acquireFence:async()=>{},authorize:async()=>true,readReviewContext:async()=>{},admitReview:async()=>{},readReviewReceipt:async()=>{}});
 const issue={companyId:'company',projectId:'project',id:'child',parentId:'root'};
 const reviewStart=source.indexOf('    #reviewDefinitions('),reviewEnd=source.indexOf('    async #fundingDefinitions()',reviewStart);assert(reviewStart>=0&&reviewEnd>reviewStart);
 const definition=source.slice(reviewStart,reviewEnd).trim().replace(/^#reviewDefinitions/,'function reviewDefinitions');
 const reviewDefinitions=new Function('nativeDomainReviewComposition','CAPABILITY_SEMANTIC_TOOL_CATALOG','NATIVE_REVIEW_READ_TOOLS','return ('+definition+');')(composition,[],new Set());
 const start=source.indexOf('    async #fundingDefinitions() {'),end=source.indexOf('    async execute(call)',start);assert(start>=0&&end>start);
 const body=source.slice(start+'    async #fundingDefinitions() {'.length,end).trim().replace(/}\s*$/,'').replaceAll('await this.#boundContext()','current').replaceAll('this.#reviewDefinitions(', 'reviewDefinitions.call(this,');
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 const tools=await new AsyncFunction('current','reviewDefinitions','nativeDomainReviewComposition',body).call({binding:{companyId:'company',issueId:'child',nativeFundingPolicy:{role:'reviewer'}}},{issue},reviewDefinitions,composition);
 assert(tools.some(t=>t.name==='record_preparation_review'),'Enabled current-set mode exposes exact scoped record tool');
 const schema=tools.find(t=>t.name==='resolve_review').inputSchema.properties.domainReview;
 assert.equal(schema.oneOf?.length,3,'Whole-packet child must receive candidate, packet and typed gap artifact schemas');
});
test('compiled board discovery grant guard accepts worker only inside the exact existing ceiling',{skip:!candidate},async()=>{
 const{normalizeNativeFundingPolicy}=await import('../transport/native/native-portfolio-funding-policy.mjs');
 const source=await readFile(candidate+'/dist/services/native-discovery-tool-grants.mjs','utf8');
 const start=source.indexOf('  let policy;'),end=source.indexOf('  const[grant]',start);assert(start>=0&&end>start);
 const guard=new Function('normalizeNativeFundingPolicy','agent','role','c','a','conflict',source.slice(start,end));
 const project='44444444-4444-4444-8444-444444444444',issue='55555555-5555-4555-8555-555555555555';
 const agent={adapterConfig:{provider:'codex',engine:'cli',disableCommandExecution:true,dangerouslyBypassApprovalsAndSandbox:false,codexPermissionMode:'never',nativeFunding:{version:1,role:'worker',projectIds:[project],issueIds:[issue]}}};
 const run=(role='scout',c={projectId:project},a={issueId:issue})=>guard(normalizeNativeFundingPolicy,agent,role,c,a,message=>new Error(message));
 run();run('diligence');assert.throws(()=>run('scout',{projectId:'foreign'}),/ceiling/);assert.throws(()=>run('scout',{projectId:project},{issueId:'foreign'}),/ceiling/);
 agent.adapterConfig.nativeFunding.role='reviewer';assert.throws(()=>run(),/ceiling/);
});
