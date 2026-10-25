import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {canonicalJson} from '../../../../dist/src/grants/engine.js';
import {memberHash,memberTarget,memberTimestamp,parseMemberIntent,validateMemberAccessProof} from '../../../../dist/src/grants/member-review.js';
const mod=await import('../native/member-delivery.mjs').catch(e=>e.code==='ERR_MODULE_NOT_FOUND'?{}:Promise.reject(e));
const contracts={hash:memberHash,canonical:canonicalJson,target:memberTarget,timestamp:memberTimestamp,parseIntent:parseMemberIntent,accessProof:validateMemberAccessProof};
const scope={schema:'inertia.member-packet-transport-scope.v2',purpose:'member-packet-review',sourceId:'native',destinationId:'domain',companyId:'00000000-0000-4000-8000-000000000001',applicantId:'applicant',applicationId:'application',opportunityNamespace:'fixture',opportunityExternalId:'opportunity',sourceScope:'members'};
function accepted(action='approve_packet'){
 const intent={schema:'inertia.member-packet-action.v2',policyHash:'a'.repeat(64),target:{packetId:'packet',packetVersion:1,packetContentHash:'b'.repeat(64)},action,payload:action==='approve_packet'?{note:'Reviewed'}:{submittedAt:'2026-10-24T12:00:00Z',declaredSubmitter:null,note:'Attested',evidence:null}};
 return{schema:'inertia.member-packet-acceptance.v2',source:{kind:'paperclip',id:randomUUID()},acceptedAt:'2026-10-24T12:00:00Z',actor:{type:'human',userId:'human'},authorization:{actorUserId:'human',actorType:'human',authenticatedHuman:true,verifiedDaoMember:true,applicationActionAllowed:true,nativeActionAllowed:true,membershipVersion:'v1',applicationAccessVersion:'v1'},intent,intentHash:memberHash(intent)};
}
const factory=(ctx,c)=>{assert.equal(typeof mod.createMemberPacketDelivery,'function','native member delivery exists');return mod.createMemberPacketDelivery(ctx,c);};
async function setup(){
 assert.equal(typeof mod.createMemberPacketDelivery,'function','native member delivery exists');
 const acceptances=[accepted(),accepted('record_submission')].sort((a,b)=>a.source.id.localeCompare(b.source.id)),effects=new Map(),calls=[],memory=new Map(),behavior={};let secrets=0,concurrent=0,maxConcurrent=0;
 const cursor=a=>({createdAt:'2026-10-24T12:00:00.'+String(acceptances.indexOf(a)+1).padStart(6,'0')+'Z',id:a.source.id});
 const response=a=>({scope,envelope:{schema:'inertia.member-packet-outcome-envelope.v2',source:a.source,intentHash:a.intentHash,acceptedDigest:memberHash(a),outcome:{state:'applied',sourceId:a.source.id,eventId:effects.get(a.source.id),action:a.intent.action,target:a.intent.target,policyHash:a.intent.policyHash}}});
 const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://fixture');calls.push({method:req.method,path:url.pathname,headers:req.headers});
  res.setHeader('Content-Type','application/json');
  if(req.headers['x-member-packet-scope']!==memberHash(scope)||behavior.revoked){res.writeHead(403);res.end('{}');return;}
  if(behavior.duplicate){res.end('{"scope":null,"scope":'+JSON.stringify(scope)+'}');return;}
  if(url.pathname.endsWith('/scope')){res.end(JSON.stringify({scope:behavior.wrongScope?{...scope,applicationId:'other'}:scope}));return;}
  if(url.pathname==='/api/member-packet-transport/acceptances'){
   const after=url.searchParams.get('afterCreatedAt'),limit=Number(url.searchParams.get('limit'));const rows=acceptances.filter(a=>!after||cursor(a).createdAt>after).slice(0,limit);
   res.end(JSON.stringify({scope,entries:rows.map(a=>({cursor:cursor(a),ambiguous:behavior.ambiguous===true&&a===acceptances[0],envelope:behavior.defer&&a===acceptances[0]?null:{scope,acceptance:a,acceptedDigest:memberHash(a)}})),nextCursor:rows.length===limit?cursor(rows.at(-1)):null}));return;
  }
  const [,id,operation]=url.pathname.match(/\/acceptances\/([^/]+)\/(apply|outcome)$/)||[],a=acceptances.find(a=>a.source.id===id);
  if(!a){res.writeHead(404);res.end('{}');return;}
  if(operation==='apply'){
   concurrent++;maxConcurrent=Math.max(maxConcurrent,concurrent);await new Promise(r=>setTimeout(r,behavior.slow?50:0));if(!behavior.noTerminal&&!(behavior.blockFirst&&a===acceptances[0]))effects.set(id,effects.get(id)??randomUUID());concurrent--;
   if(behavior.lost){req.socket.destroy();return;}
  }
  if(!effects.has(id)){res.end(JSON.stringify({scope,envelope:{state:'terminal_missing'}}));return;}
  const result=response(a);if(behavior.tamper)result.envelope.intentHash='0'.repeat(64);res.end(JSON.stringify(result));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
 const ctx={http:{fetch},secrets:{async resolve(ref){secrets++;return ref.secretId==='native'?'fixture-native':'fixture-domain';}},state:{async get(key){return memory.get(JSON.stringify(key));},async set(key,value){memory.set(JSON.stringify(key),value);},async delete(key){memory.delete(JSON.stringify(key));}}};
 const config={enabled:true,scope,contracts,nativeUrl:origin+'/api/member-packet-transport',fundingUrl:origin+'/member-packet-transport',nativeSecretRef:{type:'secret_ref',secretId:'native'},fundingSecretRef:{type:'secret_ref',secretId:'domain'},fixtureLoopback:true,pageSize:1,maxPages:5};
 return{config,ctx,delivery:factory(ctx,config),acceptances,effects,calls,memory,behavior,get secrets(){return secrets;},get maxConcurrent(){return maxConcurrent;},close:()=>new Promise(r=>server.close(r))};
}
test('disabled construction does not inspect context or options',async()=>{const boom=new Proxy({},{get(){throw Error('side effect');}}),d=factory(boom,{});assert.equal(await d.readOutcome(boom),null);assert.deepEqual(await d.reconcile(),{state:'disabled',applied:0,pending:0,complete:false});});
test('manual delivery reaches both action kinds, uses existing scope/state/secrets and restarts full sweep',async()=>{
 const f=await setup();try{for(let i=0;i<5;i++){const before=f.calls.length;await f.delivery.reconcile();assert.ok(f.calls.length-before<=6);}assert.equal(f.effects.size,2);assert.equal(f.secrets,f.calls.length);assert.equal(f.maxConcurrent,1);for(const a of f.acceptances)assert.equal((await f.delivery.readOutcome(a)).effectId,f.effects.get(a.source.id));assert.ok(!JSON.stringify([...f.memory]).includes('fixture-domain'));}finally{await f.close();}
});
test('lost apply response reads existing bound durable outcome, never remints a source',async()=>{
 const f=await setup();try{f.behavior.lost=true;const result=await f.delivery.reconcile();assert.equal(result.applied,1);assert.ok(f.calls.some(c=>c.path.endsWith('/outcome')));assert.equal(f.effects.size,1);assert.ok(f.calls.length<=6);}finally{await f.close();}
});
for(const bad of ['wrongScope','revoked','duplicate','tamper','noTerminal'])test(`${bad} never reports false applied or archive custody`,async()=>{
 const f=await setup();try{f.behavior[bad]=true;const result=await f.delivery.reconcile();assert.equal(result.applied,0);assert.equal(result.state,'pending');assert.ok(!JSON.stringify(result).includes('fixture-'));}finally{await f.close();}
});
test('deferred first source does not starve the other stream or imply rejection',async()=>{
 const f=await setup();try{f.behavior.defer=true;for(let i=0;i<3;i++)await f.delivery.reconcile();assert.equal(f.effects.size,1);assert.ok(f.effects.has(f.acceptances[1].source.id));f.behavior.defer=false;for(let i=0;i<3;i++)await f.delivery.reconcile();assert.equal(f.effects.size,2);}finally{await f.close();}
});
test('concurrent manual invocations never start a second in-flight apply',async()=>{
 const f=await setup();try{f.behavior.slow=true;const first=f.delivery.reconcile();assert.equal((await f.delivery.reconcile()).state,'busy');await first;assert.equal(f.maxConcurrent,1);}finally{await f.close();}
});
test('fixed HTTPS origin/ref/page validation occurs before network',async()=>{
 const f=await setup();try{for(const change of [{fixtureLoopback:false},{nativeUrl:'https://user:pass@bad.invalid/api/member-packet-transport'},{fundingUrl:'https://example.invalid/wrong'},{nativeSecretRef:{secretId:'native'}},{pageSize:33}])assert.throws(()=>factory(f.ctx,{...f.config,...change}));assert.equal(f.calls.length,0);}finally{await f.close();}
});
test('job seam is manual-only with no schedule and default absent registration',async()=>{
 const f=await setup();try{let handler;f.ctx.jobs={register(_key,value){handler=value;}};mod.registerMemberPacketDeliveryJob(f.ctx,{});assert.equal(handler,undefined);mod.registerMemberPacketDeliveryJob(f.ctx,f.config);assert.equal(typeof handler,'function');assert.equal(mod.memberDeliveryJob.schedule,undefined);await assert.rejects(()=>handler({trigger:'scheduled'}),/manual/);assert.equal(f.calls.length,0);await assert.rejects(()=>handler({trigger:'manual'}),/pending/);assert.ok(f.effects.size>0);}finally{await f.close();}
});

