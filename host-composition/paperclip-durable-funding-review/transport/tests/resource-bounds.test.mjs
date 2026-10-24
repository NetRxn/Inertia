import test, {afterEach, mock} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns/promises';
import {syncBuiltinESMExports} from 'node:module';
import {PassThrough, Writable} from 'node:stream';
import {setTimeout as delay} from 'node:timers/promises';
import {buildHostServices} from '../../node_modules/@paperclipai/server/dist/services/plugin-host-services.js';
import {createPluginEventBus} from '../../node_modules/@paperclipai/server/dist/services/plugin-event-bus.js';
import {sdkFixture} from './sdk-fixture.mjs';

const LIMIT = 1024 * 1024;
afterEach(() => { mock.restoreAll(); syncBuiltinESMExports(); });

/** Only the OS network edge is synthetic. The pinned host, byte collector,
 * DNS validation, SDK handlers and actual JSON-RPC encoding remain real.
 * No public/private network target is contacted by these fixtures. */
function network(scenario = {}) {
  const requests = [];
  const lookups = [];
  mock.method(dns, 'lookup', async hostname => {
    lookups.push(hostname);
    if (scenario.dnsDelay) await delay(scenario.dnsDelay);
    return scenario.addresses ?? [{address: '203.0.113.7', family: 4}];
  });
  const request = (options, callback) => {
    const response = new PassThrough();
    response.headers = scenario.headers ?? {'content-type': 'application/json'};
    response.statusCode = scenario.status ?? 200;
    response.statusMessage = 'Synthetic';
    let timer;
    const req = new Writable({autoDestroy: false, write(_chunk, _encoding, done) { done(); }, final(done) {
      done();
      queueMicrotask(() => {
        if (req.destroyed) return;
        callback(response);
        timer = setTimeout(() => {
          if (response.destroyed) return;
          if (scenario.chunks) {
            for (const chunk of scenario.chunks) { if (response.destroyed) break; response.write(chunk); }
            if (!response.destroyed) response.end();
          } else if (!scenario.stall) response.end(scenario.body ?? '{}');
        }, scenario.bodyDelay ?? 0);
      });
    }});
    const abort = () => { req.destroy(new Error('Synthetic socket aborted')); response.destroy(new Error('Synthetic socket aborted')); };
    options.signal?.addEventListener('abort', abort, {once: true});
    response.once('close', () => { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); });
    requests.push({options, req, response});
    return req;
  };
  mock.method(http, 'request', request);
  mock.method(https, 'request', request);
  syncBuiltinESMExports();
  return {requests, lookups};
}

async function fixture(scenario, overrides = {}) {
  const net = network(scenario);
  const limits = {maxRequestBytes: 8192, maxResponseBytes: LIMIT, timeoutMs: 100, ...overrides};
  const services = buildHostServices({}, 'synthetic-review', 'netrxn.inertia', createPluginEventBus(), undefined, {httpLimits: limits});
  const sdk = await sdkFixture({services});
  return {...net, ...sdk, limits, close() { for (const item of net.requests) { item.response.destroy(); item.req.destroy(); } sdk.close(); services.dispose(); }};
}

// Missing declared-length rejection currently allows a result to cross RPC.
test('declared oversized response is destroyed before body collection or RPC result', async () => {
  const x = await fixture({headers: {'content-type': 'application/json', 'content-length': String(LIMIT + 1)}});
  try {
    await assert.rejects(x.ctx.http.fetch('https://review.example/scope'), /response.*limit|exceeded/i);
    assert.equal(x.requests[0].response.destroyed, true);
    assert.equal(x.messages.filter(x => x.direction === 'host' && x.message.result?.body).length, 0);
  } finally { x.close(); }
});

test('chunked overflow aborts before concatenation and only a small error crosses RPC', async () => {
  const x = await fixture({chunks: Array.from({length: 70}, () => Buffer.alloc(16384, 120))});
  try {
    await assert.rejects(x.ctx.http.fetch('https://review.example/acceptances'), /response.*limit|exceeded/i);
    assert.equal(x.requests[0].response.destroyed, true);
    const replies = x.messages.filter(x => x.direction === 'host');
    assert.ok(replies.every(reply => reply.bytes < 1024));
  } finally { x.close(); }
});

test('absolute host deadline covers DNS and socket, independent of omitted SDK AbortSignal', async () => {
  const x = await fixture({dnsDelay: 80, bodyDelay: 80}, {timeoutMs: 110});
  const started = performance.now();
  try {
    await assert.rejects(x.ctx.http.fetch('https://review.example/scope'), /abort|deadline|timed out/i);
    assert.ok(performance.now() - started < 155, 'DNS plus socket must not restart the deadline');
    assert.equal(x.requests[0].req.destroyed, true);
  } finally { x.close(); }
});

