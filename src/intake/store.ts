import type { PluginDatabaseClient } from '@paperclipai/plugin-sdk';
import { BRIDGE_NAMESPACE } from '../store/postgres.js';
import type { IntakeDependencies, IntakeMapping } from './contracts.js';
/** One SQL CAS also appends immutable source history. No raw arrays cross host parameter binding. */
export function createIntakeStore(db: PluginDatabaseClient): IntakeDependencies['store'] {
    if (db.namespace !== BRIDGE_NAMESPACE)
        throw Error('Unexpected plugin database namespace.');
    const table = `"${BRIDGE_NAMESPACE}".objective_intake`;
    async function execute(sql: string, params: unknown[]) { try {
        return (await db.execute(sql, params)).rowCount === 1;
    }
    catch {
        throw Error('Objective mapping unavailable.');
    } }
    return {
        async read(key) { try {
            return (await db.query<{
                record: IntakeMapping | null;
            }>(`SELECT record FROM ${table} WHERE mapping_key=$1`, [key]))[0]?.record ?? null;
        }
        catch {
            throw Error('Objective mapping unavailable.');
        } },
        async claim(next, expected) {
            if (next.version !== expected + 1 || !next.pending)
                throw Error('Invalid mapping transition.');
            if (expected === 0)
                return execute(`INSERT INTO ${table} AS existing (mapping_key,record,history)
    SELECT $1,$2::jsonb,jsonb_build_array($2::jsonb) WHERE $3::integer=0
    ON CONFLICT(mapping_key) DO UPDATE SET record=$2::jsonb,history=existing.history||jsonb_build_array($2::jsonb),updated_at=now()
    WHERE COALESCE((existing.record->>'version')::integer,0)=$3::integer AND COALESCE((existing.record->>'pending')::boolean,false)=false`, [next.key, JSON.stringify(next), expected]);
            return execute(`UPDATE ${table} SET record=$2::jsonb,history=history||jsonb_build_array($2::jsonb),updated_at=now()
      WHERE mapping_key=$1 AND (record->>'version')::integer=$3 AND (record->>'pending')::boolean=false`, [next.key, JSON.stringify(next), expected]);
        },
        async finish(key, version, id) {
            return execute(`UPDATE ${table} SET record=jsonb_set(jsonb_set(record,'{pending}','false'::jsonb),'{nativeIssueId}',to_jsonb($3::text)),updated_at=now()
    WHERE mapping_key=$1 AND (record->>'version')::integer=$2 AND (record->>'pending')::boolean=true`, [key, version, id]);
        },
        async abort(key, version, previous) {
            return execute(`UPDATE ${table} SET record=$3::jsonb,updated_at=now()
    WHERE mapping_key=$1 AND (record->>'version')::integer=$2 AND (record->>'pending')::boolean=true`, [key, version, previous === null ? null : JSON.stringify(previous)]);
        }
    };
}
