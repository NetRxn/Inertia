import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { IncomingMessage, RequestOptions } from 'node:http';

const transport = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('node:http', () => ({ request: transport.request }));
vi.mock('node:https', () => ({ request: transport.request }));

import { fetchLinkPreview, isPrivateAddress } from '../src/shares/preview';

type Attempt = { url: URL; options: RequestOptions; address: string };
let attempts: Attempt[];
let responses: Array<{ status: number; location?: string }>;
let bodies: PassThrough[];
let callbackErrors: unknown[];

beforeEach(() => {
  attempts = [];
  responses = [];
  bodies = [];
  callbackErrors = [];
  // Both old fetch and the replacement request transport are simulated. No
  // sockets or real DNS queries are permitted by this regression fixture.
  vi.stubGlobal('fetch', async (input: string) => {
    attempts.push({ url: new URL(input), options: {}, address: '127.0.0.1' });
    return new Response('<meta property="og:title" content="Private replacement">', {
      headers: { 'content-type': 'text/html' },
    });
  });
  transport.request.mockImplementation((url: URL, options: RequestOptions, onResponse: (r: IncomingMessage) => void) => {
    const request = new EventEmitter() as EventEmitter & { end(): void; destroy(): void };
    request.destroy = () => { for (const body of bodies) body.destroy(); };
    options.signal?.addEventListener('abort', request.destroy, { once: true });
    request.end = () => {
      const complete = (address: string) => {
        attempts.push({ url, options, address });
        const response = responses.shift() ?? { status: 200 };
        const body = new PassThrough() as PassThrough & { statusCode: number; headers: Record<string, string> };
        body.statusCode = response.status;
        body.headers = { 'content-type': 'text/html', ...(response.location ? { location: response.location } : {}) };
        bodies.push(body);
        // Real HTTP invokes this after request() returns. Capture exceptions
        // that would otherwise escape to the process, not the fetch promise.
        queueMicrotask(() => {
          try { onResponse(body as unknown as IncomingMessage); }
          catch (error) { callbackErrors.push(error); }
          body.end('<meta property="og:title" content="Public page">');
        });
      };
      if (options.lookup) {
        (options.lookup as (host: string, options: { all: false }, callback: (error: Error | null, address: string) => void) => void)(
          url.hostname, { all: false }, (_error, address) => complete(address),
        );
      } else {
        complete('127.0.0.1');
      }
    };
    return request;
  });
});

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('preview connection boundary', () => {
  it('connects only to the checked DNS answer, keeping original Host/TLS identity', async () => {
    const lookup = vi.fn(async () => ['93.184.216.34']);
    const result = await fetchLinkPreview('https://example.org:8443/story', { lookup });
    expect(result?.title).toBe('Public page');
    expect(attempts.map(a => a.address)).toEqual(['93.184.216.34']);
    expect(attempts[0].url.href).toBe('https://example.org:8443/story');
    expect(attempts[0].options.agent).toBe(false);
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it('pins each redirect separately and cancels its body before the next hop', async () => {
    responses = [{ status: 302, location: 'https://other.example/final' }];
    const result = await fetchLinkPreview('http://example.org/story', {
      lookup: async host => host === 'other.example' ? ['2606:4700:4700::1111'] : ['93.184.216.34'],
    });
    expect(result?.title).toBe('Public page');
    expect(attempts.map(a => [a.url.hostname, a.address])).toEqual([
      ['example.org', '93.184.216.34'], ['other.example', '2606:4700:4700::1111'],
    ]);
    expect(bodies[0].destroyed).toBe(true);
  });

  it('refuses a public-to-private DNS answer on a same-host redirect', async () => {
    responses = [{ status: 302, location: '/next' }];
    let lookups = 0;
    const result = await fetchLinkPreview('https://example.org/', {
      lookup: async () => ++lookups === 1 ? ['93.184.216.34'] : ['10.0.0.1'],
    });
    expect(result).toBeNull();
    expect(attempts.map(a => a.address)).toEqual(['93.184.216.34']);
  });

  it.each([
    '0:0:0:0:0:0:0:1', '0:0:0:0:0:ffff:7f00:1',
    '0:0:0:0:0:ffff:0a00:1', '::ffff:192.168.1.1',
    'fc00::1', 'fe80::1', 'not:an:ip', '2606:bad:address',
    'fec0::1', 'ff02::1', '224.0.0.1', '240.1.2.3', '255.255.255.255',
    '192.0.0.1', '198.18.0.1', '64:ff9b::7f00:1', '2002:7f00:1::',
  ])('refuses private, special-use or malformed address %s without a connection', async address => {
    expect(isPrivateAddress(address)).toBe(true);
    expect(await fetchLinkPreview('https://example.org/', { lookup: async () => [address] })).toBeNull();
    expect(attempts).toEqual([]);
  });

  it.each(['192.0.78.17', '172.15.0.1', '172.32.0.1', '2606:4700:4700::1111'])('still accepts public address %s', async address => {
    expect((await fetchLinkPreview('https://example.org/', { lookup: async () => [address] }))?.title).toBe('Public page');
  });

  it('refuses mixed public and private DNS results before a connection', async () => {
    expect(await fetchLinkPreview('https://example.org/', {
      lookup: async () => ['93.184.216.34', '10.0.0.1'],
    })).toBeNull();
    expect(attempts).toEqual([]);
  });

  it.each(['http://127.1/', 'http://[::1]/', 'http://[::ffff:7f00:1]/'])('validates literal address %s without trusting DNS', async url => {
    expect(await fetchLinkPreview(url, { lookup: async () => ['93.184.216.34'] })).toBeNull();
    expect(attempts).toEqual([]);
  });

  it('does not start a late request after the DNS deadline expired', async () => {
    let finishLookup!: (addresses: string[]) => void;
    const lookup = new Promise<string[]>(resolve => { finishLookup = resolve; });
    expect(await fetchLinkPreview('https://example.org/', { lookup: () => lookup, timeoutMs: 5 })).toBeNull();
    finishLookup(['93.184.216.34']);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(attempts).toEqual([]);
  });

  it('collapses an unsupported upstream status into null without an uncaught callback exception', async () => {
    responses = [{ status: 600 }];
    expect(await fetchLinkPreview('https://example.org/', {
      lookup: async () => ['93.184.216.34'], timeoutMs: 10,
    })).toBeNull();
    expect(callbackErrors).toEqual([]);
    expect(bodies[0].destroyed).toBe(true);
  });

  it('identifies itself with a User-Agent, since some sites refuse requests without one', async () => {
    await fetchLinkPreview('https://example.org/story', { lookup: async () => ['93.184.216.34'] });
    const headers = attempts[0].options.headers as Record<string, string>;
    expect(headers['user-agent']).toMatch(/^InertiaMemberApp\//);
  });
});
