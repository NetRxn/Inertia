import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import express from 'express';
import {request as httpRequest} from 'node:http';
import {eq} from 'drizzle-orm';
import {authUsers, companyMemberships} from '@paperclipai/db';
const root = process.env.REVIEW_NATIVE_ROOT;
if (!root) throw Error('Set REVIEW_NATIVE_ROOT to the qualified native capture installation');
const {fixture, binding, db, client} = await import(`${root}/tests/fixture.mjs`);
const {qualificationRetention} = await import(`${root}/tests/retention.mjs`);
const {createFundingReviewCapture} = await import(`${root}/node_modules/@paperclipai/server/dist/services/funding-review-capture.js`);
const {issueThreadInteractionService} = await import(`${root}/node_modules/@paperclipai/server/dist/services/issue-thread-interactions.js`);
const {actorMiddleware} = await import(`${root}/node_modules/@paperclipai/server/dist/middleware/auth.js`);
const {boardAuthService} = await import(`${root}/node_modules/@paperclipai/server/dist/services/board-auth.js`);
const mod = await import('../native/acceptance-routes.mjs').catch(e => e.code === 'ERR_MODULE_NOT_FOUND' ? {} : Promise.reject(e));
after(() => client.end());

async function setup(options = {}) {
  assert.equal(typeof mod.createAcceptanceRouter, 'function', 'concrete native transport router exists');
  const f = await fixture(2);
  const capture = createFundingReviewCapture({registrations: [binding(f), binding(f, 'item-2')], rolePermissionKeys: {program: 'funding.review.program'}, retention: qualificationRetention});
  const service = issueThreadInteractionService(db, {captureItemVerdictsInTransaction: capture.captureInTransaction});
  await service.submitItemVerdicts(f.issue, f.interactionId, f.input, f.actor);
  await service.submitItemVerdicts(f.issue, f.interactionId, {verdicts: [{id: 'item-2', verdict: 'approve', reason: 'Second exact item'}]}, f.actor);
  const readerId = randomUUID();
  await db.insert(authUsers).values({id: readerId, name: 'Synthetic transport reader', email: `${readerId}@example.invalid`, createdAt: new Date(), updatedAt: new Date()});
  await db.insert(companyMemberships).values({companyId: f.companyId, principalType: 'user', principalId: readerId, status: 'active', membershipRole: 'member'});
  const auth = boardAuthService(db);
  const key = await auth.createNamedBoardApiKey({userId: readerId, name: 'Disposable transport test'});
  const scope = {schema: 'inertia.funding-transport-scope.v1', sourceId: 'native-test', destinationId: 'dfw-test', companyId: f.companyId, applicantId: 'applicant-1', sourceScope: 'source-1', purpose: 'durable-funding-review'};
  const config = {enabled: true, scope, principal: {userId: readerId, keyId: key.id}, db, capture, lifecycle: {assertReadable: async () => true}, ...options};
  const app = express();
  app.use(actorMiddleware(db, {deploymentMode: 'authenticated'}));
  app.use('/api/funding-review-transport', mod.createAcceptanceRouter(config));
  app.use((err, req, res, next) => res.status(err.status || 500).json({error: 'request_rejected'}));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const url = `http://127.0.0.1:${server.address().port}/api/funding-review-transport`;
  const headers = {authorization: `Bearer ${key.token}`, 'X-Funding-Scope': mod.digestJson(scope)};
  const request = (path, change = {}) => fetch(url + path, {...change, headers: {...headers, ...change.headers}});
  return {f, capture, readerId, auth, key, scope, config, request, url, headers, close: () => new Promise(resolve => server.close(resolve))};
}

test('actual native auth and capture expose bounded immutable tenant receipt envelopes', async () => {
  const x = await setup();
  try {
    const hello = await x.request('/scope'); assert.equal(hello.status, 200); assert.deepEqual(await hello.json(), {scope: x.scope});
    const first = await (await x.request('/acceptances?limit=1')).json();
    assert.equal(first.receipts.length, 1); assert.ok(first.nextCursor);
    const second = await (await x.request(`/acceptances?limit=1&afterId=${first.nextCursor}`)).json();
    assert.equal(second.receipts.length, 1);
    assert.notEqual(second.receipts[0].receipt.acceptanceId, first.receipts[0].receipt.acceptanceId);
    const envelope = first.receipts[0];
    assert.equal(envelope.receiptDigest, mod.digestJson(envelope.receipt));
    const read = await (await x.request(`/acceptances/${envelope.receipt.acceptanceId}`)).json();
    assert.deepEqual(read, {scope: x.scope, ...envelope});
    await db.update(companyMemberships).set({status: 'inactive'}).where(eq(companyMemberships.principalId, x.f.userId));
    assert.equal((await x.request(`/acceptances/${envelope.receipt.acceptanceId}`)).status, 200, 'reviewer revocation does not revoke accepted instruction');
    await x.auth.revokeBoardApiKey(x.key.id);
    assert.notEqual((await x.request('/scope')).status, 200, 'transport revocation remains current');
  } finally { await x.close(); }
});

