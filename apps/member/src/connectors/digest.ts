/** One chat line collected by a connector, before it becomes part of a digest. */
export type ChatLine = { conversationId: string; conversationName: string; at: Date; author: string; text: string; messageId: string };

export type Digest = { kind: 'chat-export'; title: string; text: string; origin: string };

const day = (d: Date) => d.toISOString().slice(0, 10);
const time = (d: Date) => d.toISOString().slice(11, 16);

/**
 * Collects chat lines and turns them into digests, one per conversation and
 * day, so org memory gets readable chunks instead of single messages.
 */
export class DigestBuffer {
  private lines = new Map<string, ChatLine[]>();

  constructor(private readonly source: string, private readonly maxChars = 20_000) {}

  add(line: ChatLine): void {
    const text = line.text.replace(/\s+/g, ' ').trim();
    if (!text) return;
    const key = `${line.conversationId}|${day(line.at)}`;
    const list = this.lines.get(key) ?? [];
    if (list.some((l) => l.messageId === line.messageId)) return;
    list.push({ ...line, text: text.slice(0, 4000) });
    this.lines.set(key, list);
  }

  get size(): number {
    let n = 0;
    for (const list of this.lines.values()) n += list.length;
    return n;
  }

  /** Empties the buffer into digests, splitting any conversation-day bigger than maxChars. */
  drain(): Digest[] {
    const digests: Digest[] = [];
    for (const list of this.lines.values()) {
      list.sort((a, b) => a.at.getTime() - b.at.getTime());
      let chunk: ChatLine[] = [];
      let length = 0;
      const flush = () => {
        if (!chunk.length) return;
        const first = chunk[0];
        const last = chunk[chunk.length - 1];
        digests.push({
          kind: 'chat-export',
          title: `${this.source}: ${first.conversationName} · ${day(first.at)}`,
          text: chunk.map((l) => `[${time(l.at)}] ${l.author}: ${l.text}`).join('\n'),
          origin: `${this.source.toLowerCase()}:${first.conversationId}:${first.messageId}-${last.messageId}`,
        });
        chunk = [];
        length = 0;
      };
      for (const line of list) {
        const size = line.text.length + line.author.length + 12;
        if (length + size > this.maxChars) flush();
        chunk.push(line);
        length += size;
      }
      flush();
    }
    this.lines.clear();
    return digests;
  }
}

/** Posts a digest to the app's ingest endpoint. */
export async function postDigest(appUrl: string, token: string, digest: Digest, fetchImpl: typeof fetch = fetch): Promise<void> {
  const response = await fetchImpl(`${appUrl.replace(/\/+$/, '')}/api/org/ingest`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(digest),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Ingest answered ${response.status}: ${(await response.text().catch(() => '')).slice(0, 200)}`);
}
