import { fetchPublicPage } from '../shares/preview';
import { htmlToText } from './ingest';

export type FetchPage = (url: string) => Promise<{ html: string; url: string } | null>;

/** Same-site links from a page, without fragments, query strings or files. */
export function sameSiteLinks(html: string, pageUrl: string, limit: number): string[] {
  const base = new URL(pageUrl);
  const found: string[] = [];
  for (const match of html.matchAll(/<a\s[^>]*href=["']([^"'#]+)["']/gi)) {
    let url: URL;
    try {
      url = new URL(match[1], base);
    } catch {
      continue;
    }
    if (url.host !== base.host || !/^https?:$/.test(url.protocol)) continue;
    if (/\.(png|jpe?g|gif|svg|webp|pdf|zip|xml|ico|css|js)$/i.test(url.pathname)) continue;
    url.search = '';
    url.hash = '';
    const href = url.toString();
    if (href !== base.toString() && !found.includes(href)) found.push(href);
    if (found.length >= limit) break;
  }
  return found;
}

/** Reads a website's home page and a few of its own pages as text. */
export async function readWebsite(
  website: string,
  opts: { maxPages?: number; fetchPage?: FetchPage } = {},
): Promise<{ url: string; title: string; text: string }[]> {
  const fetchPage = opts.fetchPage ?? ((url: string) => fetchPublicPage(url, { timeoutMs: 10_000, maxBytes: 1_000_000 }));
  const home = await fetchPage(website);
  if (!home) return [];
  const pages = [home, ...(await Promise.all(sameSiteLinks(home.html, home.url, (opts.maxPages ?? 8) - 1).map(fetchPage)))];
  return pages
    .filter((page): page is { html: string; url: string } => page !== null)
    .map((page) => {
      const { title, text } = htmlToText(page.html);
      return { url: page.url, title: title ?? new URL(page.url).pathname, text };
    })
    .filter((page) => page.text.length > 40);
}
