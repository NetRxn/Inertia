import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {request as httpRequest} from 'node:http';
import {gzipSync} from 'node:zlib';
import {setTimeout as delay} from 'node:timers/promises';
import {eq} from 'drizzle-orm';
import {authUsers, companyMemberships, plugins, pluginJobs, pluginJobRuns, pluginState} from '@paperclipai/db';
import {createApp} from '../../node_modules/@paperclipai/server/dist/app.js';
import {boardAuthService} from '../../node_modules/@paperclipai/server/dist/services/board-auth.js';
import {pluginJobStore} from '../../node_modules/@paperclipai/server/dist/services/plugin-job-store.js';
import {createPluginJobScheduler} from '../../node_modules/@paperclipai/server/dist/services/plugin-job-scheduler.js';
import {fixture, db, client} from '../../tests/fixture.mjs';
import {digestJson} from '../native/acceptance-routes.mjs';
import {createHostClientHandlers} from '@paperclipai/plugin-sdk';
import {createPluginWorkerManager} from '../../node_modules/@paperclipai/server/dist/services/plugin-worker-manager.js';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs/promises';
import {buildHostServices} from '../../node_modules/@paperclipai/server/dist/services/plugin-host-services.js';
import {createPluginEventBus} from '../../node_modules/@paperclipai/server/dist/services/plugin-event-bus.js';
import {createFundingReviewCapture} from '../../node_modules/@paperclipai/server/dist/services/funding-review-capture.js';
import {issueThreadInteractionService} from '../../node_modules/@paperclipai/server/dist/services/issue-thread-interactions.js';
import {binding} from '../../tests/fixture.mjs';
import {qualificationRetention} from '../../tests/retention.mjs';
const mod = await import('../native/host-composition.mjs').catch(error => error.code === 'ERR_MODULE_NOT_FOUND' ? {} : Promise.reject(error));
after(() => client.end());

async function config() {
  assert.equal(typeof mod.createReviewTransportHost, 'function', 'trusted owning-host assembly exists');
  const f = await fixture();
  const userId = randomUUID();
  await db.insert(authUsers).values({id: userId, name: 'Synthetic review transport reader', email: `${userId}@example.invalid`, createdAt: new Date(), updatedAt: new Date()});
  await db.insert(companyMemberships).values({companyId: f.companyId, principalType: 'user', principalId: userId, status: 'active', membershipRole: 'member'});
  const auth = boardAuthService(db);
  const key = await auth.createNamedBoardApiKey({userId, name: 'Synthetic bounded review transport'});
  const scope = {schema: 'inertia.funding-transport-scope.v1', sourceId: 'synthetic-native', destinationId: 'synthetic-funding', companyId: f.companyId, applicantId: 'applicant-1', sourceScope: 'source-1', purpose: 'durable-funding-review'};
  let reads = 0;
  const value = {enabled: true, db, scope, principal: {userId, keyId: key.id},
    capture: {readAcceptance: async () => { reads++; return null; }, listAcceptances: async () => { reads++; return {receipts: [], nextCursor: null}; }},
    lifecycle: {assertReadable: async () => true, acknowledgeTerminal: async () => {}},
    nativeUrl: 'https://native.example/api/funding-review-transport', fundingUrl: 'https://funding.example/funding-review-transport',
    nativeSecretRef: {type: 'secret_ref', secretId: 'native-existing'}, fundingSecretRef: {type: 'secret_ref', secretId: 'funding-existing'}};
  return {f, value, scope, userId, key, auth, reads: () => reads};
}

