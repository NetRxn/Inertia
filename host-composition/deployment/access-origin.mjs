import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Dependency selection is an operator-owned package root, never a request parameter.
export async function loadJose(serverPackageRoot) {
  if (!serverPackageRoot || !isAbsolute(serverPackageRoot)) throw new Error('absolute SERVER_PACKAGE_ROOT required');
  const requireServer = createRequire(pathToFileURL(resolve(serverPackageRoot, 'package.json')));
  return import(pathToFileURL(requireServer.resolve('jose')).href);
}

export function validateConfig(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('invalid config');
  const { issuer, audience, allowedEmails, bindHost, port } = input;
  // Exact HTTPS Access team origin, with no credentials, path, query, port or fragment.
  if (typeof issuer !== 'string' || !/^https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.cloudflareaccess\.com$/.test(issuer)) throw new Error('invalid Access issuer');
  if (typeof audience !== 'string' || !audience.trim() || audience.length > 256) throw new Error('invalid audience');
  if (!Array.isArray(allowedEmails) || !allowedEmails.length || allowedEmails.length > 64 ||
    !allowedEmails.every(email => typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) throw new Error('invalid email allowlist');
  if (!['127.0.0.1', '::1'].includes(bindHost)) throw new Error('loopback binding required');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('invalid port');
  return Object.freeze({ issuer, audience, allowedEmails: Object.freeze(allowedEmails.map(email => email.trim().toLowerCase())), bindHost, port });
}

// Injection is restricted to the cryptographic key resolver; claims always pass jwtVerify.
export function createVerifier(input, jose, keyResolver) {
  const config = validateConfig(input);
  const keys = keyResolver ?? jose.createRemoteJWKSet(new URL(`${config.issuer}/cdn-cgi/access/certs`), {
    timeoutDuration: 2500, cooldownDuration: 30000, cacheMaxAge: 300000,
  });
  const emails = new Set(config.allowedEmails);
  return async token => {
    if (typeof token !== 'string' || !token || token.length > 8192) return false;
    try {
      const { payload } = await jose.jwtVerify(token, keys, {
        issuer: config.issuer, audience: config.audience, algorithms: ['RS256'],
        requiredClaims: ['iss', 'aud', 'exp', 'iat', 'type', 'email'],
        clockTolerance: 0,
      });
      return payload.type === 'app' && Number.isFinite(payload.iat) && payload.iat <= Math.floor(Date.now() / 1000) &&
        payload.iat < payload.exp && typeof payload.email === 'string' && emails.has(payload.email.trim().toLowerCase());
    } catch {
      // Never log tokens, claims, email addresses or upstream error details.
      return false;
    }
  };
}

export function createVerifierServer(input, verify) {
  validateConfig(input);
  const server = createServer({ maxHeaderSize: 12288 }, async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Connection', 'close');
    if (request.method !== 'GET') { response.writeHead(405).end(); return; }
    if (request.url === '/healthz') { response.writeHead(204).end(); return; }
    if (request.url !== '/verify') { response.writeHead(404).end(); return; }
    // GET only, with no request payload. Never forward a body or identity headers.
    if (request.headers['transfer-encoding'] || (request.headers['content-length'] && request.headers['content-length'] !== '0')) {
      response.writeHead(400).end(); return;
    }
    const assertions = request.rawHeaders.filter((_, i) => i % 2 === 0 && request.rawHeaders[i].toLowerCase() === 'cf-access-jwt-assertion');
    if (assertions.length !== 1) { response.writeHead(403).end(); return; }
    try { response.writeHead(await verify(request.headers['cf-access-jwt-assertion']) ? 204 : 403).end(); }
    catch { response.writeHead(403).end(); }
  });
  server.maxHeadersCount = 32;
  server.maxConnections = 64;
  server.maxRequestsPerSocket = 1;
  server.headersTimeout = 5000;
  server.requestTimeout = 5000;
  server.keepAliveTimeout = 1000;
  server.setTimeout(5000, socket => socket.destroy());
  return server;
}

// Only this command-line entry point starts a listener, bound to validated loopback.
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const config = validateConfig(JSON.parse(await readFile(process.argv[2], 'utf8')));
    const jose = await loadJose(process.env.SERVER_PACKAGE_ROOT);
    const server = createVerifierServer(config, createVerifier(config, jose));
    server.on('error', () => { process.stderr.write('Access verifier listener failed\n'); process.exitCode = 1; });
    server.listen(config.port, config.bindHost);
  } catch {
    process.stderr.write('Access verifier configuration/startup failed\n');
    process.exitCode = 1;
  }
}
