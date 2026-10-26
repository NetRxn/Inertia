/** Pinned native-review stdio only; no lifecycle, routing, credentials or listener.
 * An acquired fence has no expiry timer. The owning native transaction MUST
 * explicitly release it after commit/rollback and reconcile uncertain outcomes.
 * Callbacks are strictly read-only native facts. Deadline races discard late
 * callback replies; they do not claim to cancel arbitrary callback side effects.
 * Two database commits are not made atomic by this transport.
 */
import {readFile,lstat,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {isAbsolute} from 'node:path';
const VERSION='dfw-native-review-v1',MAX_CALLBACKS=1024,MAX_FRAME=1024*1024;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const keys=(v,fields)=>object(v)&&Object.keys(v).length===fields.length&&fields.every(k=>Object.hasOwn(v,k));
const id=v=>typeof v==='string'&&v.length>0&&v.length<=200&&!/[\s\x00-\x1f\x7f]/.test(v);
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const canonical=v=>Array.isArray(v)?v.map(canonical):object(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a,b)=>equal(canonical(a),canonical(b));
const freeze=v=>{if(v&&typeof v==='object'){for(const child of Object.values(v))freeze(child);Object.freeze(v);}return v;};
const contextFields=['company_id','applicant_slug','match_id','principal_id','run_id','role'];
const assignmentFields=['company_id','project_id','issue_id','interaction_id','decision_id','producer_agent_id','producer_run_id','reviewer_agent_id','reviewer_run_id'];
const bindingFields=['company_id','issue_id','interaction_id','decision_id','producer_principal_id','producer_run_id','reviewer_principal_id','reviewer_run_id','candidate_hash'];
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
export class NativeReviewTransportError extends Error {
 constructor(code,message,uncertain=false){super(message);this.name='NativeReviewTransportError';this.code=code;this.outcomeUnconfirmed=uncertain;this.validationRejected=false;}
}
const error=(code,message,uncertain=false)=>new NativeReviewTransportError(code,message,uncertain);
function validContext(v){return keys(v,contextFields)&&contextFields.filter(k=>k!=='role').every(k=>id(v[k]))&&v.applicant_slug.length<=128&&v.role==='reviewer';}
function validAssignment(v){return keys(v,assignmentFields)&&assignmentFields.every(k=>id(v[k]))&&v.producer_agent_id!==v.reviewer_agent_id&&v.producer_run_id!==v.reviewer_run_id;}
function validBinding(v){return keys(v,bindingFields)&&bindingFields.filter(k=>k!=='candidate_hash').every(k=>id(v[k]))&&hash(v.candidate_hash)&&v.producer_principal_id!==v.reviewer_principal_id&&v.producer_run_id!==v.reviewer_run_id;}
function validArtifact(v){
 return keys(v,['candidate_hash','requirement_hash','evidence_set_hash','rubric_version','findings','requirement_supported'])
  &&['candidate_hash','requirement_hash','evidence_set_hash'].every(k=>hash(v[k]))&&typeof v.rubric_version==='string'&&v.rubric_version.length>0
  &&typeof v.requirement_supported==='boolean'&&Array.isArray(v.findings)&&v.findings.length<=4096
  &&Array.from(v.findings).every(f=>keys(f,['claim_start','claim_end','support','excerpt','rationale'])&&Number.isSafeInteger(f.claim_start)&&Number.isSafeInteger(f.claim_end)
   &&['supported','partial','unsupported','contradicted'].includes(f.support)&&typeof f.excerpt==='string'&&f.excerpt.length>0&&typeof f.rationale==='string'&&f.rationale.length>0);
}
function rejection(message,op,authenticated){
 const unknown=text=>({message:text,validationRejected:false});
 const generic=()=>unknown('Native review rejected request; outcome unconfirmed');
 const allowed=['invalid_config','invalid_protocol','invalid_request','authentication_failed','drafting_rejected','internal_error'];
 if(keys(message,['type','ok','error'])&&allowed.includes(message.error))return unknown(`Native review rejected request (${message.error}); outcome unconfirmed`);
 if(op!=='admit'||!authenticated||!keys(message,['type','ok','error','details'])||message.error!=='review_validation_failed')return generic();
 const d=message.details;
 if(!keys(d,['issues','truncated'])||typeof d.truncated!=='boolean'||!Array.isArray(d.issues)||d.issues.length<1||d.issues.length>32||Buffer.byteLength(JSON.stringify(d))>8192)return generic();
 const indices=new Set();
 for(const item of d.issues){
  if(!keys(item,['finding_index','field','code','evidence_ids'])||!Number.isSafeInteger(item.finding_index)||item.finding_index<0||item.finding_index>4095||indices.has(item.finding_index)
   ||item.field!=='excerpt'||item.code!=='excerpt_not_in_bound_evidence'||!Array.isArray(item.evidence_ids)||item.evidence_ids.length<1||item.evidence_ids.length>32
   ||new Set(item.evidence_ids).size!==item.evidence_ids.length||item.evidence_ids.some(x=>typeof x!=='string'||x.length>128||!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(x)))return generic();
  indices.add(item.finding_index);
 }
 return {message:`Native review validation rejected: ${JSON.stringify({code:'review_validation_failed',details:d})}`,validationRejected:true};
}
function configuration(value){
 const fields=['executable','args','cwd','entrypoint','configurationPath','pins','timeoutMs','maxOutputBytes'];
 if(!keys(value,fields))throw error('native_review_configuration','Invalid native review process configuration');
 const c=structuredClone(value);
 if(![c.executable,c.cwd,c.entrypoint,c.configurationPath].every(x=>typeof x==='string'&&isAbsolute(x))
  ||!Array.isArray(c.args)||c.args.length>30||c.args.some(x=>typeof x!=='string'||x.length>4096)||!c.args.includes(c.entrypoint)||!c.args.includes(c.configurationPath)
  ||!Array.isArray(c.pins)||c.pins.length<2||c.pins.length>128||new Set(c.pins.map(x=>x?.path)).size!==c.pins.length
  ||c.pins.some(p=>!keys(p,['path','sha256'])||typeof p.path!=='string'||!isAbsolute(p.path)||!hash(p.sha256))
  ||![c.entrypoint,c.configurationPath].every(p=>c.pins.some(pin=>pin.path===p))
  ||!Number.isInteger(c.timeoutMs)||c.timeoutMs<100||c.timeoutMs>120000||!Number.isInteger(c.maxOutputBytes)||c.maxOutputBytes<1024||c.maxOutputBytes>4*1024*1024)
  throw error('native_review_configuration','Invalid native review process configuration');
 return freeze(c);
}
export function createNativeReviewStdio(config){
 const c=configuration(config);
 return Object.freeze({async call(op,params,callbacks){
  if(!['context','admit','receipt','fence'].includes(op)||!(op==='admit'?validArtifact(params):keys(params,[])))throw error('native_review_request','Invalid native review operation request');
  if(!callbacks||typeof callbacks.context!=='function'||typeof callbacks.nativeAssignment!=='function')throw error('native_review_callbacks','Invalid trusted native review callbacks');
  if(callbacks.operationDeadlineAt!==undefined&&(!Number.isSafeInteger(callbacks.operationDeadlineAt)||callbacks.operationDeadlineAt<=0))throw error('native_review_deadline','Invalid native review operation deadline');
  const deadline=Math.min(Date.now()+c.timeoutMs,callbacks.operationDeadlineAt??Infinity),check=()=>{if(Date.now()>=deadline)throw error('native_review_deadline','Native review deadline exhausted before process launch');};
  const input=JSON.stringify({version:VERSION,op,params})+'\n';if(Buffer.byteLength(input)>128*1024)throw error('native_review_request','Native review request too large');
  check();
  for(const pin of c.pins){
   check();const metadata=await lstat(pin.path);check();
   if(!metadata.isFile()||metadata.size>16*1024*1024)throw error('native_review_pins','Native review pins must be bounded regular files');
   if(createHash('sha256').update(await readFile(pin.path)).digest('hex')!==pin.sha256)throw error('native_review_pins','Native review pin mismatch');check();
  }
  if(!(await stat(c.cwd)).isDirectory())throw error('native_review_configuration','Native review cwd is not a directory');check();
  return new NativeReviewSession(c,op,input,callbacks,deadline).initial.promise;
 }});
}
class NativeReviewSession {
 constructor(c,op,input,callbacks,deadline){
  Object.assign(this,{c,op,callbacks,deadline,params:freeze(JSON.parse(input).params),sequence:0,commandSequence:0,contextCount:0,nativeCount:0,bytes:0,diagnostics:0,buffer:Buffer.alloc(0),phase:'initial',busy:false,closed:false,resultSeen:false,initialResolved:false,terminated:false});
  this.initial=deferred();this.controller=new AbortController();this.closeWait=deferred();
  this.child=spawn(c.executable,c.args,{cwd:c.cwd,shell:false,detached:process.platform!=='win32',stdio:['pipe','pipe','pipe'],env:{PATH:'/usr/bin:/bin',HOME:'/nonexistent',LANG:'C.UTF-8',LC_ALL:'C.UTF-8',PYTHONDONTWRITEBYTECODE:'1',PYTHONNOUSERSITE:'1'}});
  this.timer=setTimeout(()=>this.fail('native_review_timeout','Native review timed out; outcome unconfirmed'),Math.max(1,deadline-Date.now()));
  this.child.on('error',()=>this.fail('native_review_spawn','Native review process unavailable; outcome unconfirmed'));
  this.child.stdin.on('error',()=>this.fail('native_review_input','Native review input failed; outcome unconfirmed'));
  this.child.stdout.on('data',chunk=>this.data(chunk));
  this.child.stderr.on('data',chunk=>{this.diagnostics+=chunk.length;if(this.diagnostics>64*1024)this.fail('native_review_diagnostics','Native review diagnostic limit exceeded; outcome unconfirmed');});
  this.child.on('exit',code=>{this.exited=true;if(code!==0||!this.resultSeen)this.fail('native_review_exit','Native review process exited before acknowledgement; outcome unconfirmed');});
  this.child.on('close',code=>{this.closed=true;this.terminate();if(!this.failure&&(code!==0||!this.resultSeen||this.buffer.length))this.failure=error('native_review_incomplete','Native review process incomplete; outcome unconfirmed',true);this.finish();});
  this.child.stdin.write(input);
 }
 terminate(){if(this.terminated)return;this.terminated=true;if(process.platform!=='win32'&&this.child.pid)try{process.kill(-this.child.pid,'SIGKILL');}catch{}this.child.kill('SIGKILL');}
 fail(code,message){
  if(this.failure)return;
  this.failure=error(code,message,true);clearTimeout(this.timer);this.controller.abort();
  // After ready the child owns the private fence. A failed check cannot release
  // it before the native owner rolls back. Only explicit release may terminate.
  if(this.phase==='ready'&&!this.ownerReleasing&&!this.exited&&!this.closed){
   if(this.pending){clearTimeout(this.pending.timer);this.pending.deferred.reject(this.failure);this.pending=null;}
   return;
  }
  this.child.stdin.destroy();this.terminate();this.finish();
 }
 async trustedCallback(callback){
  const deadline=this.phase==='initial'?this.deadline:this.pending?.deadline;
  if(!Number.isSafeInteger(deadline)||deadline<=Date.now()){
   this.fail('native_review_timeout','Native review callback timed out; outcome unconfirmed');throw this.failure;
  }
  let timer,onAbort;
  const aborted=new Promise((_,reject)=>{
   onAbort=()=>reject(this.failure??error('native_review_callback','Native review callback aborted; outcome unconfirmed',true));
   this.controller.signal.addEventListener('abort',onAbort,{once:true});
   if(this.controller.signal.aborted)onAbort();
   timer=setTimeout(()=>{this.fail('native_review_timeout','Native review callback timed out; outcome unconfirmed');onAbort();},deadline-Date.now());
  });
  try{
   const result=await Promise.race([Promise.resolve().then(()=>callback(this.controller.signal)),aborted]);
   if(this.failure)throw this.failure;
   if(Date.now()>=deadline){this.fail('native_review_timeout','Native review callback timed out; outcome unconfirmed');throw this.failure;}
   return result;
  }finally{clearTimeout(timer);this.controller.signal.removeEventListener('abort',onAbort);}
 }
 finish(){
  if(!this.closed||this.busy)return;
  clearTimeout(this.timer);if(this.pending)clearTimeout(this.pending.timer);this.controller.abort();
  if(!this.failure&&this.terminalRejection)this.failure=this.terminalRejection;
  if(this.failure){if(!this.initialResolved){this.initialResolved=true;this.initial.reject(this.failure);}this.pending?.deferred.reject(this.failure);}
  else if(this.op==='fence'){this.pending?.deferred.resolve(this.finalResult);}
  else if(!this.initialResolved){this.initialResolved=true;this.initial.resolve(this.finalResult);}
  this.pending=null;this.closeWait.resolve();
 }
 send(value){if(this.failure||this.closed)return;const line=JSON.stringify(value)+'\n';if(Buffer.byteLength(line)>MAX_FRAME)return this.fail('native_review_callback_size','Native review callback too large; outcome unconfirmed');this.child.stdin.write(line);}
 data(chunk){
  if(this.failure)return;this.bytes+=chunk.length;if(this.bytes>this.c.maxOutputBytes)return this.fail('native_review_output','Native review response too large; outcome unconfirmed');
  this.buffer=Buffer.concat([this.buffer,chunk]);
  for(let end=this.buffer.indexOf(10);end>=0;end=this.buffer.indexOf(10)){
   const line=this.buffer.subarray(0,end);this.buffer=this.buffer.subarray(end+1);
   if(!line.length||line.length>=MAX_FRAME)return this.fail('native_review_frame','Native review invalid frame; outcome unconfirmed');
   void this.frame(line).catch(()=>this.fail('native_review_frame','Native review invalid frame; outcome unconfirmed'));
  }
  if(this.buffer.length>=MAX_FRAME)this.fail('native_review_frame','Native review frame limit exceeded; outcome unconfirmed');
 }
 async frame(line){
  if(this.failure)return;if(this.busy||this.resultSeen)return this.fail('native_review_protocol','Native review protocol violation; outcome unconfirmed');
  let m;try{m=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(line));if(!object(m))throw Error();}catch{return this.fail('native_review_frame','Native review invalid frame; outcome unconfirmed');}
  if(m.type==='context'||m.type==='native_assignment'){
   if(!keys(m,['type','id'])||!Number.isSafeInteger(m.id)||m.id!==this.sequence+1||m.id>MAX_CALLBACKS||(this.phase==='ready'&&this.pending?.kind!=='assert_alive'))return this.fail('native_review_callback','Native review invalid callback; outcome unconfirmed');
   this.sequence++;this.busy=true;
   try{
    if(m.type==='context'){
     const value=await this.trustedCallback(signal=>this.callbacks.context(signal));if(!validContext(value)||(this.context&&!same(value,this.context)))throw Error();
     this.context=freeze(structuredClone(value));this.contextCount++;this.send({type:'context',id:m.id,context:this.context});
    }else{
     if(!this.contextCount)throw Error();const value=await this.trustedCallback(signal=>this.callbacks.nativeAssignment(signal));
     if(!validAssignment(value)||value.company_id!==this.context.company_id||value.reviewer_run_id!==this.context.run_id||(this.assignment&&!same(value,this.assignment)))throw Error();
     this.assignment=freeze(structuredClone(value));this.nativeCount++;this.send({type:'native_assignment',id:m.id,assignment:this.assignment});
    }
   }catch{this.fail('native_review_authority','Native review trusted callback rejected; outcome unconfirmed');}
   finally{this.busy=false;this.finish();}
   return;
  }
  if(m.type==='result'){
   if(m.ok===false){
    const rejected=rejection(m,this.op,this.contextCount>0&&this.nativeCount>0);
    if(!rejected.validationRejected)return this.fail('native_review_rejected',rejected.message);
    // Only this pre-admission validator is retryable. Keep it provisional until
    // the pinned child exits0 with no further/trailing frames or protocol error.
    this.resultSeen=true;this.terminalRejection=error('native_review_validation',rejected.message,false);this.terminalRejection.validationRejected=true;this.child.stdin.end();return;
   }
   if(!keys(m,['type','ok','result'])||m.ok!==true||!object(m.result)||!this.contextCount||!this.nativeCount)return this.fail('native_review_result','Native review invalid result; outcome unconfirmed');
   if(this.op!=='fence'&&!this.validSuccess(m.result))return this.fail('native_review_result','Native review misbound result; outcome unconfirmed');
   if(this.op==='fence'&&(!this.pending||this.pending.kind!=='release'||!keys(m.result,['released'])||m.result.released!==true))return this.fail('native_review_protocol','Native review unexpected final result; outcome unconfirmed');
   this.resultSeen=true;this.finalResult=m.result;this.child.stdin.end();return;
  }
  if(m.type==='fence_ready'){
   if(this.op!=='fence'||this.phase!=='initial'||!keys(m,['type','result'])||!this.contextCount||!this.nativeCount||!this.validReady(m.result))return this.fail('native_review_fence','Native review invalid fence binding; outcome unconfirmed');
   this.ready=freeze(structuredClone(m.result));this.phase='ready';clearTimeout(this.timer);this.initialResolved=true;this.initial.resolve(this.lease());return;
  }
  if(m.type==='fence_alive'){
   if(!keys(m,['type','id'])||this.phase!=='ready'||this.pending?.kind!=='assert_alive'||m.id!==this.pending.id)return this.fail('native_review_protocol','Native review invalid fence acknowledgement; outcome unconfirmed');
   const p=this.pending;clearTimeout(p.timer);this.pending=null;p.deferred.resolve();return;
  }
  this.fail('native_review_protocol','Native review unknown protocol frame; outcome unconfirmed');
 }
 bindingMatches(b){
  if(!validBinding(b)||!this.assignment||!this.context)return false;
  return ['company_id','issue_id','interaction_id','decision_id','producer_run_id','reviewer_run_id'].every(k=>b[k]===this.assignment[k])
   &&b.reviewer_principal_id===this.context.principal_id;
 }
 validReceipt(v,artifact){
  if(!keys(v,['binding','review_id','candidate_id','artifact_hash','state'])||!this.bindingMatches(v.binding)||!id(v.review_id)||!id(v.candidate_id)||!hash(v.artifact_hash)||!['supported','rejected'].includes(v.state))return false;
  if(!artifact)return true;
  const digest=createHash('sha256').update(JSON.stringify(canonical(artifact))).digest('hex');
  const state=artifact.requirement_supported&&artifact.findings.every(f=>f.support==='supported')?'supported':'rejected';
  return v.binding.candidate_hash===artifact.candidate_hash&&v.artifact_hash===digest&&v.state===state;
 }
 validSuccess(v){
  if(this.op==='admit')return this.validReceipt(v,this.params);
  if(this.op==='receipt')return this.validReceipt(v);
  if(!keys(v,['binding','context'])||!this.bindingMatches(v.binding)||!keys(v.context,['requests','next_action'])||v.context.next_action!=='review_candidates'||!Array.isArray(v.context.requests)||v.context.requests.length!==1)return false;
  const request=v.context.requests[0],candidate=request?.candidate;
  return object(request)&&request.request_id===v.binding.candidate_hash&&request.candidate_hash===v.binding.candidate_hash
   &&object(candidate)&&candidate.candidate_hash===v.binding.candidate_hash
   // The immutable candidate payload can predate producer column attribution.
   // Binding identity is authoritative; do not invent missing payload metadata.
   &&(candidate.producer_id==null||candidate.producer_id===v.binding.producer_principal_id)
   &&(candidate.producer_run_id==null||candidate.producer_run_id===v.binding.producer_run_id);
 }
 validReady(v){
  return keys(v,['binding','candidate','receipt'])&&this.bindingMatches(v.binding)&&keys(v.candidate,['candidate_hash','producer_principal_id','producer_run_id'])
   &&v.candidate.candidate_hash===v.binding.candidate_hash&&v.candidate.producer_principal_id===v.binding.producer_principal_id&&v.candidate.producer_run_id===v.binding.producer_run_id
   &&this.validReceipt(v.receipt)&&same(v.receipt.binding,v.binding);
 }
 usable(){if(this.failure)throw this.failure;if(this.closed||this.phase!=='ready')throw error('native_review_closed','Native review fence closed; outcome unconfirmed',true);}
 command(kind){
  this.usable();if(this.pending||this.commandSequence>=MAX_CALLBACKS){this.fail('native_review_protocol','Native review command unavailable; outcome unconfirmed');return Promise.reject(this.failure);}
  const d=deferred(),id=++this.commandSequence,timer=setTimeout(()=>this.fail('native_review_timeout','Native review fence command timed out; outcome unconfirmed'),this.c.timeoutMs);
  this.pending={kind,id,deferred:d,timer,deadline:Date.now()+this.c.timeoutMs};this.send({type:kind,id});return d.promise;
 }
 lease(){
  const self=this;let alivePromise,releasePromise;
  return Object.freeze({binding:self.ready.binding,
   async readCandidate(selector){self.usable();if(releasePromise)throw error('native_review_closed','Native review fence releasing; outcome unconfirmed',true);
    if(selector!==undefined){const expected={companyId:self.assignment.company_id,projectId:self.assignment.project_id,issueId:self.assignment.issue_id,producerAgentId:self.assignment.producer_agent_id,reviewerAgentId:self.assignment.reviewer_agent_id,producerPrincipalId:self.ready.binding.producer_principal_id,reviewerPrincipalId:self.ready.binding.reviewer_principal_id,producerRunId:self.assignment.producer_run_id};if(!object(selector)||Object.keys(selector).some(k=>!Object.hasOwn(expected,k)||selector[k]!==expected[k]))throw error('native_review_scope','Native review fence scope mismatch');}
    return self.ready.candidate;
   },
   async readAdmission(binding){self.usable();if(releasePromise)throw error('native_review_closed','Native review fence releasing; outcome unconfirmed',true);if(!same(binding,self.ready.binding))throw error('native_review_scope','Native review fence binding mismatch');return self.ready.receipt;},
   assertAlive(){if(releasePromise)return Promise.reject(error('native_review_closed','Native review fence releasing; outcome unconfirmed',true));if(!alivePromise)alivePromise=Promise.resolve().then(()=>self.command('assert_alive')).finally(()=>{alivePromise=undefined;});return alivePromise;},
   release(){
    if(!releasePromise){
     self.ownerReleasing=true;
     releasePromise=(async()=>{
      try{if(alivePromise)await alivePromise;self.usable();return await self.command('release');}
      catch(cause){
       // The native owner has explicitly finished commit/rollback. An unhealthy
       // protocol cannot provide a clean release ack; reap only this owned child.
       self.child.stdin.destroy();self.terminate();await self.closeWait.promise;
       const failure=self.failure??cause;failure.childReaped=self.closed;failure.fenceReleaseConfirmed=false;throw failure;
      }
     })();
    }
    return releasePromise;
   },
  });
 }
}
