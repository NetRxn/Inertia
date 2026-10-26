// Synthetic pinned child only: no provider, database or network.
import fs from 'node:fs/promises';import readline from 'node:readline';
const cfg=JSON.parse(await fs.readFile(process.argv[3],'utf8'));
if(cfg.pidPath)await fs.writeFile(cfg.pidPath,String(process.pid));
const rl=readline.createInterface({input:process.stdin,crlfDelay:Infinity}),lines=rl[Symbol.asyncIterator]();
const read=async()=>{const x=await lines.next();if(x.done)throw Error('synthetic EOF');return JSON.parse(x.value);};
const send=x=>process.stdout.write(JSON.stringify(x)+'\n');
const exit=()=>{rl.close();process.stdout.write('',()=>process.exit(0));};
const req=await read();let sequence=0;
async function callback(type){send({type,id:++sequence});return read();}
if(cfg.mode==='hang'){setInterval(()=>{},1000);await new Promise(()=>{});}
if(cfg.mode==='bad-id'){send({type:'context',id:2});await new Promise(()=>{});}
if(cfg.mode==='oversize'){process.stdout.write('x'.repeat(8192)+'\n');await new Promise(()=>{});}
if(cfg.mode==='diagnostics'){process.stderr.write('x'.repeat(66000));await new Promise(()=>{});}
if(cfg.mode==='error-before-auth'){send({type:'result',ok:false,error:'review_validation_failed',details:{issues:[{finding_index:0,field:'excerpt',code:'excerpt_not_in_bound_evidence',evidence_ids:['evidence-1']}],truncated:false}});exit();await new Promise(()=>{});}
await callback('context');await callback('native_assignment');
if(cfg.mode==='early-exit')exit();
else if(req.op!=='fence'){
 if(cfg.mode.startsWith('error-details')){send({type:'result',ok:false,error:'review_validation_failed',details:{issues:[{finding_index:0,field:'excerpt',code:'excerpt_not_in_bound_evidence',evidence_ids:['evidence-1'],...(cfg.mode==='error-details-bad'?{excerpt:'raw-private-canary'}:{})}],truncated:false}});if(cfg.mode==='error-details-extra')send({type:'result',ok:true,result:{unexpected:true}});if(cfg.mode==='error-details-exit1'){rl.close();process.stdout.write('',()=>process.exit(1));await new Promise(()=>{});}}
 else if(cfg.mode==='error-generic')send({type:'result',ok:false,error:'drafting_rejected'});
 else {
  let result=req.op==='admit'?structuredClone(cfg.ready.receipt):{binding:cfg.ready.binding,context:{requests:[{request_id:cfg.ready.binding.candidate_hash,candidate_hash:cfg.ready.binding.candidate_hash,candidate:{candidate_hash:cfg.ready.binding.candidate_hash,producer_id:cfg.ready.binding.producer_principal_id,producer_run_id:cfg.ready.binding.producer_run_id},instructions:'envCanary='+JSON.stringify(process.env.NATIVE_STDIO_CANARY??null)}],next_action:'review_candidates'}};
  if(cfg.mode==='success-extra')result.extra=true;
  if(cfg.mode==='context-generic'||cfg.mode==='admit-generic')result={echo:req.params};
  if(cfg.mode==='context-wrong-run')result.binding={...result.binding,reviewer_run_id:'other'};
  if(cfg.mode==='context-wrong-source')result.context.requests[0].candidate.producer_run_id='other';
  if(cfg.mode==='admit-wrong-hash')result.binding={...result.binding,candidate_hash:'c'.repeat(64)};
  if(cfg.mode==='admit-wrong-digest')result.artifact_hash='b'.repeat(64);
  send({type:'result',ok:true,result});if(cfg.mode==='extra-output')send({type:'result',ok:true,result:{duplicate:true}});
 }
 exit();
}else{
 send({type:'fence_ready',result:cfg.ready});
 if(cfg.mode==='exit-after-ready')exit();
 else for(;;){
  const command=await read();
  if(command.type==='release'){
   if(cfg.mode==='lost-release-ack')exit();
   else{send({type:'result',ok:true,result:{released:true}});exit();}
   break;
  }
  await callback('context');await callback('native_assignment');
  if(cfg.mode==='alive-bad-id')send({type:'fence_alive',id:command.id+1});
  else if(cfg.mode==='alive-hang')await new Promise(()=>{});
  else send({type:'fence_alive',id:command.id});
 }
}
