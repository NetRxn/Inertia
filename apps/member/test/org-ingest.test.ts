import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTestDb } from '../src/db/test-db';
import type { Db } from '../src/db/client';
import { members, orgPassages, orgSources } from '../src/db/schema';
import {
  addSource,
  fileToText,
  hideSource,
  htmlToText,
  IngestError,
  listSources,
  restoreSource,
  searchPassages,
  splitPassages,
  telegramExportToText,
  transcriptToText,
} from '../src/org/ingest';
import { addMember, ensureFounder, listMembers, MemberError, removeMember, setRole } from '../src/org/members';

let db: Db;

beforeAll(async () => {
  db = (await createTestDb()) as Db;
});

beforeEach(async () => {
  await db.delete(orgPassages);
  await db.delete(orgSources);
  await db.delete(members);
});

describe('reading sources', () => {
  it('strips transcript timing but keeps who said what', () => {
    const vtt = 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:04.000\nAna: We should apply for the library grant.\n';
    expect(transcriptToText(vtt).trim()).toBe('Ana: We should apply for the library grant.');
  });

  it('turns a Telegram export into dated lines, including formatted text', () => {
    const json = JSON.stringify({
      name: 'FWTX DAO',
      messages: [
        { type: 'message', date: '2026-10-20T12:30:00', from: 'Rob', text: 'I can host the workshop' },
        { type: 'service', date: '2026-10-20T12:31:00', text: 'joined' },
        { type: 'message', date: '2026-10-21T09:00:00', from: 'Ana', text: [{ type: 'bold', text: 'Yes' }, ' please'] },
      ],
    });
    const chat = telegramExportToText(json);
    expect(chat.title).toBe('Telegram: FWTX DAO');
    expect(chat.text).toBe('[2026-10-20 12:30] Rob: I can host the workshop\n[2026-10-21 09:00] Ana: Yes please');
    expect(() => telegramExportToText('{"hello":1}')).toThrow(IngestError);
  });

  it('reads page text without scripts or markup', () => {
    const page = htmlToText('<html><head><title>FWTX DAO</title><script>alert(1)</script></head><body><h1>Builders</h1><p>Weekly &amp; open</p></body></html>');
    expect(page.title).toBe('FWTX DAO');
    expect(page.text).toContain('Builders');
    expect(page.text).toContain('Weekly & open');
    expect(page.text).not.toContain('alert');
  });

  it('picks a reader by file type and refuses what it cannot read', () => {
    const bytes = new TextEncoder().encode('Notes from the roundtable');
    expect(fileToText('Roundtable notes.md', bytes).kind).toBe('meeting');
    expect(fileToText('budget.txt', bytes).kind).toBe('document');
    expect(() => fileToText('recording.mp3', bytes)).toThrow(IngestError);
  });

  it('splits long text into bounded passages with line ranges', () => {
    const text = Array.from({ length: 60 }, (_, i) => `Line ${i + 1} ${'word '.repeat(10)}`).join('\n');
    const passages = splitPassages(text, 400);
    expect(passages.length).toBeGreaterThan(3);
    expect(passages[0].location).toMatch(/^lines 1–\d+$/);
    expect(passages.every((p) => p.text.length <= 460)).toBe(true);
    expect(splitPassages('x'.repeat(5000), 1000).every((p) => p.text.length <= 1000)).toBe(true);
  });
});

describe('org memory', () => {
  it('stores a source once, finds it by keyword and hides it on request', async () => {
    const first = await addSource(db, { kind: 'meeting', title: 'October roundtable', content: 'Ana: We should apply for the library grant.\n\nRob: I can draft the budget.' });
    const again = await addSource(db, { kind: 'meeting', title: 'Same file again', content: 'Ana: We should apply for the library grant.\n\nRob: I can draft the budget.' });
    expect(again.duplicate).toBe(true);
    expect(again.source.id).toBe(first.source.id);

    const hits = await searchPassages(db, 'library grant');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ sourceId: first.source.id, title: 'October roundtable', kind: 'meeting' });

    const [admin] = await db.insert(members).values({ externalId: 'a', email: 'a@example.org', displayName: 'A', role: 'admin' }).returning();
    await hideSource(db, first.source.id, admin.id, 'Wrong meeting');
    expect(await searchPassages(db, 'library grant')).toHaveLength(0);
    expect(await listSources(db)).toHaveLength(0);
    expect((await listSources(db, { includeHidden: true }))[0]).toMatchObject({ status: 'hidden', hiddenReason: 'Wrong meeting' });
    await restoreSource(db, first.source.id);
    expect(await searchPassages(db, 'library grant')).toHaveLength(1);
  });

  it('falls back to any word when no passage matches every word', async () => {
    await addSource(db, { kind: 'note', title: 'Venue', content: 'CreateFW hosts the Wednesday roundtable.' });
    expect(await searchPassages(db, 'who hosts our weekly roundtable')).toHaveLength(1);
  });

  it('refuses empty sources', async () => {
    await expect(addSource(db, { kind: 'note', title: 'Empty', content: '  \n ' })).rejects.toThrow(IngestError);
  });
});

describe('members', () => {
  it('makes the founder the first admin only once', async () => {
    expect(await ensureFounder(db, 'Kyle@Example.org', 'Kyle')).toBe(true);
    expect(await ensureFounder(db, 'someone@example.org')).toBe(false);
    const rows = await listMembers(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ email: 'kyle@example.org', role: 'admin', origin: 'local' });
  });

  it('lets admins add, promote and remove members but keeps one admin', async () => {
    await ensureFounder(db, 'kyle@example.org', 'Kyle');
    const admin = { role: 'admin' as const };
    const john = await addMember(db, admin, { email: 'john@example.org', displayName: 'John' });
    await expect(addMember(db, admin, { email: 'john@example.org', displayName: 'John' })).rejects.toThrow(MemberError);
    await expect(addMember(db, { role: 'member' }, { email: 'x@example.org', displayName: 'X' })).rejects.toThrow(MemberError);
    await setRole(db, admin, john.id, 'admin');
    await removeMember(db, admin, john.id);
    const kyle = (await listMembers(db)).find((m) => m.email === 'kyle@example.org')!;
    await expect(removeMember(db, admin, kyle.id)).rejects.toThrow(MemberError);
    await expect(setRole(db, admin, kyle.id, 'member')).rejects.toThrow(MemberError);
    expect((await listMembers(db)).find((m) => m.id === john.id)?.status).toBe('inactive');
  });
});
