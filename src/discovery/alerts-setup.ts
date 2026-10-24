import { finalizeEvent, getPublicKey } from "nostr-tools";
import type { PluginContext } from "@paperclipai/plugin-sdk";
import { validateConfiguration } from "../config.js";
import { makeBuzzHttpClient } from "../buzz/http.js";
import { createBridgeStore } from "../store/postgres.js";
import { runtimeState } from "../bridge/runtime.js";
import type { Binding } from "../bridge/types.js";
import type { DiscoveryBinding } from "./host.js";
import { createUrgentBuzzDelivery, type UrgentBuzzConfig } from "./urgent.js";
import { renderPreliminaryBrief } from "./preliminary.js";
/** Reuses the one already-configured objective/Buzz connection and existing secret reference. */
export async function configuredUrgentAlerts(
  ctx: PluginContext,
  b: DiscoveryBinding,
) {
  async function read(): Promise<UrgentBuzzConfig | null> {
    const config = await ctx.config.get(b.companyId);
    const discovery = config.fundingDiscovery as
      | Record<string, unknown>
      | undefined;
    const alerts = discovery?.humanAlerts as
      | { enabled?: boolean; audienceAcknowledged?: boolean }
      | undefined;
    if (
      config.enabled !== true ||
      discovery?.enabled !== true ||
      alerts?.enabled !== true ||
      alerts.audienceAcknowledged !== true ||
      (b.authorize && !(await b.authorize()))
    )
      return null;
    if (!validateConfiguration(config, b.companyId).ok)
      throw Error("Urgent bridge configuration unavailable");
    const mappings = (config.bindings as Binding[]).filter(
      (x) => x.companyId === b.companyId && x.issueId === b.issueId,
    );
    if (mappings.length !== 1)
      throw Error(
        "Urgent discovery requires one explicitly configured objective/Buzz destination",
      );
    const mapping = mappings[0]!;
    return {
      organizationId: b.organizationId,
      companyId: b.companyId,
      issueId: b.issueId,
      enabled: true,
      audienceAcknowledged: true,
      relay: mapping.relay,
      channelId: mapping.channelId,
      rootId: mapping.rootId,
      bridgePubkey: config.bridgePubkey as string,
    };
  }
  const admitted = await read();
  if (!admitted) throw Error("Urgent delivery admission unavailable");
  const signer = async (template: Parameters<typeof finalizeEvent>[0]) => {
    const current = await ctx.config.get(b.companyId);
    if (!(await read())) throw Error("Urgent delivery disabled");
    const value = await ctx.secrets.resolve(
      current.signingKeyRef as Parameters<
        PluginContext["secrets"]["resolve"]
      >[0],
      { companyId: b.companyId, configPath: "signingKeyRef" },
    );
    if (!/^[0-9a-f]{64}$/.test(value))
      throw Error("Invalid urgent signing key");
    const key = Uint8Array.from(Buffer.from(value, "hex"));
    try {
      if (getPublicKey(key) !== admitted.bridgePubkey)
        throw Error("Urgent signing identity changed");
      return finalizeEvent(template, key);
    } finally {
      key.fill(0);
    }
  };
  const buzz = makeBuzzHttpClient({
    relayUrl: admitted.relay,
    signer,
    fetch: ((url, init) => ctx.http.fetch(String(url), init)) as typeof fetch,
    clock: () => Math.floor(Date.now() / 1000),
  });
  return createUrgentBuzzDelivery({
    scope: {
      organizationId: b.organizationId,
      companyId: b.companyId,
      issueId: b.issueId,
    },
    destination: {
      relay: admitted.relay,
      channelId: admitted.channelId,
      rootId: admitted.rootId,
      bridgePubkey: admitted.bridgePubkey,
    },
    loadConfig: read,
    signer,
    buzz,
    store: createBridgeStore(ctx.db),
    runtime: runtimeState(ctx.db, b.companyId, admitted.relay),
    readCurrent: async (ref) => {
      if (!b.bridge.readCapture)
        throw Error("Current source reader unavailable");
      if (b.authorize && !(await b.authorize())) return false;
      const capture = await b.bridge.readCapture(ref.captureId);
      if (!capture) return false;
      const p = capture.preliminary.find(
        (x) =>
          x.opportunityKey === ref.opportunityKey &&
          x.materialEventKey === ref.materialEventKey &&
          x.urgent !== null,
      );
      if (!p) return false;
      renderPreliminaryBrief(p);
      return true;
    },
  });
}
