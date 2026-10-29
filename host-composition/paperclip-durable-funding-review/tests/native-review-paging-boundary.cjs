/** Qualification-only domain snapshot boundary; actual bytes were exported by the real Python protocol. */
const fs=require('node:fs'),crypto=require('node:crypto'),rl=require('node:readline').createInterface({input:process.stdin});
const config=JSON.parse(fs.readFileSync(process.argv[3])),snapshot=JSON.parse(fs.readFileSync('/qual/paging/export.json'));
let step=0,request,actor,assignment;
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const sha=v=>crypto.createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex'),send=x=>console.log(JSON.stringify(x));
rl.on('line',line=>{const m=JSON.parse(line);if(step++===0){request=m;send({type:'context',id:1});return;}if(step===2){actor=m.context;send({type:'native_assignment',id:2});return;}if(step===3){assignment=m.assignment;send({type:'case_task',id:3,case_binding_id:actor.case_binding_id});return;}
 try{
  const result=structuredClone(snapshot.context),manifest=result.context.packet.manifest;
  manifest.scope.company_id=actor.company_id;manifest.scope.issue_id=actor.issue_id;manifest.native_producer_run_id=assignment.producer_run_id;
  const hash=sha(manifest);result.context.packet.manifest_hash=hash;
  result.binding={company_id:actor.company_id,issue_id:actor.issue_id,interaction_id:assignment.interaction_id,decision_id:assignment.decision_id,producer_principal_id:config.producer.principal_id,producer_run_id:assignment.producer_run_id,reviewer_principal_id:actor.principal_id,reviewer_run_id:actor.run_id,review_kind:'packet',manifest_hash:hash,packet_id:manifest.packet_id,packet_version:manifest.packet_version};
  if(request.op==='artifact_view'){
   const p=request.params,v=snapshot.views[p.artifact_key];if(!v||p.manifest_hash!==hash)throw Error('manifest/artifact denied');
   const points=[...v.text],offset=p.offset??0,limit=p.limit??8000;if(offset>points.length)throw Error('offset denied');const end=Math.min(points.length,offset+limit);
   send({type:'result',ok:true,result:{binding:result.binding,view:{manifest_hash:hash,artifact:v.artifact,format:v.format,semantic_hash:v.semantic_hash,text_length:points.length,offset,end,next_offset:end<points.length?end:null,text:points.slice(offset,end).join('')}}});
  }else send({type:'result',ok:true,result});
 }catch(e){send({type:'result',ok:false,error:{code:'qualification_domain_denied',message:e.message}});}rl.close();
});
