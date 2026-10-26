/** Owning-server initialization only. No model route, listener or lifecycle controller. */
import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createNativeReviewHostAdmissionPolicy} from './native-review-host-admission.mjs';
import {createNativeReviewStdio} from './native-review-stdio.mjs';
const fail=()=>{throw Error('native_domain_review_application_configuration_invalid');};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const freeze=v=>{if(v&&typeof v==='object'){for(const c of Object.values(v))freeze(c);Object.freeze(v);}return v;};
function validate(registry){
  if(!exact(registry,['version','bindings'])||registry.version!==1||!Array.isArray(registry.bindings)||registry.bindings.length!==1)fail();
  for(const b of registry.bindings){
    if(!exact(b,['scope','reviewerPolicy','process','host'])||!exact(b.host,['expectedPluginId','publicDrafting']))fail();
    const p=b.reviewerPolicy,s=b.scope;
    if(!exact(p,['version','role','projectIds','issueIds'])||p.version!==1||p.role!=='reviewer'||JSON.stringify(p.projectIds)!==JSON.stringify([s?.projectId])||JSON.stringify(p.issueIds)!==JSON.stringify([s?.issueId]))fail();
    // Producer and reviewer are distinct pinned protocols, not interchangeable.
    // Construction validates the reviewer process without launching a child.
    createNativeReviewStdio(b.process);
    createNativeReviewHostAdmissionPolicy({scope:s,expectedPluginId:b.host.expectedPluginId,publicDrafting:b.host.publicDrafting,applicantSlug:b.host.publicDrafting?.applicantSlug,matchId:b.host.publicDrafting?.matchId});
  }
  return registry;
}
export async function preflightNativeReviewApplication(env=process.env){
  const flag=env.PAPERCLIP_NATIVE_DOMAIN_REVIEW_REQUIRED;
  if(flag===undefined||flag==='0')return null;
  if(flag!=='1')fail();
  const file=env.PAPERCLIP_NATIVE_DOMAIN_REVIEW_CONFIG,pin=env.PAPERCLIP_NATIVE_DOMAIN_REVIEW_CONFIG_SHA256;
  if(typeof file!=='string'||!path.isAbsolute(file)||typeof pin!=='string'||!/^[a-f0-9]{64}$/.test(pin))fail();
  let handle;
  try{
    if(await fs.realpath(file)!==file)fail();
    handle=await fs.open(file,constants.O_RDONLY|constants.O_NOFOLLOW);
    const before=await handle.stat();
    if(!before.isFile()||(before.mode&0o777)!==0o600||before.uid!==process.getuid?.()||before.size>256*1024)fail();
    const bytes=await handle.readFile(),after=await handle.stat(),current=await fs.lstat(file);
    if(bytes.length>256*1024||before.size!==after.size||before.mtimeMs!==after.mtimeMs||current.isSymbolicLink()||current.dev!==after.dev||current.ino!==after.ino||createHash('sha256').update(bytes).digest('hex')!==pin)fail();
    return freeze(structuredClone(validate(JSON.parse(bytes.toString('utf8')))));
  }catch{fail();}finally{await handle?.close();}
}
export async function createNativeReviewApplicationRuntime(db,bindings){
  // Validate host configuration before constructing any private process adapter.
  bindings=freeze(structuredClone(validate({version:1,bindings}).bindings));
  const [{and,eq},{agents,heartbeatRuns,issues},{getNativeReviewAssignment},{assertNativeFundingContext},{toolAccessPolicyService},{createNativeReviewHostAdmission},{createNativeReviewRuntime}]=await Promise.all([
    import('drizzle-orm'),import('@paperclipai/db'),import('./native-review-participant.js'),import('./native-funding-policy.js'),import('../tool-access-policy.js'),import('./native-review-host-admission.mjs'),import('./native-review-runtime.mjs'),
  ]);
  const checks=await Promise.all(bindings.map(b=>createNativeReviewHostAdmission(db,{scope:b.scope,...b.host,applicantSlug:b.host.publicDrafting.applicantSlug,matchId:b.host.publicDrafting.matchId})));
  const policy=toolAccessPolicyService(db);
  const getIssue=async(issueId,companyId)=>(await db.select().from(issues).where(and(eq(issues.id,issueId),eq(issues.companyId,companyId))).limit(1))[0];
  return createNativeReviewRuntime({bindings,stdioFactory:createNativeReviewStdio,native:{
    assertHostAdmission(scope,input){const i=bindings.findIndex(b=>b.scope.companyId===scope.companyId&&b.scope.issueId===scope.issueId);return i<0?false:checks[i](scope,input);},
    async assertCurrentReviewer(binding){
      const [actor]=await db.select().from(agents).where(and(eq(agents.id,binding.agentId),eq(agents.companyId,binding.companyId))).limit(1);
      const [run]=await db.select().from(heartbeatRuns).where(and(eq(heartbeatRuns.id,binding.runId),eq(heartbeatRuns.companyId,binding.companyId),eq(heartbeatRuns.agentId,binding.agentId))).limit(1);
      const issue=await getIssue(binding.issueId,binding.companyId);
      if(!actor||!run||run.finishedAt||!issue)throw Error('native_funding_scope_revoked');
      assertNativeFundingContext(binding,{actor,run,issue});
    },
    getIssue,getReviewAssignment:p=>getNativeReviewAssignment(db,p),decideTool:p=>policy.decide(p),
  }});
}
export async function initializeNativeReviewApplication(db,registry){
  if(registry===null)return;
  const {nativeDomainReviewComposition}=await import('./native-domain-review-composition.mjs');
  const runtime=await createNativeReviewApplicationRuntime(db,registry.bindings);
  nativeDomainReviewComposition.install(runtime);
  nativeDomainReviewComposition.assertReady();
}
