import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalJson} from '../../../../dist/src/grants/engine.js';
import {memberHash, memberTarget, memberTimestamp, parseMemberIntent, validateMemberAccessProof} from '../../../../dist/src/grants/member-review.js';

const mod = await import('../native/member-outcome.mjs').catch(error => error.code === 'ERR_MODULE_NOT_FOUND' ? {} : Promise.reject(error));
const SOURCE_ID = '00000000-0000-4000-8000-000000000002';
const EFFECT_ID = '00000000-0000-5000-8000-000000000003';
// Independently calculated with Python's UTF-8 canonical JSON/SHA-256, not the projection under test.
const POLICY_HASH = '849085f1f5bb95dbae1e1cae6a6c1e2d42889ce61c2b569f541f061c68032d58';
const INTENT_HASH = '14e805a5aeea38ab80b7bb4b4843b95ad7d1cd30009e61ef506a7539c9ba23b5';
const ACCEPTED_DIGEST = '880905c720197a88074249915dd84622de0d4dbc76851d21ff2fc8f51a0fdd10';
const contracts = {hash: memberHash, canonical: canonicalJson, target: memberTarget, timestamp: memberTimestamp,
  parseIntent: parseMemberIntent, accessProof: validateMemberAccessProof};
const scope = () => ({schema: 'inertia.member-packet-transport-scope.v2', purpose: 'member-packet-review',
  sourceId: 'native-fixture', destinationId: 'dfw-fixture', companyId: '00000000-0000-4000-8000-000000000001',
  applicantId: 'applicant-1', applicationId: 'application-1', opportunityNamespace: 'fixture',
  opportunityExternalId: 'opportunity-1', sourceScope: 'members'});
function acceptance() {
  return {schema: 'inertia.member-packet-acceptance.v2', source: {kind: 'paperclip', id: SOURCE_ID},
    acceptedAt: '2026-10-24T12:30:00.000Z', actor: {type: 'human', userId: 'human-1'},
    authorization: {actorUserId: 'human-1', actorType: 'human', authenticatedHuman: true, verifiedDaoMember: true,
      applicationActionAllowed: true, nativeActionAllowed: true, membershipVersion: 'member-v1', applicationAccessVersion: 'application-v1'},
    intent: {schema: 'inertia.member-packet-action.v2', policyHash: POLICY_HASH,
      target: {packetId: 'packet-1', packetVersion: 2, packetContentHash: 'a'.repeat(64)}, action: 'record_submission',
      payload: {submittedAt: '2026-10-24T12:00:00Z', declaredSubmitter: null, note: 'Reported exact submission. 界 ✅ 😀', evidence: null}},
    intentHash: INTENT_HASH};
}
function response() {
  return {scope: scope(), envelope: {schema: 'inertia.member-packet-outcome-envelope.v2',
    source: {kind: 'paperclip', id: SOURCE_ID}, intentHash: INTENT_HASH, acceptedDigest: ACCEPTED_DIGEST,
    outcome: {state: 'applied', sourceId: SOURCE_ID, eventId: EFFECT_ID, action: 'record_submission',
      target: {packetId: 'packet-1', packetVersion: 2, packetContentHash: 'a'.repeat(64)}, policyHash: POLICY_HASH}}};
}
function factory(config = {}) {
  assert.equal(typeof mod.createMemberPacketOutcomeReader, 'function', 'strict durable outcome projection exists');
  return mod.createMemberPacketOutcomeReader(config);
}
const config = readEnvelope => ({enabled: true, scope: scope(), contracts: {...contracts}, readEnvelope});
const expected = state => ({sourceId: SOURCE_ID, intentHash: INTENT_HASH, state, effectId: state === 'applied' ? EFFECT_ID : null});

test('disabled construction and invocation do not inspect scope, ports, acceptance or context', async () => {
  const unused = new Proxy({}, {get() { throw Error('disabled side effect'); }});
  for (const enabled of [undefined, false, 'true', 1]) {
    const read = factory({enabled, get scope() { throw Error('scope access'); }, get contracts() { throw Error('codec access'); },
      get readEnvelope() { throw Error('callback access'); }});
    assert.equal(await read(unused, unused), null);
  }
  assert.equal(await factory()(), null);
});

test('enabled construction requires fixed strict scope and every trusted codec/read port', () => {
  assert.equal(typeof mod.createMemberPacketOutcomeReader, 'function');
  assert.throws(() => factory({enabled: true}));
  const good = config(async () => response());
  for (const key of ['scope', 'contracts', 'readEnvelope']) assert.throws(() => factory({...good, [key]: undefined}), key);
  for (const key of Object.keys(contracts)) assert.throws(() => factory({...good, contracts: {...contracts, [key]: null}}), key);
  for (const bad of [null, [], {...scope(), extra: true}, {...scope(), applicationId: undefined},
    {...scope(), schema: 'inertia.funding-transport-scope.v1'}, {...scope(), purpose: 'durable-funding-review'},
    {...scope(), companyId: 'company'}, {...scope(), sourceScope: ' wrong'}, {...scope(), sourceScope: '界'.repeat(100)},
    {...scope(), destinationId: 'x'.repeat(129)}, {...scope(), opportunityExternalId: 'bad\nvalue'}]) {
    assert.throws(() => factory({...good, scope: bad}));
  }
});

