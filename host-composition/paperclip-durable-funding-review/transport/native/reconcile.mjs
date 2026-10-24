/** Bounded job body. Does not create schedules, credentials, approval UI, or ledgers. */
import {MAX_RESPONSE_BYTES, UUID, canonicalJson, digestJson, receiptInScope, snapshotScope} from './acceptance-routes.mjs';

function endpoint(raw, path, fixtureLoopback) {
  const url = new URL(raw);
  if (url.username || url.password || url.search || url.hash || url.pathname.replace(/\/$/, '') !== path) {
    throw Error('Invalid trusted transport endpoint');
  }
  if (url.protocol !== 'https:' && !(fixtureLoopback === true && url.protocol === 'http:' && url.hostname === '127.0.0.1')) {
    throw Error('Transport requires HTTPS; numeric loopback is fixture-only');
  }
  return url.origin + path;
}

async function boundedJson(response) {
  if (response.status !== 200 || !response.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw Error('Transport response rejected');
  }
  const declared = response.headers.get('content-length');
  if (declared && (!/^[0-9]+$/.test(declared) || Number(declared) > MAX_RESPONSE_BYTES)) throw Error('Transport response limit');
  const reader = response.body?.getReader();
  if (!reader) throw Error('Missing transport response');
  const parts = []; let total = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) throw Error('Transport response limit');
      parts.push(Buffer.from(value));
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(Buffer.concat(parts)));
}

/** ctx uses the existing SDK's http, secrets, and state capabilities.
 * Supply this callable to an ALREADY approved native job; no job is registered here.
 * A cursor is only scan progress, never delivery/approval/effect authority.
 * The host lifecycle callback must be idempotent and own its approved archive policy.
 */