async function appFixture(x, changes = {}) {
  const host = mod.createReviewTransportHost(x.value);
  let sessionCalls = 0;
  const app = await createApp(db, {uiMode: 'none', serverPort: 0, storageService: {}, deploymentMode: 'authenticated', deploymentExposure: 'private',
    allowedHostnames: ['127.0.0.1'], bindHost: '127.0.0.1', authReady: true, companyDeletionEnabled: false, decisionServiceOptions: {},
    managedPluginAutoInstall: [], localPluginDir: `${process.env.NATIVE_CAPTURE_FIXTURE_ROOT}/plugins`,
    resolveSession: async () => { sessionCalls++; return {session: {id: 'synthetic-session'}, user: {id: x.userId}}; },
    ...host.appOptions, ...changes});
  await app.locals.bundledPluginsStartup;
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const url = `http://127.0.0.1:${server.address().port}/api/funding-review-transport`;
  const headers = {authorization: `Bearer ${x.key.token}`, 'X-Funding-Scope': digestJson(x.scope)};
  return {host, url, headers, sessionCalls: () => sessionCalls, request: (path, options = {}) => fetch(url + path, {...options, headers: {...headers, ...options.headers}}),
    async close() { await new Promise(resolve => server.close(resolve)); await app.locals.paperclipShutdown(); }};
}

function bodyRequest(x, headers, chunks) {
  return new Promise((resolve, reject) => {
    const request = httpRequest(x.url + '/acceptances', {method: 'GET', headers: {...x.headers, ...headers}}, response => {
      response.resume(); response.on('end', () => resolve(response.statusCode));
    });
    request.on('error', reject);
    for (const chunk of chunks) request.write(chunk);
    request.end();
  });
}

test('disabled host assembly has no mount, jobs, secrets, state or network side effects', async () => {
  assert.equal(typeof mod.createReviewTransportHost, 'function', 'trusted owning-host assembly exists');
  let effects = 0;
  const ctx = {jobs: {register() { effects++; }}, secrets: {resolve() { effects++; }}, http: {fetch() { effects++; }}, state: {get() { effects++; }, set() { effects++; }}};
  const host = mod.createReviewTransportHost();
  assert.deepEqual(host.appOptions, {});
  assert.deepEqual(host.jobs, []);
  host.registerJob(ctx);
  assert.equal(effects, 0);
});

test('enabled assembly rejects missing trusted lifecycle, capture, principal and worker capabilities', async () => {
  const x = await config();
  for (const changes of [{lifecycle: {}}, {capture: {}}, {principal: {}}, {db: null}]) {
    assert.throws(() => mod.createReviewTransportHost({...x.value, ...changes}), /trusted|lifecycle|composition/i);
  }
  const host = mod.createReviewTransportHost(x.value);
  assert.throws(() => host.registerJob({jobs: {register() {}}}), /capabilit/i);
  await assert.rejects(createApp(db, {fundingReviewTransport: {db: {}, beforeBodyParser() {}, router() {}}}), /ownership|composition/i);
});

test('actual owning app keeps exact native board-key auth, current membership and immutable scope', async () => {
  const x = await config();
  const a = await appFixture(x);
  try {
    x.value.scope.destinationId = 'mutated'; x.value.principal.userId = 'mutated';
    assert.equal((await a.request('/scope')).status, 200);
    assert.equal((await a.request('/scope', {headers: {authorization: ''}})).status, 403, 'session authority is not transport authority');
    assert.equal((await a.request('/scope', {headers: {'X-Funding-Scope': '0'.repeat(64)}})).status, 403);
    const other = await x.auth.createNamedBoardApiKey({userId: x.userId, name: 'Other synthetic key'});
    assert.equal((await a.request('/scope', {headers: {authorization: `Bearer ${other.token}`}})).status, 403);
    assert.notEqual((await a.request('/scope', {headers: {authorization: 'Bearer synthetic-invalid'}})).status, 200);
    await db.update(companyMemberships).set({status: 'inactive'}).where(eq(companyMemberships.principalId, x.userId));
    assert.equal((await a.request('/scope')).status, 403);
    await x.auth.revokeBoardApiKey(x.key.id);
    assert.notEqual((await a.request('/scope')).status, 200);
    assert.equal(x.reads(), 0);
  } finally { await a.close(); }
});

test('bodyless ingress rejects declared, chunked and compressed input before global JSON parsing or domain calls', async () => {
  const x = await config();
  const a = await appFixture(x);
  try {
    const before = a.sessionCalls();
    assert.equal(await bodyRequest(a, {'content-type': 'application/json', 'content-length': '1048577'}, ['{']), 400);
    assert.equal(await bodyRequest(a, {'content-type': 'application/json', 'transfer-encoding': 'chunked'}, ['{', '"scope":"forged"}']), 400);
    const zipped = gzipSync(Buffer.alloc(2 * 1024 * 1024, 120));
    assert.equal(await bodyRequest(a, {'content-type': 'application/json', 'content-encoding': 'gzip', 'content-length': String(zipped.length)}, [zipped]), 400);
    assert.equal(a.sessionCalls(), before, 'no authentication work is needed for body rejection');
    assert.equal(x.reads(), 0);
  } finally { await a.close(); }
});