test('deadline during DNS never starts a late socket after lookup settles', async () => {
  const x = await fixture({dnsDelay: 100}, {timeoutMs: 25});
  try {
    await assert.rejects(x.ctx.http.fetch('https://review.example/scope'), /abort|deadline|timed out/i);
    await delay(110);
    assert.equal(x.requests.length, 0);
  } finally { x.close(); }
});

test('request metadata and body caps reject before DNS or socket allocation', async () => {
  const x = await fixture({});
  try {
    for (const init of [{body: 'x'.repeat(8193), method: 'POST'}, {headers: {authorization: 'x'.repeat(8193)}}, {headers: {'content-length': '8193'}}]) {
      await assert.rejects(x.ctx.http.fetch('https://review.example/scope', init), /request.*limit|exceeded/i);
    }
    assert.equal(x.lookups.length, 0);
    assert.equal(x.requests.length, 0);
  } finally { x.close(); }
});

test('compressed responses are rejected without decompression or buffered RPC body', async () => {
  const x = await fixture({headers: {'content-type': 'application/json', 'content-encoding': 'gzip'}});
  try { await assert.rejects(x.ctx.http.fetch('https://review.example/scope'), /encoding|compression/i); }
  finally { x.close(); }
});

test('bounded success preserves resolved IP, Host, TLS servername and one-request redirects', async () => {
  const x = await fixture({body: '{"ok":true}', status: 302, headers: {'content-type': 'application/json', location: 'https://other.example/'}});
  try {
    const response = await x.ctx.http.fetch('https://review.example:8443/scope');
    assert.equal(response.status, 302);
    assert.equal(await response.text(), '{"ok":true}');
    assert.equal(x.requests.length, 1);
    assert.equal(x.lookups.length, 1);
    assert.equal(x.requests[0].options.maxHeaderSize, 8192, 'response header parser is bounded before RPC');
    assert.equal(x.requests[0].options.host, '203.0.113.7');
    assert.equal(x.requests[0].options.headers.host, 'review.example:8443');
    assert.equal(x.requests[0].options.servername, 'review.example');
    assert.equal(x.requests[0].options.rejectUnauthorized, undefined, 'native TLS verification default is unchanged');
  } finally { x.close(); }
});

test('existing private-only DNS restriction remains closed before any socket', async () => {
  const x = await fixture({addresses: [{address: '127.0.0.1', family: 4}]});
  try { await assert.rejects(x.ctx.http.fetch('https://review.example/scope'), /private\/reserved/); assert.equal(x.requests.length, 0); }
  finally { x.close(); }
});

test('trusted host limits are validated and snapshotted rather than worker-controlled', async () => {
  for (const limits of [{maxRequestBytes: 0, maxResponseBytes: LIMIT, timeoutMs: 100}, {maxRequestBytes: 8192, maxResponseBytes: LIMIT + 1, timeoutMs: 100}, {maxRequestBytes: 8192, maxResponseBytes: LIMIT, timeoutMs: 30001}]) {
    assert.throws(() => buildHostServices({}, 'synthetic-review', 'netrxn.inertia', createPluginEventBus(), undefined, {httpLimits: limits}), /HTTP.*limit/i);
  }
});

test('review reconciler caps credential/request metadata before SDK serialization and HTTP RPC', async () => {
  const {createAcceptanceReconciler} = await import('../native/reconcile.mjs');
  const services = {secrets: {resolve: async () => 'x'.repeat(8193)}, http: {fetch: async () => { throw Error('Host must never see oversized review request'); }}, state: {get: async () => null, set: async () => {}}};
  const sdk = await sdkFixture({services, companyId: '00000000-0000-4000-8000-000000000001'});
  const scope = {schema: 'inertia.funding-transport-scope.v1', sourceId: 'native', destinationId: 'funding', companyId: '00000000-0000-4000-8000-000000000001', applicantId: 'synthetic', sourceScope: 'synthetic', purpose: 'durable-funding-review'};
  const config = {enabled: true, scope, nativeUrl: 'https://native.example/api/funding-review-transport', fundingUrl: 'https://funding.example/funding-review-transport', nativeSecretRef: {type: 'secret_ref', secretId: 'native'}, fundingSecretRef: {type: 'secret_ref', secretId: 'funding'}, lifecycle: {acknowledgeTerminal: async () => { throw Error('Not terminal'); }}};
  try {
    assert.equal((await createAcceptanceReconciler(sdk.ctx, config)()).state, 'pending');
    assert.equal(sdk.messages.filter(x => x.direction === 'worker' && x.message.method === 'http.fetch').length, 0);
    assert.throws(() => createAcceptanceReconciler(sdk.ctx, {...config, nativeUrl: `https://${'x'.repeat(2048)}.example/api/funding-review-transport`}), /endpoint/i);
  } finally { sdk.close(); }
});

