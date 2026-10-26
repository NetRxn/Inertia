import type { PluginDatabaseClient } from '@paperclipai/plugin-sdk';
import { BRIDGE_NAMESPACE } from '../store/postgres.js';
import type { OrgProfile, OrgMember, OrgSource, OrgLogEntry, SourceKind } from './contracts.js';
import { OrgError } from './contracts.js';

export interface ObjectiveSource {
  key: string;
  title: string;
  audience: string;
  sourceSystem: string;
  nativeIssueId: string | null;
}

export interface OrgStore {
  readProfile(companyId: string): Promise<OrgProfile | null>;
  createProfile(profile: OrgProfile, founder: OrgMember): Promise<boolean>;
  readMember(companyId: string, userId: string): Promise<OrgMember | null>;
  listMembers(companyId: string): Promise<OrgMember[]>;
  upsertMember(member: OrgMember): Promise<void>;
  countModerators(companyId: string): Promise<number>;
  insertSource(source: OrgSource, content: Uint8Array | null): Promise<void>;
  readSource(companyId: string, sourceKey: string): Promise<OrgSource | null>;
  listSources(companyId: string, opts: { includeHidden: boolean; kind?: SourceKind; limit: number }): Promise<OrgSource[]>;
  listObjectiveSources(companyId: string, limit: number): Promise<ObjectiveSource[]>;
  setHidden(companyId: string, sourceKey: string, hidden: OrgSource['hidden']): Promise<boolean>;
  isHidden(companyId: string, sourceKey: string): Promise<boolean>;
  addPin(companyId: string, sourceKey: string, userId: string): Promise<boolean>;
  appendLog(entry: Omit<OrgLogEntry, 'seq' | 'at'>): Promise<OrgLogEntry>;
  listLog(companyId: string, limit: number): Promise<OrgLogEntry[]>;
}

