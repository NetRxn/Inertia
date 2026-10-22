import type { PluginDatabaseClient } from '@paperclipai/plugin-sdk';
import type { Binding, DecisionCard, Pairing, TrustedBridgeConfig } from '../bridge/types.js';
/** Native derivation: plugin_ + slug(netrxn.inertia) + SHA256(pluginKey)[0:10]. */
export const BRIDGE_NAMESPACE = 'plugin_netrxn_inertia_e936d62b87';
export interface InboxKey {
    relay: string;
    eventId: string;
}
export interface ClaimInput {
    destination: Binding;
    command: unknown;
    receiptKey: string;
}
export interface InboxReceipt extends InboxKey, ClaimInput {
    state: 'applying' | 'applied' | 'rejected' | 'uncertain';
    outcome: unknown;
    createdAt: string | Date;
    updatedAt: string | Date;
}
export interface OutboxCursor {
    createdAt: string;
    receiptKey: string;
}
export interface OutboxRecord {
    receiptKey: string;
    relay: string;
    eventId: string;
    event: unknown;
}
export interface OutboxReceipt extends OutboxRecord {
    state: 'pending' | 'delivered' | 'blocked';
    createdAt: string | Date;
    updatedAt: string | Date;
}
const inboxFields = `relay, event_id AS "eventId", state, destination, command, receipt_key AS "receiptKey", outcome, created_at::text AS "createdAt", updated_at::text AS "updatedAt"`;
const outboxFields = `receipt_key AS "receiptKey", relay, event_id AS "eventId", event, state, created_at::text AS "createdAt", updated_at::text AS "updatedAt"`;
/** Only native ctx.db is injected. SQL is compatible with its restricted execute/query APIs. */
export function createBridgeStore(hostDb: PluginDatabaseClient) {
    const db: PluginDatabaseClient = { namespace: hostDb.namespace,
        async query<T>(sql: string, params?: unknown[]) {
            try {
                return await hostDb.query<T>(sql, params);
            }
            catch {
                throw Error('Bridge database operation failed.');
            }
        },
        async execute(sql, params) {
            try {
                return await hostDb.execute(sql, params);
            }
            catch {
                throw Error('Bridge database operation failed.');
            }
        }
    };
    if (db.namespace !== BRIDGE_NAMESPACE)
        throw Error('Unexpected plugin database namespace.');
    const table = (name: string) => `"${BRIDGE_NAMESPACE}".${name}`;
    const inbox = table('bridge_inbox'), outbox = table('bridge_outbox');
    const get = async (key: InboxKey) => (await db.query<InboxReceipt>(`SELECT ${inboxFields} FROM ${inbox} WHERE relay=$1 AND event_id=$2`, [key.relay, key.eventId]))[0] ?? null;
    return {
        get,
        async claim(key: InboxKey, input: ClaimInput): Promise<'claimed' | InboxReceipt> {
            const result = await db.execute(`INSERT INTO ${inbox} (relay,event_id,state,destination,command,receipt_key) VALUES ($1,$2,'applying',$3::jsonb,$4::jsonb,$5) ON CONFLICT (relay,event_id) DO NOTHING`, [key.relay, key.eventId, JSON.stringify(input.destination), JSON.stringify(input.command), input.receiptKey]);
            if (result.rowCount === 1)
                return 'claimed';
            const existing = await get(key);
            if (!existing)
                throw Error('Bridge inbox claim could not be read.');
            return existing;
        },
        async saveOutcome(key: InboxKey, state: 'applied' | 'rejected', outcome: unknown) {
            return (await db.execute(`UPDATE ${inbox} SET state=$3, outcome=$4::jsonb, updated_at=now() WHERE relay=$1 AND event_id=$2 AND state IN ('applying','uncertain')`, [key.relay, key.eventId, state, JSON.stringify(outcome)])).rowCount === 1;
        },
        async markUncertain(key: InboxKey) { return (await db.execute(`UPDATE ${inbox} SET state='uncertain', updated_at=now() WHERE relay=$1 AND event_id=$2 AND state='applying'`, [key.relay, key.eventId])).rowCount === 1; },
        async listRecoverable(limit = 100) {
            if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000)
                throw Error('Invalid recovery batch limit.');
            const rows = await db.query<InboxReceipt>(`SELECT ${inboxFields} FROM ${inbox} WHERE state IN ('applying','uncertain') OR (state IN ('applied','rejected') AND receipt_key NOT IN (SELECT receipt_key FROM ${outbox})) ORDER BY COALESCE(recovery_scanned_at,created_at),created_at,relay,event_id LIMIT $1`, [limit]);
            if (rows.length) {
                const params = rows.flatMap(row => [row.relay, row.eventId]);
                const keys = rows.map((_, i) => `($${i * 2 + 1},$${i * 2 + 2})`).join(',');
                // Bookkeeping only: never reclaims an uncertain native mutation.
                // Durable rotation prevents a permanently uncertain batch starving later records.
                await db.execute(`UPDATE ${inbox} SET recovery_scanned_at=now() WHERE (relay,event_id) IN (${keys})`, params);
            }
            return rows;
        },
        async putOutbox(record: OutboxRecord) { return (await db.execute(`INSERT INTO ${outbox} (receipt_key,relay,event_id,event) VALUES ($1,$2,$3,$4::jsonb) ON CONFLICT (receipt_key) DO NOTHING`, [record.receiptKey, record.relay, record.eventId, JSON.stringify(record.event)])).rowCount === 1; },
        async listOutbox(limit = 100, after?: OutboxCursor) {
            if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000)
                throw Error('Invalid delivery batch limit.');
            return db.query<OutboxReceipt>(`SELECT ${outboxFields} FROM ${outbox} WHERE state='pending' AND (next_attempt_at IS NULL OR next_attempt_at<=now()) ${after ? 'AND (created_at,receipt_key)>($2::timestamptz,$3)' : ''} ORDER BY created_at,receipt_key LIMIT $1`, after ? [limit, after.createdAt, after.receiptKey] : [limit]);
        },
        async markDeferred(receiptKey: string, retryAfterMs: number) {
            if (!Number.isSafeInteger(retryAfterMs) || retryAfterMs < 0)
                throw Error('Invalid delivery retry delay.');
            return (await db.execute(`UPDATE ${outbox} SET next_attempt_at=GREATEST(COALESCE(next_attempt_at,now()),now()+($2::double precision * interval '1 millisecond')), updated_at=now() WHERE receipt_key=$1 AND state='pending'`, [receiptKey, retryAfterMs])).rowCount === 1;
        },
        async markDelivered(receiptKey: string) { return (await db.execute(`UPDATE ${outbox} SET state='delivered', updated_at=now() WHERE receipt_key=$1 AND state='pending'`, [receiptKey])).rowCount === 1; },
        async markBlocked(receiptKey: string) { return (await db.execute(`UPDATE ${outbox} SET state='blocked', updated_at=now() WHERE receipt_key=$1 AND state='pending'`, [receiptKey])).rowCount === 1; },
        async putBinding(b: Binding) { await db.execute(`INSERT INTO ${table('bridge_bindings')} (relay,channel_id,root_id,company_id,issue_id) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (relay,channel_id,root_id) DO UPDATE SET company_id=EXCLUDED.company_id, issue_id=EXCLUDED.issue_id`, [b.relay, b.channelId, b.rootId, b.companyId, b.issueId]); },
        async putPairing(p: Pairing) { await db.execute(`INSERT INTO ${table('bridge_pairings')} (relay,company_id,pubkey,actor_user_id,kind,active) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (relay,company_id,pubkey) DO UPDATE SET actor_user_id=EXCLUDED.actor_user_id, kind=EXCLUDED.kind, active=EXCLUDED.active`, [p.relay, p.companyId, p.pubkey, p.actorUserId, p.kind, p.active]); },
        async putCard(c: DecisionCard) { return (await db.execute(`INSERT INTO ${table('bridge_cards')} (token,company_id,issue_id,interaction_id,digest) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (token) DO NOTHING`, [c.token, c.companyId, c.issueId, c.interactionId, c.digest])).rowCount === 1; },
        async loadConfig(relay: string, bridgePubkey: string): Promise<TrustedBridgeConfig> {
            const bindings = await db.query<Binding>(`SELECT relay, channel_id AS "channelId", root_id AS "rootId", company_id AS "companyId", issue_id AS "issueId" FROM ${table('bridge_bindings')} WHERE relay=$1`, [relay]);
            const pairings = await db.query<Pairing>(`SELECT relay, company_id AS "companyId", pubkey, actor_user_id AS "actorUserId", kind, active FROM ${table('bridge_pairings')} WHERE relay=$1`, [relay]);
            const cards = await db.query<DecisionCard>(`SELECT token, company_id AS "companyId", issue_id AS "issueId", interaction_id AS "interactionId", digest FROM ${table('bridge_cards')}`);
            return { relay, bridgePubkey, bindings, pairings, cards };
        }
    };
}
export type BridgeStore = ReturnType<typeof createBridgeStore>;
