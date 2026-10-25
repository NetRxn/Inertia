import { registerConfiguredPublicDrafting } from "./drafting/setup.js";
import { registerConfiguredFundingDiscovery } from "./discovery/setup.js";
import {
  registerRoundtableJobs,
  type RoundtableStatus,
} from "./roundtable/host.js";
import {
  definePlugin,
  runWorker,
  type PluginContext,
  type PluginHealthDiagnostics,
} from "@paperclipai/plugin-sdk";
import { finalizeEvent, getPublicKey } from "nostr-tools";
import { makeBuzzHttpClient, BuzzRetryDeferred } from "./buzz/http.js";
import { createBridge } from "./bridge/service.js";
import {
  checkpoints,
  pollBinding,
  type PollProgress,
} from "./bridge/reconcile.js";
import { runtimeState } from "./bridge/runtime.js";
import type {
  TrustedBridgeConfig,
  Binding,
  Pairing,
  DecisionCard,
} from "./bridge/types.js";
import { createBridgeStore } from "./store/postgres.js";
import { createPaperclipAdapter } from "./paperclip/adapter.js";
const hex = /^[0-9a-f]{64}$/;
import { validateConfiguration } from "./config.js";
export { validateConfiguration } from "./config.js";
function trusted(
  c: Record<string, unknown>,
  companyId: string,
): TrustedBridgeConfig {
  const validation = validateConfiguration(c, companyId);
  if (!validation.ok) throw Error("Connection configuration needs attention.");
  const relay = new URL(c.relayUrl as string).origin;
  const bindings = c.bindings as Binding[],
    pairings = c.pairings as Pairing[],
    cards = c.cards as DecisionCard[];
  return {
    relay,
    companyId,
    bridgePubkey: c.bridgePubkey as string,
    bindings,
    pairings,
    cards,
  };
}
export function createPlugin() {
  let roundtableStatus: () => RoundtableStatus = () => ({
    state: "disabled",
    results: [],
  });
  let health: PluginHealthDiagnostics = {
    status: "degraded",
    message: "Enable a company connection to begin.",
  };
  return definePlugin({
    multiCompanyConfig: true,
    async setup(ctx) {
      await registerConfiguredFundingDiscovery(ctx);
      await registerConfiguredPublicDrafting(ctx);
      roundtableStatus = registerRoundtableJobs(ctx);
      ctx.jobs.register("retry-blocked-deliveries", async () => {
        for (const company of await ctx.companies.list({ limit: 1000 })) {
          const config = await ctx.config.get(company.id);
          if (config.enabled !== true) continue;
          const cfg = trusted(config, company.id);
          await runtimeState(ctx.db, company.id, cfg.relay).resumeBlocked?.(
            cfg.bindings.map((b) => b.issueId),
          );
        }
      });
      ctx.jobs.register("backfill-conversations", async () => {
        for (const company of await ctx.companies.list({ limit: 1000 })) {
          const config = await ctx.config.get(company.id);
          if (config.enabled !== true) continue;
          const cfg = trusted(config, company.id);
          const state = runtimeState(ctx.db, company.id, cfg.relay);
          for (const b of cfg.bindings) {
            const key = b.channelId + ":" + b.rootId;
            await state.set("backfill:" + key, true);
            await state.set("backfill-progress:" + key, null);
          }
        }
      });
      // The host schedules only delivery reconciliation. Paperclip owns native work scheduling.
      ctx.jobs.register("reconcile", async () => {
        let enabled = 0;
        let degraded = false;
        let pending = 0,
          uncertain = 0,
          blocked = 0,
          inFlightPublications = 0,
          oldestPendingAgeSeconds = 0;
        try {
          for (const company of await ctx.companies.list({ limit: 1000 })) {
            try {
              const config = await ctx.config.get(company.id);
              if (config.enabled !== true) {
                // Disabling revokes unsent snapshots without resolving secrets or making HTTP calls.
                const store = createBridgeStore(ctx.db);
                for (const row of await store.listCommentValidation(company.id))
                  await store.suppressOutbox(row.receiptKey);
                // An old publisher remains actionable even after the connection is disabled.
                const pendingClaims = await runtimeState(
                  ctx.db,
                  company.id,
                  "",
                ).deliveryHealth([]);
                inFlightPublications += pendingClaims.publishing ?? 0;
                if (pendingClaims.publishing) degraded = true;
                continue;
              }
              enabled++;
              const cfg = trusted(config, company.id);
              const runtime = runtimeState(ctx.db, company.id, cfg.relay);
              const deferred = await runtime.get<number>(
                "query-deferred-until",
              );
              if (deferred && deferred > Date.now()) {
                degraded = true;
                continue;
              }
              const loadConfig = async () => {
                const next = await ctx.config.get(company.id);
                if (next.enabled !== true) throw Error("Connection disabled.");
                const result = trusted(next, company.id);
                const saved = await createBridgeStore(ctx.db).loadConfig(
                  result.relay,
                  result.bridgePubkey,
                );
                return {
                  ...result,
                  cards: [
                    ...result.cards,
                    ...saved.cards.filter(
                      (c) =>
                        c.companyId === company.id &&
                        !result.cards.some((x) => x.token === c.token),
                    ),
                  ],
                };
              };
              const signer = async (
                template: Parameters<typeof finalizeEvent>[0],
              ) => {
                const current = await ctx.config.get(company.id);
                const value = await ctx.secrets.resolve(
                  current.signingKeyRef as Parameters<
                    PluginContext["secrets"]["resolve"]
                  >[0],
                  { companyId: company.id, configPath: "signingKeyRef" },
                );
                if (!hex.test(value))
                  throw Error("Signing key configuration is invalid.");
                const key = Uint8Array.from(Buffer.from(value, "hex"));
                try {
                  if (getPublicKey(key) !== cfg.bridgePubkey)
                    throw Error("Signing key does not match public key.");
                  return finalizeEvent(template, key);
                } finally {
                  key.fill(0);
                }
              };
              const buzz = makeBuzzHttpClient({
                relayUrl: cfg.relay,
                signer,
                fetch: ((url, init) =>
                  ctx.http.fetch(String(url), init)) as typeof fetch,
                clock: () => Math.floor(Date.now() / 1000),
              });
              const bridge = createBridge({
                store: createBridgeStore(ctx.db),
                native: createPaperclipAdapter(ctx),
                loadConfig,
                buzz,
                signer,
                clock: () => Math.floor(Date.now() / 1000),
                runtime,
              });
              const cursor = checkpoints(ctx.db);
              for (const b of cfg.bindings) {
                const key = b.channelId + ":" + b.rootId;
                const full = await runtime.get<boolean>("backfill:" + key);
                const progressKey =
                  (full ? "backfill-progress:" : "scan-progress:") + key;
                try {
                  const complete = await pollBinding({
                    binding: b,
                    since: full ? 0 : await cursor.get(b),
                    progress: await runtime.get<PollProgress>(progressKey),
                    saveProgress: (p) => runtime.set(progressKey, p),
                    query: async (filters) => {
                      try {
                        return await buzz.query(filters);
                      } catch (error) {
                        if (error instanceof BuzzRetryDeferred)
                          await runtime.set(
                            "query-deferred-until",
                            Date.now() + error.retryAfterMs,
                          );
                        throw error;
                      }
                    },
                    ingest: bridge.ingest,
                    save: (t) => cursor.save(b, t),
                  });
                  if (!complete) degraded = true;
                  else if (full) await runtime.set("backfill:" + key, false);
                } catch {
                  degraded = true;
                }
              }
              for (const b of cfg.bindings) {
                try {
                  for (const card of await ctx.issues.listInteractions(
                    b.issueId,
                    b.companyId,
                  ))
                    if (
                      !card.addresseeUserId &&
                      !card.addresseeAgentId &&
                      card.status === "pending" &&
                      card.kind === "request_confirmation" &&
                      !card.payload.target &&
                      !card.payload.toolAction &&
                      !card.payload.secretProposal
                    ) {
                      try {
                        await bridge.renderInteraction(b, card.id);
                      } catch {
                        degraded = true;
                      }
                    }
                } catch {
                  degraded = true;
                }
              }
              const result = await bridge.reconcile();
              if (result.state !== "idle") degraded = true;
              pending += result.pending;
              uncertain += result.uncertain;
              blocked += result.blocked ?? 0;
              inFlightPublications += result.inFlightPublications ?? 0;
              oldestPendingAgeSeconds = Math.max(
                oldestPendingAgeSeconds,
                result.oldestPendingAgeSeconds ?? 0,
              );
            } catch {
              degraded = true;
            }
          }
          health = {
            status: degraded ? "degraded" : enabled ? "ok" : "degraded",
            details: {
              connections: enabled,
              pendingReceipts: pending,
              uncertainMutations: uncertain,
              blockedReceipts: blocked,
              inFlightPublications,
              oldestPendingAgeSeconds,
              ...(!degraded && enabled
                ? { lastSuccessfulSync: new Date().toISOString() }
                : {}),
            },
            message: inFlightPublications
              ? "Publication is in flight or interrupted. Verify the prior worker is stopped before targeted same-event recovery."
              : degraded
                ? "Delivery or native outcome needs attention."
                : enabled
                  ? "Connected and up to date."
                  : "Enable a company connection to begin.",
          };
        } catch {
          health = {
            status: "error",
            message:
              "Connection paused. Check relay access, company mappings, signing-key reference and database migration.",
          };
        }
      });
    },
    async onValidateConfig(config) {
      return validateConfiguration(config);
    },
    async onHealth() {
      return {
        ...health,
        details: { ...health.details, roundtable: roundtableStatus() },
      };
    },
  });
}
const plugin = createPlugin();
export default plugin;
runWorker(plugin, import.meta.url);
