import { expect,it } from "vitest";
import { mkdtempSync,writeFileSync,readFileSync,existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createPublicDraftingBridge } from "../../src/drafting/stdio.js";
const context={company_id:"company",applicant_slug:"dao",match_id:"match",principal_id:"principal",run_id:"run",role:"producer" as const};
function fixture(script:string,timeoutMs=500){
 const cwd=mkdtempSync(join(tmpdir(),"drafting-stdio-")),entrypoint=join(cwd,"bridge.cjs"),configurationPath=join(cwd,"config.json");
 writeFileSync(entrypoint,script);writeFileSync(configurationPath,"{}");
 const config={executable:process.execPath,args:[entrypoint,"--config",configurationPath],entrypoint,configurationPath,cwd,timeoutMs,maxOutputBytes:2048,pins:[entrypoint,configurationPath].map(path=>({path,sha256:createHash("sha256").update(readFileSync(path)).digest("hex")}))};
 return {config,bridge:createPublicDraftingBridge(config),cwd};
}
const setup=`const rl=require('node:readline').createInterface({input:process.stdin});let n=0;rl.on('line',line=>{const q=JSON.parse(line);n++;`;
it("uses a real bounded duplex process and refreshes context independently of model args",async()=>{
 const f=fixture(setup+`if(n===1){console.log(JSON.stringify({type:'context',id:1}));}else if(n===2){console.log(JSON.stringify({type:'context',id:2}));}else{console.log(JSON.stringify({type:'result',ok:true,result:q.context}));rl.close();}});`);
 let count=0;const result=await f.bridge.call("workspace",{}, {context:async()=>({...context,run_id:"fresh-"+(++count)}),review:async()=>{throw Error("no");}});
 expect(count).toBe(2);expect(result).toEqual({...context,run_id:"fresh-2"});
});
it("transports only bounded native pending-review callbacks, not synthetic reviewer identity",async()=>{
 const request={request_id:"a".repeat(64),candidate:{text:"public"}};
 const f=fixture(setup+`if(n===1)console.log(JSON.stringify({type:'context',id:1}));else if(n===2)console.log(JSON.stringify({type:'review',id:2,request:${JSON.stringify(request)}}));else {console.log(JSON.stringify({type:'result',ok:true,result:q}));rl.close();}});`);
 expect(await f.bridge.call("save",{}, {context:async()=>context,review:async r=>({state:"pending",request_id:r.request_id as string})})).toEqual({type:"review",id:2,state:"pending",request_id:request.request_id});
});
it("rejects missing context, duplicate callback ids, extra fields, unsolicited concurrent callbacks and trailing frames",async()=>{
 const scripts=[
 `console.log(JSON.stringify({type:'result',ok:true,result:{}}))`,
 setup+`console.log(JSON.stringify({type:'context',id:1}));});`,
 `console.log(JSON.stringify({type:'context',id:1,role:'admin'}));`,
 `console.log(JSON.stringify({type:'context',id:1}));console.log(JSON.stringify({type:'context',id:2}));`,
 setup+`if(n===1)console.log(JSON.stringify({type:'context',id:1}));else{console.log(JSON.stringify({type:'result',ok:true,result:{}}));console.log('{}');rl.close();}});`,
 ];
 for(const s of scripts)await expect(fixture(s).bridge.call("workspace",{}, {context:async()=>{await new Promise(r=>setTimeout(r,10));return context;},review:async()=>{throw Error();}})).rejects.toThrow(/DFW drafting/);
});
it("kills timed-out children and aborts outstanding callback authorization",async()=>{
 const f=fixture(`require('fs').writeFileSync('pid',String(process.pid)); console.log(JSON.stringify({type:'context',id:1})); setInterval(()=>{},10000)`,1500);
 let aborted=false;
 await expect(f.bridge.call("workspace",{}, {context:async signal=>{await new Promise<void>(resolve=>signal!.addEventListener("abort",()=>{aborted=true;resolve();},{once:true}));return context;},review:async()=>{throw Error();}})).rejects.toThrow(/timed out/);
 expect(aborted).toBe(true);
 const pid=Number(readFileSync(join(f.cwd,"pid"),"utf8"));expect(()=>process.kill(pid,0)).toThrow();
});
it("fails closed for oversized input/output, changed pins, stderr and child failures without leaking diagnostics",async()=>{
 for(const script of [`console.log('x'.repeat(3000))`,`process.stderr.write('secret'.repeat(20000));`,`process.exit(3)`,`console.log(JSON.stringify({type:'result',ok:false,error:'SECRET'}))`]){
  await expect(fixture(script).bridge.call("workspace",{}, {context:async()=>context,review:async()=>{throw Error();}})).rejects.toThrow(/DFW drafting/);
 }
 const f=fixture(`require('fs').writeFileSync('started','yes');`);writeFileSync(f.config.configurationPath,"changed");
 await expect(f.bridge.call("workspace",{}, {context:async()=>context,review:async()=>{throw Error();}})).rejects.toThrow(/pin/);expect(existsSync(join(f.cwd,"started"))).toBe(false);
 await expect(fixture("").bridge.call("save",{x:"x".repeat(128*1024)}, {context:async()=>context,review:async()=>{throw Error();}})).rejects.toThrow(/large/);
});
it("rejects non-regular pinned inputs without attempting an unbounded device read",async()=>{
 const f=fixture("");f.config.pins.push({path:f.cwd,sha256:"a".repeat(64)});
 await expect(createPublicDraftingBridge(f.config).call("workspace",{}, {context:async()=>context,review:async()=>{throw Error();}})).rejects.toThrow(/regular/);
});
it("retains the caller until an already-started native write settles after child timeout",async()=>{
 const f=fixture(setup+`if(n===1)console.log(JSON.stringify({type:'context',id:1}));else if(n===2)console.log(JSON.stringify({type:'review',id:2,request:{request_id:'${"a".repeat(64)}'}}));});`,500);
 let release!:()=>void,entered!:()=>void,settled=false;
 const gate=new Promise<void>(r=>{release=r;}),started=new Promise<void>(r=>{entered=r;});
 const pending=f.bridge.call("save",{}, {context:async()=>context,review:async request=>{entered();await gate;return {state:"pending",request_id:request.request_id as string};}}).then(()=>{settled=true;},error=>{settled=true;return error;});
 await started;
 await new Promise(r=>setTimeout(r,650));
 try {expect(settled).toBe(false);} finally {release();}
 expect(await pending).toBeInstanceOf(Error);expect(settled).toBe(true);
});
it("preserves the explicit UUID gap pending callback shape on bounded stdio",async()=>{
 const request={kind:"gap_plan",request_id:"3fed4a00-4eb8-5e70-a206-883845154cf4"};
 const f=fixture(setup+`if(n===1)console.log(JSON.stringify({type:'context',id:1}));else if(n===2)console.log(JSON.stringify({type:'review',id:2,request:${JSON.stringify(request)}}));else {console.log(JSON.stringify({type:'result',ok:true,result:q}));rl.close();}});`);
 expect(await f.bridge.call("save_gap_progress",{}, {context:async()=>context,review:async r=>({kind:"gap_plan",state:"pending",request_id:r.request_id as string})})).toEqual({type:"review",id:2,kind:"gap_plan",state:"pending",request_id:request.request_id});
});
it("rejects untyped gap acknowledgements and gap SHA confusion at the transport boundary",async()=>{
 for(const request_id of ["3fed4a00-4eb8-5e70-a206-883845154cf4","a".repeat(64)]) {
  const request={kind:"gap_plan",request_id};
  const f=fixture(setup+`if(n===1)console.log(JSON.stringify({type:'context',id:1}));else if(n===2)console.log(JSON.stringify({type:'review',id:2,request:${JSON.stringify(request)}}));else {console.log(JSON.stringify({type:'result',ok:true,result:q}));rl.close();}});`);
  await expect(f.bridge.call("save_gap_progress",{}, {context:async()=>context,review:async r=>({state:"pending",request_id:r.request_id as string})})).rejects.toThrow();
 }
});
