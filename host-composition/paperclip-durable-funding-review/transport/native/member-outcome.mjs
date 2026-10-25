/** Pure, opt-in durable readback correlation for the frozen Task2 readOutcome port.
 * No network, mount, source lookup, current-access decision or effect is created here.
 * The trusted readEnvelope port must obtain the owning service's authenticated,
 * scope-bound durable response. Matching caller hashes is not independent authority.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{64}$/;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const SCOPE_KEYS = ['schema', 'purpose', 'sourceId', 'destinationId', 'companyId', 'applicantId',
  'applicationId', 'opportunityNamespace', 'opportunityExternalId', 'sourceScope'];

function need(value) { if (!value) throw Error('Unverified member packet outcome'); }
function exact(value, keys) {
  need(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)));
  return value;
}
function identifier(value) {
  need(typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(value));
  return value;
}
function hash(value) { need(typeof value === 'string' && HASH.test(value)); return value; }

/** The port accepts decoded JSON objects, not raw JSON text. Duplicate-key and
 * pre-buffer byte enforcement belongs to its qualified transport decoder. Here
 * reject accessors, hidden/symbol fields, prototypes, invalid Unicode and cycles
 * before snapshotting; the exact protocol has no array-valued fields.
 */
function snapshot(raw, canonical) {
  const seen = new Set();
  function check(value, depth) {
    need(depth <= 16);
    if (value === null || typeof value === 'boolean') return;
    if (typeof value === 'number') { need(Number.isSafeInteger(value)); return; }
    if (typeof value === 'string') {
      need(value.isWellFormed() && Buffer.byteLength(value, 'utf8') <= MAX_RESPONSE_BYTES); return;
    }
    need(value && typeof value === 'object' && !Array.isArray(value) && !seen.has(value)
      && [Object.prototype, null].includes(Object.getPrototypeOf(value)));
    seen.add(value);
    for (const key of Reflect.ownKeys(value)) {
      need(typeof key === 'string' && key.isWellFormed());
      const property = Object.getOwnPropertyDescriptor(value, key);
      need(property?.enumerable && Object.hasOwn(property, 'value'));
      check(property.value, depth + 1);
    }
    seen.delete(value);
  }
  check(raw, 0);
  const text = canonical(raw);
  need(typeof text === 'string' && Buffer.byteLength(text, 'utf8') <= MAX_RESPONSE_BYTES);
  return JSON.parse(text);
}

function snapshotScope(raw, canonical) {
  const scope = exact(snapshot(raw, canonical), SCOPE_KEYS);
  for (const key of SCOPE_KEYS) identifier(scope[key]);
  need(scope.schema === 'inertia.member-packet-transport-scope.v2'
    && scope.purpose === 'member-packet-review' && UUID.test(scope.companyId));
  return Object.freeze(scope);
}

/** contracts are fixed in-process member codecs, not request/plugin configuration:
 * {canonical,hash,parseIntent,accessProof,target,timestamp}. In a compiled host these
 * are engine.canonicalJson and the corresponding member-review exports.
 * readEnvelope(sourceId, context) returns exactly {scope,envelope}. Context is
 * forwarded unchanged, never interpreted as a human grant by this adapter.
 * Disabled returns null (accepted_pending) without inspecting any other input.
 */
export function createMemberPacketOutcomeReader(config = {}) {
  if (config.enabled !== true) return Object.freeze(async () => null);
  const names = ['canonical', 'hash', 'parseIntent', 'accessProof', 'target', 'timestamp'];
  const contracts = config.contracts;
  need(contracts && names.every(key => typeof contracts[key] === 'function') && typeof config.readEnvelope === 'function');
  const c = Object.freeze(Object.fromEntries(names.map(key => [key, contracts[key].bind(contracts)])));
  const scope = snapshotScope(config.scope, c.canonical), scopeJson = c.canonical(scope);
  const readEnvelope = config.readEnvelope.bind(config);

  return Object.freeze(async function readOutcome(rawAcceptance, context) {
    // Correlation on uncertainty is not evidence of application. Unusable
    // correlation throws so the existing Task2 boundary handles reconciliation.
    const sourceId = rawAcceptance?.source?.id, intentHash = rawAcceptance?.intentHash;
    need(typeof sourceId === 'string' && UUID.test(sourceId)); hash(intentHash);
    const uncertain = () => Object.freeze({sourceId, intentHash, state: 'needs_reconciliation', effectId: null});
    try {
      const accepted = exact(snapshot(rawAcceptance, c.canonical),
        ['schema', 'source', 'acceptedAt', 'actor', 'authorization', 'intent', 'intentHash']);
      need(accepted.schema === 'inertia.member-packet-acceptance.v2');
      exact(accepted.source, ['kind', 'id']);
      need(accepted.source.kind === 'paperclip' && accepted.source.id === sourceId);
      exact(accepted.actor, ['type', 'userId']); need(accepted.actor.type === 'human');
      identifier(accepted.actor.userId); c.timestamp(accepted.acceptedAt);
      c.accessProof(accepted.authorization, accepted.actor.userId);
      // Syntax only: the full historical policy/scope evidence is owned and
      // verified by the durable reader, not reconstructed from a caller hash.
      const intent = c.parseIntent(accepted.intent, Object.freeze({policyHash: hash(accepted.intent?.policyHash)}));
      need(c.canonical(intent) === c.canonical(accepted.intent) && c.hash(intent) === intentHash);
      const acceptedDigest = c.hash(accepted);

      const result = exact(snapshot(await readEnvelope(sourceId, context), c.canonical), ['scope', 'envelope']);
      need(c.canonical(snapshotScope(result.scope, c.canonical)) === scopeJson);
      const envelope = result.envelope;
      if (envelope && Object.hasOwn(envelope, 'state')) {
        if (envelope.state === 'terminal_missing' || envelope.state === 'disabled') {
          exact(envelope, ['state']);
          // Missing is an observation, not a rejection or a guarantee that no
          // writer is in flight. It never authorizes a retry with a new source.
          return envelope.state === 'terminal_missing' ? null : uncertain();
        }
        exact(envelope, ['state', 'reason']);
        need(envelope.state === 'reconciliation_required'
          && ['scope_evidence_unavailable', 'terminal_integrity_failed', 'scope_mismatch'].includes(envelope.reason));
        return uncertain();
      }
      exact(envelope, ['schema', 'source', 'intentHash', 'acceptedDigest', 'outcome']);
      need(envelope.schema === 'inertia.member-packet-outcome-envelope.v2');
      exact(envelope.source, ['kind', 'id']);
      need(envelope.source.kind === 'paperclip' && envelope.source.id === sourceId
        && hash(envelope.intentHash) === intentHash && hash(envelope.acceptedDigest) === acceptedDigest);
      const outcome = exact(envelope.outcome, ['state', 'sourceId', 'eventId', 'action', 'target', 'policyHash']);
      // No cancellation contract and no authoritative rejected terminal exist
      // in this slice. Neither can be promoted to success or UI rejection.
      need(outcome.state === 'applied' && outcome.sourceId === sourceId && outcome.action === intent.action
        && outcome.policyHash === intent.policyHash && typeof outcome.eventId === 'string' && UUID.test(outcome.eventId)
        && c.canonical(c.target(outcome.target)) === c.canonical(intent.target));
      return Object.freeze({sourceId: envelope.source.id, intentHash: envelope.intentHash,
        state: 'applied', effectId: outcome.eventId});
    } catch {
      // Never echo response errors, private payloads, tokens or unverifiable effect IDs.
      return uncertain();
    }
  });
}