test('verified Unicode acceptance projects stored eventId to exact frozen Task2 applied response', async () => {
  const a = acceptance(), r = response(), context = Object.freeze({currentReadAlreadyAuthorized: true});
  assert.equal(memberHash(a.intent), INTENT_HASH);
  assert.equal(memberHash(a), ACCEPTED_DIGEST);
  let calls = 0;
  const read = factory(config(async (sourceId, receivedContext) => {
    assert.equal(sourceId, SOURCE_ID); assert.equal(receivedContext, context); calls++;
    return r;
  }));
  const result = await read(a, context);
  assert.deepEqual(result, expected('applied'));
  assert.ok(Object.isFrozen(result)); assert.equal(calls, 1);
  assert.deepEqual(a, acceptance()); assert.deepEqual(r, response());
});

test('configuration, callback and native acceptance are snapshotted before awaiting durable read', async () => {
  const a = acceptance(); let release;
  const pending = new Promise(resolve => { release = resolve; });
  const settings = config(async () => pending), read = factory(settings);
  settings.scope.applicationId = 'other'; settings.readEnvelope = async () => { throw Error('replaced callback'); };
  settings.contracts.hash = () => '0'.repeat(64);
  const result = read(a, {});
  a.intent.payload.note = 'mutated in flight'; a.intentHash = '0'.repeat(64); a.source.id = 'other';
  release(response());
  assert.deepEqual(await result, expected('applied'));
});

test('only exact scoped terminal_missing means pending, never applied or rejected', async () => {
  const read = factory(config(async () => ({scope: scope(), envelope: {state: 'terminal_missing'}})));
  assert.equal(await read(acceptance()), null);
});

for (const envelope of [{state: 'disabled'}, {state: 'reconciliation_required', reason: 'scope_evidence_unavailable'},
  {state: 'reconciliation_required', reason: 'terminal_integrity_failed'}, {state: 'reconciliation_required', reason: 'scope_mismatch'},
  {state: 'rejected'}, {state: 'not_applied'}, {state: 'terminal_missing', injected: true},
  {state: 'reconciliation_required', reason: 'unknown'}, null, undefined]) {
  test(`non-success ${JSON.stringify(envelope)} remains reconciliation without effect evidence`, async () => {
    const read = factory(config(async () => ({scope: scope(), envelope})));
    assert.deepEqual(await read(acceptance()), expected('needs_reconciliation'));
  });
}

test('cancellation cannot become UI success or rejection without a qualified cancellation contract', async () => {
  const r = response(); r.envelope.outcome = {state: 'cancelled', sourceId: SOURCE_ID};
  assert.deepEqual(await factory(config(async () => r))(acceptance()), expected('needs_reconciliation'));
});

test('absent, malformed, throwing and unwrapped reads remain reconciliation', async () => {
  for (const r of [null, undefined, response().envelope, {...response(), extra: true}, JSON.stringify(response()),
    {scope: scope()}, {envelope: response().envelope}, {scope: scope(), envelope: {state: 'applied'}}]) {
    assert.deepEqual(await factory(config(async () => r))(acceptance()), expected('needs_reconciliation'));
  }
  const result = await factory(config(async () => { throw Error('private sensitive failure'); }))(acceptance());
  assert.deepEqual(result, expected('needs_reconciliation')); assert.ok(Object.isFrozen(result));
});

for (const key of Object.keys(scope())) {
  test(`response must match trusted ${key}, including pending readback`, async () => {
    for (const envelope of [response().envelope, {state: 'terminal_missing'}]) {
      const r = {scope: {...scope(), [key]: 'different'}, envelope};
      assert.deepEqual(await factory(config(async () => r))(acceptance()), expected('needs_reconciliation'));
    }
  });
}

