import {scopeForIssue,templateMatches} from './native-portfolio-scope.mjs';
/** Fresh native-table admission for the existing owning-host review runtime.
 * No listener, lifecycle operation, grants, cache or configuration write.
 * Construction inputs are protected administrator state, never model arguments.
 */
import {createHash} from 'node:crypto';
import {isAbsolute} from 'node:path';
const pluginKey='netrxn.inertia';
const scopeKeys=['companyId','projectId','issueId','producerAgentId','reviewerAgentId','producerPrincipalId','reviewerPrincipalId'];
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const keys=(v,allowed,required=allowed)=>object(v)&&Object.keys(v).every(k=>allowed.includes(k))&&required.every(k=>Object.hasOwn(v,k));
const id=v=>typeof v==='string'&&v.length>0&&v.length<=200&&!/[\s\x00-\x1f\x7f]/.test(v);
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const invalid=()=>{throw Error('native_domain_review_host_configuration_invalid');};
function canonical(v){
  if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return JSON.stringify(v);
  if(Array.isArray(v))return '['+Array.from(v,canonical).join(',')+']';
  if(object(v))return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
  return invalid();
}
const fingerprint=v=>createHash('sha256').update(canonical(v)).digest('hex');
function validProcess(p){
  return keys(p,['executable','args','cwd','entrypoint','configurationPath','timeoutMs','maxOutputBytes','pins'])
    &&[p.executable,p.cwd,p.entrypoint,p.configurationPath].every(v=>typeof v==='string'&&isAbsolute(v))
    &&Array.isArray(p.args)&&p.args.length<=30&&p.args.every(v=>typeof v==='string'&&v.length<=4096)
    &&p.args.includes(p.entrypoint)&&p.args.includes(p.configurationPath)
    &&Number.isInteger(p.timeoutMs)&&p.timeoutMs>=100&&p.timeoutMs<=120000
    &&Number.isInteger(p.maxOutputBytes)&&p.maxOutputBytes>=1024&&p.maxOutputBytes<=4*1024*1024
    &&Array.isArray(p.pins)&&p.pins.length>=2&&p.pins.length<=256
    &&p.pins.every(v=>keys(v,['path','sha256'])&&typeof v.path==='string'&&isAbsolute(v.path)&&hash(v.sha256))
    &&new Set(p.pins.map(v=>v.path)).size===p.pins.length
    &&[p.entrypoint,p.configurationPath].every(path=>p.pins.some(pin=>pin.path===path));
}
function validDrafting(c,s){
  const required=['enabled','nativeAttention','projectId','applicantSlug','matchId','producer','reviewer','process'];
  if(!keys(c,[...required,'portfolioRootIssueId','nativeCaseProgression','nativeDependencyHandoff','nativeGapPlanReview'],required)
    ||c.enabled!==true||c.nativeAttention!==true||c.projectId!==s.projectId||!id(c.applicantSlug)||c.applicantSlug.length>128||!id(c.matchId)
    ||['nativeCaseProgression','nativeDependencyHandoff'].some(k=>Object.hasOwn(c,k)&&c[k]!==false)
    ||c.nativeGapPlanReview!==undefined&&typeof c.nativeGapPlanReview!=='boolean'
    ||c.portfolioRootIssueId!==s.portfolioRootIssueId||!validProcess(c.process))return false;
  return [['producer',s.producerAgentId,s.producerPrincipalId],['reviewer',s.reviewerAgentId,s.reviewerPrincipalId]].every(([role,agentId,principalId])=>
    keys(c[role],['issueId','agentId','principalId'])&&c[role].issueId===s.issueId&&c[role].agentId===agentId&&c[role].principalId===principalId);
}

/** Pure policy shared by the real table reader and focused source tests.
 * The complete original publicDrafting object, including process pins, is hashed.
 * Native participant authorization is a separate mandatory runtime check.
 */
