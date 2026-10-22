import type { PluginDatabaseClient } from "@paperclipai/plugin-sdk";
import { BRIDGE_NAMESPACE } from "../store/postgres.js";
export interface RuntimeState {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  uncertainCount(issueIds: string[]): Promise<number>;
  resumeBlocked(issueIds: string[]): Promise<void>;
  scopeReceipt(receiptKey: string, issueId: string): Promise<void>;
  deliveryHealth(
    issueIds: string[],
  ): Promise<{ pending: number; blocked: number; oldest: string | null }>;
}
export function runtimeState(
  db: PluginDatabaseClient,
  companyId: string,
  relay: string,
): RuntimeState {
  if (db.namespace !== BRIDGE_NAMESPACE)
    throw Error("Unexpected plugin database namespace.");
  const table = `"${BRIDGE_NAMESPACE}".bridge_runtime`;
  return {
    async uncertainCount(issueIds: string[]) {
      try {
        return Number(
          (
            await db.query<{ count: string }>(
              `SELECT count(*)::text AS count FROM "${BRIDGE_NAMESPACE}".bridge_inbox WHERE relay=$1 AND state IN ('applying','uncertain') AND destination->>'companyId'=$2 AND destination->>'issueId'=ANY($3::text[])`,
              [relay, companyId, issueIds],
            )
          )[0]?.count ?? 0,
        );
      } catch {
        throw Error("Native outcome health could not be read.");
      }
    },
    async resumeBlocked(issueIds: string[]) {
      try {
        await db.execute(
          `UPDATE "${BRIDGE_NAMESPACE}".bridge_outbox SET state='pending',next_attempt_at=NULL,updated_at=now() WHERE state='blocked' AND relay=$1 AND receipt_key IN (SELECT receipt_key FROM "${BRIDGE_NAMESPACE}".bridge_outbox_scopes WHERE company_id=$2 AND issue_id=ANY($3::text[]))`,
          [relay, companyId, issueIds],
        );
      } catch {
        throw Error("Blocked receipts could not be resumed.");
      }
    },
    async scopeReceipt(receiptKey: string, issueId: string) {
      try {
        await db.execute(
          `INSERT INTO "${BRIDGE_NAMESPACE}".bridge_outbox_scopes (receipt_key,company_id,issue_id) VALUES ($1,$2,$3) ON CONFLICT (receipt_key) DO NOTHING`,
          [receiptKey, companyId, issueId],
        );
      } catch {
        throw Error("Receipt scope could not be saved.");
      }
    },
    async deliveryHealth(issueIds: string[]) {
      try {
        const rows = await db.query<{
          state: string;
          count: string;
          oldest: string | null;
        }>(
          `SELECT o.state,count(*)::text AS count,min(o.created_at)::text AS oldest FROM "${BRIDGE_NAMESPACE}".bridge_outbox o JOIN "${BRIDGE_NAMESPACE}".bridge_outbox_scopes s ON s.receipt_key=o.receipt_key WHERE o.relay=$1 AND o.state IN ('pending','blocked') AND s.company_id=$2 AND s.issue_id=ANY($3::text[]) GROUP BY o.state`,
          [relay, companyId, issueIds],
        );
        return {
          pending: Number(rows.find((x) => x.state === "pending")?.count ?? 0),
          blocked: Number(rows.find((x) => x.state === "blocked")?.count ?? 0),
          oldest:
            rows
              .map((x) => x.oldest)
              .filter((x): x is string => Boolean(x))
              .sort()[0] ?? null,
        };
      } catch {
        throw Error("Connection delivery health could not be read.");
      }
    },
    async get<T>(key: string) {
      try {
        return (
          (
            await db.query<{ value: T }>(
              `SELECT value FROM ${table} WHERE company_id=$1 AND relay=$2 AND state_key=$3`,
              [companyId, relay, key],
            )
          )[0]?.value ?? null
        );
      } catch {
        throw Error("Connection state could not be read.");
      }
    },
    async set(key, value) {
      try {
        await db.execute(
          `INSERT INTO ${table} (company_id,relay,state_key,value) VALUES ($1,$2,$3,$4::jsonb) ON CONFLICT (company_id,relay,state_key) DO UPDATE SET value=EXCLUDED.value`,
          [companyId, relay, key, JSON.stringify(value)],
        );
      } catch {
        throw Error("Connection state could not be saved.");
      }
    },
  };
}
