/** Trusted owning-host composition, not a plugin tool or credential issuer. */
import {createHash} from 'node:crypto';
import {Router} from 'express';

export const MAX_RESPONSE_BYTES = 1024 * 1024;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SCOPE_KEYS = ['schema', 'sourceId', 'destinationId', 'companyId', 'applicantId', 'sourceScope', 'purpose'];

export function canonicalJson(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isSafeInteger(value)) return JSON.stringify(value);
  if (typeof value !== 'object') throw Error('Invalid canonical JSON value');
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

export function digestJson(value) {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

export function snapshotScope(scope) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)
      || Object.keys(scope).sort().join() !== [...SCOPE_KEYS].sort().join()
      || SCOPE_KEYS.some(key => typeof scope[key] !== 'string' || !scope[key].trim() || scope[key].length > 256 || /[\x00-\x1f\x7f]/.test(scope[key]) || scope[key] !== scope[key].trim())
      || scope.schema !== 'inertia.funding-transport-scope.v1'
      || scope.purpose !== 'durable-funding-review' || !UUID.test(scope.companyId)) {
    throw Error('Invalid trusted transport scope');
  }
  return Object.freeze({...scope});
}

export function receiptInScope(receipt, scope) {
  const command = receipt?.command;
  const binding = command?.binding;
  return receipt?.schema === 'inertia.funding-acceptance.v1'
    && typeof receipt.acceptanceId === 'string' && UUID.test(receipt.acceptanceId)
    && binding?.companyId === scope.companyId
    && binding?.applicantId === scope.applicantId
    && binding?.sourceScope === scope.sourceScope
    && typeof binding?.reviewerUserId === 'string' && binding.reviewerUserId.length > 0
    && command.actorUserId === binding.reviewerUserId;
}

/** Mount under /api/funding-review-transport AFTER the actual actorMiddleware.
 * Host config and current native board-key authentication are both necessary.
 * The dedicated transport reader is NOT the human who authorized the command.
 * lifecycle.assertReadable verifies the host's already-approved storage contract;
 * this adapter neither defines retention policy nor deletes/archives anything.
 */
export function createAcceptanceRouter(config = {}) {
  const router = Router();
  if (config.enabled !== true || typeof config.lifecycle?.assertReadable !== 'function') {
    router.use((_req, res) => res.status(503).json({error: 'transport_unconfigured'}));
    return router;
  }
  const scope = snapshotScope(config.scope);
  const scopeDigest = digestJson(scope);
  const principal = Object.freeze({...config.principal});
  if (!principal.userId || !principal.keyId || !config.db
      || typeof config.capture?.readAcceptance !== 'function'
      || typeof config.capture?.listAcceptances !== 'function') {
    throw Error('Missing trusted native transport composition');
  }
  const db = config.db;
  const read = config.capture.readAcceptance.bind(config.capture);
  const list = config.capture.listAcceptances.bind(config.capture);
  const assertReadable = config.lifecycle.assertReadable.bind(config.lifecycle);
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const actor = req.actor;
    if (actor?.type !== 'board' || actor.source !== 'board_key'
        || actor.userId !== principal.userId || actor.keyId !== principal.keyId
        || !Array.isArray(actor.companyIds) || !actor.companyIds.includes(scope.companyId)
        || req.get('X-Funding-Scope') !== scopeDigest) {
      res.status(403).json({error: 'transport_access_denied'}); return;
    }
    if (req.method !== 'GET') { res.status(405).json({error: 'method_not_allowed'}); return; }
    if (req.get('transfer-encoding') || req.get('content-length') && req.get('content-length') !== '0') {
      res.status(400).json({error: 'request_body_not_allowed'}); return;
    }
    next();
  });
  const send = (res, value) => {
    const body = JSON.stringify(value);
    if (Buffer.byteLength(body, 'utf8') > MAX_RESPONSE_BYTES) {
      res.status(502).json({error: 'transport_response_limit'}); return;
    }
    res.type('application/json').send(body);
  };
  const guarded = operation => async (req, res) => {
    try { await operation(req, res); }
    catch { res.status(503).json({error: 'transport_unavailable'}); }
  };
  const envelope = async receipt => {
    if (!receiptInScope(receipt, scope)) return null;
    const exact = structuredClone(receipt);
    if (await assertReadable({scope, receipt: structuredClone(exact)}) !== true) {
      throw Error('Approved lifecycle unavailable');
    }
    return {receipt: exact, receiptDigest: digestJson(exact)};
  };
  router.get('/scope', (req, res) => {
    if (Object.keys(req.query).length) { res.status(400).json({error: 'invalid_query'}); return; }
    send(res, {scope});
  });
  router.get('/acceptances', guarded(async (req, res) => {
    const {afterId, limit = '100'} = req.query;
    if (Object.keys(req.query).some(key => !['afterId', 'limit'].includes(key))
        || typeof limit !== 'string' || !/^[1-9][0-9]{0,2}$/.test(limit) || Number(limit) > 500
        || (afterId !== undefined && (typeof afterId !== 'string' || !UUID.test(afterId)))) {
      res.status(400).json({error: 'invalid_query'}); return;
    }
    // Preserve the source cursor even when another applicant's rows were filtered.
    const page = await list(db, {companyId: scope.companyId, applicantId: scope.applicantId, sourceScope: scope.sourceScope, afterId: afterId ?? null, limit: Number(limit)});
    const pageByteBudget = MAX_RESPONSE_BYTES - Number(limit) * 40 - 256;
    const receipts = [];
    const deferredAcceptanceIds = [];
    let nextCursor = page.nextCursor;
    let consumedId = afterId ?? null;
    const size = values => Buffer.byteLength(JSON.stringify({scope, receipts: values, deferredAcceptanceIds, nextCursor: page.nextCursor}), 'utf8');
    // Merge bounded source deferrals into the existing UUID progress order.
    // Do not expose a later deferred ID if the response budget stops earlier.
    const candidates = [...page.receipts.map(receipt => ({id: receipt.acceptanceId, receipt})),
      ...(page.deferredAcceptanceIds ?? []).map(id => ({id, receipt: null}))]
      .sort((a, b) => a.id.localeCompare(b.id));
    for (const candidate of candidates) {
      if (candidate.receipt === null) {
        deferredAcceptanceIds.push(candidate.id); consumedId = candidate.id; continue;
      }
      const receipt = candidate.receipt;
      const value = await envelope(receipt);
      if (value) {
        if (size([value]) > pageByteBudget) {
          // No authority/effect is discarded: expose the unresolved ID and retry
          // it on subsequent full sweeps, without starving independent receipts.
          deferredAcceptanceIds.push(receipt.acceptanceId);
        } else if (size([...receipts, value]) > pageByteBudget) {
          nextCursor = consumedId;
          break;
        } else {
          receipts.push(value);
        }
      }
      consumedId = receipt.acceptanceId;
    }
    send(res, {scope, receipts, deferredAcceptanceIds, nextCursor});
  }));
  router.get('/acceptances/:id', guarded(async (req, res) => {
    if (!UUID.test(req.params.id) || Object.keys(req.query).length) {
      res.status(400).json({error: 'invalid_acceptance_identity'}); return;
    }
    const value = await envelope(await read(db, req.params.id));
    if (!value) { res.status(404).json({error: 'acceptance_not_found'}); return; }
    send(res, {scope, ...value});
  }));
  router.use((_req, res) => res.status(404).json({error: 'transport_route_not_found'}));
  return router;
}
