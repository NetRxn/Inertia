import assert from 'node:assert/strict';
import {runtimeState} from './plugin/dist/src/bridge/runtime.js';
import {createBridgeStore,BRIDGE_NAMESPACE} from './plugin/dist/src/store/postgres.js';
export async function checkHostBinding(nativeService,pluginId,companyId){
 const db={namespace:BRIDGE_NAMESPACE,query:(s,p)=>nativeService.query(pluginId,s,p),execute:(s,p)=>nativeService.execute(pluginId,s,p)};
 const rt=runtimeState(db,companyId,'https://synthetic.invalid');
 const store=createBridgeStore(db),ids=['issue-a',"issue-'quoted-); --"];
 const ns='"'+BRIDGE_NAMESPACE+'"';
 for(let i=0;i<ids.length;i++){
  await db.execute(`INSERT INTO ${ns}.bridge_inbox (relay,event_id,state,destination,command,receipt_key) VALUES ($1,$2,'uncertain',$3::jsonb,'{}'::jsonb,$4)`,['https://synthetic.invalid','event-'+i,JSON.stringify({companyId,issueId:ids[i]}),'inbox-'+i]);
  await db.execute(`INSERT INTO ${ns}.bridge_outbox (receipt_key,relay,event_id,event,state) VALUES ($1,$2,$3,'{}'::jsonb,'blocked')`,['comment:test-'+i,'https://synthetic.invalid','outbox-'+i]);
  await rt.scopeReceipt('comment:test-'+i,ids[i]);
 }
 for(const subset of [[],ids.slice(0,1),ids]){
  assert.equal(await rt.uncertainCount(subset),subset.length);
  assert.equal((await rt.deliveryHealth(subset)).blocked,subset.length);
 }
 await rt.resumeBlocked([]);assert.equal((await rt.deliveryHealth(ids)).blocked,2);
 await rt.resumeBlocked(ids.slice(0,1));assert.equal((await rt.deliveryHealth(ids)).pending,1);
 await rt.resumeBlocked(ids);assert.equal((await rt.deliveryHealth(ids)).pending,2);
 assert.equal((await store.listCommentValidation(companyId,1)).length,1);
 assert.equal((await store.listCommentValidation(companyId,100)).length,2);
 const scanned=await db.query(`SELECT count(*)::text AS count FROM ${ns}.bridge_outbox WHERE validation_scanned_at IS NOT NULL`);assert.equal(scanned[0].count,'2');
 assert.equal((await store.listCommentValidation('synthetic-other-company')).length,0);
 assert.equal(await runtimeState(db,'synthetic-other-company','https://synthetic.invalid').uncertainCount(ids),0);
 console.log('HOST_SQL_BINDING_ASSERTIONS_PASSED',JSON.stringify({empty:true,single:true,multiple:true,quotedId:true,companyIsolation:true,validationScanUpdates:true}));
 // Disposable rows stay isolated, but restore disabled-company baseline before lifecycle check.
 for(const t of ['bridge_inbox','bridge_outbox_scopes','bridge_outbox'])await db.execute(`DELETE FROM ${ns}.${t}`);
}