test('opt-in host rejects invalid UTF-8 rather than expanding it across RPC', async () => {
  const x = await fixture({body: Buffer.from([0xff])});
  try { await assert.rejects(x.ctx.http.fetch('https://review.example/scope'), /encoding|UTF-8/i); }
  finally { x.close(); }
});


test('trusted limit mutation cannot expand the already-constructed host policy', async () => {
  const x = await fixture({headers: {'content-type': 'application/json', 'content-length': '1048577'}});
  try { x.limits.maxResponseBytes = 200 * 1024 * 1024; await assert.rejects(x.ctx.http.fetch('https://review.example/scope'), /response.*limit/i); }
  finally { x.close(); }
});

test('exact byte limit succeeds with bounded JSON-RPC encoding, including tiny chunks', async () => {
  const x = await fixture({chunks: Array.from({length: 1024}, () => Buffer.from('"'))}, {maxResponseBytes: 1024});
  try {
    assert.equal((await (await x.ctx.http.fetch('https://review.example/scope')).text()).length, 1024);
    const reply = x.messages.find(item => item.direction === 'host' && item.message.result?.body);
    assert.ok(reply.bytes <= 6 * 1024 + 1024, 'JSON escaping remains a fixed bounded expansion, not a 1 MiB wire claim');
  } finally { x.close(); }
});

// R1: raw URL bytes are not the normalized native request-target bytes.
test('normalized Unicode request expansion is rejected before DNS and socket allocation', async () => {
  const x = await fixture({});
  try {
    const pathUrl = 'https://review.example/' + 'é'.repeat(2000);
    assert.equal(Buffer.byteLength(pathUrl), 4023);
    const generatedAuthUrl = `https://${'u'.repeat(1100)}:${'p'.repeat(1100)}@review.example/${'a'.repeat(5000)}`;
    for (const url of [pathUrl, 'https://review.example/?q=' + 'é'.repeat(2000), generatedAuthUrl]) {
      assert.ok(Buffer.byteLength(url) < 8192, 'raw guard alone cannot establish the native byte budget');
      await assert.rejects(x.ctx.http.fetch(url), /request.*limit/i);
    }
    await assert.rejects(x.ctx.http.fetch(generatedAuthUrl, {headers: {Authorization: ''}}), /request.*limit/i);
    assert.equal(x.lookups.length, 0);
    assert.equal(x.requests.length, 0);
  } finally { x.close(); }
});

test('normalized ASCII request boundary admits the exact budget and rejects the next byte', async () => {
  const x = await fixture({});
  try {
    // GET request line + Host + final CRLF + 512 reserved native metadata bytes:
    // 7640 path characters + 552 fixed bytes = the 8192-byte policy budget.
    const url = 'https://review.example/' + 'a'.repeat(7640);
    assert.equal((await x.ctx.http.fetch(url)).status, 200);
    assert.equal(x.requests[0].options.path, '/' + 'a'.repeat(7640));
    await assert.rejects(x.ctx.http.fetch(url + 'a'), /request.*limit/i);
    assert.equal(x.lookups.length, 1);
    assert.equal(x.requests.length, 1);
  } finally { x.close(); }
});

test('bounded normalized Unicode and pre-encoded URLs preserve the actual native target', async () => {
  const x = await fixture({});
  try {
    for (const url of ['https://review.example/café?q=é', 'https://review.example/caf%C3%A9?q=%C3%A9']) {
      assert.equal((await x.ctx.http.fetch(url)).status, 200);
    }
    assert.equal(x.requests.length, 2);
    assert.ok(x.requests.every(item => item.options.path === '/caf%C3%A9?q=%C3%A9'));
    assert.ok(x.requests.every(item => item.options.host === '203.0.113.7' && item.options.servername === 'review.example'));
  } finally { x.close(); }
});

test('default host compatibility does not acquire the optional normalized request limit', async () => {
  const net = network({});
  const services = buildHostServices({}, 'synthetic-default', 'other.plugin', createPluginEventBus());
  const sdk = await sdkFixture({services});
  try {
    assert.equal((await sdk.ctx.http.fetch('https://review.example/' + 'é'.repeat(2000))).status, 200);
    assert.equal(Buffer.byteLength(net.requests[0].options.path), 12001);
    assert.equal(net.requests[0].options.maxHeaderSize, undefined);
  } finally { for (const item of net.requests) { item.response.destroy(); item.req.destroy(); } sdk.close(); services.dispose(); }
});