export function createNativeReviewHostAdmissionPolicy({scope,expectedPluginId,applicantSlug,matchId,publicDrafting,privatePreparation}={}){
  if(!id(expectedPluginId)||!(keys(scope,[...scopeKeys,'wholePacketReview','portfolioRootIssueId'],scopeKeys)&&(scope.wholePacketReview===undefined||scope.wholePacketReview===true))||scopeKeys.some(k=>!id(scope[k]))||scope.portfolioRootIssueId!==undefined&&(scope.portfolioRootIssueId!==scope.issueId||scope.wholePacketReview!==true)||scope.producerAgentId===scope.reviewerAgentId||scope.producerPrincipalId===scope.reviewerPrincipalId)invalid();
  const pinned=Object.freeze({...scope});
  const privateMode=privatePreparation!==undefined;
  const adapt=c=>{if(!privateMode)return c;if(!object(c)||!id(c.policyRevision))return null;const{policyRevision,...rest}=c;return{...rest,nativeAttention:true};};
  const configured=privateMode?privatePreparation:publicDrafting;
  if(!id(applicantSlug)||applicantSlug.length>128||!id(matchId)||!validDrafting(adapt(configured),pinned)||configured.applicantSlug!==applicantSlug||configured.matchId!==matchId)invalid();
  const initial=fingerprint(configured);
  return (rows,requestedScope,input)=>{
    if(!keys(requestedScope,[...scopeKeys,'wholePacketReview','portfolioRootIssueId'],scopeKeys)||(requestedScope.wholePacketReview===true)!==(pinned.wholePacketReview===true)||requestedScope.wholePacketReview!==undefined&&requestedScope.wholePacketReview!==true||!templateMatches(requestedScope,pinned)||!scopeForIssue(pinned,input?.issue)
      ||input?.issue?.companyId!==pinned.companyId||input.issue.id!==requestedScope.issueId||input.issue.projectId!==pinned.projectId
      ||input.actor?.agentId!==pinned.reviewerAgentId||!id(input.actor.runId)||!Array.isArray(rows)||rows.length!==1)return false;
    const row=rows[0];
    if(!row||row.pluginId!==expectedPluginId||row.pluginKey!==pluginKey||row.status!=='ready'
      ||!id(row.configId)||row.configPluginId!==row.pluginId||row.configCompanyId!==pinned.companyId)return false;
    if(row.settingsId!==null&&row.settingsId!==undefined){
      if(!id(row.settingsId)||row.settingsPluginId!==row.pluginId||row.settingsCompanyId!==pinned.companyId||row.enabled!==true)return false;
    }else if(row.settingsPluginId!=null||row.settingsCompanyId!=null||row.enabled!=null)return false;
    const config=row.configJson;
    try{return config?.nativeFundingToolPreapproval===true&&validDrafting(adapt(privateMode?config.privatePreparation:config.publicDrafting),pinned)&&fingerprint(privateMode?config.privatePreparation:config.publicDrafting)===initial;}
    catch{return false;}
  };
}

/** Produces native.assertHostAdmission(scope, immutableInput).
 * Uses stock schema tables and one SELECT snapshot on every invocation; it never
 * calls the plugin-host ensurePluginAvailableForCompany no-op or infers grants.
 * Root owns installation and the immutable trusted publicDrafting snapshot.
 */
export async function createNativeReviewHostAdmission(db,expected){
  const check=createNativeReviewHostAdmissionPolicy(expected);
  if(typeof db?.select!=='function')invalid();
  const companyId=expected.scope.companyId,pinnedPluginId=expected.expectedPluginId;
  const [{and,eq},{plugins,pluginCompanySettings,pluginConfig}]=await Promise.all([import('drizzle-orm'),import('@paperclipai/db')]);
  return async(requestedScope,input)=>{
    let rows;
    try{
      rows=await db.select({pluginId:plugins.id,pluginKey:plugins.pluginKey,status:plugins.status,
        settingsId:pluginCompanySettings.id,settingsPluginId:pluginCompanySettings.pluginId,settingsCompanyId:pluginCompanySettings.companyId,enabled:pluginCompanySettings.enabled,
        configId:pluginConfig.id,configPluginId:pluginConfig.pluginId,configCompanyId:pluginConfig.companyId,configJson:pluginConfig.configJson})
        .from(plugins)
        .leftJoin(pluginCompanySettings,and(eq(pluginCompanySettings.pluginId,plugins.id),eq(pluginCompanySettings.companyId,companyId)))
        .leftJoin(pluginConfig,and(eq(pluginConfig.pluginId,plugins.id),eq(pluginConfig.companyId,companyId)))
        .where(and(eq(plugins.pluginKey,pluginKey),eq(plugins.id,pinnedPluginId))).limit(2);
    }catch{throw Error('native_domain_review_host_admission_unavailable');}
    return check(rows,requestedScope,input);
  };
}
