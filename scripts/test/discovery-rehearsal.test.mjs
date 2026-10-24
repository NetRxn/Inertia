import assert from 'node:assert/strict';
import {test} from 'node:test';
import {checkPrerequisites} from '../discovery-rehearsal/run.mjs';
test('rejects unpinned host and external database overrides',()=>{
 assert.throws(()=>checkPrerequisites({version:'latest',env:{},platform:'linux',arch:'x64'}),/pinned/);
 for(const name of ['DATABASE_URL','QUALIFICATION_DATABASE_URL','PGHOST','PGSERVICE'])
  assert.throws(()=>checkPrerequisites({version:'2026.1012.0',env:{[name]:'production'},platform:'linux',arch:'x64'}),/external database/);
 assert.throws(()=>checkPrerequisites({version:'2026.1012.0',env:{},platform:'darwin',arch:'arm64'}),/Linux x64/);
 assert.doesNotThrow(()=>checkPrerequisites({version:'2026.1012.0',env:{},platform:'linux',arch:'x64'}));
});
import {cleanupOwned} from '../discovery-rehearsal/run.mjs';
test('uncertain startup checks actual owned server and stops it before removal',async()=>{
 const actions=[]; let state='running'; const receipt={};
 await cleanupOwned({inspect:async()=>{actions.push('inspect');return state},stop:async()=>{actions.push('stop');state='stopped'},remove:async()=>actions.push('remove'),receipt});
 assert.deepEqual(actions,['inspect','stop','inspect','remove']);assert.equal(receipt.cleaned,true);
});
test('stop failure with live owned server retains data and records failure',async()=>{
 const receipt={};let removed=false;
 await cleanupOwned({inspect:async()=> 'running',stop:async()=>{throw Error('timeout')},remove:async()=>{removed=true},receipt});
 assert.equal(removed,false);assert.equal(receipt.cleaned,false);assert.equal(receipt.result,'failed');assert.match(receipt.cleanupError,/stop failed/);
});
test('unknown process ownership never stops or removes anything',async()=>{
 const receipt={}; await cleanupOwned({inspect:async()=> 'unknown',stop:async()=>assert.fail(),remove:async()=>assert.fail(),receipt});
 assert.equal(receipt.cleaned,false);assert.equal(receipt.result,'failed');
});
import {inspectOwnedPostgres} from '../discovery-rehearsal/run.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('missing pid after uncertain startup is unknown, not confirmed stopped',async()=>{
 const work=await mkdtemp(join(tmpdir(),'rehearsal-cleanup-test-'));
 try {
  assert.equal(await inspectOwnedPostgres(work,'/nonexistent',{},false),'unknown');
  assert.equal(await inspectOwnedPostgres(work,'/nonexistent',{},true),'stopped');
 } finally {await rm(work,{recursive:true,force:true});}
});
