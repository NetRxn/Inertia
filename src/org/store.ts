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
  updatedAt: string;
  hidden: OrgSource['hidden'];
  pins: number;
}

export interface OrgStore {
  readProfile(companyId: string): Promise<OrgProfile | null>;
  /** Claim the company's profile; true only for the caller whose insert won. Then completes the founder row. */
  createProfile(profile: OrgProfile, founderDisplayName: string): Promise<boolean>;
  /** Insert the founder row from the stored profile when userId created it; idempotent. */
  completeFounder(companyId: string, userId: string): Promise<void>;
  readMember(companyId: string, userId: string): Promise<OrgMember | null>;
  listMembers(companyId: string): Promise<OrgMember[]>;
  upsertMember(member: OrgMember, opKey: string): Promise<void>;
  countModerators(companyId: string): Promise<number>;
  /** Insert once; a retry with the same source key changes nothing. Content travels as base64 text. */
  insertSource(source: OrgSource, contentBase64: string | null, opKey: string): Promise<void>;
  readSource(companyId: string, sourceKey: string): Promise<OrgSource | null>;
  readContent(companyId: string, sourceKey: string): Promise<{ base64: string; mediaType: string | null } | null>;
  listSources(companyId: string, opts: { includeHidden: boolean; kind?: SourceKind; limit: number }): Promise<OrgSource[]>;
  listObjectiveSources(companyId: string, limit: number): Promise<ObjectiveSource[]>;
  readObjectiveSource(companyId: string, mappingKey: string): Promise<ObjectiveSource | null>;
  listHidden(companyId: string): Promise<Map<string, OrgSource['hidden']>>;
  setHidden(companyId: string, sourceKey: string, hidden: OrgSource['hidden'], opKey: string): Promise<boolean>;
  isHidden(companyId: string, sourceKey: string): Promise<boolean>;
  addPin(companyId: string, sourceKey: string, userId: string, opKey: string): Promise<boolean>;
  /** True when org_log already holds this operation. */
  hasLog(companyId: string, opKey: string): Promise<boolean>;
  /** True when a member, source or pin row was last written by this operation. */
  opApplied(companyId: string, opKey: string): Promise<boolean>;
  /** One audit row per (company, opKey); a repeat is a no-op. */
  appendLog(entry: Omit<OrgLogEntry, 'seq' | 'at'> & { opKey: string }): Promise<void>;
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
  const intakeTable = table('objective_intake');

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

