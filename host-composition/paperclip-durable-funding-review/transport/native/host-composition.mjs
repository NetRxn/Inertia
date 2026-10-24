/** Trusted owning-host assembly. Importing it does not mount or schedule work. */
import {createAcceptanceRouter, snapshotScope} from './acceptance-routes.mjs';
import {createAcceptanceReconciler} from './reconcile.mjs';

export const reviewTransportJob = Object.freeze({jobKey: 'reconcile-funding-review', displayName: 'Reconcile accepted funding reviews',
  description: 'Manually reconcile exact native acceptances with the paired owning service.'});

/** Construct in trusted host/bootstrap code, never from plugin configuration or
 * request JSON. The host half stays in the server process. registerJob is for a
 * trusted worker bootstrap with its own approved local lifecycle capability;
 * functions and database handles are not serialized through plugin RPC.
 * No credentials, grants, archive policy, recurring schedule or default enable
 * flag are created by this assembly. */
export function createReviewTransportHost(config = {}) {
  if (config.enabled !== true) {
    return Object.freeze({appOptions: Object.freeze({}), jobs: Object.freeze([]), registerJob() {}});
  }
  if (!config.db || typeof config.capture?.readAcceptance !== 'function'
      || typeof config.capture?.listAcceptances !== 'function'
      || typeof config.lifecycle?.assertReadable !== 'function'
      || typeof config.lifecycle?.acknowledgeTerminal !== 'function'
      || typeof config.principal?.userId !== 'string' || !config.principal.userId
      || typeof config.principal?.keyId !== 'string' || !config.principal.keyId) {
    throw Error('Missing trusted review transport composition or lifecycle capability');
  }
  const scope = snapshotScope(config.scope);
  const lifecycle = Object.freeze({assertReadable: config.lifecycle.assertReadable.bind(config.lifecycle),
    acknowledgeTerminal: config.lifecycle.acknowledgeTerminal.bind(config.lifecycle)});
  const trusted = Object.freeze({...config, scope, lifecycle, principal: Object.freeze({...config.principal}),
    nativeSecretRef: structuredClone(config.nativeSecretRef), fundingSecretRef: structuredClone(config.fundingSecretRef)});
  // Validate endpoint/ref/budget settings before anything is mounted or registered.
  createAcceptanceReconciler({}, trusted);
  const router = createAcceptanceRouter(trusted);
  const beforeBodyParser = (req, res, next) => {
    // These routes are strictly bodyless. Reject framing/encoding without ever
    // attaching a body collector or invoking auth/domain services. Content-length
    // absent and transfer-encoding absent means HTTP has no framed request body.
    if (req.get('transfer-encoding') || req.get('content-encoding')
        || req.get('content-length') && req.get('content-length') !== '0') {
      res.set('Connection', 'close');
      res.status(400).json({error: 'request_body_not_allowed'});
      return;
    }
    next();
  };
  const appOptions = Object.freeze({fundingReviewTransport: Object.freeze({db: config.db, beforeBodyParser, router})});
  const registered = new WeakMap();
  return Object.freeze({appOptions, jobs: Object.freeze([reviewTransportJob]), registerJob(ctx) {
    if (typeof ctx?.jobs?.register !== 'function' || typeof ctx.http?.fetch !== 'function'
        || typeof ctx.secrets?.resolve !== 'function' || typeof ctx.state?.get !== 'function' || typeof ctx.state?.set !== 'function') {
      throw Error('Missing trusted review transport worker capabilities');
    }
    if (registered.has(ctx)) return;
    registerReviewTransportJob(ctx, trusted);
    registered.set(ctx, true);
  }});
}

/** Worker-local trusted composition. Lifecycle functions must be installed by
 * reviewed bootstrap code; they are never accepted from host/request JSON. The
 * existing native loader must already authorize this exact company's scope. */
export function registerReviewTransportJob(ctx, config = {}) {
  if (config.enabled !== true) return;
  if (typeof ctx?.jobs?.register !== 'function' || typeof ctx.http?.fetch !== 'function'
      || typeof ctx.secrets?.resolve !== 'function' || typeof ctx.state?.get !== 'function' || typeof ctx.state?.set !== 'function'
      || typeof config.lifecycle?.acknowledgeTerminal !== 'function') {
    throw Error('Missing trusted review transport worker or lifecycle capabilities');
  }
  const reconcile = createAcceptanceReconciler(ctx, config);
  ctx.jobs.register(reviewTransportJob.jobKey, async job => {
    if (job?.trigger !== 'manual') throw Error('Funding review reconciliation requires explicit manual invocation');
    const result = await reconcile();
    if (result.state !== 'ready' || !result.complete) throw Error('Funding review reconciliation remains pending; invoke manually again');
    return result;
  });
}
