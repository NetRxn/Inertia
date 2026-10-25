import { lookup as dnsLookup } from 'node:dns/promises';

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
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true; // unspecified, private, loopback
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  return false;
}

/** True for loopback, private, link-local and unique-local addresses, in either IP family. */
export function isPrivateAddress(address: string): boolean {
  const value = address.trim().toLowerCase();
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
    return false;
  }
  return isPrivateIPv4(value);
}

async function hostIsFetchable(host: string, lookup: (host: string) => Promise<string[]>): Promise<boolean> {
  const addresses = await lookup(host);
  return addresses.length > 0 && addresses.every((address) => !isPrivateAddress(address));
}

async function readCapped(body: ReadableStream<Uint8Array> | null, maxBytes: number): Promise<string> {
  if (!body) return '';
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
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

async function fetchPreview(
  rawUrl: string,
  deps: { fetchImpl: typeof fetch; lookup: (host: string) => Promise<string[]>; maxBytes: number; signal: AbortSignal },
): Promise<LinkPreview | null> {
  let current: URL;
  try {
    current = new URL(rawUrl);
  } catch {
    return null;
  }

  // The initial fetch plus at most MAX_REDIRECTS hops. Each hop re-checks scheme and host.
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (current.protocol !== 'http:' && current.protocol !== 'https:') return null;
    if (!(await hostIsFetchable(current.hostname, deps.lookup))) return null;

    let response: Response;
    try {
      response = await deps.fetchImpl(current.toString(), {
        redirect: 'manual',
        signal: deps.signal,
        credentials: 'omit',
        headers: { accept: 'text/html' },
      });
    } catch {
      return null; // Includes aborts: the deadline race below returns null anyway.
    }

    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
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
    return extractPreview(html, current);
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
  const fetchImpl = opts.fetchImpl ?? fetch;
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
    const work = fetchPreview(url, { fetchImpl, lookup, maxBytes, signal: controller.signal }).catch(
      () => null,
    );
    return await Promise.race([work, deadline]);
  } finally {
    clearTimeout(timer);
  }
}
