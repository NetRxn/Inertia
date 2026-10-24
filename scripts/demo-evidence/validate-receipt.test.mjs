import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validateReceipt, LIMITS} from './validate-receipt.mjs';

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

// Review findings on PR60 head 92904061 and the withdrawn ask category from the PR61 answers.
const SENTINEL = 'SYNTHETIC_SENTINEL';
const assertNoSentinel = (...outputs) => outputs.forEach(o =>
  assert.ok(!(typeof o === 'string' ? o : JSON.stringify(o)).includes(SENTINEL), 'diagnostics echo rejected input'));
const scratch = () => mkdtempSync(join(tmpdir(), 'demo-evidence-'));
const writeJson = (dir, name, text) => { const f = join(dir, name); writeFileSync(f, text); return f; };

test('a rejected private value is flagged without being echoed', () => {
  const r = load('valid-synthetic');
  r.contributions[0].runRef = `https://example.invalid/${SENTINEL}`;
  const report = validateReceipt(r);
  assert.ok(codes(report.errors).includes('PRIVATE_VALUE'));
  assertNoSentinel(report);
});

test('diagnostics never echo receipt values, unknown keys or free-text reasons', () => {
  const r = load('valid-synthetic');
  r.evidenceClass = SENTINEL;
  r.claimScope = SENTINEL;
  r.contributions[0].artifactRefs[0].artifactRef = `art:${SENTINEL}`;
  r.contributions[1].artifactRefs[0].version = SENTINEL;
  r.contributions[0].invocationRefs[0] = `inv:${SENTINEL}`;
  r.toolInvocations[0].admittedSourceRefs[0] = `src:${SENTINEL}`;
  r.toolInvocations[1].runRef = `run:sha256:${'a'.repeat(64)}`;
  r.artifacts[1].producedBy.runRef = SENTINEL;
  r.artifacts[0].origin = SENTINEL;
  r.artifacts.push({...structuredClone(r.artifacts[0]), contentSha256: 'b'.repeat(64)});
  r.measurements.activeHumanTime = {status: 'unknown', boundary: 'member review', reason: SENTINEL};
  r.measurements.cost[0].status = SENTINEL;
  r[SENTINEL] = {runRef: 'bad', note: `https://example.invalid/${SENTINEL}`};
  r.measurements[`${SENTINEL}@example.invalid`] = 1;
  const report = validateReceipt(r);
  assert.equal(report.valid, false);
  assert.ok(report.errors.length > 5);
  assertNoSentinel(report);
  assert.equal(report.evidenceClass, null);
  assert.equal(report.claimScope, null);
});

test('report metadata is allowlisted, never returned wholesale', () => {
  const report = validateReceipt({...load('valid-synthetic'), receiptFormat: {password: SENTINEL}});
  assert.deepEqual(codes(report.errors), ['FORMAT']);
  assert.equal(report.receiptFormat, null);
  assertNoSentinel(report);
});

test('CLI parse and read errors are static and never echo file content', () => {
  const dir = scratch();
  const bad = run(writeJson(dir, 'bad.json', `{"receiptFormat": ${SENTINEL}}`));
  assert.equal(bad.status, 2);
  assertNoSentinel(bad.stdout, bad.stderr);
  const r = load('valid-synthetic');
  r.measurements.activeHumanTime = {status: 'unknown', boundary: 'member review', reason: SENTINEL};
  r.contributions[0].runRef = `https://example.invalid/${SENTINEL}`;
  const invalid = run(writeJson(dir, 'leak.json', JSON.stringify(r)));
  assert.equal(invalid.status, 1);
  assertNoSentinel(invalid.stdout, invalid.stderr);
});

test('required digests must be SHA256 strings, not null or booleans', () => {
  const a = load('valid-synthetic');
  a.toolInvocations[0].argumentsSha256 = null;
  assert.deepEqual(validateReceipt(a).errors.map(e => `${e.code} ${e.path}`), ['DIGEST_FORMAT toolInvocations[0].argumentsSha256']);
  const b = load('valid-synthetic');
  b.artifacts[0].contentSha256 = false;
  assert.deepEqual(validateReceipt(b).errors.map(e => `${e.code} ${e.path}`), ['DIGEST_FORMAT artifacts[0].contentSha256']);
  const c = load('valid-synthetic');
  c.toolInvocations[1].resultSha256 = 'not-a-digest';
  assert.deepEqual(validateReceipt(c).errors.map(e => `${e.code} ${e.path}`), ['DIGEST_FORMAT toolInvocations[1].resultSha256']);
});

test('source ids and currencies are not satisfied by coerced arrays', () => {
  const r = load('valid-synthetic');
  r.source.head = [r.source.head];
  r.measurements.cost[0].currency = ['USD'];
  const errs = validateReceipt(r).errors.map(e => `${e.code} ${e.path}`);
  assert.ok(errs.includes('DIGEST_FORMAT source.head'));
  assert.ok(errs.includes('MEASUREMENT_FIELD measurements.cost[0].currency'));
});

test('deeply nested input is rejected deterministically, not thrown', () => {
  const r = load('valid-synthetic');
  let p = r;
  for (let i = 0; i < 10_000; i++) p = p.extra = {};
  let report;
  assert.doesNotThrow(() => { report = validateReceipt(r); });
  assert.deepEqual(report.errors.map(e => `${e.code} ${e.path}`), ['RESOURCE_LIMIT ']);
});

