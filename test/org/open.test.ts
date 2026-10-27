import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { createOrgStore } from '../../src/org/store.js';
import { createOrgService, type OrgService } from '../../src/org/service.js';
import { BRIDGE_NAMESPACE } from '../../src/store/postgres.js';
import { createHostDb, type HostDb } from '../support/paperclip-host-db.js';

const rid = () => crypto.randomUUID();
const co = 'co';

let host: HostDb;
let service: OrgService;

beforeEach(async () => {
  host = await createHostDb();
  service = createOrgService(createOrgStore(host.db), () => new Date('2026-10-26T12:00:00Z'), () => rid());
  await service.setup(co, 'alice', { name: 'DAO', displayName: 'Alice Founder' });
  await service.addMember(co, 'alice', { requestId: rid(), userId: 'bob', displayName: 'Bob Member', reason: 'r' });
  await service.addMember(co, 'alice', { requestId: rid(), userId: 'mod', displayName: 'Mo Derator', reason: 'r' });
  await service.setModerator(co, 'alice', { requestId: rid(), userId: 'mod', moderator: true, reason: 'r' });
}, 60000);

afterEach(async () => {
  await host.close();
});

describe('open', () => {
  it('a member opens a link, a note and a file someone else shared', async () => {
    const link = await service.share(co, 'mod', { requestId: rid(), kind: 'link', title: 'Charter', url: 'https://example.com/charter' });
    const text = 'Line one\nnaïve café — 🚀👩‍👩‍👧 done';
    const note = await service.share(co, 'mod', { requestId: rid(), kind: 'note', title: 'Minutes', text });
    const bytes = new Uint8Array(256).map((_, i) => i);
    const file = await service.share(co, 'mod', { requestId: rid(), kind: 'file', title: 'blob.bin', mediaType: 'application/octet-stream', bytes });

    expect(await service.open(co, 'bob', { sourceKey: link.sourceKey })).toEqual({ kind: 'link', title: 'Charter', url: 'https://example.com/charter' });
    expect(await service.open(co, 'bob', { sourceKey: note.sourceKey })).toEqual({ kind: 'note', title: 'Minutes', text });
    expect(note.byteLength).toBe(new TextEncoder().encode(text).length);

    const opened = await service.open(co, 'bob', { sourceKey: file.sourceKey });
    expect(opened).toMatchObject({ kind: 'file', title: 'blob.bin', mediaType: 'application/octet-stream' });
    const back = Buffer.from((opened as { base64: string }).base64, 'base64');
    expect(back.equals(Buffer.from(bytes))).toBe(true);
    expect(file.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
  });

  it('a hidden item reads as missing to a member, with the same message; moderators and the founder can open it', async () => {
    const shared = await service.share(co, 'bob', { requestId: rid(), kind: 'link', title: 'Spam', url: 'https://spam.example' });
    await service.hide(co, 'mod', { requestId: rid(), sourceKey: shared.sourceKey, reason: 'spam' });

    const hidden = await service.open(co, 'bob', { sourceKey: shared.sourceKey }).catch(e => e);
    const missing = await service.open(co, 'bob', { sourceKey: `share:${rid()}` }).catch(e => e);
    expect(hidden).toMatchObject({ kind: 'invalid', message: 'Source not found.' });
    expect(missing).toMatchObject({ kind: 'invalid', message: 'Source not found.' });

    expect(await service.open(co, 'mod', { sourceKey: shared.sourceKey })).toMatchObject({ kind: 'link', title: 'Spam' });
    expect(await service.open(co, 'alice', { sourceKey: shared.sourceKey })).toMatchObject({ kind: 'link' });
  });

  it('objective sources open from their task; non-members are refused; malformed keys are invalid', async () => {
    await expect(service.open(co, 'bob', { sourceKey: `objective:${'a'.repeat(64)}` })).rejects.toMatchObject({ kind: 'invalid', message: 'Open this source from its task.' });
    const shared = await service.share(co, 'bob', { requestId: rid(), kind: 'link', title: 'Doc', url: 'https://example.com' });
    await expect(service.open(co, 'stranger', { sourceKey: shared.sourceKey })).rejects.toMatchObject({ kind: 'forbidden' });
    await expect(service.open(co, 'bob', { sourceKey: 'share:../../etc' })).rejects.toMatchObject({ kind: 'invalid' });
  });
});

describe('overview labels', () => {
  it('names feed actors and subjects; a member never gets a hidden title, a moderator does', async () => {
    const visible = await service.share(co, 'bob', { requestId: rid(), kind: 'link', title: 'Visible doc', url: 'https://example.com/v' });
    const hidden = await service.share(co, 'bob', { requestId: rid(), kind: 'link', title: 'Secret spam title', url: 'https://example.com/h' });
    await service.hide(co, 'mod', { requestId: rid(), sourceKey: hidden.sourceKey, reason: 'spam' });

    const member = (await service.overview(co, 'bob'))!;
    expect(member.labels).toMatchObject({ alice: 'Alice Founder', bob: 'Bob Member', mod: 'Mo Derator', [visible.sourceKey]: 'Visible doc' });
    expect(member.labels[hidden.sourceKey]).toBeUndefined();
    expect(JSON.stringify(member)).not.toContain('Secret spam title');

    const moderator = (await service.overview(co, 'mod'))!;
    expect(moderator.labels[hidden.sourceKey]).toBe('Secret spam title');
  });

  it('labels objective subjects only when the viewer may see them', async () => {
    const open = 'b'.repeat(64);
    const restricted = 'c'.repeat(64);
    for (const [key, audience] of [[open, 'members'], [restricted, 'restricted']] as const) {
      await host.pg.query(`INSERT INTO ${BRIDGE_NAMESPACE}.objective_intake (mapping_key, record) VALUES ($1, $2::jsonb)`, [key, JSON.stringify({ companyId: co, snapshot: { title: `Objective ${audience}`, audience, sourceSystem: 's' } })]);
      await service.pin(co, 'mod', { requestId: rid(), sourceKey: `objective:${key}` });
    }
    const member = (await service.overview(co, 'bob'))!;
    expect(member.labels[`objective:${open}`]).toBe('Objective members');
    expect(member.labels[`objective:${restricted}`]).toBeUndefined();
    const moderator = (await service.overview(co, 'mod'))!;
    expect(moderator.labels[`objective:${restricted}`]).toBe('Objective restricted');
  });
});
