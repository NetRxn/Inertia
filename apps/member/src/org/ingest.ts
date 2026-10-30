import { createHash } from 'crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { orgPassages, orgSources } from '../db/schema';

export type SourceKind = (typeof orgSources.$inferSelect)['kind'];
export type OrgSource = typeof orgSources.$inferSelect;

/** Sources bigger than this are cut, so one upload can't crowd out the rest. */
export const MAX_SOURCE_CHARS = 400_000;
/** Target passage size: big enough to keep context, small enough to cite. */
const PASSAGE_CHARS = 1200;

export class IngestError extends Error {}

/** Normalizes line endings and drops control characters, keeping the text itself unchanged. */
export function cleanText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, MAX_SOURCE_CHARS);
}

/** Strips WebVTT/SRT cue numbers and timestamps, keeping speaker text. */
export function transcriptToText(text: string): string {
  return text
    .split('\n')
    .filter((line) => !/^WEBVTT/.test(line) && !/^\d+$/.test(line.trim()) && !/-->/.test(line) && !/^NOTE\b/.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

type TelegramText = string | { text?: string }[] | undefined;
function telegramText(value: TelegramText): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((part) => (typeof part === 'string' ? part : part?.text ?? '')).join('');
  return '';
}

/** Turns a Telegram Desktop "Export chat history" JSON file into dated lines. */
export function telegramExportToText(json: string): { title: string; text: string } {
  let data: { name?: string; messages?: { type?: string; date?: string; from?: string; text?: TelegramText }[] };
  try {
    data = JSON.parse(json);
  } catch {
    throw new IngestError('That file is not a Telegram chat export.');
  }
  if (!Array.isArray(data.messages)) throw new IngestError('That file is not a Telegram chat export.');
  const lines = data.messages
    .filter((m) => m.type === 'message')
    .map((m) => ({ when: m.date?.slice(0, 16).replace('T', ' ') ?? '', from: m.from ?? 'Someone', text: telegramText(m.text).trim() }))
    .filter((m) => m.text)
    .map((m) => `[${m.when}] ${m.from}: ${m.text}`);
  return { title: data.name ? `Telegram: ${data.name}` : 'Telegram chat', text: lines.join('\n') };
}

/** Readable text from a web page: title plus body text without scripts, styles or markup. */
export function htmlToText(html: string): { title: string | null; text: string } {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() || null;
  const text = html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|section|article|li|h[1-6]|br|tr|header|footer)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*/g, '\n\n')
    .trim();
  return { title, text };
}

/** File types Inertia can read today. Audio is transcribed elsewhere first. */
export const READABLE_EXTENSIONS = ['.txt', '.md', '.markdown', '.vtt', '.srt', '.json', '.html', '.htm', '.csv'];

/** Reads an uploaded file into text, choosing the parser by extension. */
export function fileToText(name: string, bytes: Uint8Array): { title: string; text: string; kind: SourceKind } {
  const lower = name.toLowerCase();
  const ext = READABLE_EXTENSIONS.find((e) => lower.endsWith(e));
  if (!ext) throw new IngestError('Inertia can read text, Markdown, transcripts (.vtt, .srt), Telegram exports (.json), web pages and CSV.');
  const raw = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const base = name.replace(/\.[^.]+$/, '');
  if (ext === '.json') {
    const chat = telegramExportToText(raw);
    return { title: chat.title, text: chat.text, kind: 'chat-export' };
  }
  if (ext === '.vtt' || ext === '.srt') return { title: base, text: transcriptToText(raw), kind: 'meeting' };
  if (ext === '.html' || ext === '.htm') {
    const page = htmlToText(raw);
    return { title: page.title ?? base, text: page.text, kind: 'document' };
  }
  const looksLikeMeeting = /\b(transcript|meeting|roundtable|minutes|notes)\b/i.test(base);
  return { title: base, text: raw, kind: looksLikeMeeting ? 'meeting' : 'document' };
}

/** Splits text into passages along paragraph and line breaks, each labelled with its line range. */
export function splitPassages(text: string, size = PASSAGE_CHARS): { location: string; text: string }[] {
  const lines = text.split('\n');
  const passages: { location: string; text: string }[] = [];
  let start = 0;
  let buffer: string[] = [];
  let length = 0;
  const flush = (end: number) => {
    const body = buffer.join('\n').trim();
    if (body) passages.push({ location: start + 1 === end ? `line ${end}` : `lines ${start + 1}–${end}`, text: body });
    buffer = [];
    length = 0;
  };
  lines.forEach((line, i) => {
    if (!buffer.length) start = i;
    // A single very long line is cut into pieces so no passage is unbounded.
    for (let offset = 0; offset < Math.max(line.length, 1); offset += size) {
      const piece = line.slice(offset, offset + size);
      buffer.push(piece);
      length += piece.length + 1;
      if (length >= size) {
        flush(i + 1);
        start = i;
      }
    }
    if (!line.trim() && length >= size / 2) flush(i + 1);
  });
  flush(lines.length);
  return passages;
}

export function contentHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export type AddSourceInput = {
  kind: SourceKind;
  title: string;
  origin?: string | null;
  content: string;
  addedBy?: string | null;
};

/**
 * Saves a source and its passages. The same content twice is one source:
 * the second add returns the first with duplicate: true.
 */
