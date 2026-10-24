/** Provider-neutral demo-evidence receipt validator (#54). Checks internal linkage, version consistency,
 * measurement honesty, evidence class and public safety. It cannot prove a claim is true: a valid receipt is
 * provenance/measurement evidence only, never security signoff, grant acceptance or application-quality approval. */
import {readFileSync, statSync} from 'node:fs';

export const RECEIPT_FORMAT = 'inertia-demo-evidence/v0';
export const NON_CLAIMS = Object.freeze(['not security signoff', 'not grant acceptance', 'not application-quality approval',
  'not live qualification unless evidenceClass is system-produced and the run is separately qualified']);
// Input and report bounds: oversized input is rejected with RESOURCE_LIMIT, never a stack trace.
export const LIMITS = Object.freeze({bytes: 1024 * 1024, files: 64, depth: 16, nodes: 10_000, stringLength: 4096, issues: 200});

const CLASSES = {'synthetic-fixture': 'synthetic', 'system-produced': 'system-produced', 'historical-human-submitted': 'historical-human'};
const ORIGINS = new Set(['synthetic', 'system-produced', 'historical-human', 'manual-reference']);
const SCOPES = new Set(['partial-contribution', 'complete-application-outcome']);
const REF = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*:[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/;
const RUN_REF = /^run:sha256:[0-9a-f]{64}$/;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const GIT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const CURRENCY = /^[A-Z]{3}$/;
const PRIVATE_KEYS = new Set(['arguments', 'args', 'result', 'results', 'raw', 'content', 'body', 'packet', 'prompt', 'output',
  'input', 'transcript', 'credentials', 'credential', 'token', 'secret', 'password', 'apikey', 'email']);
const PRIVATE_VALUES = [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, /[a-z][a-z0-9+.-]*:\/\//i, /-----BEGIN/,
  /\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/];
const UNKNOWN = new Set(['unknown', 'not-measured']);
const ASK_KEYS = ['offered', 'accepted', 'declined', 'noResponse', 'pending', 'withdrawn', 'completed'];
const VALUE_KEYS = ['seconds', 'value', 'amount', 'count', ...ASK_KEYS];
// Diagnostics never echo receipt content: paths name only schema keys, and any other key is shown as UNRECOGNIZED.
const SCHEMA_KEYS = new Set(['receiptFormat', 'receiptId', 'evidenceClass', 'claimScope', 'qualificationClaimed', 'source', 'repo',
  'head', 'tree', 'runs', 'runRef', 'role', 'agentRef', 'runtimeRef', 'sourceHead', 'sourceRunRef', 'contributions', 'contributionRef',
  'bounded', 'invocationRefs', 'artifactRefs', 'artifactRef', 'version', 'toolInvocations', 'invocationRef', 'tool', 'argumentsSha256',
  'resultSha256', 'admittedSourceRefs', 'admittedSources', 'sourceRef', 'admissionRef', 'artifacts', 'contentSha256', 'origin',
  'producedBy', 'outcome', 'measurements', 'wallClock', 'activeHumanTime', 'status', 'startedAt', 'endedAt', 'boundary', 'method',
  'reason', 'usage', 'metric', 'unit', 'coverage', 'cost', 'currency', 'basis', 'totals', 'corrections', 'asks', 'responseTime',
  'statistic', 'nonClaims', 'savings', ...VALUE_KEYS]);
const UNRECOGNIZED = '<unrecognized>';
const safeKey = k => SCHEMA_KEYS.has(k) ? k : PRIVATE_KEYS.has(k.toLowerCase()) ? k.toLowerCase() : UNRECOGNIZED;
const allowed = (v, set) => typeof v === 'string' && set.has(v) ? v : null;

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const nonEmpty = v => typeof v === 'string' && v.trim() !== '';
const num = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const arr = v => Array.isArray(v) ? v : [];
const time = v => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(v) && !Number.isNaN(Date.parse(v)) ? Date.parse(v) : null;
const str = (v, pattern) => typeof v === 'string' && pattern.test(v);

// Iterative, so neither depth nor a cycle can exhaust the stack before the limits apply.
function withinLimits(root) {
  const stack = [[root, 0]];
  let nodes = 0;
  while (stack.length) {
    const [v, depth] = stack.pop();
    if (++nodes > LIMITS.nodes || depth > LIMITS.depth) return false;
    if (typeof v === 'string' && v.length > LIMITS.stringLength) return false;
    if (v === null || typeof v !== 'object') continue;
    for (const [k, x] of Object.entries(v)) {
      if (k.length > LIMITS.stringLength) return false;
      stack.push([x, depth + 1]);
    }
  }
  return true;
}

export function validateReceipt(receipt) {
  const errors = [], warnings = [], seen = new Set();
  // Bounded and de-duplicated by code and path; once full, one RESOURCE_LIMIT entry closes the list.
  const add = (list, code, path, message) => {
    if (list.length > LIMITS.issues || seen.has(`${list === errors}|${code}|${path}`)) return;
    seen.add(`${list === errors}|${code}|${path}`);
    list.push(list.length < LIMITS.issues ? {code, path, message} : {code: 'RESOURCE_LIMIT', path: '', message: 'further issues omitted'});
  };
  const err = (code, path, message) => add(errors, code, path, message);
  const warn = (code, path, message) => add(warnings, code, path, message);
  const report = () => {
    const valid = errors.length === 0;
    return {valid, receiptFormat: allowed(receipt?.receiptFormat, new Set([RECEIPT_FORMAT])),
      evidenceClass: allowed(receipt?.evidenceClass, new Set(Object.keys(CLASSES))), claimScope: allowed(receipt?.claimScope, SCOPES),
      qualificationClaimed: receipt?.qualificationClaimed === true,
      qualificationEligible: valid && receipt.evidenceClass === 'system-produced' && receipt.claimScope === 'complete-application-outcome',
      errors, warnings, nonClaims: [...NON_CLAIMS]};
  };
  if (!isObj(receipt)) {
    err('FORMAT', 'receiptFormat', `expected an object with receiptFormat "${RECEIPT_FORMAT}"`);
    return report();
  }
  if (!withinLimits(receipt)) {
    err('RESOURCE_LIMIT', '', `receipt exceeds depth ${LIMITS.depth}, ${LIMITS.nodes} values or ${LIMITS.stringLength}-character strings`);
    return report();
  }
  if (receipt.receiptFormat !== RECEIPT_FORMAT) {
    err('FORMAT', 'receiptFormat', `expected an object with receiptFormat "${RECEIPT_FORMAT}"`);
    return report();
  }
  const digest = (v, path) => { if (!str(v, SHA256)) err('DIGEST_FORMAT', path, 'required 64-lowercase-hex digest'); };

  // Public safety and reference shape, over the whole document.
  const walk = (v, path, key) => {
    if (typeof v === 'string') {
      if (PRIVATE_VALUES.some(p => p.test(v))) err('PRIVATE_VALUE', path, 'email, URL or secret-shaped value; use an opaque reference');
      if (key === 'runRef' || key === 'sourceRunRef') { if (!RUN_REF.test(v)) err('REF_FORMAT', path, 'run references must be run:sha256:<64 hex>'); }
      else if (key === 'receiptId' || key === 'tool' || /Refs?$/.test(key ?? '')) { if (!REF.test(v)) err('REF_FORMAT', path, 'expected an opaque <prefix>:<id> reference'); }
      else if (key === 'version' && !VERSION.test(v)) err('REF_FORMAT', path, 'expected a short opaque version token');
      else if (/Sha256$/.test(key ?? '') && !SHA256.test(v)) err('DIGEST_FORMAT', path, 'expected 64 lowercase hex');
      return;
    }
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${path}[${i}]`, typeof x === 'string' ? key : undefined));
    if (!isObj(v)) return;
    for (const [k, x] of Object.entries(v)) {
      const p = path ? `${path}.${safeKey(k)}` : safeKey(k);
      if (PRIVATE_KEYS.has(k.toLowerCase())) { err('PRIVATE_FIELD', p, 'raw/private fields are not allowed; record a digest or opaque reference'); continue; }
      if (k === 'savings') { err('SAVINGS_INFERRED', p, 'savings are never inferred in a receipt'); continue; }
      walk(x, p, k);
    }
  };
  walk(receipt, '', undefined);

  // Claim and evidence class.
  const cls = receipt.evidenceClass, expectedOrigin = CLASSES[cls], historical = cls === 'historical-human-submitted';
  if (!expectedOrigin) err('SHAPE', 'evidenceClass', `expected one of ${Object.keys(CLASSES).join(', ')}`);
  if (!SCOPES.has(receipt.claimScope)) err('SHAPE', 'claimScope', `expected one of ${[...SCOPES].join(', ')}`);
  if (typeof receipt.qualificationClaimed !== 'boolean') err('SHAPE', 'qualificationClaimed', 'expected a boolean');
  if (!nonEmpty(receipt.receiptId)) err('SHAPE', 'receiptId', 'required');
  const source = isObj(receipt.source) ? receipt.source : (err('SHAPE', 'source', 'required'), {});
  if (!nonEmpty(source.repo)) err('SHAPE', 'source.repo', 'required');
  for (const k of ['head', 'tree']) if (!str(source[k], GIT_ID)) err('DIGEST_FORMAT', `source.${k}`, 'expected an exact git object id');
  if (cls !== 'system-produced') warn('NOT_SYSTEM_OUTPUT', 'evidenceClass', 'this evidence is not actual system output');
  if (receipt.qualificationClaimed === true && cls !== 'system-produced')
    err('QUALIFICATION_OVERCLAIM', 'qualificationClaimed', 'only system-produced evidence can support a qualification claim');
  else if (receipt.qualificationClaimed === true && receipt.claimScope !== 'complete-application-outcome')
    err('SCOPE_OVERCLAIM', 'qualificationClaimed', 'a partial contribution cannot claim outcome qualification');

  if (historical) {
    for (const k of ['runs', 'contributions', 'toolInvocations'])
      if (k in receipt) err('CLASS_MISMATCH', k, 'historical human-submitted evidence cannot carry system runs or invocations');
  } else {
    for (const k of ['runs', 'contributions', 'toolInvocations', 'artifacts'])
      if (!arr(receipt[k]).length) err('SHAPE', k, 'required non-empty array');
    if (!Array.isArray(receipt.admittedSources)) err('SHAPE', 'admittedSources', 'required array');
  }

  // Indexes, duplicates and version consistency.
  const index = (list, key, name) => {
    const m = new Map();
    arr(list).forEach((x, i) => {
      if (!isObj(x)) return err('SHAPE', `${name}[${i}]`, 'expected an object');
      if (m.has(x[key])) err('DUPLICATE_REF', `${name}[${i}].${key}`, `duplicate ${key}`);
      else m.set(x[key], x);
    });
    return m;
  };
  const required = {runs: ['runRef', 'agentRef', 'runtimeRef'], contributions: ['contributionRef', 'runRef'],
    toolInvocations: ['invocationRef', 'runRef'], admittedSources: ['sourceRef'], artifacts: ['artifactRef', 'version']};
  for (const [name, keys] of Object.entries(required))
    arr(receipt[name]).forEach((x, i) => { if (isObj(x)) for (const k of keys) if (!nonEmpty(x[k])) err('SHAPE', `${name}[${i}].${k}`, 'required'); });
  const runs = index(receipt.runs, 'runRef', 'runs');
  const invocations = index(receipt.toolInvocations, 'invocationRef', 'toolInvocations');
  const sources = index(receipt.admittedSources, 'sourceRef', 'admittedSources');
  index(receipt.contributions, 'contributionRef', 'contributions');
  const artifacts = new Map(), artifactRefs = new Set();
  arr(receipt.artifacts).forEach((a, i) => {
    if (!isObj(a)) return err('SHAPE', `artifacts[${i}]`, 'expected an object');
    const key = `${a.artifactRef}@${a.version}`, prior = artifacts.get(key);
    if (!prior) { artifacts.set(key, a); artifactRefs.add(a.artifactRef); }
    else if (prior.contentSha256 !== a.contentSha256) err('VERSION_CONFLICT', `artifacts[${i}].contentSha256`, 'the same artifact version is recorded with two different digests');
    else err('DUPLICATE_REF', `artifacts[${i}]`, 'duplicate artifact version');
  });
  const resolveArtifact = (ref, path) => {
    if (!isObj(ref)) return err('SHAPE', path, 'expected {artifactRef, version}');
    const a = artifacts.get(`${ref.artifactRef}@${ref.version}`);
    if (!a && artifactRefs.has(ref.artifactRef)) err('VERSION_CONFLICT', `${path}.version`, 'artifact is not recorded at this version');
    else if (!a) err('LINK_UNRESOLVED', `${path}.artifactRef`, 'unknown artifact');
    return a;
  };
  const invocationsFor = (refs, runRef, path) => {
    if (!arr(refs).length) return err('LINK_MISSING', path, 'at least one tool invocation is required');
    refs.forEach((r, j) => {
      const inv = invocations.get(r);
      if (!inv) err('LINK_UNRESOLVED', `${path}[${j}]`, 'unknown invocation');
      else if (inv.runRef !== runRef) err('LINK_MISMATCH', `${path}[${j}]`, 'invocation belongs to a different run');
    });
  };

  // Linkage: run → contribution → invocation → admitted source → artifact.
  const systemRuns = [...runs.values()].filter(r => r.role === 'system');
  if (!historical && runs.size && systemRuns.length !== 1) err('SHAPE', 'runs', 'exactly one registered system run is required');
  arr(receipt.runs).forEach((r, i) => {
    if (!isObj(r)) return;
    if (!['system', 'collaborator'].includes(r.role)) err('SHAPE', `runs[${i}].role`, 'expected system or collaborator');
    if (r.sourceHead !== source.head) err('VERSION_CONFLICT', `runs[${i}].sourceHead`, 'run source head differs from source.head');
  });
  arr(receipt.contributions).forEach((c, i) => {
    if (!isObj(c)) return;
    const p = `contributions[${i}]`, run = runs.get(c.runRef);
    if (!run) err('LINK_UNRESOLVED', `${p}.runRef`, 'unknown run');
    if (typeof c.bounded !== 'boolean') err('SHAPE', `${p}.bounded`, 'expected a boolean');
    else if (run?.role === 'collaborator' && !c.bounded) err('SCOPE_OVERCLAIM', `${p}.bounded`, 'a collaborator contribution is bounded, not the outcome');
    invocationsFor(c.invocationRefs, c.runRef, `${p}.invocationRefs`);
    if (!arr(c.artifactRefs).length) err('LINK_MISSING', `${p}.artifactRefs`, 'at least one resulting artifact is required');
    arr(c.artifactRefs).forEach((ref, j) => {
      const a = resolveArtifact(ref, `${p}.artifactRefs[${j}]`);
      if (!a || !isObj(a.producedBy)) return;
      if (a.producedBy.runRef !== c.runRef) err('LINK_MISMATCH', `${p}.artifactRefs[${j}]`, 'artifact was produced by a different run');
      else if (arr(a.producedBy.invocationRefs).some(r => invocations.has(r) && !arr(c.invocationRefs).includes(r)))
        err('LINK_MISMATCH', `${p}.artifactRefs[${j}]`, 'artifact was produced by invocations outside this contribution');
    });
  });
  arr(receipt.toolInvocations).forEach((inv, i) => {
    if (!isObj(inv)) return;
    const p = `toolInvocations[${i}]`;
    if (!runs.has(inv.runRef)) err('LINK_UNRESOLVED', `${p}.runRef`, 'unknown run');
    if (!nonEmpty(inv.tool)) err('SHAPE', `${p}.tool`, 'required');
    for (const k of ['argumentsSha256', 'resultSha256']) digest(inv[k], `${p}.${k}`);
    if (!Array.isArray(inv.admittedSourceRefs)) err('SHAPE', `${p}.admittedSourceRefs`, 'required array');
    arr(inv.admittedSourceRefs).forEach((s, j) => { if (!sources.has(s)) err('LINK_UNRESOLVED', `${p}.admittedSourceRefs[${j}]`, 'source was not admitted'); });
  });
  arr(receipt.admittedSources).forEach((s, i) => {
    if (isObj(s)) for (const k of ['admissionRef', 'version']) if (!nonEmpty(s[k])) err('SHAPE', `admittedSources[${i}].${k}`, 'required');
  });
  arr(receipt.artifacts).forEach((a, i) => {
    if (!isObj(a)) return;
    const p = `artifacts[${i}]`;
    digest(a.contentSha256, `${p}.contentSha256`);
    if (!ORIGINS.has(a.origin)) err('SHAPE', `${p}.origin`, `expected one of ${[...ORIGINS].join(', ')}`);
    else if (expectedOrigin && a.origin !== expectedOrigin)
      err('CLASS_MISMATCH', `${p}.origin`, a.origin === 'manual-reference' && cls === 'system-produced'
        ? 'a manual reference packet cannot be claimed as system output' : `${a.origin} artifact in ${cls} evidence`);
    if (historical) { if ('producedBy' in a) err('CLASS_MISMATCH', `${p}.producedBy`, 'historical artifacts were not produced by a system run'); return; }
    if (!isObj(a.producedBy)) return err('LINK_MISSING', `${p}.producedBy`, 'required');
    if (!runs.has(a.producedBy.runRef)) err('LINK_UNRESOLVED', `${p}.producedBy.runRef`, 'unknown run');
    invocationsFor(a.producedBy.invocationRefs, a.producedBy.runRef, `${p}.producedBy.invocationRefs`);
  });
  if (receipt.claimScope === 'complete-application-outcome') {
    if (!isObj(receipt.outcome)) err('SCOPE_OVERCLAIM', 'outcome', 'a complete outcome must name its resulting artifact version');
    else {
      const a = resolveArtifact(receipt.outcome, 'outcome');
      if (a && (systemRuns.length !== 1 || a.producedBy?.runRef !== systemRuns[0].runRef))
        err('SCOPE_OVERCLAIM', 'outcome', 'the complete outcome must be produced by the registered system run, not a collaborator contribution');
    }
  }

  checkMeasurements(receipt.measurements, err, warn);
  return report();
}

function checkMeasurements(m, err, warn) {
  if (!isObj(m)) return err('MEASUREMENT_FIELD', 'measurements', 'required');
  let componentsOk = true;
  const fieldErr = (path, message) => { componentsOk = false; err('MEASUREMENT_FIELD', path, message); };
  const status = (x, p) => {
    if (UNKNOWN.has(x.status)) {
      warn('MEASUREMENT_UNKNOWN', p, `${x.status}; the receipt states its reason`);
      for (const k of VALUE_KEYS) if (k in x) { err('UNKNOWN_COERCED', `${p}.${k}`, 'an unknown measurement carries no value, not zero'); }
      if (!nonEmpty(x.reason)) fieldErr(`${p}.reason`, 'unknown values need a reason');
      return false;
    }
    if (x.status !== 'measured') { fieldErr(`${p}.status`, 'expected measured, unknown or not-measured'); return false; }
    return true;
  };
  const coverage = (x, p) => {
    if (x.coverage === 'partial') warn('COVERAGE_PARTIAL', `${p}.coverage`, 'partial coverage; not a total');
    else if (x.coverage === 'none') { err('UNKNOWN_COERCED', `${p}.coverage`, 'a measured value with no coverage is an unknown, not zero'); }
    else if (x.coverage !== 'complete') fieldErr(`${p}.coverage`, 'expected complete or partial');
  };

  // Wall-clock and active human time are separate, each with a stated boundary.
  for (const k of ['wallClock', 'activeHumanTime']) {
    const x = m[k], p = `measurements.${k}`;
    if (!isObj(x)) { fieldErr(p, 'required, separately from the other time measure'); continue; }
    if (!nonEmpty(x.boundary)) fieldErr(`${p}.boundary`, 'state what the measurement covers');
    if (!status(x, p)) continue;
    if (!num(x.seconds)) { fieldErr(`${p}.seconds`, 'expected non-negative seconds'); continue; }
    if (k === 'activeHumanTime') { if (!nonEmpty(x.method)) fieldErr(`${p}.method`, 'state how human time was measured'); continue; }
    const start = time(x.startedAt), end = time(x.endedAt);
    if (start === null || end === null) fieldErr(p, 'startedAt and endedAt must be UTC ISO timestamps');
    else if (end < start || Math.abs((end - start) / 1000 - x.seconds) > 1)
      err('MEASUREMENT_INCONSISTENT', `${p}.seconds`, 'seconds do not match startedAt/endedAt');
  }

  // Usage and cost: units, currency and coverage; unknown is explicit, never $0.
  const usage = arr(m.usage), cost = arr(m.cost);
  if (!usage.length) fieldErr('measurements.usage', 'record at least one usage entry, even if unknown');
  if (!cost.length) fieldErr('measurements.cost', 'record at least one cost entry, even if unknown');
  usage.forEach((u, i) => {
    const p = `measurements.usage[${i}]`;
    if (!isObj(u)) return fieldErr(p, 'expected an object');
    if (!nonEmpty(u.metric)) fieldErr(`${p}.metric`, 'required');
    if (!nonEmpty(u.unit)) fieldErr(`${p}.unit`, 'required');
    if (!status(u, p)) return;
    if (!num(u.value)) fieldErr(`${p}.value`, 'expected a non-negative number');
    if (!nonEmpty(u.source)) fieldErr(`${p}.source`, 'state where the figure came from');
    coverage(u, p);
  });
  cost.forEach((c, i) => {
    const p = `measurements.cost[${i}]`;
    if (!isObj(c)) return fieldErr(p, 'expected an object');
    if (!status(c, p)) { if ('currency' in c && !str(c.currency, CURRENCY)) fieldErr(`${p}.currency`, 'expected ISO 4217'); return; }
    if (!num(c.amount)) fieldErr(`${p}.amount`, 'expected a non-negative number');
    if (!str(c.currency, CURRENCY)) fieldErr(`${p}.currency`, 'expected ISO 4217, e.g. USD');
    if (!nonEmpty(c.basis)) fieldErr(`${p}.basis`, 'state the pricing basis');
    coverage(c, p);
  });

  // Corrections are a primary measure; ask metrics are optional secondary measures.
  const corrections = m.corrections, cp = 'measurements.corrections';
  if (!isObj(corrections)) fieldErr(cp, 'required, even if unknown');
  else {
    if (!nonEmpty(corrections.boundary)) fieldErr(`${cp}.boundary`, 'state what the count covers');
    if (status(corrections, cp)) {
      if (!Number.isInteger(corrections.count) || corrections.count < 0) fieldErr(`${cp}.count`, 'expected a non-negative integer');
      if (!nonEmpty(corrections.source)) fieldErr(`${cp}.source`, 'state where the count came from');
    }
  }
  if (m.asks !== undefined) checkAsks(m.asks, err, fieldErr, status);

  // Totals only over complete, measured components, and they must add up.
  const t = m.totals;
  if (t === null || t === undefined) return;
  if (!componentsOk) return;
  if (![...usage, ...cost].every(x => x.status === 'measured' && x.coverage === 'complete'))
    return err('TOTAL_INCOMPLETE', 'measurements.totals', 'totals require every usage and cost component to be measured with complete coverage');
  if (!isObj(t)) return err('MEASUREMENT_FIELD', 'measurements.totals', 'expected an object or null');
  if (t.cost !== undefined) {
    const currencies = new Set(cost.map(c => c.currency));
    const sum = cost.reduce((s, c) => s + c.amount, 0);
    if (!isObj(t.cost) || !num(t.cost.amount) || currencies.size !== 1 || t.cost.currency !== cost[0].currency || Math.abs(t.cost.amount - sum) > 1e-9)
      err('MEASUREMENT_INCONSISTENT', 'measurements.totals.cost', 'total does not equal the single-currency sum of cost entries');
  }
  if (t.usage === undefined) return;
  if (!Array.isArray(t.usage)) return err('MEASUREMENT_FIELD', 'measurements.totals.usage', 'expected an array of {metric, unit, value}');
  t.usage.forEach((u, i) => {
    const p = `measurements.totals.usage[${i}]`;
    if (!isObj(u) || !nonEmpty(u.metric) || !nonEmpty(u.unit)) return err('MEASUREMENT_FIELD', p, 'expected {metric, unit, value}');
    const parts = usage.filter(x => x.metric === u.metric && x.unit === u.unit);
    if (!parts.length || !num(u.value) || Math.abs(u.value - parts.reduce((s, x) => s + x.value, 0)) > 1e-9)
      err('MEASUREMENT_INCONSISTENT', p, 'total does not equal the sum of matching usage entries');
  });
}

// Every offered ask is accepted, declined, unanswered, pending or withdrawn. Silence and withdrawal are never
// folded into declined, and a completed (accepted) ask is never re-counted as withdrawn.
function checkAsks(a, err, fieldErr, status) {
  const p = 'measurements.asks';
  if (!isObj(a)) return fieldErr(p, 'expected an object');
  if (!nonEmpty(a.boundary)) fieldErr(`${p}.boundary`, 'state which asks are counted');
  if (!status(a, p)) return;
  if (!('noResponse' in a)) return err('NO_RESPONSE_COERCED', `${p}.noResponse`, 'record unanswered asks separately; silence is not a rejection');
  if (!('withdrawn' in a)) return err('WITHDRAWAL_COERCED', `${p}.withdrawn`, 'record withdrawn asks separately; a withdrawal is not a decline or no response');
  const bad = ASK_KEYS.filter(k => !Number.isInteger(a[k]) || a[k] < 0);
  if (bad.length) return bad.forEach(k => fieldErr(`${p}.${k}`, 'expected a non-negative integer'));
  if (a.accepted + a.declined + a.noResponse + a.pending + a.withdrawn !== a.offered)
    err('MEASUREMENT_INCONSISTENT', p, 'accepted + declined + noResponse + pending + withdrawn must equal offered');
  if (a.completed > a.accepted) err('MEASUREMENT_INCONSISTENT', `${p}.completed`, 'completed asks cannot exceed accepted asks');
  const rt = a.responseTime, rp = `${p}.responseTime`;
  if (rt === undefined) return;
  if (!isObj(rt)) return fieldErr(rp, 'expected an object');
  if (!nonEmpty(rt.boundary)) fieldErr(`${rp}.boundary`, 'state which responses are timed');
  if (!status(rt, rp)) return;
  if (!['median', 'mean', 'max'].includes(rt.statistic)) fieldErr(`${rp}.statistic`, 'expected median, mean or max');
  if (!num(rt.seconds)) fieldErr(`${rp}.seconds`, 'expected non-negative seconds');
  if (a.accepted + a.declined === 0) err('MEASUREMENT_INCONSISTENT', rp, 'no responses to time; record responseTime as unknown');
}

if (import.meta.main) {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error('usage: node scripts/demo-evidence/validate-receipt.mjs <receipt.json> [...]');
    process.exit(2);
  }
  if (files.length > LIMITS.files) {
    console.error(`at most ${LIMITS.files} receipt files per run`);
    process.exit(2);
  }
  // Input errors are static: never echo file content, parser snippets or stack traces.
  const fail = (file, message) => { console.error(`${file}: ${message}`); process.exit(2); };
  const reports = [];
  for (const file of files) {
    let text, receipt, report;
    try { if (statSync(file).size > LIMITS.bytes) fail(file, `exceeds the ${LIMITS.bytes}-byte limit`); text = readFileSync(file, 'utf8'); }
    catch { fail(file, 'unreadable'); }
    if (Buffer.byteLength(text) > LIMITS.bytes) fail(file, `exceeds the ${LIMITS.bytes}-byte limit`);
    try { receipt = JSON.parse(text); } catch { fail(file, 'not valid JSON'); }
    try { report = validateReceipt(receipt); } catch { fail(file, 'could not be validated'); }
    reports.push({file, ...report});
  }
  console.log(JSON.stringify(reports, null, 2));
  process.exit(reports.every(r => r.valid) ? 0 : 1);
}
