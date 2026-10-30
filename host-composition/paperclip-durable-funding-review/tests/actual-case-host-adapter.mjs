/** Synthetic native fixture adapter: production handler + real bounded Python stdio.
 * Only issues/document API reads use exact synthetic native fixture snapshots.
 * No domain receipt is constructed or reshaped here.
 */
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export async function buildActualCaseSourceHandler({metadata:m,childId,reviewerRun,domainDirectory,caseOwnerRunId=m.runId,pluginRoot='/qual/current-plugin'}){
 const {registerCaseWork}=await import(pathToFileURL(pluginRoot+'/dist/src/case-work/host.js'));
 const {createBoundedContextBridge}=await import(pathToFileURL(pluginRoot+'/dist/src/bridge/duplex.js'));
 const executable='/bin/sh',entrypoint=domainDirectory+'/run-entry.sh',pythonEntry=domainDirectory+'/entry.py',configurationPath=domainDirectory+'/config.json';
 await fs.writeFile(entrypoint,'#!/bin/sh\nexport PYTHONHOME=/opt/dfw-seed/python\nexec /opt/dfw-seed/dfw-runtime/.venv/bin/python '+JSON.stringify(pythonEntry)+' \"$@\" 2>'+JSON.stringify(domainDirectory+'/synthetic-python-stderr.txt')+'\n',{mode:0o700});
 const pins=await Promise.all([entrypoint,configurationPath,pythonEntry].map(async path=>({path,sha256:createHash('sha256').update(await fs.readFile(path)).digest('hex')})));
 const bridge=createBoundedContextBridge({executable,args:[entrypoint,'--config',configurationPath],entrypoint,configurationPath,cwd:domainDirectory,pins,timeoutMs:30000,maxOutputBytes:4194304},'dfw-native-case-work-v1');
 const rows=[{id:m.rootId,companyId:m.companyId,projectId:m.P,status:'in_progress',assigneeAgentId:m.coId,workMode:'standard'},
  {id:m.caseId,companyId:m.companyId,projectId:m.Q,parentId:m.rootId,status:'blocked',assigneeAgentId:m.betaId,executionRunId:caseOwnerRunId,workMode:'standard',originKind:'manual',originId:'paperclip-runner:create-task:'+m.rootId+':case:'+m.caseBindingId},
  {id:childId,companyId:m.companyId,projectId:m.Q,parentId:m.caseId,status:'in_progress',assigneeAgentId:m.charlieId,executionRunId:reviewerRun,workMode:'standard',originKind:'manual',originId:'paperclip-runner:create-task:'+m.caseId+':source-review:'+m.proposalHash}];
 const provenance={version:'inertia-case-source-proposal-v1',company_id:m.companyId,project_id:m.Q,root_issue_id:m.rootId,case_binding_id:m.caseBindingId,record_id:m.recordId,proposal_hash:m.proposalHash,producer_issue_id:m.caseId,producer_agent_id:m.betaId,producer_principal_id:'beta',producer_run_id:m.runId};
 const doc={key:'funding-'+createHash('sha256').update(JSON.stringify('case-source-proposal-'+m.proposalHash)).digest('hex').slice(0,32)+'-0000000001',companyId:m.companyId,issueId:m.caseId,body:JSON.stringify(provenance),latestRevisionNumber:1};
 const issues={get:async id=>rows.find(r=>r.id===id)??null,getSubtree:async id=>({companyId:m.companyId,rootIssueId:id,issues:rows,issueIds:rows.map(r=>r.id),activeRuns:Object.fromEntries(rows.filter(r=>r.executionRunId).map(r=>[r.id,[{id:r.executionRunId,issueId:r.id,agentId:r.assigneeAgentId,status:'running',finishedAt:null}]])),assignees:{[m.betaId]:{id:m.betaId,status:'running'},[m.charlieId]:{id:m.charlieId,status:'running'}}}),documents:{list:async id=>id===m.caseId?[doc]:[],get:async(id,key)=>id===m.caseId&&key===doc.key?doc:null,upsert:async()=>{throw Error('Unexpected native document write in source receipt read fixture');}}};
 let selected;
 registerCaseWork({tools:{register:(name,definition,handler)=>{if(name!=='funding_case_work')throw Error('Unexpected actual case tool');selected={definition,handler};}},issues},[{companyId:m.companyId,researchProjectId:m.Q,projectId:m.Q,rootIssueId:m.rootId,rootProjectId:m.P,applicantSlug:m.applicantSlug,researcher:{agentId:m.alphaId,principalId:'alpha'},producer:{agentId:m.betaId,principalId:'beta'},reviewer:{agentId:m.charlieId,principalId:'charlie'},policyRevision:'v1',authorize:async()=>true,bridge}],{own:async(_scope,work)=>work()});
 if(!selected)throw Error('Actual production case handler was not registered');
 return{definition:selected.definition,invoke:(input,provided)=>selected.handler(input,provided),actualProductionHandler:true};
}