export function createAcceptanceReconciler(ctx, config = {}) {
  if (config.enabled !== true || typeof config.lifecycle?.acknowledgeTerminal !== 'function') {
    return async () => ({state: 'disabled', acknowledged: 0, complete: false});
  }
  const scope = snapshotScope(config.scope);
  const scopeDigest = digestJson(scope);
  const nativeUrl = endpoint(config.nativeUrl, '/api/funding-review-transport', config.fixtureLoopback);
  const fundingUrl = endpoint(config.fundingUrl, '/funding-review-transport', config.fixtureLoopback);
  const nativeRef = structuredClone(config.nativeSecretRef);
  const fundingRef = structuredClone(config.fundingSecretRef);
  for (const ref of [nativeRef, fundingRef]) {
    if (ref?.type !== 'secret_ref' || typeof ref.secretId !== 'string' || !ref.secretId) throw Error('Require existing secret references');
  }
  const pageSize = config.pageSize ?? 100;
  const maxPages = config.maxPages ?? 5;
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 500
      || !Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > 20) throw Error('Invalid bounded sweep size');
  const acknowledge = config.lifecycle.acknowledgeTerminal.bind(config.lifecycle);
  const cursorKey = Object.freeze({scopeKind: 'company', scopeId: scope.companyId, namespace: 'funding-review-transport', stateKey: `scan:${scopeDigest}`});
  const exactScope = result => result && canonicalJson(result.scope) === canonicalJson(scope);
  const rawRequest = async (native, path, method = 'GET') => {
    const secret = await ctx.secrets.resolve(native ? nativeRef : fundingRef, {companyId: scope.companyId});
    if (typeof secret !== 'string' || !secret || /[\r\n]/.test(secret)) throw Error('Transport credential unavailable');
    const headers = {'X-Funding-Scope': scopeDigest, Accept: 'application/json'};
    headers[native ? 'Authorization' : 'X-Admin-Token'] = native ? `Bearer ${secret}` : secret;
    // Actual pinned SDK uses a single pinned-IP request and does not follow redirects.
    // redirect/error and timeout also protect direct standard-fetch host compositions.
    const response = await ctx.http.fetch((native ? nativeUrl : fundingUrl) + path,
      {method, headers, redirect: 'error', signal: AbortSignal.timeout(15_000)});
    return boundedJson(response);
  };
  const terminal = (value, envelope) => exactScope(value)
    && value.acceptanceId === envelope.receipt.acceptanceId
    && value.receiptDigest === envelope.receiptDigest
    && ['applied', 'cancelled'].includes(value.state);
  return async function reconcile() {
    let acknowledged = 0;
    let pending = 0;
    let requests = 0;
    const progress = complete => ({state: pending ? 'pending' : 'ready', acknowledged, pending, complete});
    const request = (...args) => {
      if (requests >= 6) throw Error('Invocation HTTP budget exhausted');
      requests++;
      return rawRequest(...args);
    };
    try {
      // Neither one-sided configuration nor an agent event can establish pairing.
      if (!exactScope(await request(true, '/scope')) || !exactScope(await request(false, '/scope'))) throw Error('Scope handshake mismatch');
      let cursor = await ctx.state.get(cursorKey) ?? null;
      if (cursor !== null && (typeof cursor !== 'string' || !UUID.test(cursor))) cursor = null;
      for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
        if (requests >= 6) return progress(false);
        const query = `?limit=${pageSize}${cursor ? `&afterId=${encodeURIComponent(cursor)}` : ''}`;
        const page = await request(true, '/acceptances' + query);
        if (!exactScope(page) || !Array.isArray(page.receipts) || page.receipts.length > pageSize
            || !(page.nextCursor === null || typeof page.nextCursor === 'string' && UUID.test(page.nextCursor))
            || page.nextCursor !== null && cursor !== null && page.nextCursor <= cursor) throw Error('Malformed acceptance page');
        const deferred = page.deferredAcceptanceIds ?? [];
        if (!Array.isArray(deferred)) throw Error('Malformed deferred acceptance page');
        const ids = [...page.receipts.map(item => item?.receipt?.acceptanceId), ...deferred];
        if ( ids.length > pageSize || new Set(ids).size !== ids.length
            || ids.some(id => typeof id !== 'string' || !UUID.test(id)
              || cursor !== null && id <= cursor || page.nextCursor !== null && id > page.nextCursor)) {
          throw Error('Malformed deferred acceptance page');
        }
        for (const envelope of page.receipts) {
          if (!receiptInScope(envelope?.receipt, scope) || digestJson(envelope.receipt) !== envelope.receiptDigest
              || cursor !== null && envelope.receipt.acceptanceId <= cursor
              || page.nextCursor !== null && envelope.receipt.acceptanceId > page.nextCursor) throw Error('Receipt provenance mismatch');
        }
        const envelopes = new Map(page.receipts.map(item => [item.receipt.acceptanceId, item]));
        for (const id of ids.sort()) {
          const envelope = envelopes.get(id);
          if (!envelope) {
            pending++;
            await ctx.state.set(cursorKey, id);
            continue;
          }
          // Reserve the uncertain-result readback before starting an effect.
          if (requests + 2 > 6) return progress(false);
          try {
            const path = `/acceptances/${envelope.receipt.acceptanceId}`;
            let outcome;
            try { outcome = await request(false, path + '/apply', 'POST'); }
            catch { outcome = await request(false, path + '/outcome'); }
            if (!terminal(outcome, envelope)) throw Error('Funding outcome unresolved');
            await acknowledge({scope, receipt: structuredClone(envelope.receipt), receiptDigest: envelope.receiptDigest, outcome: structuredClone(outcome)});
            acknowledged++;
          } catch {
            // A stale/rejected instruction must not starve independent later work.
            // It is NOT acknowledged: the next complete sweep retries it.
            pending++;
          }
          await ctx.state.set(cursorKey, id);
        }
        // This is scan progress, not delivery proof. Advance past unresolved rows
        // and reset after exhaustion; DFW alone owns terminal effects and dedup.
        cursor = page.nextCursor;
        await ctx.state.set(cursorKey, cursor);
        if (cursor === null) return progress(true);
      }
      return progress(false);
    } catch {
      // Never echo URLs, tokens, payloads, external errors, or applicant facts.
      return {state: 'pending', acknowledged, complete: false};
    }
  };
}