export async function addSource(db: Db, input: AddSourceInput): Promise<{ source: OrgSource; duplicate: boolean }> {
  const content = cleanText(input.content);
  if (!content) throw new IngestError('There is no text to read in that.');
  const title = input.title.trim().slice(0, 200) || 'Untitled';
  const hash = contentHash(content);
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(orgSources).where(eq(orgSources.contentHash, hash));
    if (existing) return { source: existing, duplicate: true };
    const [source] = await tx
      .insert(orgSources)
      .values({ kind: input.kind, title, origin: input.origin?.slice(0, 2000) ?? null, content, contentHash: hash, addedBy: input.addedBy ?? null })
      .returning();
    const passages = splitPassages(content);
    if (passages.length) {
      await tx.insert(orgPassages).values(passages.map((p, ordinal) => ({ sourceId: source.id, ordinal, location: p.location, text: p.text })));
    }
    return { source, duplicate: false };
  });
}

export async function setSummary(db: Db, sourceId: string, summary: string): Promise<void> {
  await db.update(orgSources).set({ summary: summary.slice(0, 2000) }).where(eq(orgSources.id, sourceId));
}

export type SourceListItem = Pick<OrgSource, 'id' | 'kind' | 'title' | 'origin' | 'summary' | 'status' | 'hiddenReason' | 'addedBy' | 'createdAt'> & {
  characters: number;
  passages: number;
};

/** Everything the organization has told Inertia, newest first. Hidden sources only when asked. */
export async function listSources(db: Db, opts: { includeHidden?: boolean } = {}): Promise<SourceListItem[]> {
  const rows = await db
    .select({
      id: orgSources.id,
      kind: orgSources.kind,
      title: orgSources.title,
      origin: orgSources.origin,
      summary: orgSources.summary,
      status: orgSources.status,
      hiddenReason: orgSources.hiddenReason,
      addedBy: orgSources.addedBy,
      createdAt: orgSources.createdAt,
      characters: sql<number>`length(${orgSources.content})`,
      passages: sql<number>`count(${orgPassages.id})`,
    })
    .from(orgSources)
    .leftJoin(orgPassages, eq(orgPassages.sourceId, orgSources.id))
    .where(opts.includeHidden ? undefined : eq(orgSources.status, 'active'))
    .groupBy(orgSources.id)
    .orderBy(desc(orgSources.createdAt));
  return rows.map((row) => ({ ...row, characters: Number(row.characters), passages: Number(row.passages) }));
}

export async function getSource(db: Db, id: string): Promise<OrgSource | null> {
  const [row] = await db.select().from(orgSources).where(eq(orgSources.id, id));
  return row ?? null;
}

/** Hides a source from members and the assistant. Nothing is deleted; it can be restored. */
export async function hideSource(db: Db, id: string, by: string, reason: string): Promise<void> {
  await db.update(orgSources).set({ status: 'hidden', hiddenBy: by, hiddenReason: reason.trim().slice(0, 300) || 'Hidden by an admin' }).where(eq(orgSources.id, id));
}

export async function restoreSource(db: Db, id: string): Promise<void> {
  await db.update(orgSources).set({ status: 'active', hiddenBy: null, hiddenReason: null }).where(eq(orgSources.id, id));
}

export type PassageHit = { passageId: string; sourceId: string; title: string; kind: SourceKind; location: string; text: string };

/** Keyword search over visible passages, best matches first. */
export async function searchPassages(db: Db, query: string, limit = 8): Promise<PassageHit[]> {
  const q = query.trim().slice(0, 300);
  if (!q) return [];
  const rows = await db
    .select({
      passageId: orgPassages.id,
      sourceId: orgSources.id,
      title: orgSources.title,
      kind: orgSources.kind,
      location: orgPassages.location,
      text: orgPassages.text,
      rank: sql<number>`ts_rank(to_tsvector('english', ${orgPassages.text}), websearch_to_tsquery('english', ${q}))`,
    })
    .from(orgPassages)
    .innerJoin(orgSources, eq(orgPassages.sourceId, orgSources.id))
    .where(and(eq(orgSources.status, 'active'), sql`to_tsvector('english', ${orgPassages.text}) @@ websearch_to_tsquery('english', ${q})`))
    .orderBy(sql`5 desc`)
    .limit(limit);
  if (rows.length) return rows.map((row) => ({ passageId: row.passageId, sourceId: row.sourceId, title: row.title, kind: row.kind, location: row.location, text: row.text }));
  // No exact match: fall back to any word, so short or loose questions still find something.
  const words = q.split(/\s+/).filter((w) => w.length > 2).slice(0, 8).join(' or ');
  if (!words || words === q) return [];
  return searchPassages(db, words, limit);
}

/** The opening passages of each visible source, for drafting the profile. */
export async function sourceDigest(db: Db, perSource = 3, maxSources = 40): Promise<{ source: Pick<OrgSource, 'id' | 'title' | 'kind'>; passages: { id: string; location: string; text: string }[] }[]> {
  const sources = await db
    .select({ id: orgSources.id, title: orgSources.title, kind: orgSources.kind })
    .from(orgSources)
    .where(eq(orgSources.status, 'active'))
    .orderBy(desc(orgSources.createdAt))
    .limit(maxSources);
  const out = [];
  for (const source of sources) {
    const passages = await db
      .select({ id: orgPassages.id, location: orgPassages.location, text: orgPassages.text })
      .from(orgPassages)
      .where(eq(orgPassages.sourceId, source.id))
      .orderBy(orgPassages.ordinal)
      .limit(perSource);
    out.push({ source, passages });
  }
  return out;
}
