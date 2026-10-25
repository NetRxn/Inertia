import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {db,client,fixture} from '../../tests/fixture.mjs';
import {createApp} from '../../node_modules/@paperclipai/server/dist/app.js';
import fs from 'node:fs/promises';
after(()=>client.end());
async function appFixture(option){
 const f=await fixture(),seen=[];const router=express.Router();router.get('/probe',(req,res)=>{seen.push(req.actor);res.json({actor:req.actor?.type});});
 const opts={uiMode:'none',serverPort:0,storageService:{},deploymentMode:'authenticated',deploymentExposure:'private',allowedHostnames:['127.0.0.1'],bindHost:'127.0.0.1',authReady:true,companyDeletionEnabled:false,managedPluginAutoInstall:[],localPluginDir:`${process.env.NATIVE_CAPTURE_FIXTURE_ROOT}/plugins`,resolveSession:async()=>({session:{id:'fixture-session'},user:{id:f.userId}})};
 if(option)opts.memberPacketTransport={db,beforeBodyParser:(req,res,next)=>req.get('content-length')&&req.get('content-length')!=='0'?res.status(400).end():next(),router};
 const app=await createApp(db,opts);await app.locals.bundledPluginsStartup;
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 return{app,url:`http://127.0.0.1:${server.address().port}/api/member-packet-transport/probe`,server,seen};
}
test('member-only mount executes after actual native actor middleware; absent remains absent',async()=>{
 for(const enabled of [false,true]){const f=await appFixture(enabled);try{const response=await fetch(f.url);assert.equal(response.status,enabled?200:404);assert.equal(f.seen.length,enabled?1:0);if(enabled){assert.equal(f.seen[0].type,'board');assert.equal(f.seen[0].source,'session');assert.equal((await fetch(f.url,{method:'POST',body:'{}'})).status,400);}}finally{await new Promise(r=>f.server.close(r));await f.app.locals.paperclipShutdown();}}
});
test('member-only owning mount selects same existing SDK pre-buffer limits, preserving v1',async()=>{
 const app=await fs.readFile(new URL('../../node_modules/@paperclipai/server/dist/app.js',import.meta.url),'utf8');
 assert.match(app.match(/httpLimits:[^;]+/)[0],/httpLimits:\s*\(reviewTransport\s*\|\|\s*memberTransport\)\s*&&\s*manifest.id\s*===\s*"netrxn.inertia"/);
 assert.match(app,/maxRequestBytes:\s*8192,\s*maxResponseBytes:\s*1024\s*\*\s*1024,\s*timeoutMs:\s*15000/);
});
test('wrong database ownership or incomplete transport ports fail construction',async()=>{
 for(const memberPacketTransport of [{},{db,router:()=>{}},{db:{},beforeBodyParser:()=>{},router:()=>{}}])await assert.rejects(()=>createApp(db,{memberPacketTransport}),/member packet/i);
});
