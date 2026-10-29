import {it,expect} from "vitest";
import {mkdtemp,writeFile,readFile,rm,realpath} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {createBoundedContextBridge} from "../../src/bridge/duplex.js";
const python="/Users/johnroehm/Programming/PythonEnvironments/DFW-Gov-Fund/DFW-Gov-Fund/government-funding-dfw/.venv/bin/python";
const backend="/tmp/dfw-native-case-work-20261028";
it("actual cold Python case protocol persists two independent partial drafts and paged history",{timeout:60000},async()=>{
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),"case-work-cold-")));
 try{
  const setup=path.join(dir,"fixture.py");
  await writeFile(setup,[
   "import sys,json","from pathlib import Path","sys.path[:0]=["+JSON.stringify(backend+"/src")+","+JSON.stringify(backend+"/tests")+"]",
   "from test_native_case_work import fixture","from dfw_incentives.repository import Repository","from dfw_incentives.schemas import SourceRecord",
   "from dfw_incentives.models import SourceRecordCurrent","from sqlalchemy import select",
   "m,db,e,r,doc,quote,c,actor,task,service=fixture(Path(sys.argv[1]))","snap=e.context(record_id=r)",
   "other=SourceRecord('opportunity','codex-2',{**snap['data'],'title':'Second preliminary case'},doc)",
   "repo=Repository(db)","repo.upsert_source_record('FED',other,run_id=snap['coverage']['fetch_run_id'])","repo.project(e.registry.get('FED'),other)",
   "with db.session() as session: second=session.scalar(select(SourceRecordCurrent.id).where(SourceRecordCurrent.external_id=='codex-2'))",
   "root=Path(sys.argv[1])","(root/'case.json').write_text(c.model_dump_json())",
   "(root/'metadata.json').write_text(json.dumps({'actor':vars(actor[0]),'records':[{'record_id':r,'record_hash':e.context(record_id=r)['record_hash']},{'record_id':second,'record_hash':e.context(record_id=second)['record_hash']}]}))"
  ].join("\n"));
  const prepared=spawnSync(python,[setup,dir],{encoding:"utf8"});expect(prepared.status,prepared.stderr).toBe(0);
  const meta=JSON.parse(await readFile(path.join(dir,"metadata.json"),"utf8")),entry=path.join(dir,"run.py"),config=path.join(dir,"case.json");
  await writeFile(entry,"import sys\nsys.path.insert(0,"+JSON.stringify(backend+"/src")+")\nfrom dfw_incentives.native_case_work_stdio import main\nmain()\n");
  const sha=async(p:string)=>createHash("sha256").update(await readFile(p)).digest("hex");
  const bridge=createBoundedContextBridge<any>({executable:python,args:[entry,"--config",config],entrypoint:entry,configurationPath:config,cwd:dir,pins:await Promise.all([entry,config].map(async p=>({path:p,sha256:await sha(p)}))),timeoutMs:30000,maxOutputBytes:4*1024*1024},"dfw-native-case-work-v1");
  let actor=meta.actor;
  const context=async()=>actor,caseTask=async(request:Record<string,unknown>)=>({company_id:actor.company_id,project_id:actor.project_id,issue_id:actor.issue_id,parent_id:actor.root_issue_id,assignee_agent_id:actor.agent_id,origin_kind:"manual",origin_id:"paperclip-runner:create-task:"+actor.root_issue_id+":case:"+request.case_binding_id,hidden:false,status:"in_progress",active_run_id:actor.run_id,root_hidden:false,root_status:"blocked"});
  const cases:any[]=[];for(const record of meta.records)cases.push(await bridge.call("reserve_case",record,{context}));
  expect(cases[0].case_binding_id).not.toBe(cases[1].case_binding_id);
  const checkpoints:any[]=[];
  for(let i=0;i<cases.length;i++){
   actor={...meta.actor,project_id:"public-cases",issue_id:"case-"+i,agent_id:"beta",principal_id:"p-beta",run_id:"beta-"+i,role:"producer",case_binding_id:cases[i].case_binding_id};
   const current:any=await bridge.call("context",{}, {context,caseTask});
   expect(current.source.agent_ready).toBe(false);
   const result:any=await bridge.call("checkpoint",{revision_hash:current.revision_hash,previous_checkpoint_hash:null,phase:"draft",artifact_refs:[],note:"Substantive working draft for case "+i+": proposed cyber workforce outline; verify sponsor match and exact deadline.",unresolved:["Exact match remains unverified."]},{context,caseTask});
   expect(result.business_complete).toBe(false);expect(result.checkpoint.note).toContain("Substantive working draft");checkpoints.push(result);
  }
  expect(checkpoints[0].checkpoint_hash).not.toBe(checkpoints[1].checkpoint_hash);
  const history:any=await bridge.call("context",{view:"history",offset:0,limit:100},{context,caseTask});
  expect(JSON.stringify(history)).toContain("Substantive working draft");
 }finally{await rm(dir,{recursive:true,force:true});}
});