export function createOrgStore(hostDb: PluginDatabaseClient): OrgStore {
  if (hostDb.namespace !== BRIDGE_NAMESPACE) {
    throw Error('Unexpected plugin database namespace.');
  }

  const table = (name: string) => `"${BRIDGE_NAMESPACE}".${name}`;
  const profileTable = table('org_profile');
  const membersTable = table('org_members');
  const sourcesTable = table('org_sources');
  const pinsTable = table('org_source_pins');
  const logTable = table('org_log');

  const unavailableError = () => new OrgError('unavailable', 'Organization data unavailable.');

  async function query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    try {
      return await hostDb.query<T>(sql, params);
    } catch {
      throw unavailableError();
    }
  }

  async function execute(sql: string, params?: unknown[]): Promise<number> {
    try {
      return (await hostDb.execute(sql, params)).rowCount;
    } catch {
      throw unavailableError();
    }
  }

  return {
    async readProfile(companyId: string): Promise<OrgProfile | null> {
      const rows = await query<{ company_id: string; name: string; created_by: string; created_at: string }>(
        `SELECT company_id, name, created_by, created_at::text FROM ${profileTable} WHERE company_id=$1`,
        [companyId]
      );
      if (rows.length === 0) return null;
      const row = rows[0]!;
      return {
        companyId: row.company_id,
        name: row.name,
        createdBy: row.created_by,
        createdAt: row.created_at
      };
    },

    async createProfile(profile: OrgProfile, founder: OrgMember): Promise<boolean> {
      const count = await execute(
        `WITH new_profile AS (
           INSERT INTO ${profileTable} (company_id, name, created_by, created_at)
           VALUES ($1, $2, $3, $4::timestamptz)
           ON CONFLICT (company_id) DO NOTHING
           RETURNING company_id
         )
         INSERT INTO ${membersTable} (company_id, user_id, display_name, role, status, joined_at)
         SELECT $1, $5, $6, $7, $8, $9::timestamptz FROM new_profile`,
        [profile.companyId, profile.name, profile.createdBy, profile.createdAt, founder.userId, founder.displayName, founder.role, founder.status, founder.joinedAt]
      );
      return count === 1;
    },

    async readMember(companyId: string, userId: string): Promise<OrgMember | null> {
      const rows = await query<{ company_id: string; user_id: string; display_name: string; role: string; status: string; joined_at: string }>(
        `SELECT company_id, user_id, display_name, role, status, joined_at::text FROM ${membersTable} WHERE company_id=$1 AND user_id=$2`,
        [companyId, userId]
      );
      if (rows.length === 0) return null;
      const row = rows[0]!;
      return {
        companyId: row.company_id,
        userId: row.user_id,
        displayName: row.display_name,
        role: row.role as OrgMember['role'],
        status: row.status as OrgMember['status'],
        joinedAt: row.joined_at
      };
    },

    async listMembers(companyId: string): Promise<OrgMember[]> {
      const rows = await query<{ company_id: string; user_id: string; display_name: string; role: string; status: string; joined_at: string }>(
        `SELECT company_id, user_id, display_name, role, status, joined_at::text FROM ${membersTable} WHERE company_id=$1`,
        [companyId]
      );
      return rows.map(row => ({
        companyId: row.company_id,
        userId: row.user_id,
        displayName: row.display_name,
        role: row.role as OrgMember['role'],
        status: row.status as OrgMember['status'],
        joinedAt: row.joined_at
      }));
    },

    async upsertMember(member: OrgMember): Promise<void> {
      await execute(
        `INSERT INTO ${membersTable} (company_id, user_id, display_name, role, status, joined_at)
         VALUES ($1, $2, $3, $4, $5, $6::timestamptz)
         ON CONFLICT (company_id, user_id) DO UPDATE
         SET display_name=$3, role=$4, status=$5`,
        [member.companyId, member.userId, member.displayName, member.role, member.status, member.joinedAt]
      );
    },

    async countModerators(companyId: string): Promise<number> {
      const rows = await query<{ count: number }>(
        `SELECT COUNT(*) as count FROM ${membersTable} WHERE company_id=$1 AND role IN ('founder', 'moderator') AND status='active'`,
        [companyId]
      );
      return rows[0]?.count ?? 0;
    },

    async insertSource(source: OrgSource, content: Uint8Array | null): Promise<void> {
      await execute(
        `INSERT INTO ${sourcesTable} (company_id, source_key, kind, title, url, media_type, byte_length, sha256, shared_by, audience, hidden, pins, content, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14::timestamptz)`,
        [
          source.companyId,
          source.sourceKey,
          source.kind,
          source.title,
          source.url,
          source.mediaType,
          source.byteLength,
          source.sha256,
          source.sharedBy,
          source.audience,
          source.hidden ? JSON.stringify(source.hidden) : null,
          source.pins,
          content,
          source.createdAt
        ]
      );
    },

    async readSource(companyId: string, sourceKey: string): Promise<OrgSource | null> {
      const rows = await query<{
        company_id: string;
        source_key: string;
        kind: string;
        title: string;
        url: string | null;
        media_type: string | null;
        byte_length: number | null;
        sha256: string | null;
        shared_by: string;
        audience: string;
        hidden: OrgSource['hidden'];
        pins: number;
        created_at: string;
      }>(
        `SELECT company_id, source_key, kind, title, url, media_type, byte_length, sha256, shared_by, audience, hidden, pins, created_at::text FROM ${sourcesTable} WHERE company_id=$1 AND source_key=$2`,
        [companyId, sourceKey]
      );
      if (rows.length === 0) return null;
      const row = rows[0]!;
      return {
        companyId: row.company_id,
        sourceKey: row.source_key,
        kind: row.kind as SourceKind,
        title: row.title,
        url: row.url,
        mediaType: row.media_type,
        byteLength: row.byte_length,
        sha256: row.sha256,
        sharedBy: row.shared_by,
        audience: row.audience as OrgSource['audience'],
        hidden: row.hidden,
        pins: row.pins,
        createdAt: row.created_at
      };
    },

    async listSources(companyId: string, opts: { includeHidden: boolean; kind?: SourceKind; limit: number }): Promise<OrgSource[]> {
      const conditions = ['company_id=$1'];
      const params: unknown[] = [companyId];

      if (!opts.includeHidden) {
        conditions.push('hidden IS NULL');
      }

      if (opts.kind) {
        conditions.push(`kind=$${params.length + 1}`);
        params.push(opts.kind);
      }

      params.push(opts.limit);

      const rows = await query<{
        company_id: string;
        source_key: string;
        kind: string;
        title: string;
        url: string | null;
        media_type: string | null;
        byte_length: number | null;
        sha256: string | null;
        shared_by: string;
        audience: string;
        hidden: OrgSource['hidden'];
        pins: number;
        created_at: string;
      }>(
        `SELECT company_id, source_key, kind, title, url, media_type, byte_length, sha256, shared_by, audience, hidden, pins, created_at::text
         FROM ${sourcesTable}
         WHERE ${conditions.join(' AND ')}
         ORDER BY created_at DESC
         LIMIT $${params.length}`,
        params
      );

      return rows.map(row => ({
        companyId: row.company_id,
        sourceKey: row.source_key,
        kind: row.kind as SourceKind,
        title: row.title,
        url: row.url,
        mediaType: row.media_type,
        byteLength: row.byte_length,
        sha256: row.sha256,
        sharedBy: row.shared_by,
        audience: row.audience as OrgSource['audience'],
        hidden: row.hidden,
        pins: row.pins,
        createdAt: row.created_at
      }));
    },

    async setHidden(companyId: string, sourceKey: string, hidden: OrgSource['hidden']): Promise<boolean> {
      if (sourceKey.startsWith('objective:')) {
        const count = await execute(
          `INSERT INTO ${sourcesTable} (company_id, source_key, kind, title, url, media_type, byte_length, sha256, shared_by, audience, hidden, pins, created_at)
           VALUES ($1, $2, 'objective', '', NULL, NULL, NULL, NULL, '', 'members', $3::jsonb, 0, now())
           ON CONFLICT (company_id, source_key) DO UPDATE
           SET hidden=$3::jsonb`,
          [companyId, sourceKey, hidden ? JSON.stringify(hidden) : null]
        );
        return count > 0;
      }

      const existing = await this.readSource(companyId, sourceKey);
      if (!existing) {
        return false;
      }

      const count = await execute(
        `UPDATE ${sourcesTable} SET hidden=$3::jsonb WHERE company_id=$1 AND source_key=$2`,
        [companyId, sourceKey, hidden ? JSON.stringify(hidden) : null]
      );
      return count > 0;
    },

    async isHidden(companyId: string, sourceKey: string): Promise<boolean> {
      const rows = await query<{ hidden: OrgSource['hidden'] | null }>(
        `SELECT hidden FROM ${sourcesTable} WHERE company_id=$1 AND source_key=$2`,
        [companyId, sourceKey]
      );
      return rows[0]?.hidden !== null && rows[0]?.hidden !== undefined;
    },

    async listObjectiveSources(companyId: string, limit: number): Promise<ObjectiveSource[]> {
      const rows = await query<{
        mapping_key: string;
        title: string;
        audience: string;
        source_system: string;
        native_issue_id: string | null;
      }>(
        `SELECT
           mapping_key,
           record->'snapshot'->>'title' as title,
           record->'snapshot'->>'audience' as audience,
           record->'snapshot'->>'sourceSystem' as source_system,
           record->>'nativeIssueId' as native_issue_id
         FROM plugin_netrxn_inertia_e936d62b87.objective_intake
         WHERE record->>'companyId' = $1
         ORDER BY mapping_key
         LIMIT $2`,
        [companyId, limit]
      );

      return rows.map(row => ({
        key: row.mapping_key,
        title: row.title,
        audience: row.audience,
        sourceSystem: row.source_system,
        nativeIssueId: row.native_issue_id
      }));
    },

    async addPin(companyId: string, sourceKey: string, userId: string): Promise<boolean> {
      const count = await execute(
        `INSERT INTO ${pinsTable} (company_id, source_key, user_id)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [companyId, sourceKey, userId]
      );

      if (count === 1) {
        await execute(
          `UPDATE ${sourcesTable} SET pins = pins + 1 WHERE company_id=$1 AND source_key=$2`,
          [companyId, sourceKey]
        );
        return true;
      }
      return false;
    },

    async appendLog(entry: Omit<OrgLogEntry, 'seq' | 'at'>): Promise<OrgLogEntry> {
      const rows = await query<{ seq: number; at: string }>(
        `INSERT INTO ${logTable} (company_id, actor, action, subject, reason, at)
         VALUES ($1, $2, $3, $4, $5, now())
         RETURNING seq, at::text`,
        [entry.companyId, entry.actor, entry.action, entry.subject, entry.reason]
      );
      const row = rows[0]!;
      return {
        ...entry,
        seq: row.seq,
        at: row.at
      };
    },

    async listLog(companyId: string, limit: number): Promise<OrgLogEntry[]> {
      const rows = await query<{
        company_id: string;
        seq: number;
        actor: string;
        action: string;
        subject: string;
        reason: string;
        at: string;
      }>(
        `SELECT company_id, seq, actor, action, subject, reason, at::text FROM ${logTable} WHERE company_id=$1 ORDER BY seq DESC LIMIT $2`,
        [companyId, limit]
      );

      return rows.map(row => ({
        companyId: row.company_id,
        seq: row.seq,
        actor: row.actor,
        action: row.action as OrgLogEntry['action'],
        subject: row.subject,
        reason: row.reason,
        at: row.at
      }));
    }
  };
}
