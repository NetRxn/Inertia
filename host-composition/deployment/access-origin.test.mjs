import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

const source = new URL('./access-origin.mjs', import.meta.url);
const packageRoot = process.env.SERVER_PACKAGE_ROOT;
assert.ok(packageRoot, 'set SERVER_PACKAGE_ROOT to the installed pinned @paperclipai/server package');
const requireServer = createRequire(pathToFileURL(resolve(packageRoot, 'package.json')));
const jose = await import(pathToFileURL(requireServer.resolve('jose')).href);
const { privateKey, publicKey } = await jose.generateKeyPair('RS256');
const config = {
  issuer: 'https://netrxn.cloudflareaccess.com',
  audience: 'a29f5af19baa628276c7f1e12bf94915e3e32e252b71bbaa1dca7264aec38a2d',
  allowedEmails: ['NetRxn137@gmail.com', 'kyle@datalof.com'], bindHost: '127.0.0.1', port: 19091,
};
const now = Math.floor(Date.now() / 1000);
async function token(changes = {}, alg = 'RS256', signingKey = privateKey) {
  return new jose.SignJWT({ iss: config.issuer, aud: config.audience, exp: now + 300, iat: now, type: 'app', email: 'NetRxn137@gmail.com', ...changes })
    .setProtectedHeader({ alg, kid: 'test-key' }).sign(signingKey);
}

test('origin verifier implementation exists', () => assert.ok(existsSync(source), 'missing origin verifier implementation'));
if (existsSync(source)) {
  const { createVerifier, createVerifierServer, validateConfig, loadJose } = await import(source);
  test('server-owned dependency resolution loads pinned jose', async () => {
    assert.equal(typeof (await loadJose(packageRoot)).jwtVerify, 'function');
  });
  test('valid RSA Access app JWT admits normalized allowlisted email', async () => {
    const verify = createVerifier(config, jose, publicKey);
    assert.equal(await verify(await token()), true);
    assert.equal(await verify(await token({ email: '  KYLE@DATALOF.COM  ' })), true);
  });
  const denied = [
    ['wrong issuer', { iss: 'https://evil.cloudflareaccess.com' }],
    ['wrong audience', { aud: 'wrong' }], ['expired', { exp: now - 1 }],
    ['missing expiry', { exp: undefined }], ['missing issued-at', { iat: undefined }],
    ['future issued-at', { iat: now + 300 }], ['organization token', { type: 'org' }],
    ['missing type', { type: undefined }], ['email absent', { email: undefined }],
    ['email not allowlisted', { email: 'other@example.com' }], ['email wrong type', { email: ['kyle@datalof.com'] }],
  ];
  for (const [name, changes] of denied) test(`denies ${name}`, async () => {
    assert.equal(await createVerifier(config, jose, publicKey)(await token(changes)), false);
  });
  test('denies missing, malformed, oversized, unsigned, wrong algorithm, and forged signatures', async () => {
    const verify = createVerifier(config, jose, publicKey);
    const other = await jose.generateKeyPair('RS256');
    const hs = await token({}, 'HS256', new Uint8Array(32));
    const valid = await token();
    for (const value of [undefined, '', 'bad', 'x'.repeat(8193), `${valid.split('.').slice(0, 2).join('.')}.`, hs, await token({}, 'RS256', other.privateKey)]) {
      assert.equal(await verify(value), false);
    }
  });
  test('key resolution failure denies a signed JWT', async () => {
    const verify = createVerifier(config, jose, async () => { throw new Error('JWKS unavailable'); });
    assert.equal(await verify(await token()), false);
  });
  test('configuration rejects public binding and malformed security settings', () => {
    for (const change of [{ bindHost: '0.0.0.0' }, { bindHost: 'localhost' }, { port: 0 }, { port: 65536 },
      { issuer: 'http://netrxn.cloudflareaccess.com' }, { issuer: 'https://netrxn.cloudflareaccess.com/extra' },
      { issuer: 'https://netrxn.cloudflareaccess.com.evil.test' }, { issuer: 'https://u:p@netrxn.cloudflareaccess.com' },
      { audience: '' }, { allowedEmails: [] }, { allowedEmails: ['bad'] }]) assert.throws(() => validateConfig({ ...config, ...change }));
  });
  test('HTTP endpoint only verifies GET with a signed JWT and never trusts email headers', async () => {
    const server = createVerifierServer(config, createVerifier(config, jose, publicKey));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const base = `http://127.0.0.1:${server.address().port}`;
      const request = (path, options = {}) => fetch(base + path, options);
      assert.equal((await request('/verify', { headers: { 'Cf-Access-Authenticated-User-Email': 'NetRxn137@gmail.com' } })).status, 403);
      const response = await request('/verify', { headers: { 'Cf-Access-Jwt-Assertion': await token() } });
      assert.equal(response.status, 204);
      assert.equal(await response.text(), '');
      assert.equal(response.headers.get('Cf-Access-Authenticated-User-Email'), null);
      assert.equal((await request('/verify', { method: 'POST', body: 'do not forward' })).status, 405);
      assert.equal((await request('/verify?anything')).status, 404);
      assert.equal((await request('/unknown')).status, 404);
      assert.equal((await request('/healthz')).status, 204);
      assert.ok(server.maxHeadersCount <= 32);
      assert.ok(server.requestTimeout <= 5000);
      assert.ok(server.headersTimeout <= 5000);
      assert.ok(server.maxConnections <= 64);
      assert.equal(server.maxRequestsPerSocket, 1);
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
}