test('no ambient human or agent authority, malformed parameters, or scope confusion', async () => {
  const x = await setup();
  try {
    for (const change of [{authorization: ''}, {'X-Funding-Scope': '0'.repeat(64)}, {'X-Funding-Scope': mod.digestJson({...x.scope, destinationId: 'other'})}]) {
      assert.equal((await x.request('/scope', {headers: change})).status, 403);
    }
    for (const path of ['/acceptances?limit=501', '/acceptances?limit=-1', '/acceptances?afterId=nope', '/acceptances?limit=1&limit=2', '/acceptances?companyId=other', '/acceptances/nope']) {
      assert.equal((await x.request(path)).status, 400, path);
    }
    assert.equal((await x.request('/acceptances', {method: 'POST', body: '{}'})).status, 405);
  } finally { await x.close(); }
});

test('disabled or missing approved lifecycle cannot serve receipts', async () => {
  for (const options of [{enabled: false}, {lifecycle: undefined}]) {
    const x = await setup(options);
    try { assert.equal((await x.request('/scope')).status, 503); } finally { await x.close(); }
  }
});

test('host configuration is snapshotted and exact reader identity enforced', async () => {
  const x = await setup();
  try {
    x.config.principal.userId = 'different'; x.config.scope.destinationId = 'different';
    assert.equal((await x.request('/scope')).status, 200, 'mutable config is not ambient authority');
    await db.update(companyMemberships).set({status: 'inactive'}).where(eq(companyMemberships.principalId, x.readerId));
    assert.equal((await x.request('/scope')).status, 403);
  } finally { await x.close(); }
});

test('a second valid board credential is not the configured transport principal', async () => {
  const x = await setup();
  try {
    const otherKey = await x.auth.createNamedBoardApiKey({userId: x.readerId, name: 'Other disposable key'});
    assert.equal((await x.request('/scope', {headers: {authorization: `Bearer ${otherKey.token}`}})).status, 403);
    const otherUser = randomUUID();
    await db.insert(authUsers).values({id: otherUser, name: 'Other fixture human', email: `${otherUser}@example.invalid`, createdAt: new Date(), updatedAt: new Date()});
    await db.insert(companyMemberships).values({companyId: x.f.companyId, principalType: 'user', principalId: otherUser, status: 'active', membershipRole: 'member'});
    const otherUserKey = await x.auth.createNamedBoardApiKey({userId: otherUser, name: 'Other disposable user key'});
    assert.equal((await x.request('/scope', {headers: {authorization: `Bearer ${otherUserKey.token}`}})).status, 403);
    assert.equal((await x.request(`/acceptances/${randomUUID()}`)).status, 404);
  } finally { await x.close(); }
});

test('native read routes reject bodies before parsing authority-like or oversized payloads',async()=>{
 const x=await setup();try{
  for(const body of ['{"actorUserId":"other"}','x'.repeat(1024*1024+1)]){
   const status=await new Promise((resolve,reject)=>{const req=httpRequest(x.url+'/scope',{method:'GET',headers:{...x.headers,'content-type':'application/json','content-length':Buffer.byteLength(body)}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end(body);});
   assert.equal(status,400);
  }
 }finally{await x.close();}
});

test('legal multibyte receipt batches are byte-paged instead of permanently rejected',async()=>{
 let receipts=[];
 const x=await setup({capture:{readAcceptance:async()=>null,listAcceptances:async(_db,{afterId,limit})=>{const page=receipts.filter(r=>!afterId||r.acceptanceId>afterId).slice(0,limit);return {receipts:page,nextCursor:page.length===limit?page.at(-1).acceptanceId:null};}}});
 try{
  const original=(await x.capture.listAcceptances(db,{companyId:x.f.companyId})).receipts[0];
  receipts=Array.from({length:100},(_,i)=>({...structuredClone(original),acceptanceId:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,command:{...structuredClone(original.command),reason:'界'.repeat(4000)}}));
  let cursor=null,count=0,pages=0;
  do{const response=await x.request('/acceptances?limit=100'+(cursor?`&afterId=${cursor}`:''));assert.equal(response.status,200);const page=await response.json();count+=page.receipts.length;cursor=page.nextCursor;pages++;assert.ok(pages<5);}while(cursor);
  assert.equal(count,100);assert.ok(pages>1);
 }finally{await x.close();}
});

test('one impossible oversized receipt is deferred without hiding later valid receipts',async()=>{
 let receipts=[];
 const x=await setup({capture:{readAcceptance:async()=>null,listAcceptances:async()=>({receipts,nextCursor:null})}});
 try{
  const original=(await x.capture.listAcceptances(db,{companyId:x.f.companyId})).receipts[0];
  receipts=[{...structuredClone(original),acceptanceId:'00000000-0000-4000-8000-000000000001',command:{...structuredClone(original.command),reason:'界'.repeat(400000)}},{...structuredClone(original),acceptanceId:'00000000-0000-4000-8000-000000000002'}];
  const response=await x.request('/acceptances');assert.equal(response.status,200);const page=await response.json();assert.deepEqual(page.deferredAcceptanceIds,[receipts[0].acceptanceId]);assert.equal(page.receipts.length,1);assert.equal(page.receipts[0].receipt.acceptanceId,receipts[1].acceptanceId);
 }finally{await x.close();}
});
