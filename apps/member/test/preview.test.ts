import { describe, it, expect, vi } from 'vitest';
import { fetchLinkPreview } from '../src/shares/preview';

const PUBLIC = ['93.184.216.34'];

const OG_HTML = [
  '<html><head>',
  '<meta charset="utf-8">',
  '<meta property="og:title" content="City micro-grants &amp; urban farms">',
  "<meta content='Funding for city farms' property='og:description'>",
  '<meta name="og:image" content="https://example.org/cover.png">',
  '</head><body></body></html>',
].join('');

const htmlResponse = (html: string) =>
  new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });

const redirectResponse = (location: string) =>
  new Response(null, { status: 302, headers: { location } });

describe('fetchLinkPreview', () => {
  it('extracts og:title, og:description, og:image', async () => {
    const preview = await fetchLinkPreview('https://example.org/grants', {
      fetchImpl: async () => htmlResponse(OG_HTML),
      lookup: async () => PUBLIC,
    });

    expect(preview).toEqual({
      title: 'City micro-grants & urban farms',
      description: 'Funding for city farms',
      imageUrl: 'https://example.org/cover.png',
    });
  });

  it('returns null for a host resolving to 127.0.0.1, 10.x, 172.16-31.x, 192.168.x, 169.254.x, ::1 or fc00::/7', async () => {
    const blocked = [
      '127.0.0.1',
      '10.1.2.3',
      '172.16.0.1',
      '172.31.255.254',
      '192.168.0.5',
      '169.254.169.254',
      '::1',
      'fc00::1',
      'fd12:3456::abcd',
      'fe80::1',
      '::ffff:127.0.0.1',
    ];
    const fetchImpl = vi.fn(async () => htmlResponse(OG_HTML));

    for (const address of blocked) {
      const preview = await fetchLinkPreview('https://example.org/', {
        fetchImpl,
        lookup: async () => [address],
      });
      expect(preview, address).toBeNull();
    }
    expect(fetchImpl).not.toHaveBeenCalled();

    // ftp: and javascript: URLs are never fetched either.
    const schemePreview = await fetchLinkPreview('ftp://example.org/file', {
      fetchImpl,
      lookup: async () => PUBLIC,
    });
    expect(schemePreview).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();

    // Addresses just outside the private ranges pass the check.
    for (const address of ['172.15.0.1', '172.32.0.1']) {
      const preview = await fetchLinkPreview('https://example.org/', {
        fetchImpl: async () => htmlResponse(OG_HTML),
        lookup: async () => [address],
      });
      expect(preview, address).not.toBeNull();
    }
  });

  it('returns null for non-HTML content-type', async () => {
    const preview = await fetchLinkPreview('https://example.org/data.json', {
      fetchImpl: async () =>
        new Response('{"a": 1}', { headers: { 'content-type': 'application/json' } }),
      lookup: async () => PUBLIC,
    });
    expect(preview).toBeNull();
  });

  it('stops reading after maxBytes', async () => {
    const filler = 'x'.repeat(8192);
    const html =
      `<html><head><meta property="og:title" content="Early title">${filler}` +
      '<meta property="og:description" content="Late description"></head></html>';
    const encoder = new TextEncoder();
    let offset = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset >= html.length) {
          controller.close();
          return;
        }
        const chunk = encoder.encode(html.slice(offset, offset + 256));
        offset += chunk.length;
        controller.enqueue(chunk);
      },
    });

    const preview = await fetchLinkPreview('https://example.org/', {
      fetchImpl: async () => new Response(stream, { headers: { 'content-type': 'text/html' } }),
      lookup: async () => PUBLIC,
      maxBytes: 1024,
    });

    // The title inside the first kilobyte is extracted…
    expect(preview?.title).toBe('Early title');
    // …and everything past maxBytes was never read.
    expect(preview?.description).toBeNull();
    expect(offset).toBeLessThanOrEqual(1024 + 256);
    expect(offset).toBeLessThan(html.length);
  });

  it('returns null after timeout', async () => {
    const fetchImpl = () => new Promise<Response>(() => {});
    const preview = await fetchLinkPreview('https://example.org/', {
      fetchImpl,
      lookup: async () => PUBLIC,
      timeoutMs: 50,
    });
    expect(preview).toBeNull();
  });

  it('follows at most 3 redirects and re-checks each host', async () => {
    const hops: Record<string, Response> = {
      'https://a.example/': redirectResponse('https://b.example/1'),
      'https://b.example/1': redirectResponse('https://c.example/2'),
      'https://c.example/2': redirectResponse('https://good.example/final'),
      'https://good.example/final': htmlResponse('<meta property="og:title" content="Made it">'),
    };
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      return hops[url] ?? new Response(null, { status: 404 });
    });
    const lookup: (host: string) => Promise<string[]> = async () => PUBLIC;
    const lookupMock = vi.fn(lookup);

    const preview = await fetchLinkPreview('https://a.example/', { fetchImpl, lookup: lookupMock });
    expect(preview?.title).toBe('Made it');
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(lookupMock.mock.calls.map((call) => call[0])).toEqual([
      'a.example',
      'b.example',
      'c.example',
      'good.example',
    ]);

    // A fourth redirect is not followed.
    const longHops: Record<string, Response> = {
      'https://r1.example/': redirectResponse('https://r2.example/'),
      'https://r2.example/': redirectResponse('https://r3.example/'),
      'https://r3.example/': redirectResponse('https://r4.example/'),
      'https://r4.example/': redirectResponse('https://final.example/'),
    };
    const longFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      return longHops[url] ?? htmlResponse('<meta property="og:title" content="Nope">');
    });
    const none = await fetchLinkPreview('https://r1.example/', {
      fetchImpl: longFetch,
      lookup: async () => PUBLIC,
    });
    expect(none).toBeNull();
    expect(longFetch).toHaveBeenCalledTimes(4);

    // A redirect to a private host is refused, and the hop is not fetched.
    const privateFetch = vi.fn(async (input: RequestInfo | URL) =>
      String(input) === 'https://pub.example/'
        ? redirectResponse('https://intranet.example/x')
        : htmlResponse('<meta property="og:title" content="Nope">'),
    );
    const intranet = await fetchLinkPreview('https://pub.example/', {
      fetchImpl: privateFetch,
      lookup: async (host) => (host === 'intranet.example' ? ['10.0.0.9'] : PUBLIC),
    });
    expect(intranet).toBeNull();
    expect(privateFetch).toHaveBeenCalledTimes(1);
  });
});