test('an unresolved prior page cannot become ready merely by reaching an empty tail',async()=>{
 const f=await setup();try{f.behavior.defer=true;const d=factory(f.ctx,{...f.config,maxPages:1});for(let i=0;i<3;i++){const result=await d.reconcile();assert.equal(result.state,'pending');}}finally{await f.close();}
});
test('a valid unresolved action is not overtaken by a later dependent submission',async()=>{
 const f=await setup();try{f.behavior.blockFirst=true;for(let i=0;i<4;i++)await f.delivery.reconcile();assert.equal(f.effects.size,0);f.behavior.blockFirst=false;for(let i=0;i<4;i++)await f.delivery.reconcile();assert.equal(f.effects.size,2);}finally{await f.close();}
});
test('wire requests explicitly negotiate identity encoding through real native compression middleware',async()=>{
 const f=await setup();try{await f.delivery.reconcile();assert.ok(f.calls.length>0);assert.ok(f.calls.every(c=>c.headers['accept-encoding']==='identity'));}finally{await f.close();}
});

test('known timestamp ambiguity blocks later dependent transitions until reconciliation',async()=>{
 const f=await setup();try{f.behavior.ambiguous=true;for(let i=0;i<4;i++)await f.delivery.reconcile();assert.equal(f.effects.size,0);}finally{await f.close();}
});
