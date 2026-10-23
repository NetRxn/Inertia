/** Read a synthetic owning-service export and test actual Helix wire compatibility.
 * Usage: npm run build; node scripts/qualify-partner-wire.mjs /path/to/export.json
 * Export must be created in a disposable DB, not copied from private production data.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Client } from '@helix-db/helix-db';
import { createHelixProjection } from '../dist/src/partners/helix.js';
import { queryPartnerFacts } from '../dist/src/partners/retrieval.js';

if (!process.argv[2]) throw Error('Expected disposable synthetic domain export path');
const fixture = JSON.parse(await readFile(process.argv[2], 'utf8'));
assert.equal(fixture.query_first.items.length, 0);
assert.equal(fixture.receipt.opportunity_outcome, 'rejected');
assert.equal(fixture.source_before.items.length, 1);
assert.equal(fixture.source_after.items.length, 0);
const client = await Client.embedded({ kind:'inMemory', database:crypto.randomUUID() });
try {
  const target = createHelixProjection(client, {embedded:true});
  await target.initialize(); await target.advanceFence(fixture.lease);
  const live = await target.apply(fixture.lease, fixture.live);
  assert.deepEqual(await target.apply(fixture.lease, fixture.live), live);
  const query = {predicate:'HAS_CAPABILITY',value:'manufacturing',limit:20};
  const pointers = await target.candidates(fixture.scope, query);
  assert.equal(pointers.length,1); assert.equal(pointers[0].assertion_id,fixture.live.assertion_id);
  // The real owning-service output after revocation is empty BEFORE Helix deletion.
  const source = {projectionCurrent:async()=>true,revalidate:async()=>fixture.source_after.items,fallback:async()=>fixture.source_after.items};
  assert.equal((await queryPartnerFacts(source,target,fixture.scope,query)).facts.length,0);
  const removed = await target.apply(fixture.lease, fixture.tombstone);
  assert.equal(removed.deleted,true); assert(removed.revision>live.revision);
  assert.equal((await target.candidates(fixture.scope,query)).length,0);
  await assert.rejects(()=>target.apply(fixture.lease,fixture.live),/revision/);
  console.log(JSON.stringify({result:'passed',qualification:'actual Python SQLite export to official embedded Helix',query_first:true,rejected_opportunity_kept_knowledge:true,live_revision:live.revision,revoked_revision:removed.revision,immediate_authoritative_revocation:true,stale_projection_replay_denied:true,remote_gateway_test:false},null,2));
} finally { await client.close(); }
