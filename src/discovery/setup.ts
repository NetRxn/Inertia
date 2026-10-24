import { verifyDfwScope } from "./scope.js";
import { configuredUrgentAlerts } from "./alerts-setup.js";
import { randomUUID } from "node:crypto";
import type { PluginContext } from "@paperclipai/plugin-sdk";
import { createRuntimeOwner } from "../bridge/ownership.js";
import { registerFundingDiscovery, type DiscoveryBinding } from "./host.js";
import {
  createStdioDiscoveryBridge,
  type DiscoveryProcessConfig,
} from "./stdio.js";
import { discoveryHash } from "./service.js";
export { fundingDiscoverySchema } from "./schema.js";
/** One plugin/one runtime. Installation declares capabilities; enabling this config is separate admission. */
export async function registerConfiguredFundingDiscovery(
  ctx: PluginContext,
): Promise<void> {
  const bindings: DiscoveryBinding[] = [];
  for (const company of await ctx.companies.list({ limit: 1000 })) {
    let raw: unknown;
    try {
      raw = (await ctx.config.get(company.id)).fundingDiscovery;
    } catch (error) {
      // The native company inventory can include companies outside plugin admission.
      // Only the explicit missing-scope denial is skipped; enabled config errors fail.
      if (
        error instanceof Error &&
        error.message.includes("company context is required")
      )
        continue;
      throw error;
    }
    if (
      !raw ||
      typeof raw !== "object" ||
      Array.isArray(raw) ||
      (raw as Record<string, unknown>).enabled !== true
    )
      continue;
    const c = raw as Record<string, unknown>;
    const fingerprint = discoveryHash(c);
    const allowed = [
      "enabled",
      "key",
      "organizationId",
      "projectId",
      "issueId",
      "agentId",
      "urgentIssueId",
      "publicQueries",
      "capabilities",
      "maximumLeads",
      "retryAfterMs",
      "runBudgetMs",
      "process",
      "principalId",
      "diligence",
      "humanAlerts",
    ];
    if (Object.keys(c).some((k) => !allowed.includes(k)))
      throw Error("Unexpected funding discovery configuration");
    if (typeof c.principalId !== "string" || !c.principalId.trim())
      throw Error("Missing DFW scout principal mapping");
    await verifyDfwScope(c.process as unknown as DiscoveryProcessConfig, {
      organizationId: c.organizationId as string,
      projectId: c.projectId as string,
      principalId: c.principalId,
    });
    const binding: DiscoveryBinding = {
      key: c.key as string,
      enabled: true,
      companyId: company.id,
      organizationId: c.organizationId as string,
      projectId: c.projectId as string,
      issueId: c.issueId as string,
      agentId: c.agentId as string,
      urgentIssueId: c.urgentIssueId as string,
      publicQueries: c.publicQueries as string[],
      capabilities: c.capabilities as string[],
      maximumLeads: c.maximumLeads as number,
      retryAfterMs: c.retryAfterMs as number,
      ...(c.runBudgetMs === undefined
        ? {}
        : { runBudgetMs: c.runBudgetMs as number }),
      bridge: createStdioDiscoveryBridge(
        c.process as unknown as DiscoveryProcessConfig,
      ),
      authorize: async () =>
        discoveryHash((await ctx.config.get(company.id)).fundingDiscovery) ===
        fingerprint,
    };
    if (c.diligence) {
      const d = c.diligence as Record<string, unknown>;
      if (
        Object.keys(d).some(
          (k) =>
            ![
              "issueId",
              "agentId",
              "process",
              "principalId",
              "policyId",
            ].includes(k),
        ) ||
        typeof d.issueId !== "string" ||
        !d.issueId.trim() ||
        typeof d.agentId !== "string" ||
        !d.agentId.trim() ||
        d.issueId === binding.issueId ||
        d.agentId === binding.agentId
      )
        throw Error("Invalid independent diligence configuration");
      if (typeof d.principalId !== "string" || typeof d.policyId !== "string")
        throw Error("Missing independent DFW principal mapping");
      await verifyDfwScope(d.process as unknown as DiscoveryProcessConfig, {
        organizationId: binding.organizationId,
        projectId: binding.projectId,
        principalId: d.principalId,
        scoutPrincipalId: c.principalId,
        reviewerPolicyId: d.policyId,
      });
      binding.diligence = {
        issueId: d.issueId,
        agentId: d.agentId,
        bridge: createStdioDiscoveryBridge(
          d.process as unknown as DiscoveryProcessConfig,
        ),
      };
    }
    if ((c.humanAlerts as { enabled?: boolean } | undefined)?.enabled === true)
      binding.humanAlerts = await configuredUrgentAlerts(ctx, binding);
    bindings.push(binding);
  }
  const owner = createRuntimeOwner(ctx.db, {
    workerId: "funding:" + process.pid + ":" + randomUUID(),
    runId: "native-plugin-worker",
  });
  registerFundingDiscovery(ctx, bindings, owner);
}
