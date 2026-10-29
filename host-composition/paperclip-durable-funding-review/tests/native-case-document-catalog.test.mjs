import test from'node:test';import assert from'node:assert/strict';import{pathToFileURL}from'node:url';
const root=process.env.INERTIA_ROLE_CANDIDATE??'/tmp/inertia-source-receipt-fixture-20261029/candidate';
const m=await import(pathToFileURL(root+'/dist/services/native-runtime/native-case-work-tools.mjs'));
for(const role of['producer','researcher','reviewer'])test('admitted '+role+' can discover bounded native task documents',async()=>{
 const names=role==='researcher'?[m.CASE_PROJECTED_TOOL,m.ENRICHMENT_PROJECTED_TOOL]:[m.CASE_PROJECTED_TOOL];
 const binding={nativeTaskProjectAdmission:{kind:role==='reviewer'?'source-review':'case-work',role,proposalHash:'a'.repeat(64)},assignedMcpTools:{definitionsFresh:async()=>names.map(name=>({name,inputSchema:{type:'object'}}))}};
 const defs=await m.taskProjectDefinitions(binding,async()=>{});
 for(const name of['list_documents','read_document'])assert(defs.some(t=>t.name===name),'missing '+name+' for '+role);
 assert(!defs.some(t=>t.name==='write_document'));
});