test('stock hostname and warm-standby gates still precede native authentication and receipt reads', async () => {
  const x = await config();
  const a = await appFixture(x);
  try {
    const before = a.sessionCalls();
    assert.notEqual(await bodyRequest(a, {host: 'untrusted.invalid', authorization: ''}, []), 200);
    assert.equal(a.sessionCalls(), before);
    assert.equal(x.reads(), 0);
  } finally { await a.close(); }
  const standby = await appFixture(x, {cloudWarmStandby: () => true});
  try {
    assert.notEqual((await standby.request('/scope', {headers: {authorization: ''}})).status, 200);
    assert.equal(standby.sessionCalls(), 0);
  } finally { await standby.close(); }
});

test('manual-only job uses actual native SDK and scheduler with no recurring schedule', async () => {
  const x = await config();
  assert.equal(typeof mod.registerReviewTransportJob, 'function', 'trusted worker-local registration exists');
  const host = mod.createReviewTransportHost(x.value);
  let requests = 0;
  let states = 0;
  let secrets = 0;
  const capture = createFundingReviewCapture({registrations: [binding(x.f)], rolePermissionKeys: {program: 'funding.review.program'}, retention: qualificationRetention});
  await issueThreadInteractionService(db, {captureItemVerdictsInTransaction: capture.captureInTransaction}).submitItemVerdicts(x.f.issue, x.f.interactionId, x.f.input, x.f.actor);
  const [receipt] = (await capture.listAcceptances(db, {companyId: x.scope.companyId})).receipts;
  const receiptDigest = digestJson(receipt);
  const pluginId = randomUUID();
  const services = buildHostServices(db, pluginId, 'netrxn.inertia', createPluginEventBus(), undefined,
    {httpLimits: {maxRequestBytes: 8192, maxResponseBytes: 1048576, timeoutMs: 15000}});
  const state = services.state;
  services.state = {...state, async delete(params) { states++; await delay(10); return state.delete(params); }, async get(params) { states++; await delay(10); return state.get(params); }, async set(params) { states++; await delay(10); return state.set(params); }};
  services.secrets = {async resolve() { secrets++; await delay(10); return 'synthetic-token'; }};
  services.http = {async fetch({url}) {
    requests++; await delay(10);
    let value;
    if (url.endsWith('/scope')) value = {scope: x.scope};
    else if (url.includes('/acceptances?')) value = {scope: x.scope, receipts: [{receipt, receiptDigest}], nextCursor: null};
    else if (url.endsWith('/apply')) throw Error('Synthetic committed response loss');
    else if (url.endsWith('/outcome')) value = {scope: x.scope, acceptanceId: receipt.acceptanceId, receiptDigest, state: 'applied'};
    else throw Error('Unexpected fixture request');
    return {status: 200, statusText: 'OK', headers: {'content-type': 'application/json'}, body: JSON.stringify(value)};
  }};
  const acknowledgementPath = `${process.env.NATIVE_CAPTURE_FIXTURE_ROOT}/synthetic-acknowledgement.jsonl`;
  const manifest = {id: 'netrxn.inertia', apiVersion: 1, version: '0.0.0', displayName: 'Synthetic bounded review', author: 'Synthetic', categories: ['connector'],
    capabilities: ['http.outbound', 'secrets.read-ref', 'plugin.state.read', 'plugin.state.write'], entrypoints: {worker: 'unused'}, jobs: host.jobs};
  const manager = createPluginWorkerManager();
  const workerOptions = {entrypointPath: fileURLToPath(new URL('./manual-review-worker.mjs', import.meta.url)), manifest, config: {}, apiVersion: 1,
    instanceInfo: {instanceId: 'synthetic', hostVersion: '2026.1012.0'}, proactiveCompanyScopes: [x.scope.companyId],
    hostHandlers: createHostClientHandlers({pluginId, capabilities: manifest.capabilities, services}),
    env: {NATIVE_CAPTURE_FIXTURE_ROOT: process.env.NATIVE_CAPTURE_FIXTURE_ROOT, REVIEW_WORKER_SCOPE: JSON.stringify(x.scope), REVIEW_WORKER_ACK_FILE: acknowledgementPath}, autoRestart: false};
  await manager.startWorker(pluginId, workerOptions);
  await db.insert(plugins).values({id: pluginId, pluginKey: `synthetic.review.${pluginId}`, packageName: 'synthetic-review', version: '0.0.0', manifestJson: {jobs: host.jobs}, status: 'ready'});
  const store = pluginJobStore(db);
  await store.syncJobDeclarations(pluginId, host.jobs);
  const [job] = await db.select().from(pluginJobs).where(eq(pluginJobs.pluginId, pluginId));
  const scheduler = createPluginJobScheduler({db, jobStore: store, workerManager: manager});
  try {
    assert.equal(job.schedule, '');
    assert.equal(job.nextRunAt, null);
    await scheduler.tick();
    assert.equal(requests, 0, 'native scheduler never schedules this declaration');
    await assert.rejects(manager.call(pluginId, 'runJob', {job: {jobKey: job.jobKey, trigger: 'scheduled'}}), /manual/i);
    const started = performance.now();
    const {runId} = await scheduler.triggerJob(job.id);
    let run;
    do { await delay(10); [run] = await db.select().from(pluginJobRuns).where(eq(pluginJobRuns.id, runId)); } while (['pending', 'queued', 'running'].includes(run.status) && performance.now() - started < 3000);
    assert.equal(run.status, 'succeeded');
    assert.equal(requests, 5, 'lost-response readback stays within the six-request budget');
    assert.equal(secrets, 5);
    assert.deepEqual(await db.select().from(pluginState).where(eq(pluginState.pluginId, pluginId)), [], 'native delete resets the completed sweep using its existing write capability');
    assert.deepEqual(JSON.parse((await fs.readFile(acknowledgementPath, 'utf8')).trim()), {acceptanceId: receipt.acceptanceId, state: 'applied'});
    assert.ok(states >= 2);
    assert.ok(performance.now() - started < 3000, 'synthetic secret/state/HTTP latency fits native five-minute budget');
    // Restart the actual worker, retaining the same native PostgreSQL state.
    // Repeating a full sweep must neither stick behind SQL NULL nor preserve a
    // permanent high-water mark. Terminal acknowledgement is an idempotent file
    // replacement in this disposable fixture, never archival/deletion policy.
    await manager.stopWorker(pluginId);
    await manager.startWorker(pluginId, workerOptions);
    const restartedAt = performance.now();
    const second = await scheduler.triggerJob(job.id);
    do { await delay(10); [run] = await db.select().from(pluginJobRuns).where(eq(pluginJobRuns.id, second.runId)); } while (['pending', 'queued', 'running'].includes(run.status) && performance.now() - restartedAt < 3000);
    assert.equal(run.status, 'succeeded');
    assert.equal(requests, 10);
    assert.deepEqual(await db.select().from(pluginState).where(eq(pluginState.pluginId, pluginId)), []);
    assert.deepEqual(JSON.parse((await fs.readFile(acknowledgementPath, 'utf8')).trim()), {acceptanceId: receipt.acceptanceId, state: 'applied'});
  } finally { scheduler.stop(); await manager.stopAll(); services.dispose(); await db.delete(plugins).where(eq(plugins.id, pluginId)); }
});


test('default owning-app startup leaves the review transport unmounted and local-board authority is rejected', async () => {
  const x = await config();
  const disabled = await appFixture({...x, value: {enabled: false}});
  try { assert.equal((await disabled.request('/scope')).status, 404); assert.equal(x.reads(), 0); }
  finally { await disabled.close(); }
  const local = await appFixture(x, {deploymentMode: 'local_trusted'});
  try { assert.equal((await local.request('/scope', {headers: {authorization: ''}})).status, 403); }
  finally { await local.close(); }
});
