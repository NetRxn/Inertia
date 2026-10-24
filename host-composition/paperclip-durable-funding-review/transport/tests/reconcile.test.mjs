import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {digestJson} from '../native/acceptance-routes.mjs';
const mod = await import('../native/reconcile.mjs').catch(e => e.code === 'ERR_MODULE_NOT_FOUND' ? {} : Promise.reject(e));
const scope = {schema: 'inertia.funding-transport-scope.v1', sourceId: 'native-test', destinationId: 'dfw-test', companyId: randomUUID(), applicantId: 'applicant', sourceScope: 'source', purpose: 'durable-funding-review'};
function receipt() {
  return {schema: 'inertia.funding-acceptance.v1', acceptanceId: randomUUID(), acceptedAt: '2026-10-24T00:00:00Z', command: {actorUserId: 'reviewer', binding: {companyId: scope.companyId, applicantId: scope.applicantId, sourceScope: scope.sourceScope, reviewerUserId: 'reviewer'}}};
}
async function setup() {
  assert.equal(typeof mod.createAcceptanceReconciler, 'function', 'concrete bounded reconciliation exists');
  const receipts = [receipt(), receipt()]; receipts.sort((a,b) => a.acceptanceId.localeCompare(b.acceptanceId));
  const outcomes = new Map(); const acknowledgements = []; const calls = []; const memory = new Map();
  const behavior = {lost: false, revoked: false, tamper: false, wrongScope: false, malformed: false, oversize: false};
  const server = createServer((req,res) => {
    const url = new URL(req.url, 'http://fixture'); calls.push(url.pathname);
    if (behavior.revoked || req.headers['x-funding-scope'] !== digestJson(scope)) {res.writeHead(403); res.end('{}'); return;}
    const native = url.pathname.startsWith('/api/');
    if ((native ? req.headers.authorization : req.headers['x-admin-token']) !== (native ? 'Bearer fixture-native' : 'fixture-dfw')) {res.writeHead(401); res.end('{}'); return;}
    res.setHeader('content-type', 'application/json');
    if (behavior.oversize) {res.end(' '.repeat(1024 * 1024 + 1)); return;}
    if (behavior.malformed) {res.end('{'); return;}
    if (url.pathname.endsWith('/scope')) {res.end(JSON.stringify({scope: behavior.wrongScope ? {...scope,destinationId:'other'} : scope})); return;}
    if (url.pathname === '/api/funding-review-transport/acceptances') {
      const after = url.searchParams.get('afterId');
      const selected = receipts.filter(r => !after || r.acceptanceId > after).slice(0,1);
      if(behavior.deferred && selected[0]?.acceptanceId===receipts[0].acceptanceId){res.end(JSON.stringify({scope,receipts:[],deferredAcceptanceIds:behavior.badDeferred?['not-an-id']:[selected[0].acceptanceId],nextCursor:selected[0].acceptanceId}));return;}
      res.end(JSON.stringify({scope, receipts: selected.map(r => ({receipt:r,receiptDigest:behavior.tamper ? '0'.repeat(64) : digestJson(r)})), nextCursor:selected.length ? selected[0].acceptanceId : null})); return;
    }
    const [,id,operation] = url.pathname.match(/\/acceptances\/([^/]+)\/(apply|outcome)$/) || [];
    if (!id) {res.writeHead(404);res.end('{}');return;}
    if (behavior.blockFirst && id === receipts[0].acceptanceId) {res.writeHead(409);res.end('{}');return;}
    if (operation === 'apply') outcomes.set(id, 'applied');
    if (behavior.lost && operation === 'apply') {req.socket.destroy();return;}
    const item = receipts.find(r=>r.acceptanceId===id);
    res.end(JSON.stringify({scope,acceptanceId:id,state:outcomes.get(id),receiptDigest:digestJson(item)}));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const ctx={http:{fetch},secrets:{resolve:async ref=>ref.secretId==='native'?'fixture-native':'fixture-dfw'},state:{get:async key=>memory.get(JSON.stringify(key)),set:async(key,value)=>memory.set(JSON.stringify(key),value)}};
  const config={enabled:true,scope,nativeUrl:origin+'/api/funding-review-transport',fundingUrl:origin+'/funding-review-transport',nativeSecretRef:{type:'secret_ref',secretId:'native'},fundingSecretRef:{type:'secret_ref',secretId:'dfw'},fixtureLoopback:true,maxPages:1,pageSize:1,lifecycle:{acknowledgeTerminal:async value=>acknowledgements.push(value)}};
  return {run:mod.createAcceptanceReconciler(ctx,config),ctx,config,receipts,outcomes,acknowledgements,calls,memory,behavior,close:()=>new Promise(resolve=>server.close(resolve))};
}

test('page checkpoint resumes then resets every completed sweep; repeated delivery remains exact', async()=>{
  const x=await setup();try {
    assert.equal((await x.run()).acknowledged,1);assert.equal((await x.run()).acknowledged,1);
    assert.equal((await x.run()).complete,true);
    assert.equal((await x.run()).acknowledged,1,'restart full scan rather than permanent UUID high-water mark');
    assert.equal(x.outcomes.size,2);assert.equal(x.acknowledgements.length,3);
    assert.ok(x.acknowledgements.every(a=>a.receiptDigest===digestJson(a.receipt)&&a.outcome.state==='applied'));
    const state=JSON.stringify([...x.memory]);assert.ok(!state.includes('fixture-native')&&!state.includes('fixture-dfw'));
  } finally {await x.close();}
});
test('lost apply response is reconciled by exact terminal read before archive acknowledgement',async()=>{
  const x=await setup();try {x.behavior.lost=true;const result=await x.run();assert.equal(result.acknowledged,1);assert.ok(x.calls.some(p=>p.endsWith('/outcome')));assert.equal(x.outcomes.size,1);}finally{await x.close();}
});
for(const flag of ['revoked','tamper','wrongScope','malformed','oversize'])test(`${flag} fails closed without acknowledging archive`,async()=>{
  const x=await setup();try{x.behavior[flag]=true;const result=await x.run();assert.equal(result.state,'pending');assert.equal(x.acknowledgements.length,0);assert.equal(x.outcomes.size,0);assert.ok(!JSON.stringify(result).includes('fixture-'));}finally{await x.close();}
});
test('missing lifecycle and disabled config cause no network work',async()=>{
  const x=await setup();try{for(const change of [{enabled:false},{lifecycle:undefined}]){const run=mod.createAcceptanceReconciler(x.ctx,{...x.config,...change});assert.equal((await run()).state,'disabled');}assert.equal(x.calls.length,0);}finally{await x.close();}
});
test('non-HTTPS, credentials in URL, and scope-swapped endpoint are rejected before secret resolution',async()=>{
  const x=await setup();try{assert.throws(()=>mod.createAcceptanceReconciler(x.ctx,{...x.config,fixtureLoopback:false}),/HTTPS/);assert.throws(()=>mod.createAcceptanceReconciler(x.ctx,{...x.config,nativeUrl:'https://user:pass@example.invalid/api/funding-review-transport'}),/endpoint/);}finally{await x.close();}
});

test('canonical protocol rejects unsupported numeric values and malformed trusted scopes',async()=>{
  const {canonicalJson,snapshotScope}=await import('../native/acceptance-routes.mjs');
  for(const value of [NaN,Infinity,1.25,Number.MAX_SAFE_INTEGER+1,undefined,{bad:undefined}]) assert.throws(()=>canonicalJson(value));
  assert.throws(()=>snapshotScope({...scope,sourceId:'bad\nvalue'}));
  assert.throws(()=>snapshotScope({...scope,companyId:scope.companyId.toUpperCase()}));
});

test('one stale receipt does not starve later receipts and is retried on the next full sweep',async()=>{
  const x=await setup();try{
    x.behavior.blockFirst=true;
    assert.equal((await x.run()).state,'pending');assert.equal(x.outcomes.size,0);
    assert.equal((await x.run()).acknowledged,1);assert.equal(x.outcomes.size,1);
    assert.equal((await x.run()).complete,true);
    x.behavior.blockFirst=false;assert.equal((await x.run()).acknowledged,1);assert.equal(x.outcomes.size,2);
  }finally{await x.close();}
});

test('oversized source records remain pending while later records progress',async()=>{
 const x=await setup();try{x.behavior.deferred=true;const first=await x.run();assert.equal(first.state,'pending');assert.equal(first.pending,1);assert.equal(x.acknowledgements.length,0);assert.equal((await x.run()).acknowledged,1);}finally{await x.close();}
});
test('malformed deferred record IDs cannot advance scan state',async()=>{
 const x=await setup();try{x.behavior.deferred=true;x.behavior.badDeferred=true;assert.equal((await x.run()).state,'pending');assert.equal(x.memory.size,0);}finally{await x.close();}
});

test('native job invocation caps HTTP work and resumes per-record scan progress',async()=>{
 const x=await setup();try{
  x.receipts.push(receipt(),receipt(),receipt(),receipt());x.receipts.sort((a,b)=>a.acceptanceId.localeCompare(b.acceptanceId));
  const run=mod.createAcceptanceReconciler(x.ctx,{...x.config,maxPages:20});
  for(let i=0;i<8;i++){const before=x.calls.length;await run();assert.ok(x.calls.length-before<=6,'fixed HTTP request budget');}
  assert.equal(x.outcomes.size,6);
 }finally{await x.close();}
});
