import {expect,it} from "vitest";
import {mkdtempSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
import {createCentralBridge} from "../../src/central/stdio.js";
const python=process.env.DFW_TEST_PYTHON,root=process.env.DFW_TEST_ROOT;
it.skipIf(!python||!root)("runs private workspace and protected review through the actual shared Node/Python bridge",async()=>{
 const temp=mkdtempSync(join(tmpdir(),"central-real-bridge-"));
 const env={...process.env,PYTHONPATH:join(root!,"src")+":"+join(root!,"tests")};
 const fixture=spawnSync(python!,[join(root!,"tests/central_native_fixture.py"),temp],{env,encoding:"utf8"});
 expect(fixture.status,fixture.stderr).toBe(0);
 const data=JSON.parse(fixture.stdout),entrypoint=join(root!,"src/dfw_incentives/trusted_central_stdio.py"),configurationPath=data.configuration_path;
 const config={executable:python!,args:[entrypoint,"--config",configurationPath],entrypoint,configurationPath,cwd:root!,timeoutMs:10000,maxOutputBytes:1024*1024,pins:[entrypoint,configurationPath].map(path=>({path,sha256:createHash("sha256").update(readFileSync(path)).digest("hex")}))};
 const previous=process.env.PYTHONPATH;process.env.PYTHONPATH=env.PYTHONPATH;
 try{
  const bridge=createCentralBridge(config),requests:any[]=[];
  const callbacks={context:async()=>data.producer,review:async(request:any)=>{requests.push(request);return {state:"pending" as const,request_id:request.request_id};}};
  const w:any=await bridge.call("workspace",{},callbacks);
  expect(JSON.stringify(w)).toContain("PRIVATE-MEETING");expect(JSON.stringify(w)).not.toContain("DENIED-");
  await bridge.call("knowledge",{operation:"propose",parameters:{record:data.record}},callbacks);
  const params={record_id:data.record.record_id,expected_revision:1,policy_id:"independent-source-v1"};
  const pending:any=await bridge.call("knowledge",{operation:"admit",parameters:params},callbacks);
  expect(pending.state).toBe("pending");expect(requests).toHaveLength(1);expect(JSON.stringify(requests)).not.toContain("PRIVATE");
  const r=requests[0],artifact={request_id:r.request_id,record_id:r.record_id,record_revision:r.record_revision,evidence_hash:r.evidence_hash,decision:"supported",semantic_kind:"resource",attribution_supported:true,scope_supported:true,rationale:"Exact synthetic independently checked resource source."};
  await bridge.call("knowledge",{operation:"review",parameters:artifact},{context:async()=>data.reviewer});
  const admitted:any=await bridge.call("knowledge",{operation:"admit",parameters:params},{context:async()=>({...data.producer,run_id:"second-native-run"})});
  expect(admitted.status).toBe("current");
 }finally{if(previous===undefined)delete process.env.PYTHONPATH;else process.env.PYTHONPATH=previous;}
},30000);