test('node count, string length and cycles are bounded', () => {
  const wide = load('valid-synthetic');
  wide.measurements.cost[0].basisNotes = new Array(LIMITS.nodes + 1).fill(0);
  assert.deepEqual(codes(validateReceipt(wide).errors), ['RESOURCE_LIMIT']);
  const long = load('valid-synthetic');
  long.measurements.cost[0].basis = 'a'.repeat(LIMITS.stringLength + 1);
  assert.deepEqual(codes(validateReceipt(long).errors), ['RESOURCE_LIMIT']);
  const cyclic = load('valid-synthetic');
  cyclic.measurements.self = cyclic.measurements;
  assert.deepEqual(codes(validateReceipt(cyclic).errors), ['RESOURCE_LIMIT']);
});

test('report growth is capped with a final RESOURCE_LIMIT entry', () => {
  const r = load('valid-synthetic');
  r.extraRefs = new Array(LIMITS.issues * 3).fill('bad');
  const {errors} = validateReceipt(r);
  assert.equal(errors.length, LIMITS.issues + 1);
  assert.equal(errors.at(-1).code, 'RESOURCE_LIMIT');
});

test('CLI bounds file count and size, and reports deep nesting without a stack trace', () => {
  const dir = scratch();
  const valid = fixture('valid-synthetic');
  const many = run(...new Array(LIMITS.files + 1).fill(valid));
  assert.equal(many.status, 2);
  assert.equal(many.stdout, '');
  const big = run(writeJson(dir, 'big.json', JSON.stringify({pad: 'a'.repeat(LIMITS.bytes)})));
  assert.equal(big.status, 2);
  let deep = '{}';
  for (let i = 0; i < 10_000; i++) deep = `{"extra":${deep}}`;
  const nested = run(writeJson(dir, 'deep.json', deep));
  assert.ok([1, 2].includes(nested.status));
  assert.doesNotMatch(nested.stderr, /\n\s+at /);
});

test('an artifact claimed by a contribution must be produced by that contribution\'s invocations', () => {
  const r = load('valid-synthetic');
  r.contributions[0].invocationRefs = ['inv:sql-01'];
  r.artifacts[0].producedBy.invocationRefs = ['inv:sql-02'];
  assert.deepEqual(validateReceipt(r).errors.map(e => `${e.code} ${e.path}`), ['LINK_MISMATCH contributions[0].artifactRefs[0]']);
  const subset = load('valid-synthetic');
  subset.artifacts[0].producedBy.invocationRefs = ['inv:sql-01'];
  assert.deepEqual(validateReceipt(subset).errors, []);
});

test('a genuine single-agent receipt with no collaborator is valid', () => {
  const r = load('valid-synthetic');
  r.runs.pop(); r.contributions.pop(); r.toolInvocations.pop(); r.artifacts.pop();
  assert.deepEqual(validateReceipt(r).errors, []);
});

test('usage totals must be an array of well-formed entries before they are summed', () => {
  const obj = load('valid-synthetic');
  obj.measurements.totals.usage = {value: 999};
  assert.deepEqual(validateReceipt(obj).errors.map(e => `${e.code} ${e.path}`), ['MEASUREMENT_FIELD measurements.totals.usage']);
  const item = load('valid-synthetic');
  item.measurements.totals.usage = [{value: 999}];
  assert.deepEqual(codes(validateReceipt(item).errors), ['MEASUREMENT_FIELD']);
  const ok = load('valid-synthetic');
  ok.measurements.totals.usage = [{metric: 'input_tokens', unit: 'tokens', value: 182000}];
  assert.deepEqual(validateReceipt(ok).errors, []);
  ok.measurements.totals.usage[0].value = 999;
  assert.deepEqual(codes(validateReceipt(ok).errors), ['MEASUREMENT_INCONSISTENT']);
});

test('withdrawn asks are their own state, separate from declined and no response', () => {
  const r = load('valid-synthetic');
  Object.assign(r.measurements.asks, {offered: 5, withdrawn: 1});
  assert.deepEqual(validateReceipt(r).errors, []);
  const folded = load('valid-synthetic');
  Object.assign(folded.measurements.asks, {offered: 5, declined: 2, withdrawn: 1});
  assert.deepEqual(validateReceipt(folded).errors.map(e => `${e.code} ${e.path}`), ['MEASUREMENT_INCONSISTENT measurements.asks']);
  const negative = load('valid-synthetic');
  negative.measurements.asks.withdrawn = -1;
  assert.deepEqual(validateReceipt(negative).errors.map(e => `${e.code} ${e.path}`), ['MEASUREMENT_FIELD measurements.asks.withdrawn']);
});

test('measured asks must record withdrawals separately', () => {
  const r = load('valid-synthetic');
  delete r.measurements.asks.withdrawn;
  assert.deepEqual(validateReceipt(r).errors.map(e => `${e.code} ${e.path}`), ['WITHDRAWAL_COERCED measurements.asks.withdrawn']);
});

test('a withdrawal never erases a completed contribution', () => {
  const r = load('valid-synthetic');
  Object.assign(r.measurements.asks, {accepted: 1, withdrawn: 1});
  assert.deepEqual(validateReceipt(r).errors.map(e => `${e.code} ${e.path}`), ['MEASUREMENT_INCONSISTENT measurements.asks.completed']);
});
