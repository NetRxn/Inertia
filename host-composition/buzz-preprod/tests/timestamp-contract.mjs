/** Offline characterization, NOT a real relay or a replacement HTTP adapter.
 * Models only verified official NIP98/event timestamp rules and exact-ID reads.
 * Product change that alters observed errors or exact signed bytes fails assertions.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const deps = process.env.INERTIA_DEPENDENCY_ROOT;
assert(deps, 'Set INERTIA_DEPENDENCY_ROOT to an existing reviewed Inertia checkout; no installation is performed');
const require = createRequire(resolve(deps, 'package.json'));
const { build } = require('esbuild');
const { finalizeEvent, verifyEvent } = require('nostr-tools');
const temp = await mkdtemp(resolve(tmpdir(), 'buzz-offline-contract-'));
try {
  await build({ entryPoints: [resolve(root, 'evidence/inertia/src/buzz/http.ts')], bundle: true, platform: 'node', format: 'esm', outfile: resolve(temp, 'http.mjs'), nodePaths: [resolve(deps, 'node_modules')] });
  const { makeBuzzHttpClient, BuzzRequestRejected, BuzzDeliveryUnknown } = await import(resolve(temp, 'http.mjs'));
  const key = new Uint8Array(32).fill(1); // Existing public Inertia fixture key. NEVER deployment identity.
  const channel = 'bf290cba-a856-449b-b9d3-9e6fa5d0684b';
  let now = 1700000000;
  const sign = t => finalizeEvent(t, key);
  const message = created_at => sign({kind:9, created_at, content:'SYNTHETIC timestamp characterization', tags:[['h',channel]]});
  const stored = new Map(), authIds = new Set(), submitted = [], submittedBodies = [];
  let loseResponse = false;
  const fixtureFetch = async (url, init) => {
    assert.equal(init.redirect, 'error');
    const auth = JSON.parse(Buffer.from(init.headers.Authorization.slice(6),'base64').toString());
    assert(verifyEvent(auth)); assert.equal(auth.kind,27235);
    assert(Math.abs(auth.created_at-now)<=60);
    const tag = name => auth.tags.find(t=>t[0]===name)?.[1];
    assert.equal(tag('u'),url); assert.equal(tag('method'),'POST');
    assert.equal(tag('payload'),createHash('sha256').update(init.body).digest('hex'));
    assert(!authIds.has(auth.id)); authIds.add(auth.id);
    if(url.endsWith('/query')) {
      const filters=JSON.parse(init.body);
      return Response.json([...stored.values()].filter(e=>filters.some(f=>f.ids?.includes(e.id))));
    }
    assert(url.endsWith('/events'));
    const event=JSON.parse(init.body); submitted.push(event); submittedBodies.push(init.body);
    assert(verifyEvent(event)); assert.equal(event.pubkey,auth.pubkey);
    // Official ingest.rs checks drift before ordinary duplicate handling.
    if(Math.abs(event.created_at-now)>900) return Response.json({error:'invalid: event timestamp too far from server time'},{status:400});
    stored.set(event.id,event);
    if(loseResponse) {loseResponse=false; now+=901; throw new Error('fixture: response lost after persistence; clock advanced');}
    return Response.json({event_id:event.id,accepted:true,message:''});
  };
  const client=makeBuzzHttpClient({relayUrl:'https://relay.example',signer:sign,fetch:fixtureFetch,clock:()=>now,sleep:async()=>{}});
  const old=message(now-901);
  await assert.rejects(client.publish(old),BuzzRequestRejected);
  assert.equal(stored.size,0);
  console.log('PASS older first publication is rejected; not persisted');
  const fresh=message(now); loseResponse=true;
  await assert.rejects(client.publish(fresh),BuzzDeliveryUnknown);
  assert.equal(stored.size,1);
  assert.equal(submitted.at(-1).id,fresh.id);
  assert.deepEqual(submitted.at(-1),submitted.at(-2));
  assert.equal(submittedBodies.at(-1),submittedBodies.at(-2));
  console.log('PASS lost response + >15min retry remains delivery-unknown with unchanged signed event');
  await assert.rejects(client.publish(fresh),BuzzRequestRejected);
  assert.equal(stored.size,1);
  console.log('PASS separate later retry misclassifies prior durable uncertainty as first-attempt rejection (known gap)');
  const readback=await client.query([{ids:[fresh.id],kinds:[9],'#h':[channel]}]);
  assert.equal(readback.length,1); assert.deepEqual(JSON.parse(JSON.stringify(readback[0].event)),JSON.parse(JSON.stringify(fresh)));
  console.log('PASS exact-ID readback proves stored signed event without re-signing or duplication');
  const absent=await client.query([{ids:[old.id],kinds:[9],'#h':[channel]}]);
  assert.equal(absent.length,0);
  console.log('PASS absent exact-ID query is observable, not automatic replacement authorization');
  console.log('5 offline characterization checks passed; real relay and host fetch NOT tested');
} finally { await rm(temp,{recursive:true,force:true}); }
