import { lookup as dnsLookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { Readable } from 'node:stream';

/** What a fetched page says about itself; every field may be missing. */
export type LinkPreview = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
};

export type FetchLinkPreviewOptions = {
  fetchImpl?: typeof fetch;
  lookup?: (host: string) => Promise<string[]>;
  timeoutMs?: number;
  maxBytes?: number;
};

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_BYTES = 512_000;
const MAX_REDIRECTS = 3;
const TITLE_MAX = 200;
const DESCRIPTION_MAX = 500;

async function defaultLookup(host: string): Promise<string[]> {
  const results = await dnsLookup(host, { all: true });
  return results.map((result) => result.address);
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true; // Unparseable addresses are never fetched.
  }
  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127) return true; // unspecified, private, loopback
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a >= 224) return true; // multicast, reserved and broadcast
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true; // special-use/documentation
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  return false;
}

/** True for loopback, private, link-local and unique-local addresses, in either IP family. */
export function isPrivateAddress(address: string): boolean {
  let value = address.trim().toLowerCase();
  if (!isIP(value)) return true;
  // Canonicalize expanded IPv6 before matching mapped IPv4 and loopback.
  if (isIP(value) === 6) value = new URL(`http://[${value}]/`).hostname.slice(1, -1);
  if (value.includes(':')) {
    if (value === '::' || value === '::1') return true;
    // IPv4-mapped IPv6, dotted form (::ffff:127.0.0.1) and hex form (::ffff:7f00:1).
    const dotted = value.match(/^::ffff:(?:0:)?(\d+\.\d+\.\d+\.\d+)$/);
    if (dotted) return isPrivateIPv4(dotted[1]);
    const hexMapped = value.match(/^::ffff:([0-9a-f]+(?::[0-9a-f]+)?)$/);
    if (hexMapped) {
      const groups = hexMapped[1].split(':').filter(Boolean).map((g) => parseInt(g, 16));
      if (groups.length === 2 && groups.every((g) => Number.isInteger(g))) {
        return isPrivateIPv4(`${groups[0] >> 8}.${groups[0] & 0xff}.${groups[1] >> 8}.${groups[1] & 0xff}`);
      }
    }
    const [first] = value.split(':');
    if (!first || !/^[0-9a-f]+$/.test(first)) return true; // unparseable — refuse
    const head = parseInt(first, 16);
    if (head >= 0xfc00 && head <= 0xfdff) return true; // fc00::/7 unique-local
    if ((head & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    // Refuse non-global and translation/tunnel ranges rather than allowing an
    // embedded private IPv4 target through NAT64, 6to4 or deprecated site-local.
    return (head & 0xe000) !== 0x2000 || head === 0x2002;
  }
  return isPrivateIPv4(value);
}

async function fetchAddress(host: string, lookup: (host: string) => Promise<string[]>): Promise<string | null> {
  const bareHost = host.replace(/^\[|\]$/g, '');
  const addresses = isIP(bareHost) ? [bareHost] : await lookup(bareHost);
  return addresses.length > 0 && addresses.every((address) => !isPrivateAddress(address)) ? addresses[0] : null;
}

const USER_AGENT = 'InertiaMemberApp/0.1 (link preview)';

/** Keep the URL hostname for Host and TLS verification; only DNS is replaced. */
function fetchPinned(url: URL, address: string, signal: AbortSignal): Promise<Response> {
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
      agent: false,
      signal,
      family: isIP(address),
      lookup: (_host, _options, callback) => callback(null, address, isIP(address)),
      // Without a User-Agent some sites (Wikimedia, for one) answer 403.
      headers: { accept: 'text/html', 'accept-encoding': 'identity', 'user-agent': USER_AGENT },
    }, (response) => {
      // The callback runs after the Promise executor returns: conversion
      // errors must reject explicitly, not escape as process exceptions.
      try {
        const status = response.statusCode;
        if (!status || !Number.isInteger(status) || status < 200 || status > 599) {
          throw new Error('Unsupported preview response status');
        }
        const headers = new Headers();
        for (const [key, value] of Object.entries(response.headers)) {
          if (Array.isArray(value)) value.forEach(item => headers.append(key, item));
          else if (value !== undefined) headers.set(key, value);
        }
        // Response forbids a body on these statuses; release the native stream.
        const noBody = status === 204 || status === 205 || status === 304;
        if (noBody) response.destroy();
        resolve(new Response(noBody ? null : Readable.toWeb(response) as ReadableStream<Uint8Array>, { status, headers }));
      } catch (error) {
        response.destroy();
        reject(error);
      }
    });
    request.on('error', reject);
    request.end();
  });
}

async function readCapped(body: ReadableStream<Uint8Array> | null, maxBytes: number): Promise<string> {
  if (!body) return '';
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value.subarray(0, maxBytes - total));
    total += value.length;
    if (total >= maxBytes) {
      try {
        await reader.cancel();
      } catch {
        // The stream may already be closed; either way we stop reading.
      }
      break;
    }
  }
  const merged = new Uint8Array(Math.min(total, maxBytes));
  let offset = 0;
  for (const chunk of chunks) {
    const take = Math.min(chunk.length, merged.length - offset);
    merged.set(chunk.subarray(0, take), offset);
    offset += take;
    if (offset >= merged.length) break;
  }
  return new TextDecoder('utf-8').decode(merged);
}

