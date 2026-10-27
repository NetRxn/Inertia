import { describe, it, expect, beforeEach } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { type PluginDatabaseClient } from '@paperclipai/plugin-sdk';
import { createOrgStore } from '../../src/org/store.js';
import { createOrgService } from '../../src/org/service.js';
import { OrgError } from '../../src/org/contracts.js';
import type { OrgProfile, OrgMember } from '../../src/org/contracts.js';
import { validateShare, significance } from '../../src/org/sources.js';
import { createHostDb } from '../support/paperclip-host-db.js';

const rid = () => crypto.randomUUID();

describe('sources', () => {
  let db: PGlite;
  let hostDb: PluginDatabaseClient;
  let idCounter = 0;

  beforeEach(async () => {
    const host = await createHostDb();
    db = host.pg;
    hostDb = host.db;

    idCounter = 0;
  });

  const newId = () => `00000000-0000-4000-8000-${String(++idCounter).padStart(12, '0')}`;
  const OBJ1 = '1'.repeat(64);
  const OBJ2 = '2'.repeat(64);
  const OBJ3 = '3'.repeat(64);
  const clock = () => new Date('2026-10-26T12:00:00Z');

  describe('validateShare', () => {
    it('accepts https URL', () => {
      const result = validateShare({ kind: 'link', title: 'Example', url: 'https://example.com' });
      expect(result).toEqual({ kind: 'link', title: 'Example', url: 'https://example.com' });
    });

    it('accepts http URL', () => {
      const result = validateShare({ kind: 'link', title: 'Example', url: 'http://example.com' });
      expect(result).toEqual({ kind: 'link', title: 'Example', url: 'http://example.com' });
    });

    it('rejects javascript: URL', () => {
      expect(() => validateShare({ kind: 'link', title: 'Bad', url: 'javascript:alert(1)' }))
        .toThrow(OrgError);
    });

    it('rejects data: URL', () => {
      expect(() => validateShare({ kind: 'link', title: 'Bad', url: 'data:text/html,<script>alert(1)</script>' }))
        .toThrow(OrgError);
    });

    it('rejects empty title', () => {
      expect(() => validateShare({ kind: 'link', title: '', url: 'https://example.com' }))
        .toThrow(OrgError);
    });

    it('rejects title with control character', () => {
      expect(() => validateShare({ kind: 'link', title: 'Bad\x07Title', url: 'https://example.com' }))
        .toThrow(OrgError);
    });

    it('rejects file over 1 MiB', () => {
      const bytes = new Uint8Array(1048577);
      expect(() => validateShare({ kind: 'file', title: 'Big', mediaType: 'text/plain', bytes }))
        .toThrow(OrgError);
    });

    it('accepts file at exactly 1 MiB', () => {
      const bytes = new Uint8Array(1048576);
      const result = validateShare({ kind: 'file', title: 'Max', mediaType: 'text/plain', bytes });
      expect(result.kind).toBe('file');
      if (result.kind === 'file') {
        expect(result.bytes.length).toBe(1048576);
      }
    });

    it('rejects media type over 200 chars or without type/subtype form', () => {
      const bytes = new Uint8Array(1);
      expect(() => validateShare({ kind: 'file', title: 'F', mediaType: 'text/' + 'x'.repeat(200), bytes })).toThrow(OrgError);
      expect(() => validateShare({ kind: 'file', title: 'F', mediaType: 'not a type', bytes })).toThrow(OrgError);
      expect(validateShare({ kind: 'file', title: 'F', mediaType: 'application/vnd.ms-excel', bytes }).kind).toBe('file');
    });

    it('rejects URL over 2048 characters', () => {
      const url = 'https://example.com/' + 'a'.repeat(2048);
      expect(() => validateShare({ kind: 'link', title: 'Long', url })).toThrow(OrgError);
    });

    it('accepts note with text under 20k chars', () => {
      const text = 'x'.repeat(19999);
      const result = validateShare({ kind: 'note', title: 'Note', text });
      expect(result).toEqual({ kind: 'note', title: 'Note', text });
    });

    it('rejects note over 20k chars', () => {
      const text = 'x'.repeat(20001);
      expect(() => validateShare({ kind: 'note', title: 'Long', text }))
        .toThrow(OrgError);
    });
  });

  describe('significance', () => {
    it('calculates citations * 2 + pins', () => {
      expect(significance({ citations: 3, pins: 2 })).toBe(8);
      expect(significance({ citations: 0, pins: 5 })).toBe(5);
      expect(significance({ citations: 10, pins: 0 })).toBe(20);
    });
  });

  describe('service integration', () => {
    let store: ReturnType<typeof createOrgStore>;
    let service: ReturnType<typeof createOrgService>;
    const companyId = 'company1';
    const founderId = 'user1';
    const memberId = 'user2';
    const moderatorId = 'user3';

    beforeEach(async () => {
      store = createOrgStore(hostDb);
      service = createOrgService(store, clock, newId);

      await service.setup(companyId, founderId, { name: 'Test Org', displayName: 'Founder' });
      await service.addMember(companyId, founderId, { requestId: rid(), userId: memberId, displayName: 'Member', reason: 'test' });
      await service.addMember(companyId, founderId, { requestId: rid(), userId: moderatorId, displayName: 'Moderator', reason: 'test' });
      await service.setModerator(companyId, founderId, { requestId: rid(), userId: moderatorId, moderator: true, reason: 'test' });
    });

    describe('share', () => {
      it('stores link and logs source.share', async () => {
        const result = await service.share(companyId, founderId, { requestId: rid(), kind: 'link', title: 'Example', url: 'https://example.com' });

        expect(result.kind).toBe('link');
        expect(result.title).toBe('Example');
        expect(result.url).toBe('https://example.com');
        expect(result.sharedBy).toBe(founderId);
        expect(result.audience).toBe('members');

        const log = await store.listLog(companyId, 10);
        const shareEntry = log.find(e => e.action === 'source.share');
        expect(shareEntry).toBeDefined();
        expect(shareEntry!.subject).toBe(result.sourceKey);
      });

      it('appears in overview feed', async () => {
        await service.share(companyId, founderId, { requestId: rid(), kind: 'link', title: 'Example', url: 'https://example.com' });

        const overview = await service.overview(companyId, memberId);
        expect(overview).not.toBeNull();

        const shareEntry = overview!.feed.find(e => e.action === 'source.share');
        expect(shareEntry).toBeDefined();
      });

      it('rejects javascript: URL', async () => {
        await expect(service.share(companyId, founderId, { requestId: rid(), kind: 'link', title: 'Bad', url: 'javascript:alert(1)' }))
          .rejects.toThrow(OrgError);
      });

      it('rejects member without share permission', async () => {
        await expect(service.share(companyId, 'nonmember', { requestId: rid(), kind: 'link', title: 'Test', url: 'https://example.com' }))
          .rejects.toThrow(OrgError);
      });
    });

    describe('sources', () => {
      it('forbids member from calling sources()', async () => {
        await expect(service.sources(companyId, memberId, { hidden: false }))
          .rejects.toThrow(OrgError);
      });

      it('allows moderator to call sources()', async () => {
        await service.share(companyId, founderId, { requestId: rid(), kind: 'link', title: 'Example', url: 'https://example.com' });

        const sources = await service.sources(companyId, moderatorId, { hidden: false });
        expect(sources.length).toBe(1);
        expect(sources[0]!.title).toBe('Example');
      });

      it('includes feeds.tasks from objective intake', async () => {
        await db.exec(`
          INSERT INTO plugin_netrxn_inertia_e936d62b87.objective_intake (mapping_key, record)
          VALUES ('${OBJ1}', '{"key":"${OBJ1}","companyId":"${companyId}","version":1,"snapshot":{"sourceSystem":"test","sourceId":"s1","organizationId":"org1","revision":"r1","sourceHash":"h1","expectedPreviousHash":null,"authorRef":"a1","audience":"public","title":"Test Objective","text":"body","withdrawn":false},"nativeIssueId":"issue1","pending":false,"marker":"m1"}'::jsonb)
        `);

        const sources = await service.sources(companyId, moderatorId, { hidden: false });
        const objSource = sources.find(s => s.sourceKey === `objective:${OBJ1}`);

        expect(objSource).toBeDefined();
        expect(objSource!.feeds.tasks).toBe(1);
      });

      it('shows feeds.tasks = 0 for objective without nativeIssueId', async () => {
        await db.exec(`
          INSERT INTO plugin_netrxn_inertia_e936d62b87.objective_intake (mapping_key, record)
          VALUES ('${OBJ2}', '{"key":"${OBJ2}","companyId":"${companyId}","version":1,"snapshot":{"sourceSystem":"test","sourceId":"s2","organizationId":"org1","revision":"r1","sourceHash":"h2","expectedPreviousHash":null,"authorRef":"a1","audience":"public","title":"Pending Objective","text":"body","withdrawn":false},"nativeIssueId":null,"pending":true,"marker":"m2"}'::jsonb)
        `);

        const sources = await service.sources(companyId, moderatorId, { hidden: false });
        const objSource = sources.find(s => s.sourceKey === `objective:${OBJ2}`);

        expect(objSource).toBeDefined();
        expect(objSource!.feeds.tasks).toBe(0);
      });

      it('shows feeds.tasks = 0 for shared items', async () => {
        await service.share(companyId, founderId, { requestId: rid(), kind: 'link', title: 'Example', url: 'https://example.com' });

        const sources = await service.sources(companyId, moderatorId, { hidden: false });
        const linkSource = sources.find(s => s.kind === 'link');

        expect(linkSource).toBeDefined();
        expect(linkSource!.feeds.tasks).toBe(0);
      });
    });

    describe('hide and restore', () => {
      it('hides shared source and excludes from member feed', async () => {
        const shared = await service.share(companyId, founderId, { requestId: rid(), kind: 'link', title: 'Example', url: 'https://example.com' });

        await service.hide(companyId, moderatorId, { requestId: rid(), sourceKey: shared.sourceKey, reason: 'spam' });

        const overview = await service.overview(companyId, memberId);
        expect(overview!.feed.every(e => e.subject !== shared.sourceKey)).toBe(true);
        expect(overview!.keyDocuments.every(d => d.sourceKey !== shared.sourceKey)).toBe(true);
      });

      it('shows hidden source in sources({hidden:true})', async () => {
        const shared = await service.share(companyId, founderId, { requestId: rid(), kind: 'link', title: 'Example', url: 'https://example.com' });

        await service.hide(companyId, moderatorId, { requestId: rid(), sourceKey: shared.sourceKey, reason: 'spam' });

        const sources = await service.sources(companyId, moderatorId, { hidden: true });
        const hiddenSource = sources.find(s => s.sourceKey === shared.sourceKey);

        expect(hiddenSource).toBeDefined();
        expect(hiddenSource!.hidden).not.toBeNull();
        expect(hiddenSource!.hidden!.by).toBe(moderatorId);
        expect(hiddenSource!.hidden!.reason).toBe('spam');
      });

      it('moderator sees hide entries in feed', async () => {
        const shared = await service.share(companyId, founderId, { requestId: rid(), kind: 'link', title: 'Example', url: 'https://example.com' });

        await service.hide(companyId, moderatorId, { requestId: rid(), sourceKey: shared.sourceKey, reason: 'spam' });

        const overview = await service.overview(companyId, moderatorId);
        const hideEntry = overview!.feed.find(e => e.action === 'source.hide');

        expect(hideEntry).toBeDefined();
        expect(hideEntry!.subject).toBe(shared.sourceKey);
      });

      it('restores source and logs source.restore', async () => {
        const shared = await service.share(companyId, founderId, { requestId: rid(), kind: 'link', title: 'Example', url: 'https://example.com' });

        await service.hide(companyId, moderatorId, { requestId: rid(), sourceKey: shared.sourceKey, reason: 'spam' });
        await service.restore(companyId, moderatorId, { requestId: rid(), sourceKey: shared.sourceKey, reason: 'false alarm' });

        const sources = await service.sources(companyId, moderatorId, { hidden: false });
        const restoredSource = sources.find(s => s.sourceKey === shared.sourceKey);

        expect(restoredSource).toBeDefined();
        expect(restoredSource!.hidden).toBeNull();

        const log = await store.listLog(companyId, 20);
        const restoreEntry = log.find(e => e.action === 'source.restore');

        expect(restoreEntry).toBeDefined();
        expect(restoreEntry!.subject).toBe(shared.sourceKey);
      });

      it('hides objective source without touching objective_intake', async () => {
        await db.exec(`
          INSERT INTO plugin_netrxn_inertia_e936d62b87.objective_intake (mapping_key, record)
          VALUES ('${OBJ3}', '{"key":"${OBJ3}","companyId":"${companyId}","version":1,"snapshot":{"sourceSystem":"test","sourceId":"s3","organizationId":"org1","revision":"r1","sourceHash":"h3","expectedPreviousHash":null,"authorRef":"a1","audience":"public","title":"Test Objective","text":"body","withdrawn":false},"nativeIssueId":"issue3","pending":false,"marker":"m3"}'::jsonb)
        `);

        await service.hide(companyId, moderatorId, { requestId: rid(), sourceKey: `objective:${OBJ3}`, reason: 'spam' });

        const hidden = await store.isHidden(companyId, `objective:${OBJ3}`);
        expect(hidden).toBe(true);

        const intake = await db.query('SELECT * FROM plugin_netrxn_inertia_e936d62b87.objective_intake WHERE mapping_key=$1', [OBJ3]);
        expect(intake.rows.length).toBe(1);
      });

      it('throws invalid for hide of non-existent share: key', async () => {
        await expect(service.hide(companyId, moderatorId, { requestId: rid(), sourceKey: 'share:nonexistent', reason: 'spam' }))
          .rejects.toThrow(OrgError);
      });

      it('throws invalid for restore of non-existent share: key', async () => {
        await expect(service.restore(companyId, moderatorId, { requestId: rid(), sourceKey: 'share:nonexistent', reason: 'oops' }))
          .rejects.toThrow(OrgError);
      });
    });

    describe('overview', () => {
      it('returns null before setup', async () => {
        const newCompany = 'company2';
        const overview = await service.overview(newCompany, founderId);
        expect(overview).toBeNull();
      });

      it('forbids non-member after setup', async () => {
        await expect(service.overview(companyId, 'stranger'))
          .rejects.toThrow(OrgError);
      });

      it('returns profile, role, feed, keyDocuments, initiatives', async () => {
        await service.share(companyId, founderId, { requestId: rid(), kind: 'link', title: 'Example', url: 'https://example.com' });

        const overview = await service.overview(companyId, memberId);

        expect(overview).not.toBeNull();
        expect(overview!.profile.name).toBe('Test Org');
        expect(overview!.role).toBe('member');
        expect(overview!.feed.length).toBeGreaterThan(0);
        expect(overview!.keyDocuments).toBeDefined();
        expect(overview!.initiatives).toEqual([]);
      });

      it('orders keyDocuments by significance (citations*2 + pins)', async () => {
        const s1 = await service.share(companyId, founderId, { requestId: rid(), kind: 'link', title: 'Low', url: 'https://low.com' });
        const s2 = await service.share(companyId, founderId, { requestId: rid(), kind: 'link', title: 'High', url: 'https://high.com' });
        const s3 = await service.share(companyId, founderId, { requestId: rid(), kind: 'link', title: 'Medium', url: 'https://medium.com' });

        await service.pin(companyId, founderId, { requestId: rid(), sourceKey: s2.sourceKey });
        await service.pin(companyId, memberId, { requestId: rid(), sourceKey: s2.sourceKey });
        await service.pin(companyId, moderatorId, { requestId: rid(), sourceKey: s2.sourceKey });

        await service.pin(companyId, founderId, { requestId: rid(), sourceKey: s3.sourceKey });

        const overview = await service.overview(companyId, memberId);

        expect(overview!.keyDocuments.length).toBeGreaterThan(0);
        expect(overview!.keyDocuments[0]!.title).toBe('High');
        expect(overview!.keyDocuments[0]!.score).toBe(3);
      });

      it('limits keyDocuments to top 5', async () => {
        for (let i = 0; i < 10; i++) {
          await service.share(companyId, founderId, { requestId: rid(), kind: 'link', title: `Doc ${i}`, url: `https://doc${i}.com` });
        }

        const overview = await service.overview(companyId, memberId);
        expect(overview!.keyDocuments.length).toBeLessThanOrEqual(5);
      });

      it('limits feed to 50 entries', async () => {
        for (let i = 0; i < 60; i++) {
          await service.share(companyId, founderId, { requestId: rid(), kind: 'link', title: `Link ${i}`, url: `https://link${i}.com` });
        }

        const overview = await service.overview(companyId, memberId);
        expect(overview!.feed.length).toBeLessThanOrEqual(50);
      });
    });

    describe('pin', () => {
      it('adds pin and increases count', async () => {
        const shared = await service.share(companyId, founderId, { requestId: rid(), kind: 'link', title: 'Example', url: 'https://example.com' });

        await service.pin(companyId, memberId, { requestId: rid(), sourceKey: shared.sourceKey });

        const sources = await service.sources(companyId, moderatorId, { hidden: false });
        const pinned = sources.find(s => s.sourceKey === shared.sourceKey);

        expect(pinned!.pins).toBe(1);
      });

      it('logs source.pin', async () => {
        const shared = await service.share(companyId, founderId, { requestId: rid(), kind: 'link', title: 'Example', url: 'https://example.com' });

        await service.pin(companyId, memberId, { requestId: rid(), sourceKey: shared.sourceKey });

        const log = await store.listLog(companyId, 20);
        const pinEntry = log.find(e => e.action === 'source.pin');

        expect(pinEntry).toBeDefined();
        expect(pinEntry!.subject).toBe(shared.sourceKey);
      });
    });

    async function insertObjective(key: string, snapshot: Record<string, unknown> = {}) {
      const record = {
        key, companyId, version: 1,
        snapshot: { sourceSystem: 'Drive sync', sourceId: 's', organizationId: 'org1', revision: 'r1', sourceHash: 'h', expectedPreviousHash: null, authorRef: 'a1', audience: 'public', title: 'Objective', text: 'body', withdrawn: false, ...snapshot },
        nativeIssueId: null, pending: false, marker: 'm',
      };
      await db.query('INSERT INTO plugin_netrxn_inertia_e936d62b87.objective_intake (mapping_key, record) VALUES ($1, $2::jsonb)', [key, JSON.stringify(record)]);
    }

    describe('objective sources', () => {
      it('sources({kind:"objective"}) returns only objective rows', async () => {
        await service.share(companyId, founderId, { requestId: rid(), kind: 'link', title: 'Example', url: 'https://example.com' });
        await insertObjective(OBJ1);
        const sources = await service.sources(companyId, moderatorId, { kind: 'objective', hidden: true });
        expect(sources.map(s => s.kind)).toEqual(['objective']);
      });

      it('maps sharedBy, createdAt, audience and the stored hidden marker honestly', async () => {
        await insertObjective(OBJ1, { audience: 'restricted' });
        await insertObjective(OBJ2, { audience: 'members' });
        await service.hide(companyId, moderatorId, { requestId: rid(), sourceKey: `objective:${OBJ1}`, reason: 'spam' });

        const sources = await service.sources(companyId, moderatorId, { kind: 'objective', hidden: true });
        const restricted = sources.find(s => s.sourceKey === `objective:${OBJ1}`)!;
        const members = sources.find(s => s.sourceKey === `objective:${OBJ2}`)!;
        expect(restricted.sharedBy).toBe('Drive sync');
        expect(restricted.audience).toBe('moderators');
        expect(members.audience).toBe('members');
        expect(restricted.createdAt).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
        expect(restricted.hidden).toEqual({ by: moderatorId, at: clock().toISOString(), reason: 'spam' });
        expect(members.hidden).toBeNull();
      });

      it('refuses to hide an objective key with no intake row, creating no stub', async () => {
        await expect(service.hide(companyId, moderatorId, { requestId: rid(), sourceKey: `objective:${OBJ2}`, reason: 'spam' }))
          .rejects.toMatchObject({ kind: 'invalid' });
        expect(await store.isHidden(companyId, `objective:${OBJ2}`)).toBe(false);
      });

      it('refuses to hide an objective that belongs to another company', async () => {
        const record = { key: OBJ2, companyId: 'other-co', version: 1, snapshot: { title: 'Foreign', audience: 'public', sourceSystem: 'x' }, nativeIssueId: null, pending: false, marker: 'm' };
        await db.query('INSERT INTO plugin_netrxn_inertia_e936d62b87.objective_intake (mapping_key, record) VALUES ($1, $2::jsonb)', [OBJ2, JSON.stringify(record)]);
        await expect(service.hide(companyId, moderatorId, { requestId: rid(), sourceKey: `objective:${OBJ2}`, reason: 'spam' }))
          .rejects.toMatchObject({ kind: 'invalid' });
      });

      it('after hide and restore of an objective, no stub shows as a shared item or key document', async () => {
        await insertObjective(OBJ1);
        await service.hide(companyId, moderatorId, { requestId: rid(), sourceKey: `objective:${OBJ1}`, reason: 'spam' });
        await service.restore(companyId, moderatorId, { requestId: rid(), sourceKey: `objective:${OBJ1}`, reason: 'ok' });

        const overview = await service.overview(companyId, memberId);
        expect(overview!.keyDocuments).toEqual([]);
        expect(await store.listSources(companyId, { includeHidden: true, limit: 100 })).toEqual([]);
        const sources = await service.sources(companyId, moderatorId, { hidden: true });
        expect(sources.filter(s => s.sourceKey === `objective:${OBJ1}`)).toHaveLength(1);
        expect(sources[0]!.title).toBe('Objective');
      });

      it('rejects malformed source keys in hide, restore and pin', async () => {
        for (const sourceKey of ['share:nope', 'objective:abc', 'other:1', '']) {
          await expect(service.hide(companyId, moderatorId, { requestId: rid(), sourceKey, reason: 'spam' })).rejects.toMatchObject({ kind: 'invalid' });
          await expect(service.restore(companyId, moderatorId, { requestId: rid(), sourceKey, reason: 'ok' })).rejects.toMatchObject({ kind: 'invalid' });
          await expect(service.pin(companyId, memberId, { requestId: rid(), sourceKey })).rejects.toMatchObject({ kind: 'invalid' });
        }
      });
    });

    describe('pin rules', () => {
      it('refuses a well-formed key for a source that does not exist and logs nothing', async () => {
        await expect(service.pin(companyId, memberId, { requestId: rid(), sourceKey: 'share:00000000-0000-4000-8000-999999999999' }))
          .rejects.toMatchObject({ kind: 'invalid' });
        expect((await store.listLog(companyId, 50)).some(e => e.action === 'source.pin')).toBe(false);
      });

      it('refuses a member pinning a hidden source; a moderator may', async () => {
        const shared = await service.share(companyId, founderId, { requestId: rid(), kind: 'link', title: 'Example', url: 'https://example.com' });
        await service.hide(companyId, moderatorId, { requestId: rid(), sourceKey: shared.sourceKey, reason: 'spam' });
        await expect(service.pin(companyId, memberId, { requestId: rid(), sourceKey: shared.sourceKey })).rejects.toMatchObject({ kind: 'invalid' });
        await service.pin(companyId, moderatorId, { requestId: rid(), sourceKey: shared.sourceKey });
      });

      it('lets a member pin a visible objective but not a restricted one', async () => {
        await insertObjective(OBJ1);
        await insertObjective(OBJ2, { audience: 'restricted' });
        await service.pin(companyId, memberId, { requestId: rid(), sourceKey: `objective:${OBJ1}` });
        await expect(service.pin(companyId, memberId, { requestId: rid(), sourceKey: `objective:${OBJ2}` })).rejects.toMatchObject({ kind: 'invalid' });
        const sources = await service.sources(companyId, moderatorId, { kind: 'objective', hidden: false });
        expect(sources.find(s => s.sourceKey === `objective:${OBJ1}`)!.pins).toBe(1);
      });

      it('logs source.pin only once when the same user pins twice', async () => {
        const shared = await service.share(companyId, founderId, { requestId: rid(), kind: 'link', title: 'Example', url: 'https://example.com' });
        await service.pin(companyId, memberId, { requestId: rid(), sourceKey: shared.sourceKey });
        await service.pin(companyId, memberId, { requestId: rid(), sourceKey: shared.sourceKey });
        expect((await store.listLog(companyId, 50)).filter(e => e.action === 'source.pin')).toHaveLength(1);
      });
    });

    describe('isHidden', () => {
      it('returns true for hidden source', async () => {
        const shared = await service.share(companyId, founderId, { requestId: rid(), kind: 'link', title: 'Example', url: 'https://example.com' });
        await service.hide(companyId, moderatorId, { requestId: rid(), sourceKey: shared.sourceKey, reason: 'spam' });

        const hidden = await service.isHidden(companyId, shared.sourceKey);
        expect(hidden).toBe(true);
      });

      it('returns false for visible source', async () => {
        const shared = await service.share(companyId, founderId, { requestId: rid(), kind: 'link', title: 'Example', url: 'https://example.com' });

        const hidden = await service.isHidden(companyId, shared.sourceKey);
        expect(hidden).toBe(false);
      });

      it('returns false for non-existent source', async () => {
        const hidden = await service.isHidden(companyId, 'share:nonexistent');
        expect(hidden).toBe(false);
      });
    });
  });
});