  async function readObjectives(companyId: string, mappingKey: string | null, limit: number): Promise<ObjectiveSource[]> {
    const rows = await query<{
      mapping_key: string;
      title: string;
      audience: string;
      source_system: string;
      native_issue_id: string | null;
      updated_at: string;
      hidden: OrgSource['hidden'];
      pins: number;
    }>(
      `SELECT
         i.mapping_key,
         i.record->'snapshot'->>'title' as title,
         i.record->'snapshot'->>'audience' as audience,
         i.record->'snapshot'->>'sourceSystem' as source_system,
         i.record->>'nativeIssueId' as native_issue_id,
         to_char(i.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at,
         s.hidden,
         (SELECT COUNT(*)::int FROM ${pinsTable} p WHERE p.company_id=$1 AND p.source_key='objective:' || i.mapping_key) as pins
       FROM ${intakeTable} i
       LEFT JOIN ${sourcesTable} s ON s.company_id=$1 AND s.source_key='objective:' || i.mapping_key
       WHERE i.record->>'companyId' = $1 AND ($2::text IS NULL OR i.mapping_key=$2)
       ORDER BY i.mapping_key
       LIMIT $3`,
      [companyId, mappingKey, limit]
    );

    return rows.map(row => ({
      key: row.mapping_key,
      title: row.title,
      audience: row.audience,
      sourceSystem: row.source_system,
      nativeIssueId: row.native_issue_id,
      updatedAt: row.updated_at,
      hidden: row.hidden ?? null,
      pins: Number(row.pins)
    }));
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

    async createProfile(profile: OrgProfile, founderDisplayName: string): Promise<boolean> {
      const claimed = await execute(
        `INSERT INTO ${profileTable} (company_id, name, created_by, founder_display_name, created_at)
         VALUES ($1, $2, $3, $4, $5::timestamptz)
         ON CONFLICT (company_id) DO NOTHING`,
        [profile.companyId, profile.name, profile.createdBy, founderDisplayName, profile.createdAt]
      );
      if (claimed !== 1) {
        return false;
      }
      await this.completeFounder(profile.companyId, profile.createdBy);
      return true;
    },

    async completeFounder(companyId: string, userId: string): Promise<void> {
      await execute(
        `INSERT INTO ${membersTable} (company_id, user_id, display_name, role, status, joined_at)
         SELECT company_id, created_by, founder_display_name, 'founder', 'active', created_at
         FROM ${profileTable}
         WHERE company_id=$1 AND created_by=$2
         ON CONFLICT (company_id, user_id) DO NOTHING`,
        [companyId, userId]
      );
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

    async upsertMember(member: OrgMember, opKey: string): Promise<void> {
      await execute(
        `INSERT INTO ${membersTable} (company_id, user_id, display_name, role, status, joined_at, last_op_key)
         VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7)
         ON CONFLICT (company_id, user_id) DO UPDATE
         SET display_name=$3, role=$4, status=$5, last_op_key=$7`,
        [member.companyId, member.userId, member.displayName, member.role, member.status, member.joinedAt, opKey]
      );
    },

    async countModerators(companyId: string): Promise<number> {
      const rows = await query<{ count: number }>(
        `SELECT COUNT(*)::int as count FROM ${membersTable} WHERE company_id=$1 AND role IN ('founder', 'moderator') AND status='active'`,
        [companyId]
      );
      return Number(rows[0]?.count ?? 0);
    },

    async insertSource(source: OrgSource, contentBase64: string | null, opKey: string): Promise<void> {
      await execute(
        `INSERT INTO ${sourcesTable} (company_id, source_key, kind, title, url, media_type, byte_length, sha256, shared_by, audience, hidden, content, created_at, last_op_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, decode($12::text, 'base64'), $13::timestamptz, $14)
         ON CONFLICT (company_id, source_key) DO NOTHING`,
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
          contentBase64,
          source.createdAt,
          opKey
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
        `SELECT s.company_id, s.source_key, s.kind, s.title, s.url, s.media_type, s.byte_length, s.sha256, s.shared_by, s.audience, s.hidden,
           (SELECT COUNT(*)::int FROM ${pinsTable} p WHERE p.company_id=s.company_id AND p.source_key=s.source_key) as pins, s.created_at::text as created_at
         FROM ${sourcesTable} s WHERE s.company_id=$1 AND s.source_key=$2`,
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
        pins: Number(row.pins),
        createdAt: row.created_at
      };
    },

    async readContent(companyId: string, sourceKey: string): Promise<{ base64: string; mediaType: string | null } | null> {
      const rows = await query<{ base64: string | null; media_type: string | null }>(
        `SELECT encode(content, 'base64') as base64, media_type FROM ${sourcesTable} WHERE company_id=$1 AND source_key=$2`,
        [companyId, sourceKey]
      );
      const row = rows[0];
      if (!row || row.base64 === null) {
        return null;
      }
      // encode() wraps base64 at 76 columns.
      return { base64: row.base64.replace(/\s+/g, ''), mediaType: row.media_type };
    },

    async listSources(companyId: string, opts: { includeHidden: boolean; kind?: SourceKind; limit: number }): Promise<OrgSource[]> {
      const conditions = ['s.company_id=$1', "s.kind <> 'objective'"];
      const params: unknown[] = [companyId];

      if (!opts.includeHidden) {
        conditions.push('s.hidden IS NULL');
      }

      if (opts.kind) {
        conditions.push(`s.kind=$${params.length + 1}`);
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
        `SELECT s.company_id, s.source_key, s.kind, s.title, s.url, s.media_type, s.byte_length, s.sha256, s.shared_by, s.audience, s.hidden,
           (SELECT COUNT(*)::int FROM ${pinsTable} p WHERE p.company_id=s.company_id AND p.source_key=s.source_key) as pins, s.created_at::text as created_at
         FROM ${sourcesTable} s
         WHERE ${conditions.join(' AND ')}
         ORDER BY s.created_at DESC
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
        pins: Number(row.pins),
        createdAt: row.created_at
      }));
    },

    async setHidden(companyId: string, sourceKey: string, hidden: OrgSource['hidden'], opKey: string): Promise<boolean> {
      if (sourceKey.startsWith('objective:')) {
        const count = await execute(
          `INSERT INTO ${sourcesTable} (company_id, source_key, kind, title, url, media_type, byte_length, sha256, shared_by, audience, hidden, created_at, last_op_key)
           SELECT $1, $2, 'objective', '', NULL, NULL, NULL, NULL, '', 'members', $3::jsonb, now(), $5
           WHERE EXISTS (SELECT 1 FROM ${intakeTable} WHERE mapping_key=$4 AND record->>'companyId'=$1)
           ON CONFLICT (company_id, source_key) DO UPDATE
           SET hidden=$3::jsonb, last_op_key=$5`,
          [companyId, sourceKey, hidden ? JSON.stringify(hidden) : null, sourceKey.slice('objective:'.length), opKey]
        );
        return count > 0;
      }

      const existing = await this.readSource(companyId, sourceKey);
      if (!existing) {
        return false;
      }

      const count = await execute(
        `UPDATE ${sourcesTable} SET hidden=$3::jsonb, last_op_key=$4 WHERE company_id=$1 AND source_key=$2`,
        [companyId, sourceKey, hidden ? JSON.stringify(hidden) : null, opKey]
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
      return readObjectives(companyId, null, limit);
    },

    async readObjectiveSource(companyId: string, mappingKey: string): Promise<ObjectiveSource | null> {
      return (await readObjectives(companyId, mappingKey, 1))[0] ?? null;
    },

    async listHidden(companyId: string): Promise<Map<string, OrgSource['hidden']>> {
      const rows = await query<{ source_key: string; hidden: OrgSource['hidden'] }>(
        `SELECT source_key, hidden FROM ${sourcesTable} WHERE company_id=$1 AND hidden IS NOT NULL`,
        [companyId]
      );

      return new Map(rows.map(row => [row.source_key, row.hidden]));
    },

    async addPin(companyId: string, sourceKey: string, userId: string, opKey: string): Promise<boolean> {
      const count = await execute(
        `INSERT INTO ${pinsTable} (company_id, source_key, user_id, last_op_key)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [companyId, sourceKey, userId, opKey]
      );
      return count === 1;
    },

    async hasLog(companyId: string, opKey: string): Promise<boolean> {
      const rows = await query<{ found: number }>(
        `SELECT 1 as found FROM ${logTable} WHERE company_id=$1 AND op_key=$2`,
        [companyId, opKey]
      );
      return rows.length > 0;
    },

    async opApplied(companyId: string, opKey: string): Promise<boolean> {
      const rows = await query<{ found: number }>(
        `SELECT 1 as found FROM ${membersTable} WHERE company_id=$1 AND last_op_key=$2
         UNION ALL SELECT 1 FROM ${sourcesTable} WHERE company_id=$1 AND last_op_key=$2
         UNION ALL SELECT 1 FROM ${pinsTable} WHERE company_id=$1 AND last_op_key=$2
         LIMIT 1`,
        [companyId, opKey]
      );
      return rows.length > 0;
    },

    async appendLog(entry: Omit<OrgLogEntry, 'seq' | 'at'> & { opKey: string }): Promise<void> {
      await execute(
        `INSERT INTO ${logTable} (company_id, op_key, actor, action, subject, reason, at)
         VALUES ($1, $2, $3, $4, $5, $6, now())
         ON CONFLICT (company_id, op_key) DO NOTHING`,
        [entry.companyId, entry.opKey, entry.actor, entry.action, entry.subject, entry.reason]
      );
    },

    async listLog(companyId: string, limit: number): Promise<OrgLogEntry[]> {
      const rows = await query<{
        company_id: string;
        seq: number | string;
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
        // The host returns bigint columns as strings.
        seq: Number(row.seq),
        actor: row.actor,
        action: row.action as OrgLogEntry['action'],
        subject: row.subject,
        reason: row.reason,
        at: row.at
      }));
    }
  };
}
