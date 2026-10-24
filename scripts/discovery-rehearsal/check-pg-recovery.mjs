import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import postgres from 'postgres';
import {createBridgeStore,BRIDGE_NAMESPACE} from './plugin/dist/src/store/postgres.js';
// The SDK's SQL port takes serialized JSON strings. Preserve those strings on
// postgres.js's inferred jsonb parameter path rather than encoding them twice.
const sql=postgres(process.env.QUALIFICATION_DATABASE_URL,{max:10,types:{json:{to:3802,from:[114,3802],serialize:v=>typeof v==='string'?v:JSON.stringify(v),parse:JSON.parse}}});
const dbFor=(s)=>({namespace:BRIDGE_NAMESPACE,query:(q,p)=>s.unsafe(q,p),execute:async(q,p)=>({rowCount:(await s.unsafe(q,p)).count})});
const store=createBridgeStore(dbFor(sql));
const key={relay:'https://synthetic.invalid',eventId:'restart-event'};
const input={destination:{relay:key.relay,companyId:'synthetic-co',issueId:'synthetic-issue',channelId:'synthetic-channel',rootId:'a'.repeat(64)},command:{kind:'comment'},receiptKey:'comment:restart-receipt'};
async function discoverySnapshot(){
 const documents=await sql`SELECT l.company_id,l.issue_id,l.key,d.title,d.latest_body,d.latest_revision_id FROM issue_documents l JOIN documents d ON d.id=l.document_id WHERE l.key LIKE 'funding-%' ORDER BY l.issue_id,l.key`;
 const outbox=await sql.unsafe(`SELECT receipt_key,relay,event_id,event,state,suppression_requested FROM "${BRIDGE_NAMESPACE}".bridge_outbox WHERE receipt_key LIKE 'alert:%' ORDER BY receipt_key`);
 const scopes=await sql.unsafe(`SELECT receipt_key,company_id,issue_id FROM "${BRIDGE_NAMESPACE}".bridge_outbox_scopes WHERE receipt_key LIKE 'alert:%' ORDER BY receipt_key`);
 const wakeups=await sql`SELECT id,company_id,agent_id,idempotency_key,payload FROM agent_wakeup_requests WHERE payload->>'contextSource' IN ('inertia.funding-discovery.urgent','inertia.funding-discovery.diligence') ORDER BY id`;
 assert.ok(documents.length>=5);assert.equal(outbox.length,2);assert.equal(scopes.length,2);assert.ok(outbox.some(r=>r.state==='delivered'));assert.ok(outbox.some(r=>r.state==='suppressed'));assert.ok(wakeups.length>=2);
 return createHash('sha256').update(JSON.stringify({documents,outbox,scopes,wakeups})).digest('hex');
}
try {
  if(process.argv[2]==='seed') {
    await writeFile('discovery-before-crash.sha256',await discoverySnapshot());
    const claims=await Promise.all(Array.from({length:8},()=>store.claim(key,input)));
    assert.equal(claims.filter(x=>x==='claimed').length,1);
    await assert.rejects(()=>store.claim({...key,eventId:'different-event'},input),/claim could not be read/);
    await store.saveOutcome(key,'applied',{nativeId:'synthetic-authoritative-result'});
    assert.equal((await store.get(key)).outcome.nativeId,'synthetic-authoritative-result');
    const writes=await Promise.all(Array.from({length:8},()=>store.putOutbox({receiptKey:input.receiptKey,relay:key.relay,eventId:'stable-signed-id',event:{id:'stable-signed-id'}})));
    assert.equal(writes.filter(Boolean).length,1);
    await assert.rejects(()=>store.putOutbox({receiptKey:'different-receipt',relay:key.relay,eventId:'stable-signed-id',event:{id:'stable-signed-id'}}),/receipt could not be read/);
    const publications=await Promise.all(Array.from({length:8},(_,i)=>store.claimCommentDelivery(input.receiptKey,'holder-'+i)));
    assert.equal(publications.filter(Boolean).length,1);
    await sql.unsafe('CREATE ROLE fixture_bridge NOLOGIN');
    await sql.unsafe(`GRANT USAGE ON SCHEMA ${BRIDGE_NAMESPACE} TO fixture_bridge`);
    await sql.unsafe(`GRANT SELECT,INSERT,UPDATE ON ${BRIDGE_NAMESPACE}.bridge_inbox,${BRIDGE_NAMESPACE}.bridge_outbox TO fixture_bridge`);
    await sql.begin(async tx=>{
      await tx.unsafe('SET LOCAL ROLE fixture_bridge');
      assert.equal((await createBridgeStore(dbFor(tx)).get(key)).state,'applied');
    });
    for(const denied of ['SELECT * FROM companies',`DELETE FROM ${BRIDGE_NAMESPACE}.bridge_outbox`,`INSERT INTO ${BRIDGE_NAMESPACE}.bridge_pairings(relay,company_id,pubkey,actor_user_id,kind,active) VALUES ('x','x','x','x','human',true)`])
      await assert.rejects(()=>sql.begin(async tx=>{await tx.unsafe('SET LOCAL ROLE fixture_bridge');await tx.unsafe(denied);}),e=>e.code==='42501');
    console.log('PG_SEED_ASSERTIONS_PASSED concurrent-inbox=8 concurrent-outbox=8 concurrent-publication=8 restricted-role=true');
  } else if(process.argv[2]==='recover') {
    assert.equal(await discoverySnapshot(),await readFile('discovery-before-crash.sha256','utf8'));
    console.log('DISCOVERY_WAL_RECOVERY_IDENTICAL nativeDocuments=true signedAlertOutbox=true nativeWakeups=true immutableHashesUnchanged=true');
    assert.equal((await store.get(key)).outcome.nativeId,'synthetic-authoritative-result');
    assert.equal((await store.claim(key,input)).state,'applied');
    const row=await store.getOutbox(input.receiptKey);
    assert.equal(row.state,'publishing');
    assert.equal(row.eventId,'stable-signed-id');
    assert.equal(await store.finishCommentDelivery(input.receiptKey,'stale-holder','delivered'),false);
    assert.equal(await store.recoverCommentDelivery(input.receiptKey,row.publishToken),true);
    assert.equal((await store.getOutbox(input.receiptKey)).state,'pending');
    assert.equal(await store.claimCommentDelivery(input.receiptKey,'new-holder'),true);
    assert.equal(await store.finishCommentDelivery(input.receiptKey,row.publishToken,'delivered'),false);
    await store.suppressOutbox(input.receiptKey);
    assert.equal(await store.finishCommentDelivery(input.receiptKey,'new-holder','pending'),true);
    assert.equal((await store.getOutbox(input.receiptKey)).state,'suppressed');
    assert.equal(await store.claimCommentDelivery(input.receiptKey,'resurrection'),false);
    console.log('PG_RECOVERY_ASSERTIONS_PASSED crash-durable=true native-result-not-repeated=true stale-token-denied=true suppression-survives=true');
  } else throw Error('Expected seed or recover');
} finally {await sql.end();}
