import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { type PluginDatabaseClient } from '@paperclipai/plugin-sdk';
import { createOrgStore } from '../../src/org/store.js';
import { createOrgService } from '../../src/org/service.js';
import { OrgError } from '../../src/org/contracts.js';
import type { OrgProfile, OrgMember } from '../../src/org/contracts.js';
import { validateShare, significance } from '../../src/org/sources.js';
import { readFile } from 'node:fs/promises';

describe('sources', () => {
  let db: PGlite;
  let hostDb: PluginDatabaseClient;
  let idCounter = 0;

  beforeEach(async () => {
    db = new PGlite();
    hostDb = {
      namespace: 'plugin_netrxn_inertia_e936d62b87',
      query: async <T>(sql: string, params?: unknown[]) => {
        const res = await db.query<T>(sql, params);
        return res.rows;
      },
      execute: async (sql: string, params?: unknown[]) => {
        const res = await db.query(sql, params);
        return { rowCount: res.affectedRows ?? 0 };
      }
    };

    await db.exec('CREATE SCHEMA plugin_netrxn_inertia_e936d62b87');

    const migrations = [
      await readFile(new URL('../../migrations/007_objective_intake.sql', import.meta.url), 'utf-8'),
      await readFile(new URL('../../migrations/009_org_profile.sql', import.meta.url), 'utf-8')
    ];

    for (const migration of migrations) {
      await db.exec(migration);
    }

    idCounter = 0;
  });

  const newId = () => `id${++idCounter}`;
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
      await service.addMember(companyId, founderId, { userId: memberId, displayName: 'Member', reason: 'test' });
      await service.addMember(companyId, founderId, { userId: moderatorId, displayName: 'Moderator', reason: 'test' });
      await service.setModerator(companyId, founderId, { userId: moderatorId, moderator: true, reason: 'test' });
    });

    describe('share', () => {
      it('stores link and logs source.share', async () => {
        const result = await service.share(companyId, founderId, { kind: 'link', title: 'Example', url: 'https://example.com' });

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
        await service.share(companyId, founderId, { kind: 'link', title: 'Example', url: 'https://example.com' });

        const overview = await service.overview(companyId, memberId);
        expect(overview).not.toBeNull();

        const shareEntry = overview!.feed.find(e => e.action === 'source.share');
        expect(shareEntry).toBeDefined();
      });

      it('rejects javascript: URL', async () => {
        await expect(service.share(companyId, founderId, { kind: 'link', title: 'Bad', url: 'javascript:alert(1)' }))
          .rejects.toThrow(OrgError);
      });

      it('rejects member without share permission', async () => {
        await expect(service.share(companyId, 'nonmember', { kind: 'link', title: 'Test', url: 'https://example.com' }))
          .rejects.toThrow(OrgError);
      });
    });

    describe('sources', () => {
      it('forbids member from calling sources()', async () => {
        await expect(service.sources(companyId, memberId, { hidden: false }))
          .rejects.toThrow(OrgError);
      });

      it('allows moderator to call sources()', async () => {
        await service.share(companyId, founderId, { kind: 'link', title: 'Example', url: 'https://example.com' });

        const sources = await service.sources(companyId, moderatorId, { hidden: false });
        expect(sources.length).toBe(1);
        expect(sources[0]!.title).toBe('Example');
      });

      it('includes feeds.tasks from objective intake', async () => {
        await db.exec(`
          INSERT INTO plugin_netrxn_inertia_e936d62b87.objective_intake (mapping_key, record)
          VALUES ('obj1', '{"key":"obj1","companyId":"${companyId}","version":1,"snapshot":{"sourceSystem":"test","sourceId":"s1","organizationId":"org1","revision":"r1","sourceHash":"h1","expectedPreviousHash":null,"authorRef":"a1","audience":"public","title":"Test Objective","text":"body","withdrawn":false},"nativeIssueId":"issue1","pending":false,"marker":"m1"}'::jsonb)
        `);

        const sources = await service.sources(companyId, moderatorId, { hidden: false });
        const objSource = sources.find(s => s.sourceKey === 'objective:obj1');

        expect(objSource).toBeDefined();
        expect(objSource!.feeds.tasks).toBe(1);
      });

      it('shows feeds.tasks = 0 for objective without nativeIssueId', async () => {
        await db.exec(`
          INSERT INTO plugin_netrxn_inertia_e936d62b87.objective_intake (mapping_key, record)
          VALUES ('obj2', '{"key":"obj2","companyId":"${companyId}","version":1,"snapshot":{"sourceSystem":"test","sourceId":"s2","organizationId":"org1","revision":"r1","sourceHash":"h2","expectedPreviousHash":null,"authorRef":"a1","audience":"public","title":"Pending Objective","text":"body","withdrawn":false},"nativeIssueId":null,"pending":true,"marker":"m2"}'::jsonb)
        `);

        const sources = await service.sources(companyId, moderatorId, { hidden: false });
        const objSource = sources.find(s => s.sourceKey === 'objective:obj2');

        expect(objSource).toBeDefined();
        expect(objSource!.feeds.tasks).toBe(0);
      });

      it('shows feeds.tasks = 0 for shared items', async () => {
        await service.share(companyId, founderId, { kind: 'link', title: 'Example', url: 'https://example.com' });

        const sources = await service.sources(companyId, moderatorId, { hidden: false });
        const linkSource = sources.find(s => s.kind === 'link');

        expect(linkSource).toBeDefined();
        expect(linkSource!.feeds.tasks).toBe(0);
      });
    });

    describe('hide and restore', () => {
      it('hides shared source and excludes from member feed', async () => {
        const shared = await service.share(companyId, founderId, { kind: 'link', title: 'Example', url: 'https://example.com' });

        await service.hide(companyId, moderatorId, { sourceKey: shared.sourceKey, reason: 'spam' });

        const overview = await service.overview(companyId, memberId);
        expect(overview!.feed.every(e => e.subject !== shared.sourceKey)).toBe(true);
        expect(overview!.keyDocuments.every(d => d.sourceKey !== shared.sourceKey)).toBe(true);
      });

      it('shows hidden source in sources({hidden:true})', async () => {
        const shared = await service.share(companyId, founderId, { kind: 'link', title: 'Example', url: 'https://example.com' });

        await service.hide(companyId, moderatorId, { sourceKey: shared.sourceKey, reason: 'spam' });

        const sources = await service.sources(companyId, moderatorId, { hidden: true });
        const hiddenSource = sources.find(s => s.sourceKey === shared.sourceKey);

        expect(hiddenSource).toBeDefined();
        expect(hiddenSource!.hidden).not.toBeNull();
        expect(hiddenSource!.hidden!.by).toBe(moderatorId);
        expect(hiddenSource!.hidden!.reason).toBe('spam');
      });

      it('moderator sees hide entries in feed', async () => {
        const shared = await service.share(companyId, founderId, { kind: 'link', title: 'Example', url: 'https://example.com' });

        await service.hide(companyId, moderatorId, { sourceKey: shared.sourceKey, reason: 'spam' });

        const overview = await service.overview(companyId, moderatorId);
        const hideEntry = overview!.feed.find(e => e.action === 'source.hide');

        expect(hideEntry).toBeDefined();
        expect(hideEntry!.subject).toBe(shared.sourceKey);
      });

      it('restores source and logs source.restore', async () => {
        const shared = await service.share(companyId, founderId, { kind: 'link', title: 'Example', url: 'https://example.com' });

        await service.hide(companyId, moderatorId, { sourceKey: shared.sourceKey, reason: 'spam' });
        await service.restore(companyId, moderatorId, { sourceKey: shared.sourceKey, reason: 'false alarm' });

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
          VALUES ('obj3', '{"key":"obj3","companyId":"${companyId}","version":1,"snapshot":{"sourceSystem":"test","sourceId":"s3","organizationId":"org1","revision":"r1","sourceHash":"h3","expectedPreviousHash":null,"authorRef":"a1","audience":"public","title":"Test Objective","text":"body","withdrawn":false},"nativeIssueId":"issue3","pending":false,"marker":"m3"}'::jsonb)
        `);

        await service.hide(companyId, moderatorId, { sourceKey: 'objective:obj3', reason: 'spam' });

        const hidden = await store.isHidden(companyId, 'objective:obj3');
        expect(hidden).toBe(true);

        const intake = await db.query('SELECT * FROM plugin_netrxn_inertia_e936d62b87.objective_intake WHERE mapping_key=$1', ['obj3']);
        expect(intake.rows.length).toBe(1);
      });

      it('throws invalid for hide of non-existent share: key', async () => {
        await expect(service.hide(companyId, moderatorId, { sourceKey: 'share:nonexistent', reason: 'spam' }))
          .rejects.toThrow(OrgError);
      });

      it('throws invalid for restore of non-existent share: key', async () => {
        await expect(service.restore(companyId, moderatorId, { sourceKey: 'share:nonexistent', reason: 'oops' }))
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
        await service.share(companyId, founderId, { kind: 'link', title: 'Example', url: 'https://example.com' });

        const overview = await service.overview(companyId, memberId);

        expect(overview).not.toBeNull();
        expect(overview!.profile.name).toBe('Test Org');
        expect(overview!.role).toBe('member');
        expect(overview!.feed.length).toBeGreaterThan(0);
        expect(overview!.keyDocuments).toBeDefined();
        expect(overview!.initiatives).toEqual([]);
      });

      it('orders keyDocuments by significance (citations*2 + pins)', async () => {
        const s1 = await service.share(companyId, founderId, { kind: 'link', title: 'Low', url: 'https://low.com' });
        const s2 = await service.share(companyId, founderId, { kind: 'link', title: 'High', url: 'https://high.com' });
        const s3 = await service.share(companyId, founderId, { kind: 'link', title: 'Medium', url: 'https://medium.com' });

        await service.pin(companyId, founderId, { sourceKey: s2.sourceKey });
        await service.pin(companyId, memberId, { sourceKey: s2.sourceKey });
        await service.pin(companyId, moderatorId, { sourceKey: s2.sourceKey });

        await service.pin(companyId, founderId, { sourceKey: s3.sourceKey });

        const overview = await service.overview(companyId, memberId);

        expect(overview!.keyDocuments.length).toBeGreaterThan(0);
        expect(overview!.keyDocuments[0]!.title).toBe('High');
        expect(overview!.keyDocuments[0]!.score).toBe(3);
      });

      it('limits keyDocuments to top 5', async () => {
        for (let i = 0; i < 10; i++) {
          await service.share(companyId, founderId, { kind: 'link', title: `Doc ${i}`, url: `https://doc${i}.com` });
        }

        const overview = await service.overview(companyId, memberId);
        expect(overview!.keyDocuments.length).toBeLessThanOrEqual(5);
      });

      it('limits feed to 50 entries', async () => {
        for (let i = 0; i < 60; i++) {
          await service.share(companyId, founderId, { kind: 'link', title: `Link ${i}`, url: `https://link${i}.com` });
        }

        const overview = await service.overview(companyId, memberId);
        expect(overview!.feed.length).toBeLessThanOrEqual(50);
      });
    });

    describe('pin', () => {
      it('adds pin and increases count', async () => {
        const shared = await service.share(companyId, founderId, { kind: 'link', title: 'Example', url: 'https://example.com' });

        await service.pin(companyId, memberId, { sourceKey: shared.sourceKey });

        const sources = await service.sources(companyId, moderatorId, { hidden: false });
        const pinned = sources.find(s => s.sourceKey === shared.sourceKey);

        expect(pinned!.pins).toBe(1);
      });

      it('logs source.pin', async () => {
        const shared = await service.share(companyId, founderId, { kind: 'link', title: 'Example', url: 'https://example.com' });

        await service.pin(companyId, memberId, { sourceKey: shared.sourceKey });

        const log = await store.listLog(companyId, 20);
        const pinEntry = log.find(e => e.action === 'source.pin');

        expect(pinEntry).toBeDefined();
        expect(pinEntry!.subject).toBe(shared.sourceKey);
      });
    });

    describe('isHidden', () => {
      it('returns true for hidden source', async () => {
        const shared = await service.share(companyId, founderId, { kind: 'link', title: 'Example', url: 'https://example.com' });
        await service.hide(companyId, moderatorId, { sourceKey: shared.sourceKey, reason: 'spam' });

        const hidden = await service.isHidden(companyId, shared.sourceKey);
        expect(hidden).toBe(true);
      });

      it('returns false for visible source', async () => {
        const shared = await service.share(companyId, founderId, { kind: 'link', title: 'Example', url: 'https://example.com' });

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
