import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { isAbsolute } from "node:path";
import type { DiscoveryProcessConfig } from "../discovery/stdio.js";
export interface BoundedProcessConfig extends DiscoveryProcessConfig { configurationPath: string }
export interface ContextCallbacks<C> {
  /** Trusted caller deadline, never serialized into private/model parameters. */
  operationDeadlineAt?: number;
  context(signal?:AbortSignal):Promise<C>;
  review?(request:Record<string,unknown>,signal?:AbortSignal):Promise<{state:"pending";request_id:string}>;
}
export interface ContextBridge<C> {
  call(operation:string,params:Record<string,unknown>,callbacks:ContextCallbacks<C>):Promise<unknown>;
}
const object=(v:unknown):v is Record<string,unknown>=>!!v && typeof v==="object" && !Array.isArray(v);
const keys=(v:Record<string,unknown>,fields:string[])=>Object.keys(v).length===fields.length && fields.every(k=>Object.hasOwn(v,k));
const safeRejectionCodes=new Set(["invalid_config","invalid_protocol","invalid_request","authentication_failed","drafting_rejected","native_preparation_rejected","internal_error"]);
function rejectionMessage(message:Record<string,unknown>,version:string,operation:string,authenticated:boolean):string {
  const generic="DFW drafting rejected request";
  if(version!=="dfw-public-drafting-v1")return generic;
  if(keys(message,["type","ok","error"]) && typeof message.error==="string" && safeRejectionCodes.has(message.error))return `${generic} (${message.error})`;
  if(operation==="save" && authenticated && keys(message,["type","ok","error","details"]) && message.error==="proposal_validation_failed") {
    const details=message.details;
    if(!object(details)||!keys(details,["issues","truncated"])||typeof details.truncated!=="boolean"||!Array.isArray(details.issues)||details.issues.length<1||details.issues.length>32)return generic;
    const fields=new Set(["target_type","target_key","value","evidence_ids","confidence","rationale","concerns","claim_support","proposal"]),seen=new Set<string>();
    for(const issue of details.issues) {
      if(!object(issue)||!keys(issue,["proposal_index","field","code"])||!Number.isSafeInteger(issue.proposal_index)||Number(issue.proposal_index)<0||Number(issue.proposal_index)>99||typeof issue.field!=="string"||!fields.has(issue.field)||typeof issue.code!=="string"||!["required","invalid_value","unsupported_field"].includes(issue.code))return generic;
      const key=JSON.stringify([issue.proposal_index,issue.field,issue.code]);if(seen.has(key))return generic;seen.add(key);
    }
    if(Buffer.byteLength(JSON.stringify(details))>8192)return generic;
    return `${generic}: ${JSON.stringify({code:"proposal_validation_failed",details})}`;
  }
  if(version!=="dfw-public-drafting-v1" || operation!=="review" || !authenticated ||
     !keys(message,["type","ok","error","details"]) || message.error!=="review_validation_failed")return generic;
  const details=message.details;
  if(!object(details) || !keys(details,["issues","truncated"]) || typeof details.truncated!=="boolean" ||
     !Array.isArray(details.issues) || details.issues.length<1 || details.issues.length>32)return generic;
  const indices=new Set<number>();
  for(const issue of details.issues) {
    if(!object(issue) || !keys(issue,["finding_index","field","code","evidence_ids"]) ||
       !Number.isSafeInteger(issue.finding_index) || Number(issue.finding_index)<0 || Number(issue.finding_index)>4095 || indices.has(Number(issue.finding_index)) ||
       issue.field!=="excerpt" || issue.code!=="excerpt_not_in_bound_evidence" || !Array.isArray(issue.evidence_ids) ||
       issue.evidence_ids.length<1 || issue.evidence_ids.length>32 || new Set(issue.evidence_ids).size!==issue.evidence_ids.length ||
       issue.evidence_ids.some(id=>typeof id!=="string" || id.length>128 || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(id)))return generic;
    indices.add(Number(issue.finding_index));
  }
  if(Buffer.byteLength(JSON.stringify(details))>8192)return generic;
  return `${generic}: ${JSON.stringify({code:"review_validation_failed",details})}`;
}
/** Narrow one-operation duplex protocol. No paths, scope or identity come from model arguments. */
export function createBoundedContextBridge<C>(configuration:BoundedProcessConfig, version:string):ContextBridge<C> {
  const c=structuredClone(configuration);
  if(!c || !isAbsolute(c.executable??"") || !isAbsolute(c.cwd??"") || !isAbsolute(c.entrypoint??"") || !isAbsolute(c.configurationPath??"") ||
     !Array.isArray(c.args) || c.args.length>30 || c.args.some(a=>typeof a!=="string" || a.length>4096) || !c.args.includes(c.entrypoint) || !c.args.includes(c.configurationPath) ||
     !Array.isArray(c.pins) || c.pins.length<2 || c.pins.length>128 || ![c.entrypoint,c.configurationPath].every(p=>c.pins.some(pin=>pin.path===p)) ||
     c.pins.some(p=>!isAbsolute(p.path) || !/^[a-f0-9]{64}$/.test(p.sha256)) ||
     !Number.isInteger(c.timeoutMs) || c.timeoutMs<100 || c.timeoutMs>120_000 || !Number.isInteger(c.maxOutputBytes) || c.maxOutputBytes<1024 || c.maxOutputBytes>4*1024*1024)
    throw Error("Invalid DFW drafting process configuration");
  return { async call(op,params,callbacks) {
    if(callbacks.operationDeadlineAt!==undefined && (!Number.isSafeInteger(callbacks.operationDeadlineAt) || callbacks.operationDeadlineAt<=0))
      throw Error("DFW drafting invalid operation deadline");
    const deadline=Math.min(Date.now()+c.timeoutMs,callbacks.operationDeadlineAt??Infinity);
    const checkDeadline=()=>{if(Date.now()>=deadline)throw Error("DFW drafting deadline exhausted");};
    checkDeadline();
    const input=JSON.stringify({version,op,params})+"\n";
    if(Buffer.byteLength(input)>128*1024) throw Error("DFW drafting request too large");
    for(const pin of c.pins) {
      checkDeadline();
      const metadata=await stat(pin.path);
      checkDeadline();
      if(!metadata.isFile()) throw Error("DFW drafting pins must be regular files");
      if(metadata.size>16*1024*1024) throw Error("DFW drafting pinned input too large");
      if(createHash("sha256").update(await readFile(pin.path)).digest("hex")!==pin.sha256) throw Error("DFW drafting pin mismatch");
      checkDeadline();
    }
    const remaining=deadline-Date.now();
    if(remaining<=0) throw Error("DFW drafting deadline exhausted");
    return new Promise((resolve,reject)=>{
      const child=spawn(c.executable,c.args,{cwd:c.cwd,shell:false,detached:process.platform!=="win32",stdio:["pipe","pipe","pipe"]});
      const controller=new AbortController();
      let settled=false,closing=false,childClosed=false,busy=false,resultSeen=false,contextCount=0,sequence=0,bytes=0,diagnostics=0;
      let buffer=Buffer.alloc(0), result:unknown;
      let failure:Error|undefined;
      let groupTerminated=false;
      const terminate=()=>{
        if(groupTerminated)return;
        groupTerminated=true;
        // POSIX detached children own a private process group. Kill descendants
        // as well as the leader; Node's close event reaps the direct child.
        if(process.platform!=="win32" && child.pid)try{process.kill(-child.pid,"SIGKILL");}catch{}
        child.kill("SIGKILL");
      };
      const finish=()=>{
        // Child termination does not prove an already-started host RPC has stopped.
        // Keep the caller's durable owner until that callback settles too.
        if(settled || !childClosed || busy)return;
        settled=true;clearTimeout(timer);controller.abort();
        if(failure)reject(failure);else resolve(result);
      };
      const fail=(message:string)=>{
        if(closing)return;
        failure=Error(message);closing=true;controller.abort();child.stdin.destroy();terminate();
        // Wait for close before releasing the caller's durable owner.
      };
      const timer=setTimeout(()=>fail("DFW drafting timed out; outcome unconfirmed"),remaining);
      child.on("error",()=>{fail("DFW drafting process unavailable");finish();});
      child.stdin.on("error",()=>fail("DFW drafting input failed; outcome unconfirmed"));
      const send=(value:unknown)=>{
        if(closing)return;
        const line=JSON.stringify(value)+"\n";
        if(Buffer.byteLength(line)>1024*1024)return fail("DFW drafting callback too large");
        child.stdin.write(line);
      };
      async function frame(line:Buffer) {
        if(closing)return;
        if(busy || resultSeen)return fail("DFW drafting protocol violation; outcome unconfirmed");
        let message:Record<string,unknown>;
        try { const decoded=new TextDecoder("utf-8",{fatal:true}).decode(line);const parsed:unknown=JSON.parse(decoded);if(!object(parsed))throw Error();message=parsed; }
        catch {return fail("DFW drafting invalid frame; outcome unconfirmed");}
        if(message.type==="result") {
          if(message.ok===false)return fail(rejectionMessage(message,version,op,contextCount>0));
          if(!keys(message,["type","ok","result"]) || message.ok!==true || contextCount<1)return fail("DFW drafting invalid result; outcome unconfirmed");
          resultSeen=true;result=message.result;child.stdin.end();return;
        }
        if(!Number.isSafeInteger(message.id) || message.id!==sequence+1 || sequence>=1024 ||
           !((message.type==="context" && keys(message,["type","id"])) || (message.type==="review" && keys(message,["type","id","request"]) && object(message.request) && contextCount>0)))
          return fail("DFW drafting invalid callback; outcome unconfirmed");
        sequence++;busy=true;
        try {
          if(message.type==="context") {
            const context=await callbacks.context(controller.signal);contextCount++;
            send({type:"context",id:message.id,context});
          } else {
            if(!callbacks.review)throw Error();
            const pending=await callbacks.review(message.request as Record<string,unknown>,controller.signal);
            if(pending.state!=="pending" || pending.request_id!==(message.request as Record<string,unknown>).request_id)throw Error();
            send({type:"review",id:message.id,...pending});
          }
        }catch {fail("DFW drafting trusted callback rejected; outcome unconfirmed");}
        finally {busy=false;finish();}
      }
      child.stdout.on("data",(chunk:Buffer)=>{
        if(closing)return;
        bytes+=chunk.length;
        if(bytes>c.maxOutputBytes)return fail("DFW drafting response too large; outcome unconfirmed");
        buffer=Buffer.concat([buffer,chunk]);
        for(let end=buffer.indexOf(10);end>=0;end=buffer.indexOf(10)) {
          const line=buffer.subarray(0,end);buffer=buffer.subarray(end+1);
          if(line.length===0 || line.length>=1024*1024)return fail("DFW drafting invalid frame; outcome unconfirmed");
          void frame(line);
        }
      });
      child.stderr.on("data",(chunk:Buffer)=>{diagnostics+=chunk.length;if(diagnostics>64*1024)fail("DFW drafting diagnostic limit exceeded; outcome unconfirmed");});
      child.on("close",code=>{
        childClosed=true;
        terminate();
        if(!failure && (code!==0 || !resultSeen || buffer.length || busy))failure=Error("DFW drafting process incomplete; outcome unconfirmed");
        finish();
      });
      child.stdin.write(input);
    });
  }};
}
