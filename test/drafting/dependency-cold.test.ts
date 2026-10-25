/** Optional real cold DFW transport qualification. Native run admission below is a host fixture, not a provider/scheduler proof. */
import { expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync,readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPublicDraftingBridge } from "../../src/drafting/stdio.js";
import { fixture } from "./fixture.js";
const home=process.env.NATIVE_DEPENDENCY_DFW_HOME,python=process.env.NATIVE_DEPENDENCY_PYTHON;
it.skipIf(!home || !python)("cold six-tool dependency slice freezes old P and supports independent reject/redraft with explicit fresh-run fixture admission",async()=>{
 const root=mkdtempSync(join(tmpdir(),"dependency-cold-"));
 const metadata=JSON.parse(execFileSync(python!,[join(home!,"tests/native_cycle_transport_fixture.py"),root,"--dependency-handoff"],{
  env:{...process.env,PYTHONPATH:join(home!,"src")+":"+join(home!,"tests")},encoding:"utf8"}));
 const entrypoint=join(home!,"src/dfw_incentives/native_cycle_stdio.py"),configurationPath=metadata.configuration_path;
 const pins=[entrypoint,configurationPath,...["native_cycle.py","public_drafting_stdio.py","public_drafting.py"].map(p=>join(home!,"src/dfw_incentives",p))];
 const bridge=createPublicDraftingBridge({executable:python!,args:[entrypoint,"--config",configurationPath],entrypoint,configurationPath,cwd:home!,timeoutMs:10000,maxOutputBytes:1048576,
  pins:pins.map(path=>({path,sha256:createHash("sha256").update(readFileSync(path)).digest("hex")}))});
 const f=fixture();f.binding.applicantSlug="codex-applicant";f.binding.matchId="initial-packet";
 f.binding.nativeCaseProgression=true;f.binding.nativeDependencyHandoff=true;f.bridge.call=bridge.call.bind(bridge);
 const subtree=f.ctx.issues.getSubtree;
 f.ctx.issues.getSubtree=async(...args:any[])=>({...await subtree(...args),issueIds:[args[0]],relations:{[args[0]]:{blockedBy:args[0]==="producer"?[{id:"reviewer",status:f.rows.reviewer.status}]:[],blocks:[]}}});
 f.rows.reviewer.status="done";f.runs.reviewer=[];
 const call=(tool:string,args:any,run:any)=>f.tools.get(tool)(args,run).then((r:any)=>r.data);
 const admit=(role:"producer"|"reviewer",runId:string)=>{
  const agentId=role==="producer"?"author":"critic";
  f.rows[role].status="in_progress";f.runs[role]=[{id:runId,issueId:role,agentId,status:"running",finishedAt:null}];
  return {companyId:"company",projectId:"project",agentId,runId};
 };
 const proposal=(workspace:any,value:string)=>{
  const evidence=workspace.context.evidence[0];
  return {target_type:"sponsor_answer",target_key:"SPONSOR.PROGRAM_SUMMARY",value,evidence_ids:["OPP-1"],confidence:.8,rationale:"Synthetic public program basis",
   claim_support:[{claim_text:value,claim_start:0,claim_end:value.length,evidence_id:"OPP-1",source_locator:evidence.source_locator,source_revision:evidence.source_revision,source_content_hash:evidence.content_sha256,support_kind:"proposal_basis"}]};
 };
 const review=(request:any,supported:boolean)=>{
  const c=request.candidate;return {candidate_hash:c.candidate_hash,requirement_hash:c.requirement_hash,evidence_set_hash:c.evidence_set_hash,rubric_version:"synthetic-transport-v1",requirement_supported:supported,
   findings:[{claim_start:0,claim_end:c.value.length,support:supported?"supported":"unsupported",excerpt:"Describe the program and measurable outcomes.",rationale:"Synthetic independent reviewer fixture; not real-provider quality evidence"}]};
 };
 let producer=f.producer;const initial=await call("funding_drafting_workspace",{},producer);
 expect(JSON.stringify(initial)).not.toContain("PRIVATE-");
 let save=await call("save_funding_proposals",{workspace_hash:initial.workspace_hash,proposals:[proposal(initial,"We propose a program with measurable outcomes.")]},producer);
 expect(save.packet.pending_review_count).toBe(1);
 let reviewer=admit("reviewer","run-critic");
 const first=await call("funding_drafting_checkpoint",{},producer);expect(first.disposition).toBe("awaiting_independent_review");
 expect(f.rows.producer.status).toBe("blocked");
 expect(await call("funding_drafting_checkpoint",{},producer)).toEqual(first);
 let context=await call("funding_review_context",{},reviewer);expect(context.requests).toHaveLength(1);
 await call("review_funding_candidate",{request_id:context.requests[0].request_id,artifact:review(context.requests[0],false)},reviewer);
 expect(f.rows.reviewer.status).toBe("done");
 // Native issue recheckout alone cannot unfreeze the domain run.
 f.rows.producer.status="in_progress";
 await expect(call("funding_drafting_workspace",{},producer)).rejects.toThrow();
 expect(await call("funding_drafting_checkpoint",{},producer)).toEqual(first);expect(f.rows.producer.status).toBe("in_progress");
 f.runs.reviewer=[];producer=admit("producer","run-author-2");
 const rework=await call("funding_drafting_workspace",{},producer);
 expect(rework.packet.saved_candidates.some((c:any)=>c.machine_review_state==="rejected")).toBe(true);
 save=await call("save_funding_proposals",{workspace_hash:rework.workspace_hash,proposals:[proposal(rework,"Revised: We propose a program with measurable outcomes.")]},producer);
 expect(save.packet.pending_review_count).toBe(1);
 const second=await call("funding_drafting_checkpoint",{},producer);
 expect(second.selection_id).toBe(first.selection_id);expect(second.native_run_id).toBe("run-author-2");
 reviewer=admit("reviewer","run-critic-2");context=await call("funding_review_context",{},reviewer);
 await call("review_funding_candidate",{request_id:context.requests[0].request_id,artifact:review(context.requests[0],true)},reviewer);
 f.runs.reviewer=[];producer=admit("producer","run-author-3");
 const final=await call("funding_drafting_workspace",{},producer);
 expect(final.packet.pending_review_count).toBe(0);expect(final.packet.saved_candidates.some((c:any)=>c.machine_review_state==="supported")).toBe(true);
 expect([...f.wakeups.values()].every(w=>w.id==="reviewer")).toBe(true);expect(f.tools.size).toBe(6);
 const result=await call("funding_drafting_checkpoint",{},producer);
 expect(result.human_acceptance).toBe("not_accepted");expect(result.submission).toBe("not_submitted");
},30000);
