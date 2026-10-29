/** Exact installed host closure + real HTTPS, native SQL and SDK capability handler. */
import test,{before,after} from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import{createServer}from'node:https';import{spawnSync}from'node:child_process';import{randomUUID,createHash}from'node:crypto';import{pathToFileURL}from'node:url';import{createRequire}from'node:module';
if(process.env.QUALIFY_DISPOSABLE!=='1'){
 test('controlled host qualification requires documented disposable target',{skip:'Set QUALIFY_DISPOSABLE=1 in offline pinned image only'},()=>{});
}else{
 const source=process.env.QUALIFICATION_PUBLIC_ROOT??'/qual/source',native='/opt/host/node_modules',root='/tmp/inertia-controlled-host',host=root+'/node_modules/@paperclipai/server';
 const load=p=>import(pathToFileURL(native+'/'+p));
 await fs.mkdir(host,{recursive:true});await fs.cp(native+'/@paperclipai/server/dist',host+'/dist',{recursive:true});await fs.copyFile(native+'/@paperclipai/server/package.json',host+'/package.json');
 for(const depRoot of[native+'/@paperclipai/server/node_modules',native])for(const name of await fs.readdir(depRoot)){if(name==='@paperclipai'||name.startsWith('.'))continue;await fs.symlink(depRoot+'/'+name,root+'/node_modules/'+name).catch(e=>{if(e.code!=='EEXIST')throw e;});}
 for(const name of await fs.readdir(native+'/@paperclipai'))if(name!=='server')await fs.symlink(native+'/@paperclipai/'+name,root+'/node_modules/@paperclipai/'+name);
 const composition=source+'/host-composition/paperclip-durable-funding-review';
 for(const file of['scripts/apply-controlled-target-http.mjs','patches/controlled-target-http.patch','patches/controlled-target-http-pins.json','transport/native/controlled-target-http.mjs']){await fs.mkdir(root+'/'+file.slice(0,file.lastIndexOf('/')),{recursive:true});await fs.copyFile(composition+'/'+file,root+'/'+file);}
 const{startEmbeddedPostgresTestDatabase,createDb}=await load('@paperclipai/db/dist/index.js');
 const{createPluginEventBus}=await load('@paperclipai/server/dist/services/plugin-event-bus.js');
 const{createHostClientHandlers}=await load('@paperclipai/plugin-sdk/dist/index.js');
 let temporary,db,server,services,origin,port,hits=0,mode='okay',publicationReceipt=null,buzzEvent=null;const pluginId=randomUUID(),key='netrxn.inertia',admissionFile=root+'/admission.json';
 const{finalizeEvent,verifyEvent}=createRequire('/opt/inertia-reviewed/package.json')('nostr-tools');
 const cert=await fs.readFile(source+'/test/fixtures/controlled-host/public-test-cert.txt','utf8'),tlsKey=await fs.readFile(source+'/test/fixtures/controlled-host/public-test-key.txt','utf8');
 const runInstaller=()=>spawnSync(process.execPath,[root+'/scripts/apply-controlled-target-http.mjs'],{encoding:'utf8'});
 let config;
 const save=async()=>{await fs.writeFile(admissionFile,JSON.stringify(config),{mode:0o600});await fs.chmod(admissionFile,0o600);};
 before(async()=>{
  temporary=await startEmbeddedPostgresTestDatabase('controlled-http-');db=createDb(temporary.connectionString);
  server=createServer({cert,key:tlsKey},async(req,res)=>{
   hits++;assert.equal(req.headers.host,'inertia-controlled.invalid:'+port);
   const chunks=[];for await(const chunk of req)chunks.push(chunk);
   const body=Buffer.concat(chunks).toString('utf8');
   if(mode==='publication'){
    if(req.method==='POST'){
     const envelope=JSON.parse(body),p=envelope.publication;assert.equal(req.headers['idempotency-key'],p.operationId);assert.equal(req.headers['if-none-match'],'*');
     publicationReceipt={state:'present',publicationId:'controlled-publication',meetingNoteId:'controlled-note',operationId:p.operationId,outputHash:p.outputHash,requestBodyHash:createHash('sha256').update(body).digest('hex'),audience:'members',current:true,currentOutputHash:p.outputHash,readbackPath:'/api/integrations/v1/roundtables/operations/'+p.operationId,envelope};
     res.writeHead(201,{'content-type':'application/json'});res.end('{}');return;
    }
    res.writeHead(publicationReceipt?200:404,{'content-type':'application/json',...(publicationReceipt?{etag:'"'+publicationReceipt.outputHash+'"'}:{})});res.end(JSON.stringify(publicationReceipt??{code:'operation_absent'}));return;
   }
   if(mode==='buzz'){
    const auth=JSON.parse(Buffer.from(req.headers.authorization.slice(6),'base64').toString('utf8'));assert(verifyEvent(auth));assert(auth.tags.some(t=>t[0]==='u'&&t[1]===origin+req.url));assert(auth.tags.some(t=>t[0]==='payload'&&t[1]===createHash('sha256').update(body).digest('hex')));
    res.writeHead(200,{'content-type':'application/json'});
    if(req.url==='/events'){buzzEvent=JSON.parse(body);assert(verifyEvent(buzzEvent));res.end(JSON.stringify({accepted:true,event_id:buzzEvent.id}));}
    else res.end(JSON.stringify(buzzEvent?[buzzEvent]:[]));return;
   }
   if(mode==='redirect'){res.writeHead(302,{location:'https://127.0.0.1:1/never'});res.end();return;}
   if(mode==='large'){res.writeHead(200);res.end(Buffer.alloc(1024*1024+1));return;}
   if(mode==='timeout')return;
   if(mode==='revoke'){config.expiresAt=new Date(Date.now()-1000).toISOString();await save();}
   res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({controlled:true,method:req.method,path:req.url,bytes:Buffer.concat(chunks).length}));
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));port=server.address().port;origin='https://inertia-controlled.invalid:'+port;
  const{buildHostServices}=await load('@paperclipai/server/dist/services/plugin-host-services.js');
  const base=buildHostServices(db,pluginId,key,createPluginEventBus());
  await assert.rejects(()=>base.http.fetch({url:'https://127.0.0.1:'+port+'/query',init:{method:'POST',body:'[]'}}),/private\/reserved/);assert.equal(hits,0);base.dispose();
  for(let i=0;i<2;i++){const r=runInstaller();assert.equal(r.status,0,r.stdout+r.stderr);}
  const installed=await import(pathToFileURL(host+'/dist/services/plugin-host-services.js'));
  services=installed.buildHostServices(db,pluginId,key,createPluginEventBus());
  config={version:1,environment:'controlled-local-preprod',expiresAt:new Date(Date.now()+600000).toISOString(),targets:['roundtable-website','buzz-relay'].map(purpose=>({pluginId,pluginKey:key,purpose,origin,connectAddress:'127.0.0.1',caPem:cert,timeoutMs:1000}))};await save();
  process.env.PAPERCLIP_INERTIA_CONTROLLED_HTTP_TARGETS_FILE=admissionFile;
 });
 after(async()=>{delete process.env.PAPERCLIP_INERTIA_CONTROLLED_HTTP_TARGETS_FILE;services?.dispose();server?.closeAllConnections();if(server)await new Promise(r=>server.close(r));await temporary?.cleanup();});
 const website=()=>({url:origin+'/api/integrations/v1/roundtables/operations/'+'a'.repeat(64),init:{method:'GET',headers:{Authorization:'Bearer synthetic-token'}}});
 const buzz=()=>({url:origin+'/query',init:{method:'POST',headers:{Authorization:'Nostr e30=','Content-Type':'application/json'},body:'[]'}});
 test('installed SDK HTTP handler reaches only admitted HTTPS hostname through pinned private address and CA',async()=>{
  const handlers=createHostClientHandlers({pluginId:key,capabilities:['http.outbound'],services});
  for(const request of[website(),buzz()]){const response=await handlers['http.fetch'](request);assert.equal(response.status,200);assert.equal(JSON.parse(response.body).controlled,true);}
  const handlersDenied=createHostClientHandlers({pluginId:key,capabilities:[],services});const prior=hits;
  await assert.rejects(()=>handlersDenied['http.fetch'](buzz()));assert.equal(hits,prior);
 });
 test('arbitrary hosts paths methods headers and metadata addresses remain denied before credential dispatch',async()=>{
  const prior=hits;
  for(const request of[
   {...buzz(),url:'https://127.0.0.1:'+port+'/query'},
   {...buzz(),url:origin+'/admin'},
   {...buzz(),url:origin+'/query?redirect=https://other.invalid'},
   {...buzz(),init:{...buzz().init,method:'GET'}},
   {...buzz(),init:{...buzz().init,headers:{...buzz().init.headers,Host:'other.invalid'}}},
  ])await assert.rejects(()=>services.http.fetch(request));
  const other= (await import(pathToFileURL(host+'/dist/services/plugin-host-services.js'))).buildHostServices(db,randomUUID(),key,createPluginEventBus());
  await assert.rejects(()=>other.http.fetch({...buzz(),url:'https://127.0.0.1:'+port+'/query'}));other.dispose();assert.equal(hits,prior);
  config.targets[0].connectAddress='169.254.169.254';await save();await assert.rejects(()=>services.http.fetch(website()));assert.equal(hits,prior);config.targets[0].connectAddress='127.0.0.1';await save();
 });
 test('unchanged installed website publisher completes exact-content readback through the installed HTTP boundary',async()=>{
  const{prepare}=await import('file:///opt/inertia-reviewed/dist/src/roundtable/ingestion.js');
  const{prepareWebsiteOperation,createWebsitePublisher}=await import('file:///opt/inertia-reviewed/dist/src/roundtable/website.js');
  const fetch=async(url,init)=>{const r=await services.http.fetch({url:String(url),init});return new Response(r.body,{status:r.status,headers:r.headers});};
  const source={meetingId:'controlled-meeting',sourceId:'controlled-source',revision:'1',ready:true,kind:'transcript',audience:'members',text:'We deferred release pending accessibility testing.'};
  const prepared=await prepare(source,async()=>({notes:[{text:source.text,line:1}],decisions:[],actions:[]}));
  const binding={origin,principalId:'controlled-owner'},record=prepareWebsiteOperation(prepared,{title:'Controlled meeting',date:'2026-10-28',attendees:null,agenda:null,tags:[]},binding);
  mode='publication';const client=createWebsitePublisher({...binding,token:'synthetic-token',fetch});
  assert.equal((await client.publish(record)).state,'published');assert.equal((await client.publish(record)).state,'already-published');assert.equal(publicationReceipt.envelope.publication.transcript,source.text);mode='okay';
 });
 test('unchanged installed Buzz client signs and reads back its event through the installed HTTP boundary',async()=>{
  const{makeBuzzHttpClient}=await import('file:///opt/inertia-reviewed/dist/src/buzz/http.js');
  const keyBytes=new Uint8Array(32).fill(21),now=Math.floor(Date.now()/1000);
  const client=makeBuzzHttpClient({relayUrl:origin,clock:()=>now,signer:t=>finalizeEvent(t,keyBytes),fetch:async(url,init)=>{const r=await services.http.fetch({url:String(url),init});return new Response(r.body,{status:r.status,headers:r.headers});}});
  const event=finalizeEvent({kind:9,created_at:now,tags:[['h','00000000-0000-4000-8000-000000000001']],content:'Controlled signed contribution, not an adopted decision.'},keyBytes);
  mode='buzz';assert.equal((await client.publish(event)).eventId,event.id);assert.equal((await client.query([{ids:[event.id]}]))[0].event.id,event.id);mode='okay';
 });
 test('redirect oversized response and bounded timeout never become successful private requests',async()=>{
  for(const value of['redirect','large','timeout']){mode=value;await assert.rejects(()=>services.http.fetch(buzz()),/controlled_http_request_unconfirmed/);}mode='okay';
 });
 test('invalid owned-file admission CA and revocation fail closed with no returned private content',async()=>{
  let prior=hits;await fs.chmod(admissionFile,0o644);await assert.rejects(()=>services.http.fetch(website()));assert.equal(hits,prior);await fs.chmod(admissionFile,0o600);
  config.targets.forEach(t=>t.caPem=cert.replace('MIID','MIIC'));await save();await assert.rejects(()=>services.http.fetch(website()));assert.equal(hits,prior);config.targets.forEach(t=>t.caPem=cert);await save();
  mode='revoke';await assert.rejects(()=>services.http.fetch(website()));mode='okay';config.expiresAt=new Date(Date.now()+600000).toISOString();await save();
  delete process.env.PAPERCLIP_INERTIA_CONTROLLED_HTTP_TARGETS_FILE;prior=hits;
  await assert.rejects(()=>services.http.fetch({url:'https://127.0.0.1:'+port+'/query',init:buzz().init}),/private\/reserved/);assert.equal(hits,prior);
 });
 test('installer rejects drift without changing host source',async()=>{
  await fs.appendFile(host+'/dist/services/plugin-host-services.js','\n// controlled fixture drift');
  const before=await fs.readFile(host+'/dist/services/plugin-host-services.js','utf8'),r=runInstaller();assert.notEqual(r.status,0);assert.match(r.stdout+r.stderr,/Unqualified/);assert.equal(await fs.readFile(host+'/dist/services/plugin-host-services.js','utf8'),before);
 });
}
