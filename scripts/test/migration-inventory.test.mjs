import test from 'node:test';
import assert from 'node:assert/strict';
import {assertMigrationInventory} from '../cloud-rehearsal/migration-inventory.mjs';
const files=Array.from({length:7},(_,i)=>`${String(i+1).padStart(3,'0')}_fixture.sql`);
const applied=files.map(migration_key=>({migration_key,status:'applied'}));
test('qualifies exact current inventory including an additive seventh migration',()=>{assert.doesNotThrow(()=>assertMigrationInventory(applied,files));});
test('rejects missing, extra, duplicate, failed and untracked migrations',()=>{
 for(const rows of [applied.slice(0,6),[...applied,{migration_key:'008_other.sql',status:'applied'}],[...applied,applied[0]],applied.map((r,i)=>i===6?{...r,status:'failed'}:r)])assert.throws(()=>assertMigrationInventory(rows,files));
});
