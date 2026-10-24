import { expect, it } from "vitest";
import {
  registerConfiguredFundingDiscovery,
  fundingDiscoverySchema,
} from "../../src/discovery/setup.js";
it("default-disabled registration does not spawn processes or touch source state", async () => {
  const registered: string[] = [];
  const ctx: any = {
    companies: { list: async () => [{ id: "company" }] },
    config: { get: async () => ({}) },
    db: { namespace: "plugin_netrxn_inertia_e936d62b87" },
    tools: { register: (k: string) => registered.push(k) },
    jobs: { register: (k: string) => registered.push(k) },
  };
  await registerConfiguredFundingDiscovery(ctx);
  expect(registered).toContain("funding-discovery-context");
  expect(registered).toContain("funding-discovery-recheck");
  expect((fundingDiscoverySchema as any).properties.enabled.default).toBe(
    false,
  );
});
it("skips only explicit inaccessible company context and surfaces other errors", async () => {
  const ctx: any = {
    companies: { list: async () => [{ id: "other" }] },
    config: {
      get: async () => {
        throw Error("config.get: company context is required");
      },
    },
    db: { namespace: "plugin_netrxn_inertia_e936d62b87" },
    tools: { register() {} },
    jobs: { register() {} },
  };
  await expect(
    registerConfiguredFundingDiscovery(ctx),
  ).resolves.toBeUndefined();
  ctx.config.get = async () => {
    throw Error("database unavailable");
  };
  await expect(registerConfiguredFundingDiscovery(ctx)).rejects.toThrow(
    "database unavailable",
  );
});
