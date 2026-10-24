import { randomUUID } from "node:crypto";
import type { PluginDatabaseClient } from "@paperclipai/plugin-sdk";
import { BRIDGE_NAMESPACE } from "../store/postgres.js";
export interface RuntimeOwnerScope {
  companyId: string;
  namespaceScope: string;
  key: string;
}
export interface RuntimeOwnerRecord {
  token: string;
  workerId: string;
  runId: string;
}
/** Durable, non-expiring exclusive ownership. A timer is never proof that an executor stopped. */
export function createRuntimeOwner(
  db: PluginDatabaseClient,
  identity: {
    workerId: string;
    runId: string;
  },
) {
  if (
    db.namespace !== BRIDGE_NAMESPACE ||
    !identity.workerId ||
    !identity.runId
  )
    throw Error("Invalid native owner configuration.");
  const instance = structuredClone(identity);
  const table = `"${BRIDGE_NAMESPACE}".bridge_runtime`;
  function params(scope: RuntimeOwnerScope) {
    if (!scope.companyId || !scope.namespaceScope || !scope.key)
      throw Error("Invalid native owner scope.");
    return [
      scope.companyId,
      scope.namespaceScope,
      "exclusive-owner:" + scope.key,
    ];
  }
  async function inspect(
    scope: RuntimeOwnerScope,
  ): Promise<RuntimeOwnerRecord | null> {
    try {
      return (
        (
          await db.query<{
            value: RuntimeOwnerRecord;
          }>(
            `SELECT value FROM ${table} WHERE company_id=$1 AND relay=$2 AND state_key=$3`,
            params(scope),
          )
        )[0]?.value ?? null
      );
    } catch {
      throw Error("Native ownership unavailable.");
    }
  }
  async function remove(scope: RuntimeOwnerScope, token: string) {
    return (
      (
        await db.execute(
          `DELETE FROM ${table} WHERE company_id=$1 AND relay=$2 AND state_key=$3 AND value->>'token'=$4`,
          [...params(scope), token],
        )
      ).rowCount === 1
    );
  }
  return {
    inspect,
    async own<T>(
      scope: RuntimeOwnerScope,
      work: () => Promise<T>,
    ): Promise<T | null> {
      // Snapshot scope: asynchronous caller mutations must not redirect release.
      const locked = structuredClone(scope);
      const record: RuntimeOwnerRecord = { token: randomUUID(), ...instance };
      let acquired: boolean;
      try {
        acquired =
          (
            await db.execute(
              `INSERT INTO ${table} (company_id,relay,state_key,value) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(company_id,relay,state_key) DO NOTHING`,
              [...params(locked), JSON.stringify(record)],
            )
          ).rowCount === 1;
      } catch {
        throw Error("Native ownership unavailable.");
      }
      if (!acquired) return null;
      try {
        return await work();
      } finally {
        try {
          if (!(await remove(locked, record.token))) throw Error();
        } catch {
          throw Error("Native ownership release unconfirmed.");
        }
      }
    },
    /** Only a trusted host lifecycle/operator may provide termination proof. Not a public tool. */
    async recoverStopped(
      scope: RuntimeOwnerScope,
      observedToken: string,
      confirmStopped: (workerId: string) => Promise<boolean>,
    ): Promise<boolean> {
      const locked = structuredClone(scope);
      const record = await inspect(locked);
      if (!record || record.token !== observedToken) return false;
      if (!(await confirmStopped(record.workerId))) return false;
      try {
        return await remove(locked, observedToken);
      } catch {
        throw Error("Native ownership recovery unconfirmed.");
      }
    },
  };
}
