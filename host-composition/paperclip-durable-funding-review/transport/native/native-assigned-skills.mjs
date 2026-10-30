/** Existing call_api reads only: authority comes from the persisted native RUN bundle. */
const VERSION='GET /api/companies/{companyId}/skills/{skillId}/versions/{versionId}',FILE='GET /api/companies/{companyId}/skills/{skillId}/files';
const object=v=>v&&typeof v==='object'&&!Array.isArray(v),deny=()=>{throw Error('native_assigned_skill_read_denied');};
export function selectAssignedSkillRead(snapshot,rows,input,companyId){
 if(!object(input)||Object.keys(input).some(k=>!['operationId','pathParams','query','responseText'].includes(k))||![VERSION,FILE].includes(input.operationId)||!object(input.pathParams)||input.pathParams.companyId!==companyId)deny();
 const isVersion=input.operationId===VERSION,p=input.pathParams;
 if(Object.keys(p).sort().join()!==(isVersion?'companyId,skillId,versionId':'companyId,skillId'))deny();
 const row=rows.find(r=>r.id===p.skillId&&r.companyId===companyId),assigned=snapshot?.skills?.filter(s=>s.key===row?.key&&s.versionId&&/^[a-f0-9]{64}$/.test(s.bundle?.digest));
 if(!row||assigned?.length!==1)deny();const pin=assigned[0];
 if(isVersion){if(p.versionId!==pin.versionId||input.query!==undefined)deny();return{skillId:row.id,versionId:pin.versionId,bundleDigest:pin.bundle.digest};}
 // The existing files endpoint otherwise reads mutable local/github bytes.
 // Its installed-source branch serves the immutable current version inventory.
 if(row.currentVersionId!==pin.versionId||!row.metadata?.skillSourceId||!row.metadata?.snapshotHash||input.query!==undefined&&(!object(input.query)||Object.keys(input.query).some(k=>k!=='path')))deny();
 const path=input.query?.path??'SKILL.md';if(typeof path!=='string'||!path||path.startsWith('/')||path.includes('\\')||path.includes('\0')||path.split('/').some(s=>!s||s==='.'||s==='..'))deny();
 return{skillId:row.id,versionId:pin.versionId,bundleDigest:pin.bundle.digest,path};
}
export const ASSIGNED_SKILL_READ_DEFINITION=Object.freeze({name:'call_api',description:'Read only skills assigned to this persisted native run. Use GET /api/companies/{companyId}/skills/{skillId}/versions/{versionId} with the exact pinned version to read its fileInventory. GET files is available only for the exact installed immutable snapshot; no arbitrary paths, discovery, latest versions or writes.',inputSchema:{type:'object',properties:{operationId:{type:'string',enum:[VERSION,FILE]},pathParams:{type:'object',properties:{companyId:{type:'string'},skillId:{type:'string'},versionId:{type:'string'}},required:['companyId','skillId'],additionalProperties:false},query:{type:'object',properties:{path:{type:'string'}},additionalProperties:false},responseText:{type:'object',properties:{offsetBytes:{type:'integer',minimum:0},limitBytes:{type:'integer',minimum:4,maximum:24576}},additionalProperties:false}},required:['operationId','pathParams'],additionalProperties:false}});
export async function assignedSkillFacts(db,binding,context){
 const raw=context.run.runnerProfileJson?.nativeExecutionInput;if(!raw)return null;
 const {parseNativeExecutionInput}=await import('../../vendor/paperclip-runner/index.js');const execution=parseNativeExecutionInput(raw);
 if(['companyId','issueId','agentId','runId'].some(k=>execution.binding[k]!==binding[k]))deny();
 const snapshot=execution.runtimeContext;if(!snapshot?.skills?.some(s=>s.versionId))return null;
 const[{and,eq,inArray},{companySkills}]=await Promise.all([import('drizzle-orm'),import('@paperclipai/db')]);
 const rows=await db.select().from(companySkills).where(and(eq(companySkills.companyId,binding.companyId),inArray(companySkills.key,snapshot.skills.filter(s=>s.versionId).map(s=>s.key))));
 return{snapshot,rows};
}
export async function assertAssignedSkillRead(db,binding,context,input){const facts=await assignedSkillFacts(db,binding,context);if(!facts)deny();return selectAssignedSkillRead(facts.snapshot,facts.rows,input,binding.companyId);}

export function assignedSkillReadDefinition(facts){
 const assignments=facts.snapshot.skills.flatMap(pin=>facts.rows.filter(row=>row.key===pin.key&&pin.versionId).map(row=>({companyId:row.companyId,skillId:row.id,key:pin.key,versionId:pin.versionId})));
 return{...ASSIGNED_SKILL_READ_DEFINITION,description:ASSIGNED_SKILL_READ_DEFINITION.description+' Exact assigned read coordinates: '+JSON.stringify(assignments)};
}
