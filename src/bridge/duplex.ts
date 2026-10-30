import { open, stat } from "node:fs/promises";
import { constants, type BigIntStats } from "node:fs";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { isAbsolute } from "node:path";
import type { DiscoveryProcessConfig } from "../discovery/stdio.js";
export interface BoundedProcessConfig extends DiscoveryProcessConfig { configurationPath: string }
export interface ContextCallbacks<C> {
  /** Trusted caller deadline, never serialized into private/model parameters. */
  operationDeadlineAt?: number;
  context(signal?:AbortSignal):Promise<C>;
  sourceAssignment?(request:Record<string,unknown>,signal?:AbortSignal):Promise<Record<string,unknown>>;
  caseTask?(request:Record<string,unknown>,signal?:AbortSignal):Promise<Record<string,unknown>>;
  privateAuthorization?(request:Record<string,unknown>,signal?:AbortSignal):Promise<{authorized:boolean;scope_hash:string;actor_hash:string}>;
  review?(request:Record<string,unknown>,signal?:AbortSignal):Promise<{state:"pending";request_id:string}>;
}
export interface ContextBridge<C> {
  call(operation:string,params:Record<string,unknown>,callbacks:ContextCallbacks<C>):Promise<unknown>;
}
const object=(v:unknown):v is Record<string,unknown>=>!!v && typeof v==="object" && !Array.isArray(v);
const keys=(v:Record<string,unknown>,fields:string[])=>Object.keys(v).length===fields.length && fields.every(k=>Object.hasOwn(v,k));
const safeRejectionCodes=new Set(["invalid_config","invalid_protocol","invalid_request","authentication_failed","drafting_rejected","native_preparation_rejected","internal_error"]);
const samePinnedFile=(a:BigIntStats,b:BigIntStats)=>a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeNs===b.mtimeNs&&a.ctimeNs===b.ctimeNs;
async function verifyPinnedFile(pin:{path:string;sha256:string},checkDeadline:()=>void):Promise<void> {
  checkDeadline();
  const initial=await stat(pin.path,{bigint:true});
  checkDeadline();
  if(!initial.isFile())throw Error("DFW drafting pins must be regular files");
  // Keep configured symlink-to-regular-file behavior. NONBLOCK prevents a path
  // swapped to a FIFO from hanging open before descriptor type verification.
  const file=await open(pin.path,constants.O_RDONLY|constants.O_NONBLOCK);
  try {
    checkDeadline();
    const opened=await file.stat({bigint:true});
    checkDeadline();
    if(!opened.isFile())throw Error("DFW drafting pins must be regular files");
    if(!samePinnedFile(initial,opened))throw Error("DFW drafting pin changed while verifying");
    const hash=createHash("sha256"),chunk=Buffer.allocUnsafe(64*1024);
    while(true) {
      checkDeadline();
      const {bytesRead}=await file.read(chunk,0,chunk.length,null);
      checkDeadline();
      if(bytesRead===0)break;
      hash.update(chunk.subarray(0,bytesRead));
    }
    const after=await file.stat({bigint:true});checkDeadline();
    const pathAfter=await stat(pin.path,{bigint:true});checkDeadline();
    if(!samePinnedFile(opened,after)||!samePinnedFile(opened,pathAfter))throw Error("DFW drafting pin changed while verifying");
    if(hash.digest("hex")!==pin.sha256)throw Error("DFW drafting pin mismatch");
  } finally { await file.close(); }
}
function rejectionMessage(message:Record<string,unknown>,version:string,operation:string,authenticated:boolean):string {
  const generic="DFW drafting rejected request";
  if(version==="dfw-entity-grounding-v1"){
    if(!authenticated||!keys(message,["type","ok","error","details"])||message.error!=="entity_validation_failed")return generic;
    const d=message.details,fields=new Set("offset limit source_id context_hash query request_id source_ids unsupported_field".split(" "));
    const codes=new Set("missing extra_forbidden int_type int_parsing int_from_float greater_than_equal less_than_equal string_type string_too_short string_too_long string_pattern_mismatch list_type too_short too_long value_error finite_number".split(" "));
    if(!object(d)||!keys(d,["issues","truncated"])||typeof d.truncated!=="boolean"||!Array.isArray(d.issues)||!d.issues.length||d.issues.length>20||Buffer.byteLength(JSON.stringify(d))>8192)return generic;
    for(const i of d.issues)if(!object(i)||!keys(i,["path","code"])||!Array.isArray(i.path)||i.path.length>8||i.path.some(k=>!(typeof k==="string"&&fields.has(k))&&!(Number.isSafeInteger(k)&&Number(k)>=0&&Number(k)<=10000000))||typeof i.code!=="string"||!codes.has(i.code))return generic;
    return generic+": "+JSON.stringify({code:"entity_validation_failed",details:d});
  }
  if(version==="dfw-private-preparation-v1"){
    if(!authenticated||!keys(message,["type","ok","error","details"])||message.error!=="invalid_parameters")return generic;
    const d=message.details,fields=new Set("target_type target_key value evidence_ids confidence rationale concerns claim_support claim_text evidence_id source_locator source_revision support_kind source_content_hash claim_start claim_end numeric_derivation operands formula units currency period commitment fact_key candidate_hash requirement_hash evidence_set_hash rubric_version findings requirement_supported support excerpt unknown_field".split(" "));
    const types=new Set("missing extra_forbidden string_type string_too_short string_too_long string_pattern_mismatch dict_type list_type literal_error int_type int_parsing int_from_float float_type float_parsing bool_type bool_parsing finite_number decimal_type decimal_parsing greater_than greater_than_equal less_than less_than_equal value_error".split(" "));
    if(!object(d)||!keys(d,["issues","truncated"])||typeof d.truncated!=="boolean"||!Array.isArray(d.issues)||!d.issues.length||d.issues.length>20||Buffer.byteLength(JSON.stringify(d))>8192)return generic;
    for(const i of d.issues)if(!object(i)||!keys(i,["path","type"])||!Array.isArray(i.path)||i.path.length>12||i.path.some(t=>!(typeof t==="string"&&fields.has(t))&&!(Number.isInteger(t)&&Number(t)>=0&&Number(t)<1000))||typeof i.type!=="string"||!types.has(i.type))return generic;
    return `${generic}: ${JSON.stringify({code:"private_validation_failed",details:d})}`;
  }
  const caseSource=version==="dfw-native-case-work-v1"&&["source_context","source_links","source_capture","source_propose","source_receipt","source_review","source_settlement"].includes(operation);
  if(version==="dfw-general-enrichment-v1"||caseSource){
    if(((version==="dfw-general-enrichment-v1"&&operation==="capture")||
        (version==="dfw-native-case-work-v1"&&operation==="source_capture"))
        &&authenticated&&keys(message,["type","ok","error","details"])&&message.error==="capture_failed"){
      const d=message.details;
      if(object(d)&&keys(d,["code","http_status"])&&
        ((d.code==="http_status"&&Number.isInteger(d.http_status)&&Number(d.http_status)>=400&&Number(d.http_status)<=599)||
         (d.code==="fetch_failed"&&d.http_status===null)))
        return `${generic}: ${JSON.stringify({code:"capture_failed",details:d})}`;
      return generic;
    }
    const validationCode=caseSource?"case_source_validation_failed":"enrichment_validation_failed";
    if(!caseSource&&!["context","propose","review","receipt","capture","triage_scan","triage_page","links"].includes(operation)||!keys(message,["type","ok","error","details"])||message.error!==validationCode)return generic;
    const d=message.details,paths=new Set('answer_key artifact_type confidence content_sha256 context_hash decision effective_date end evidence evidence_required evidence_requirements expected_content_sha256 expected_media_types field fields findings form_version instructions key language_kind limit locator_notes max_characters max_verification_age_days max_words message offset op operation owner_role parameters params portal_field proposal_hash quote record_id required required_attachment required_for_handoff requirement requirements resolution_answer_key response_type responsible_party role severity source_document_id source_locator source_reference source_url sponsor_language start title unresolved_concerns unsupported_field url validation_rules value verification_status verified_on version scan_hash view'.split(" ")),codes=new Set('missing extra_forbidden dict_type model_type model_attributes_type list_type value_error literal_error string_type string_pattern_mismatch string_too_short string_too_long int_type int_parsing int_from_float greater_than greater_than_equal less_than_equal bool_type bool_parsing float_type float_parsing date_type date_parsing date_from_datetime_parsing finite_number invalid_value sponsor_language_quote_mismatch exact_source_passage_required verified_metadata_incomplete'.split(" "));
    if(!object(d)||!keys(d,["issues","truncated"])||typeof d.truncated!=="boolean"||!Array.isArray(d.issues)||d.issues.length<1||d.issues.length>32||Buffer.byteLength(JSON.stringify(d))>8192)return generic;
    for(const i of d.issues)if(!object(i)||!keys(i,["path","code"])||!Array.isArray(i.path)||i.path.length>12||i.path.some(t=>!(typeof t==="string"&&paths.has(t))&&!(Number.isSafeInteger(t)&&Number(t)>=0&&Number(t)<=10_000_000))||typeof i.code!=="string"||!codes.has(i.code))return generic;
    return `${generic}: ${JSON.stringify({code:validationCode,details:d})}`;
  }
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
     !Array.isArray(c.pins) || c.pins.length<2 || c.pins.length>256 || ![c.entrypoint,c.configurationPath].every(p=>c.pins.some(pin=>pin.path===p)) ||
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
    if(Buffer.byteLength(input)>(version==="dfw-native-case-work-v1"?256:128)*1024) throw Error("DFW drafting request too large");
    for(const pin of c.pins) {
      await verifyPinnedFile(pin,checkDeadline);
    }
    const remaining=deadline-Date.now();
    if(remaining<=0) throw Error("DFW drafting deadline exhausted");
    return new Promise((resolve,reject)=>{
      const child=spawn(c.executable,c.args,{cwd:c.cwd,shell:false,detached:process.platform!=="win32",stdio:["pipe","pipe","pipe"]});
      const controller=new AbortController();
      let settled=false,closing=false,childClosed=false,busy=false,resultSeen=false,contextCount=0,privateCount=0,sequence=0,bytes=0,diagnostics=0;
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
          if(!keys(message,["type","ok","result"]) || message.ok!==true || (contextCount<1||version==="dfw-private-preparation-v1"&&privateCount<1))return fail("DFW drafting invalid result; outcome unconfirmed");
          resultSeen=true;result=message.result;child.stdin.end();return;
        }
        if(!Number.isSafeInteger(message.id) || message.id!==sequence+1 || sequence>=1024 ||
           !((message.type==="context" && keys(message,["type","id"])) || (message.type==="review" && keys(message,["type","id","request"]) && object(message.request) && contextCount>0) || (version==="dfw-native-case-work-v1" && message.type==="source_assignment" && keys(message,["type","id","case_binding_id","proposal_hash"]) && typeof message.case_binding_id==="string" && typeof message.proposal_hash==="string" && /^[a-f0-9]{64}$/.test(message.proposal_hash) && contextCount>0) || (version==="dfw-native-case-work-v1" && message.type==="case_task" && keys(message,["type","id","case_binding_id"]) && typeof message.case_binding_id==="string" && contextCount>0) || (version==="dfw-private-preparation-v1" && message.type==="private_authorization" && keys(message,["type","id","scope","actor","scope_hash","actor_hash"]) && object(message.scope) && object(message.actor) && contextCount>0)))
          return fail("DFW drafting invalid callback; outcome unconfirmed");
        sequence++;busy=true;
        try {
          if(message.type==="context") {
            const context=await callbacks.context(controller.signal);contextCount++;
            send({type:"context",id:message.id,context});
          } else if(message.type==="source_assignment") {
            if(!callbacks.sourceAssignment)throw Error();
            const assignment=await callbacks.sourceAssignment({case_binding_id:message.case_binding_id,proposal_hash:message.proposal_hash},controller.signal);
            send({type:"source_assignment",id:message.id,assignment});
          } else if(message.type==="case_task") {
            if(!callbacks.caseTask)throw Error();
            const task=await callbacks.caseTask({case_binding_id:message.case_binding_id},controller.signal);
            send({type:"case_task",id:message.id,task});
          } else if(message.type==="private_authorization") {
            if(!callbacks.privateAuthorization)throw Error();
            const grant=await callbacks.privateAuthorization(message,controller.signal);
            if(typeof grant.authorized!=="boolean"||grant.scope_hash!==message.scope_hash||grant.actor_hash!==message.actor_hash)throw Error();
            if(grant.authorized)privateCount++;
            send({type:"private_authorization",id:message.id,...grant});
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
