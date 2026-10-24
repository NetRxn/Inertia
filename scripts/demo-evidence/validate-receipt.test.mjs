import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validateReceipt} from './validate-receipt.mjs';

const fixture = name => fileURLToPath(new URL(`./fixtures/${name}.json`, import.meta.url));
const load = name => JSON.parse(readFileSync(fixture(name), 'utf8'));
const codes = list => [...new Set(list.map(e => e.code))].sort();
const cli = fileURLToPath(new URL('./validate-receipt.mjs', import.meta.url));
const run = (...args) => spawnSync(process.execPath, [cli, ...args], {encoding: 'utf8'});

const expected = {
  'valid-synthetic': [],
  'missing-link': ['LINK_UNRESOLVED'],
  'conflicting-version': ['VERSION_CONFLICT'],
  'unknown-measurement': [],
  'unknown-as-zero': ['TOTAL_INCOMPLETE', 'UNKNOWN_COERCED'],
  'silence-as-rejection': ['NO_RESPONSE_COERCED'],
  'manual-packet-as-system': ['CLASS_MISMATCH'],
  'partial-as-complete': ['SCOPE_OVERCLAIM'],
  'private-field-leak': ['PRIVATE_FIELD', 'PRIVATE_VALUE'],
};
for (const [name, errors] of Object.entries(expected)) {
  test(`fixture ${name} yields exactly ${errors.join(', ') || 'no errors'}`, () => {
    const report = validateReceipt(load(name));
    assert.deepEqual(codes(report.errors), errors);
    assert.equal(report.valid, errors.length === 0);
  });
}

test('valid synthetic receipt is never eligible for qualification and states its non-claims', () => {
  const report = validateReceipt(load('valid-synthetic'));
  assert.equal(report.qualificationEligible, false);
  assert.ok(codes(report.warnings).includes('NOT_SYSTEM_OUTPUT'));
  assert.ok(report.nonClaims.includes('not security signoff'));
});

test('missing-link names each unresolved reference', () => {
  const paths = validateReceipt(load('missing-link')).errors.map(e => e.path).sort();
  assert.deepEqual(paths, ['artifacts[1].producedBy.invocationRefs[0]', 'toolInvocations[1].admittedSourceRefs[1]']);
});

test('conflicting-version reports the contribution version, the run head and the duplicate artifact hash', () => {
  const paths = validateReceipt(load('conflicting-version')).errors.map(e => e.path).sort();
  assert.deepEqual(paths, ['artifacts[2].contentSha256', 'contributions[1].artifactRefs[0].version', 'runs[1].sourceHead']);
});

test('explicit unknowns stay valid but are surfaced, never as zero', () => {
  const report = validateReceipt(load('unknown-measurement'));
  assert.deepEqual(codes(report.warnings), ['COVERAGE_PARTIAL', 'MEASUREMENT_UNKNOWN', 'NOT_SYSTEM_OUTPUT']);
  assert.deepEqual(report.warnings.filter(w => w.code === 'MEASUREMENT_UNKNOWN').map(w => w.path).sort(),
    ['measurements.activeHumanTime', 'measurements.cost[0]']);
});

test('a complete system-produced outcome with full linkage is eligible for qualification review', () => {
  const r = load('partial-as-complete');
  r.outcome = {artifactRef: 'art:nsf-prep', version: 'v1'};
  const report = validateReceipt(r);
  assert.deepEqual(report.errors, []);
  assert.equal(report.qualificationEligible, true);
});

test('qualification cannot be claimed for synthetic or partial receipts', () => {
  const synthetic = {...load('valid-synthetic'), qualificationClaimed: true};
  assert.deepEqual(codes(validateReceipt(synthetic).errors), ['QUALIFICATION_OVERCLAIM']);
  const partial = {...load('manual-packet-as-system'), qualificationClaimed: true};
  partial.artifacts[0].origin = 'system-produced';
  assert.deepEqual(codes(validateReceipt(partial).errors), ['SCOPE_OVERCLAIM']);
});

test('historical human-submitted evidence cannot carry system runs or invocations', () => {
  const r = load('valid-synthetic');
  r.evidenceClass = 'historical-human-submitted';
  r.artifacts.forEach(a => { a.origin = 'historical-human'; });
  assert.deepEqual(codes(validateReceipt(r).errors), ['CLASS_MISMATCH']);
  delete r.runs; delete r.contributions; delete r.toolInvocations;
  r.artifacts.forEach(a => { delete a.producedBy; });
  const report = validateReceipt(r);
  assert.deepEqual(report.errors, []);
  assert.equal(report.qualificationEligible, false);
});

test('a system-produced artifact must come from at least one tool invocation', () => {
  const r = load('manual-packet-as-system');
  r.artifacts[0].origin = 'system-produced';
  r.artifacts[0].producedBy.invocationRefs = [];
  assert.deepEqual(codes(validateReceipt(r).errors), ['LINK_MISSING']);
});

