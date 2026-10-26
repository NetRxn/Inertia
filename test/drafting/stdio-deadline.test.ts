import {expect,it,vi} from "vitest";
import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHash} from "node:crypto";
const hooks=vi.hoisted(()=>({beforeStat:undefined as undefined|(()=>void)}));
vi.mock("node:fs/promises",async importOriginal=>{
  const real=await importOriginal<typeof import("node:fs/promises")>();
  return {...real,stat:async(...args:Parameters<typeof real.stat>)=>{hooks.beforeStat?.();return real.stat(...args);}};
});
import {createPublicDraftingBridge} from "../../src/drafting/stdio.js";
const context={company_id:"company",applicant_slug:"dao",match_id:"match",principal_id:"principal",run_id:"run",role:"producer" as const};
function fixture(script:string){
  const cwd=mkdtempSync(join(tmpdir(),"drafting-deadline-")),entrypoint=join(cwd,"bridge.cjs"),configurationPath=join(cwd,"config.json");
  writeFileSync(entrypoint,script);writeFileSync(configurationPath,"{}");
  const config={executable:process.execPath,args:[entrypoint,"--config",configurationPath],entrypoint,configurationPath,cwd,timeoutMs:1500,maxOutputBytes:2048,
    pins:[entrypoint,configurationPath].map(path=>({path,sha256:createHash("sha256").update(readFileSync(path)).digest("hex")}))};
  return {cwd,bridge:createPublicDraftingBridge(config)};
}
const handshake=`const rl=require('node:readline').createInterface({input:process.stdin});let n=0;rl.on('line',line=>{if(++n===1)console.log(JSON.stringify({type:'context',id:1}));else {console.log(JSON.stringify({type:'result',ok:true,result:{ok:true}}));rl.close();}});`;

it("rejects an already expired operation deadline before pinning or spawn",async()=>{
  const f=fixture(`require('fs').writeFileSync('started','yes');`);let stats=0;hooks.beforeStat=()=>{stats++;};
  try{
    const callbacks:any={operationDeadlineAt:Date.now()-1,context:async()=>context,review:async()=>{throw Error();}};
    await expect(f.bridge.call("workspace",{},callbacks)).rejects.toThrow(/deadline|expired/i);
    expect(stats).toBe(0);expect(existsSync(join(f.cwd,"started"))).toBe(false);
  }finally{hooks.beforeStat=undefined;rmSync(f.cwd,{recursive:true,force:true});}
});

it("charges pin verification against the same absolute deadline and never spawns after it expires",async()=>{
  const f=fixture(`require('fs').writeFileSync('started','yes');`+handshake),start=Date.now();let now=start;
  const clock=vi.spyOn(Date,"now").mockImplementation(()=>now);hooks.beforeStat=()=>{now=start+101;};
  try{
    const callbacks:any={operationDeadlineAt:start+100,context:async()=>context,review:async()=>{throw Error();}};
    await expect(f.bridge.call("workspace",{},callbacks)).rejects.toThrow(/deadline|expired/i);
    expect(existsSync(join(f.cwd,"started"))).toBe(false);
  }finally{hooks.beforeStat=undefined;clock.mockRestore();rmSync(f.cwd,{recursive:true,force:true});}
});

it("aborts authorization and kills the owned child process group at the clipped operation deadline",async()=>{
  const f=fixture(`const fs=require('fs'),cp=require('child_process');fs.writeFileSync('pid',String(process.pid));const child=cp.spawn(process.execPath,['-e','setInterval(()=>{},10000)'],{stdio:['ignore','inherit','inherit']});fs.writeFileSync('descendant',String(child.pid));console.log(JSON.stringify({type:'context',id:1}));setInterval(()=>{},10000);`);
  let aborted=false;
  const callbacks:any={operationDeadlineAt:Date.now()+450,context:async(signal:AbortSignal)=>{
    await new Promise<void>(resolve=>signal.addEventListener("abort",()=>{aborted=true;resolve();},{once:true}));return context;
  },review:async()=>{throw Error();}};
  const pending=f.bridge.call("workspace",{},callbacks).then(()=>null,e=>e);
  try{
    const timeout=Symbol("not settled");const result=await Promise.race([pending,new Promise(resolve=>setTimeout(()=>resolve(timeout),1100))]);
    expect(result).not.toBe(timeout);expect(result).toBeInstanceOf(Error);expect((result as Error).message).toMatch(/outcome unconfirmed/);
    expect(aborted).toBe(true);
    for(const name of ["pid","descendant"]){const pid=Number(readFileSync(join(f.cwd,name),"utf8"));
      // An orphan may briefly remain as an init-owned zombie; it is no longer executing.
      let live=false;try{process.kill(pid,0);const stat=readFileSync(`/proc/${pid}/stat`,"utf8");live=!/^\d+ \(.*\) Z /.test(stat);}catch{}
      expect(live).toBe(false);
    }
  }finally{
    for(const name of ["descendant","pid"])if(existsSync(join(f.cwd,name))){try{process.kill(Number(readFileSync(join(f.cwd,name),"utf8")),"SIGKILL");}catch{}}
    await pending;rmSync(f.cwd,{recursive:true,force:true});
  }
});
