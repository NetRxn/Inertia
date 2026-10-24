import assert from 'node:assert/strict';
/** Compare actual installed migrations with this candidate, not a historical count. */
export function assertMigrationInventory(actual, files) {
  const expected = files.filter(name => name.endsWith('.sql')).sort();
  assert.ok(expected.length > 0, 'Candidate migration inventory is empty');
  assert.ok(actual.every(row => row.status === 'applied'), 'A migration is not applied');
  assert.deepEqual(actual.map(row => row.migration_key).sort(), expected,
    'Installed migrations differ from the exact candidate inventory');
}
