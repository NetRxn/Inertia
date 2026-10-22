import type { PluginDatabaseClient } from "@paperclipai/plugin-sdk";
import type { BuzzClient } from "../buzz/http.js";
import type { Binding } from "./types.js";
import { BRIDGE_NAMESPACE } from "../store/postgres.js";
import type { IngressOutcome } from "./service.js";
export function checkpoints(db: PluginDatabaseClient) {
  if (db.namespace !== BRIDGE_NAMESPACE)
    throw Error("Unexpected plugin database namespace.");
  const table = `"${BRIDGE_NAMESPACE}".bridge_checkpoints`;
  const params = (b: Binding) => [b.companyId, b.relay, b.channelId, b.rootId];
  return {
    async get(b: Binding) {
      try {
        return Number(
          (
            await db.query<{ value: string }>(
              `SELECT last_timestamp AS value FROM ${table} WHERE company_id=$1 AND relay=$2 AND channel_id=$3 AND root_id=$4`,
              params(b),
            )
          )[0]?.value ?? 0,
        );
      } catch {
        throw Error("Checkpoint database operation failed.");
      }
    },
    async save(b: Binding, time: number) {
      try {
        await db.execute(
          `INSERT INTO ${table} (company_id,relay,channel_id,root_id,last_timestamp) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (company_id,relay,channel_id,root_id) DO UPDATE SET last_timestamp=GREATEST(${table}.last_timestamp,EXCLUDED.last_timestamp)`,
          [...params(b), time],
        );
      } catch {
        throw Error("Checkpoint database operation failed.");
      }
    },
  };
}
export interface PollProgress {
  until: number;
  newest: number;
}
/** Inclusive timestamp overlap plus inbox dedup. Never silently step over a saturated second. */
export async function pollBinding(input: {
  binding: Binding;
  since: number;
  lookbackSeconds?: number;
  maxPages?: number;
  progress?: PollProgress | null;
  saveProgress?: (progress: PollProgress | null) => Promise<void>;
  query: BuzzClient["query"];
  ingest: (raw: unknown) => Promise<IngressOutcome>;
  save: (timestamp: number) => Promise<void>;
}) {
  let until: number | undefined =
    input.progress?.until ?? Math.floor(Date.now() / 1000) + 60;
  let newest = input.progress?.newest ?? input.since;
  const since = Math.max(0, input.since - (input.lookbackSeconds ?? 86400));
  for (let page = 0; page < (input.maxPages ?? 20); page++) {
    const events = await input.query([
      {
        kinds: [9],
        "#h": [input.binding.channelId],
        "#e": [input.binding.rootId],
        since,
        limit: 100,
        ...(until === undefined ? {} : { until }),
      },
    ]);
    if (events.length === 0) {
      await input.save(newest);
      await input.saveProgress?.(null);
      return true;
    }
    const eligible = events.filter(
      (x) => x.event.created_at <= Math.floor(Date.now() / 1000) + 60,
    );
    if (eligible.length === 0) {
      await input.save(newest);
      await input.saveProgress?.(null);
      return true;
    }
    const times = eligible.map((x) => x.event.created_at);
    const oldest = Math.min(...times);
    newest = Math.max(newest, ...times);
    for (const e of eligible) await input.ingest(e.event);
    if (events.length < 100) {
      await input.save(newest);
      await input.saveProgress?.(null);
      return true;
    }
    if (oldest === until || times.every((t) => t === oldest))
      throw Error(
        "Buzz timestamp boundary saturated; checkpoint retained. Narrow the binding or use the native backlog view.",
      );
    until = oldest; // overlap the boundary second, rather than losing unseen events there
  }
  if (input.saveProgress && until !== undefined) {
    await input.saveProgress({ until, newest });
    return false;
  }
  throw Error(
    "Buzz backlog exceeds one reconciliation batch; checkpoint retained.",
  );
}
