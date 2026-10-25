/** Optional cross-repository qualification with a real cold DFW process and synthetic SQLite. */
import { expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPublicDraftingBridge } from "../../src/drafting/stdio.js";
import { fixture } from "./fixture.js";
const home=process.env.NATIVE_CYCLE_DFW_HOME,python=process.env.NATIVE_CYCLE_PYTHON;
it.skipIf(!home || !python)("uses unchanged six native tools to select a persisted match and checkpoint public-only draft",async()=>{
 const root=mkdtempSync(join(tmpdir(),"native-cycle-"));
 const metadata=JSON.parse(execFileSync(python!,[join(home!,"tests/native_cycle_transport_fixture.py"),root],{
  env:{...process.env,PYTHONPATH:join(home!,"src")+":"+join(home!,"tests")},encoding:"utf8"}));
 const entrypoint=join(home!,"src/dfw_incentives/native_cycle_stdio.py"),configurationPath=metadata.configuration_path;
 // Launch through a module with the installed package; no PYTHONPATH runtime grant or model shell.
 const sourceFiles=["native_cycle.py","native_cycle_stdio.py","public_drafting_stdio.py"].map(p=>join(home!,"src/dfw_incentives",p));
 const bridge=createPublicDraftingBridge({executable:python!,args:[entrypoint,"--config",configurationPath],entrypoint,configurationPath,cwd:home!,timeoutMs:10000,maxOutputBytes:1048576,
  pins:[...new Set([entrypoint,configurationPath,...sourceFiles])].map(path=>({path,sha256:createHash("sha256").update(readFileSync(path)).digest("hex")}))});
 const f=fixture();f.binding.applicantSlug="codex-applicant";f.binding.matchId="initial-packet";
 f.bridge.call=bridge.call.bind(bridge);
 expect(f.tools.size).toBe(6);
 const workspace=(await f.tools.get("funding_drafting_workspace")({},f.producer)).data;
 expect(workspace.workspace_hash).toMatch(/^[a-f0-9]{64}$/);
 expect(JSON.stringify(workspace)).not.toContain("PRIVATE-");
 expect(JSON.stringify(workspace)).toContain(metadata.selected_match_id);
 await expect(f.tools.get("funding_drafting_workspace")({match_id:"other"},f.producer)).rejects.toThrow();
 await expect(f.tools.get("funding_drafting_workspace")({},f.reviewer)).rejects.toThrow();
 await f.tools.get("funding_drafting_checkpoint")({},f.producer);
 expect(f.docs.size).toBe(1);expect(f.rows.producer.status).toBe("in_review");
 expect([...f.docs.values()][0].body).toContain("not_human_accepted");
 // Explicit administrator opt-in exercises the real private handoff protocol.
 // This is a cold domain subprocess + native host fixture, never provider work.
 f.binding.nativeCaseProgression=true;
 const checkpoint=(await f.tools.get("funding_drafting_checkpoint")({},f.producer)).data;
 expect(checkpoint).toMatchObject({version:"dfw-native-case-handoff-v1",native_run_id:f.producer.runId,
  human_acceptance:"not_accepted",submission:"not_submitted"});
 expect(checkpoint.case_key.opportunity_external_id).toBeTruthy();
 expect(checkpoint.packet_hash).toMatch(/^[a-f0-9]{64}$/);
 expect(["remaining_agent_work","awaiting_independent_review","awaiting_owner_input","awaiting_human_review"]).toContain(checkpoint.disposition);
 const documentsAfterHandoff=f.docs.size;
 expect(documentsAfterHandoff).toBe(2);
 expect((await f.tools.get("funding_drafting_checkpoint")({},f.producer)).data).toEqual(checkpoint);
 expect(f.docs.size).toBe(documentsAfterHandoff);expect(f.wakeups.size).toBe(0);
},30000);
