/** Board-only exact discovery tool additions. No model/plugin grant administration. */
import{createHash}from'node:crypto';import{and,eq}from'drizzle-orm';
import{agents,companies,companyMemberships,principalPermissionGrants,pluginConfig,plugins,pluginCompanySettings,issues}from'@paperclipai/db';
import{badRequest,conflict,forbidden,notFound}from'../errors.js';
import{authorizationService}from'./authorization.js';import{logActivity,publishActivity}from'./activity-log.js';
import{discoveryFingerprint,DISCOVERY_CANONICAL_TOOLS}from'./native-runtime/native-discovery-policy.mjs';
import{normalizeNativeFundingPolicy}from'./native-runtime/native-funding-policy.js';
const fingerprint=g=>createHash('sha256').update(JSON.stringify({version:1,companyId:g.companyId,agentId:g.principalId,grantId:g.id,scope:g.scope,updatedAt:g.updatedAt.toISOString()})).digest('hex');
function finite(scope){
 if(!scope||typeof scope!=='object'||Array.isArray(scope)||Object.keys(scope).length!==1)throw conflict('Existing finite tools:use grant required');
 const a=Object.hasOwn(scope,'allow')?(typeof scope.allow==='string'?[scope.allow]:scope.allow):null;
 const names=a?.map(n=>typeof n==='string'&&n.startsWith('tool:')?n.slice(5):null)??scope.toolNames;
 if(!Array.isArray(names)||!names.length||names.some(n=>typeof n!=='string'||n.length>240||/[\r\n]/.test(n)||!/^[A-Za-z0-9][A-Za-z0-9._-]*:[A-Za-z0-9][A-Za-z0-9._-]*$/.test(n)))throw conflict('Unsupported current tool scope');
 return [...new Set(names)];
}
export async function addNativeDiscoveryToolGrants(db,{companyId,agentId,actor,body}){
 if(actor?.type!=='board'||actor.source!=='local_implicit'||typeof actor.userId!=='string'||!actor.userId.trim())throw forbidden('Existing local-trusted board operator required');
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join()!=='expectedDiscoveryFingerprint,expectedGrantFingerprint'||[body.expectedDiscoveryFingerprint,body.expectedGrantFingerprint].some(x=>typeof x!=='string'||x.length!==64||!/^[a-f0-9]{64}$/.test(x)))throw badRequest('Exact grant and discovery configuration fingerprints required');
 const publications=[];
 const result=await db.transaction(async tx=>{
  const[company]=await tx.select().from(companies).where(eq(companies.id,companyId)).for('update');if(!company||company.status!=='active')throw conflict('Active company required');
  const[agent]=await tx.select().from(agents).where(and(eq(agents.id,agentId),eq(agents.companyId,companyId))).for('update');if(!agent)throw notFound('Agent not found');
  if(!['active','idle','paused'].includes(agent.status)||agent.role!=='general'||agent.adapterType!=='paperclip_runner')throw conflict('Eligible existing native agent required');
  await tx.select().from(companyMemberships).where(and(eq(companyMemberships.companyId,companyId),eq(companyMemberships.principalType,'user'),eq(companyMemberships.principalId,actor.userId))).for('update');
  await tx.select().from(principalPermissionGrants).where(and(eq(principalPermissionGrants.companyId,companyId),eq(principalPermissionGrants.principalType,'user'),eq(principalPermissionGrants.principalId,actor.userId),eq(principalPermissionGrants.permissionKey,'users:manage_permissions'))).for('update');
  const decision=await authorizationService(tx).decide({actor,action:'users:manage_permissions',resource:{type:'company',companyId}});if(!decision.allowed)throw forbidden('Current board permission-management authority required');
  const[membership]=await tx.select().from(companyMemberships).where(and(eq(companyMemberships.companyId,companyId),eq(companyMemberships.principalType,'agent'),eq(companyMemberships.principalId,agentId))).for('update');if(membership?.status!=='active')throw conflict('Existing active membership required');
  const installed=await tx.select({plugin:plugins,configuration:pluginConfig}).from(plugins).innerJoin(pluginConfig,and(eq(pluginConfig.pluginId,plugins.id),eq(pluginConfig.companyId,companyId))).where(eq(plugins.pluginKey,'netrxn.inertia')).for('update');
  if(installed.length!==1||installed[0].plugin.status!=='ready')throw conflict('One ready Inertia configuration required');
  const p=installed[0],c=p.configuration.configJson?.fundingDiscovery;if(c?.enabled!==true||discoveryFingerprint(c)!==body.expectedDiscoveryFingerprint)throw conflict('Discovery configuration changed');
  const[setting]=await tx.select().from(pluginCompanySettings).where(and(eq(pluginCompanySettings.pluginId,p.plugin.id),eq(pluginCompanySettings.companyId,companyId))).for('update');if(setting&&setting.enabled!==true)throw conflict('Plugin company admission disabled');
  const role=c.agentId===agentId?'scout':c.diligence?.agentId===agentId?'diligence':null,a=role==='scout'?c:role==='diligence'?c.diligence:null;
  if(!role||!a||!c.diligence||!c.principalId||c.agentId===c.diligence?.agentId||c.principalId===c.diligence?.principalId||c.issueId===c.diligence?.issueId||!a.principalId||!a.issueId||!c.projectId)throw conflict('Exact independent discovery role required');
  const[issue]=await tx.select().from(issues).where(and(eq(issues.id,a.issueId),eq(issues.companyId,companyId))).for('update');if(!issue||issue.hiddenAt||issue.projectId!==c.projectId||issue.assigneeAgentId!==agentId||issue.workMode!=='standard'||['done','cancelled'].includes(issue.status)||issue.executionRunId)throw conflict('Idle exact assigned discovery task required');
  let policy;try{policy=normalizeNativeFundingPolicy(agent.adapterConfig);}catch{throw conflict('Exact native funding ceiling required');}if(!policy||![role==='scout'?'producer':'reviewer','worker'].includes(policy.role)||!policy.projectIds.includes(c.projectId)||!policy.issueIds.includes(a.issueId))throw conflict('Discovery task outside native ceiling');
  const[grant]=await tx.select().from(principalPermissionGrants).where(and(eq(principalPermissionGrants.companyId,companyId),eq(principalPermissionGrants.principalType,'agent'),eq(principalPermissionGrants.principalId,agentId),eq(principalPermissionGrants.permissionKey,'tools:use'))).for('update');if(!grant)throw conflict('Existing tools:use row required');
  if(fingerprint(grant)!==body.expectedGrantFingerprint)throw conflict('Tool grant changed');
  const before=finite(grant.scope),names=[...new Set([...before,...DISCOVERY_CANONICAL_TOOLS[role]])].sort(),scope={allow:names.map(n=>'tool:'+n)};
  if(JSON.stringify(scope)===JSON.stringify(grant.scope))return{companyId,agentId,role,toolNames:names,grantFingerprint:fingerprint(grant),replayed:true};
  const[updated]=await tx.update(principalPermissionGrants).set({scope,updatedAt:new Date()}).where(eq(principalPermissionGrants.id,grant.id)).returning();
  await logActivity(tx,{companyId,actorType:'user',actorId:actor.userId,action:'agent.discovery_tool_use_added',entityType:'agent',entityId:agentId,details:{grantId:grant.id,role,issueId:a.issueId,beforeScope:grant.scope,afterScope:scope,expectedGrantFingerprint:body.expectedGrantFingerprint,discoveryFingerprint:body.expectedDiscoveryFingerprint,grantFingerprint:fingerprint(updated)}},publications);
  return{companyId,agentId,role,toolNames:names,grantFingerprint:fingerprint(updated),replayed:false};
 });for(const p of publications)publishActivity(p);return result;
}