test('savings, inconsistent wall-clock and wrong totals are rejected', () => {
  const r = load('valid-synthetic');
  r.measurements.savings = {amount: 500, currency: 'USD'};
  r.measurements.wallClock.seconds = 60;
  r.measurements.totals.cost.amount = 2;
  assert.deepEqual(codes(validateReceipt(r).errors), ['MEASUREMENT_INCONSISTENT', 'SAVINGS_INFERRED']);
});

test('a non-numeric total is inconsistent, not silently accepted', () => {
  const r = load('valid-synthetic');
  r.measurements.totals.cost.amount = 'about a dollar';
  assert.deepEqual(codes(validateReceipt(r).errors), ['MEASUREMENT_INCONSISTENT']);
});

test('every linked record must carry its own reference', () => {
  const r = load('valid-synthetic');
  delete r.runs[1].agentRef;
  delete r.admittedSources[0].sourceRef;
  delete r.artifacts[0].version;
  const paths = validateReceipt(r).errors.filter(e => e.code === 'SHAPE').map(e => e.path).sort();
  assert.deepEqual(paths, ['admittedSources[0].sourceRef', 'artifacts[0].version', 'runs[1].agentRef']);
});

test('corrections are required and an unknown count is never zero', () => {
  const r = load('valid-synthetic');
  delete r.measurements.corrections;
  assert.deepEqual(validateReceipt(r).errors.map(e => `${e.code} ${e.path}`), ['MEASUREMENT_FIELD measurements.corrections']);
  r.measurements.corrections = {status: 'unknown', count: 0, boundary: 'review history', reason: 'not exported'};
  assert.deepEqual(codes(validateReceipt(r).errors), ['UNKNOWN_COERCED']);
});

test('ask metrics are optional, but when measured every offered ask has exactly one state', () => {
  const r = load('valid-synthetic');
  delete r.measurements.asks;
  assert.deepEqual(validateReceipt(r).errors, []);
  const a = load('valid-synthetic');
  a.measurements.asks.accepted = 3;
  a.measurements.asks.completed = 4;
  assert.deepEqual(validateReceipt(a).errors.map(e => e.path).sort(),
    ['measurements.asks', 'measurements.asks.completed']);
  assert.ok(validateReceipt(a).errors.every(e => e.code === 'MEASUREMENT_INCONSISTENT'));
});

test('a response time needs at least one response to time', () => {
  const r = load('valid-synthetic');
  Object.assign(r.measurements.asks, {accepted: 0, declined: 0, noResponse: 4, completed: 0});
  assert.deepEqual(validateReceipt(r).errors.map(e => `${e.code} ${e.path}`),
    ['MEASUREMENT_INCONSISTENT measurements.asks.responseTime']);
});

test('usage needs a unit and cost needs a currency', () => {
  const r = load('valid-synthetic');
  delete r.measurements.usage[0].unit;
  r.measurements.cost[0].currency = 'dollars';
  assert.deepEqual(validateReceipt(r).errors.map(e => e.path).sort(),
    ['measurements.cost[0].currency', 'measurements.usage[0].unit']);
});

test('references must be opaque and run references must be digests', () => {
  const r = load('valid-synthetic');
  r.runs[0].agentRef = 'Jane Member';
  r.runs[1].runRef = 'run:4f2a';
  const errs = validateReceipt(r).errors;
  assert.ok(errs.some(e => e.code === 'REF_FORMAT' && e.path === 'runs[0].agentRef'));
  assert.ok(errs.some(e => e.code === 'REF_FORMAT' && e.path === 'runs[1].runRef'));
});

test('secret-shaped values and URLs are flagged', () => {
  const r = load('valid-synthetic');
  r.measurements.cost[0].basis = 'see https://billing.internal/acct and token ghp_abcdefghijklmnop1234';
  assert.deepEqual(codes(validateReceipt(r).errors), ['PRIVATE_VALUE']);
});

test('unsupported format and malformed input fail closed', () => {
  assert.deepEqual(codes(validateReceipt({...load('valid-synthetic'), receiptFormat: 'v9'}).errors), ['FORMAT']);
  for (const bad of [null, [], 'receipt']) assert.deepEqual(codes(validateReceipt(bad).errors), ['FORMAT']);
});

test('CLI exits 0 for valid, 1 for invalid and 2 for usage or parse errors', () => {
  const ok = run(fixture('valid-synthetic'));
  assert.equal(ok.status, 0);
  assert.equal(JSON.parse(ok.stdout)[0].valid, true);
  const bad = run(fixture('valid-synthetic'), fixture('missing-link'));
  assert.equal(bad.status, 1);
  assert.deepEqual(JSON.parse(bad.stdout).map(r => r.valid), [true, false]);
  assert.equal(run().status, 2);
  assert.equal(run(cli).status, 2);
});