const responseMutations = {
  'unknown wrapper field': r => { r.extra = true; },
  'unknown scope field': r => { r.scope.extra = true; },
  'wrong envelope schema': r => { r.envelope.schema = 'inertia.funding-outcome.v1'; },
  'unknown envelope field': r => { r.envelope.accepted = acceptance(); },
  'wrong source kind': r => { r.envelope.source.kind = 'buzz'; },
  'wrong source ID': r => { r.envelope.source.id = EFFECT_ID; },
  'unknown source field': r => { r.envelope.source.actor = 'human-1'; },
  'caller hash is not durable evidence': r => { r.envelope.intentHash = '0'.repeat(64); },
  'changed accepted digest': r => { r.envelope.acceptedDigest = '0'.repeat(64); },
  'missing accepted digest': r => { delete r.envelope.acceptedDigest; },
  'wrong durable source ID': r => { r.envelope.outcome.sourceId = EFFECT_ID; },
  'wrong durable action': r => { r.envelope.outcome.action = 'approve_packet'; },
  'wrong policy': r => { r.envelope.outcome.policyHash = '0'.repeat(64); },
  'wrong packet ID': r => { r.envelope.outcome.target.packetId = 'other'; },
  'wrong packet version': r => { r.envelope.outcome.target.packetVersion = 3; },
  'wrong packet hash': r => { r.envelope.outcome.target.packetContentHash = 'b'.repeat(64); },
  'unknown target field': r => { r.envelope.outcome.target.actor = 'human-1'; },
  'unknown outcome field': r => { r.envelope.outcome.authorized = true; },
  'missing effect': r => { delete r.envelope.outcome.eventId; },
  'non-UUID effect': r => { r.envelope.outcome.eventId = INTENT_HASH; },
  'unsupported rejected terminal': r => { r.envelope.outcome.state = 'rejected'; },
  'wrong effect type': r => { r.envelope.outcome.eventId = {id: EFFECT_ID}; },
};
for (const [name, mutate] of Object.entries(responseMutations)) test(name, async () => {
  const r = response(); mutate(r);
  assert.deepEqual(await factory(config(async () => r))(acceptance()), expected('needs_reconciliation'));
});

test('a different full acceptance with identical intent does not match acceptedDigest', async () => {
  for (const mutate of [a => { a.actor.userId = 'human-2'; a.authorization.actorUserId = 'human-2'; },
    a => { a.acceptedAt = '2026-10-24T12:31:00.000Z'; }, a => { a.authorization.membershipVersion = 'member-v2'; }]) {
    const a = acceptance(); mutate(a);
    assert.deepEqual(await factory(config(async () => response()))(a), expected('needs_reconciliation'));
  }
});

test('malformed native acceptance fails before invoking durable reader', async () => {
  const mutations = [a => { a.injected = true; }, a => { a.schema = 'inertia.funding-acceptance.v1'; },
    a => { a.source.kind = 'buzz'; }, a => { a.source.extra = true; }, a => { a.actor.type = 'agent'; },
    a => { a.actor.userId = 'other'; }, a => { a.authorization.verifiedDaoMember = false; },
    a => { a.authorization.extra = true; }, a => { a.intent.payload.note = 'changed without rehash'; },
    a => { a.intent.extra = true; }, a => { a.intent.target.extra = true; },
    a => { a.acceptedAt = '2026-02-30T12:00:00Z'; }, a => { a.intent.payload.note = '界'.repeat(667); },
    a => { a.intent.payload.note = '\ud800'; }];
  let calls = 0;
  const read = factory(config(async () => { calls++; return response(); }));
  for (const mutate of mutations) {
    const a = acceptance(); mutate(a);
    assert.deepEqual(await read(a), expected('needs_reconciliation'));
  }
  assert.equal(calls, 0);
});

test('Unicode exact byte limit passes while excess bytes cannot create an applied projection', async () => {
  for (const [note, state] of [['界'.repeat(666) + 'ab', 'applied'], ['界'.repeat(667), 'needs_reconciliation']]) {
    const a = acceptance(); a.intent.payload.note = note; a.intentHash = memberHash(a.intent);
    const r = response(); r.envelope.intentHash = a.intentHash; r.envelope.acceptedDigest = memberHash(a);
    const result = await factory(config(async () => r))(a);
    assert.equal(result.state, state); assert.equal(result.effectId, state === 'applied' ? EFFECT_ID : null);
  }
});

test('non-JSON fields, accessors and prototype objects cannot bypass strict durable response validation', async () => {
  const candidates = [];
  const symbol = response(); symbol.envelope[Symbol('hidden')] = true; candidates.push(symbol);
  const hidden = response(); Object.defineProperty(hidden.envelope, 'hidden', {value: true}); candidates.push(hidden);
  const exotic = response(); Object.setPrototypeOf(exotic.envelope, {kind: 'inherited'}); candidates.push(exotic);
  const accessor = response(); Object.defineProperty(accessor.envelope, 'intentHash', {enumerable: true, get() { throw Error('must not invoke accessor'); }}); candidates.push(accessor);
  const cycle = response(); cycle.envelope.outcome.target = cycle; candidates.push(cycle);
  for (const r of candidates) assert.deepEqual(await factory(config(async () => r))(acceptance()), expected('needs_reconciliation'));
});