function attributeValue(tag: string, attribute: string): string | null {
  const match = tag.match(
    new RegExp(`${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i'),
  );
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? null;
}

function extractMeta(html: string, key: string): string | null {
  const tags = /<meta\s[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = tags.exec(html)) !== null) {
    const tag = match[0];
    const property = attributeValue(tag, 'property') ?? attributeValue(tag, 'name');
    if (property && property.toLowerCase() === key) {
      return attributeValue(tag, 'content');
    }
  }
  return null;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, entity: string) => {
    if (entity[0] === '#') {
      const isHex = entity[1] === 'x' || entity[1] === 'X';
      const code = parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (Number.isInteger(code) && code > 0 && code <= 0x10ffff) return String.fromCodePoint(code);
      return whole;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? whole;
  });
}

function cleanMeta(text: string | null): string | null {
  if (!text) return null;
  const cleaned = decodeEntities(text).replace(/\s+/g, ' ').trim();
  return cleaned || null;
}

function cap(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function extractPreview(html: string, pageUrl: URL): LinkPreview | null {
  const title = cleanMeta(extractMeta(html, 'og:title'));
  const description = cleanMeta(extractMeta(html, 'og:description'));
  let imageUrl: string | null = null;
  const rawImage = cleanMeta(extractMeta(html, 'og:image'));
  if (rawImage) {
    try {
      const resolved = new URL(rawImage, pageUrl);
      imageUrl = resolved.protocol === 'https:' || resolved.protocol === 'http:' ? resolved.toString() : null;
    } catch {
      imageUrl = null;
    }
  }
  if (!title && !description && !imageUrl) return null;
  return {
    title: title ? cap(title, TITLE_MAX) : null,
    description: description ? cap(description, DESCRIPTION_MAX) : null,
    imageUrl,
  };
}

type FetchDeps = { fetchImpl?: typeof fetch; lookup: (host: string) => Promise<string[]>; maxBytes: number; signal: AbortSignal };

async function fetchPreview(rawUrl: string, deps: FetchDeps): Promise<LinkPreview | null> {
  const page = await fetchHtml(rawUrl, deps);
  return page ? extractPreview(page.html, page.url) : null;
}

/** Fetches an HTML page under the same host, redirect, type and size rules as previews. */
async function fetchHtml(rawUrl: string, deps: FetchDeps): Promise<{ html: string; url: URL } | null> {
  let current: URL;
  try {
    current = new URL(rawUrl);
  } catch {
    return null;
  }

  // The initial fetch plus at most MAX_REDIRECTS hops. Each hop re-checks scheme and host.
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (current.protocol !== 'http:' && current.protocol !== 'https:') return null;
    if (current.username || current.password || deps.signal.aborted) return null;
    const address = await fetchAddress(current.hostname, deps.lookup);
    if (!address || deps.signal.aborted) return null;

    let response: Response;
    try {
      response = deps.fetchImpl ? await deps.fetchImpl(current.toString(), {
        redirect: 'manual',
        signal: deps.signal,
        credentials: 'omit',
        headers: { accept: 'text/html' },
      }) : await fetchPinned(current, address, deps.signal);
    } catch {
      return null; // Includes aborts: the deadline race below returns null anyway.
    }

    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel();
      if (hop === MAX_REDIRECTS) return null;
      try {
        current = new URL(location, current);
      } catch {
        return null;
      }
      continue;
    }

    if (!response.ok) {
      try {
        await response.body?.cancel();
      } catch {
        // Nothing to release.
      }
      return null;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!/^text\/html/i.test(contentType.trim())) {
      try {
        await response.body?.cancel();
      } catch {
        // Nothing to release.
      }
      return null;
    }

    const html = await readCapped(response.body, deps.maxBytes);
    return { html, url: current };
  }
  return null;
}

/**
 * Fetches a page and reads its Open Graph tags, best effort: it returns null
 * for anything unusual instead of throwing, and never follows a private host.
 */
export async function fetchLinkPreview(
  url: string,
  opts: FetchLinkPreviewOptions = {},
): Promise<LinkPreview | null> {
  return withDeadline(opts, (deps) => fetchPreview(url, deps));
}

/**
 * Fetches a public HTML page's markup, best effort, under the same rules as
 * link previews: null for anything unusual, never a private host.
 */
export async function fetchPublicPage(
  url: string,
  opts: FetchLinkPreviewOptions = {},
): Promise<{ html: string; url: string } | null> {
  const page = await withDeadline(opts, (deps) => fetchHtml(url, deps));
  return page ? { html: page.html, url: page.url.toString() } : null;
}

async function withDeadline<T>(opts: FetchLinkPreviewOptions, run: (deps: FetchDeps) => Promise<T | null>): Promise<T | null> {
  const fetchImpl = opts.fetchImpl;
  const lookup = opts.lookup ?? defaultLookup;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(null);
    }, timeoutMs);
  });

  try {
    // Errors inside the fetch collapse to null; the deadline wins even over a
    // fetch implementation that ignores the abort signal.
    const work = run({ fetchImpl, lookup, maxBytes, signal: controller.signal }).catch(() => null);
    return await Promise.race([work, deadline]);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
