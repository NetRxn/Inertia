import { it, expect } from "vitest";
import { manifest } from "../../src/manifest.js";
import { createPlugin, validateConfiguration } from "../../src/worker.js";
it("declares the real SDK worker, SQL migration and narrow native capabilities", () => {
  expect(manifest.id).toBe("netrxn.inertia");
  expect(manifest.database?.migrationsDir).toBe("migrations");
  expect(manifest.capabilities).toContain(
    "issue.comments.create_human_attributed",
  );
  expect(manifest.capabilities).not.toContain("approvals.respond");
  expect(manifest.entrypoints.worker).toBe("dist/src/worker.js");
});
it("fails closed with actionable redacted configuration errors", () => {
  expect(
    validateConfiguration({
      enabled: true,
      relayUrl: "https://secret:token@buzz.example",
      signingKeyRef: "password=secret",
    }).ok,
  ).toBe(false);
  expect(
    JSON.stringify(
      validateConfiguration({
        enabled: true,
        relayUrl: "https://secret:token@buzz.example",
      }),
    ),
  ).not.toContain("token");
  expect(validateConfiguration({ enabled: false }).ok).toBe(true);
});
it("exports an actual definePlugin lifecycle with no side effects during import", async () => {
  const plugin = createPlugin();
  expect(typeof plugin.definition.setup).toBe("function");
  expect((await plugin.definition.onHealth!()).status).toBe("degraded");
});

it("registers the native scheduled job and reports disabled setup without external calls", async () => {
  const { createTestHarness } = await import("@paperclipai/plugin-sdk/testing");
  const harness = createTestHarness({ manifest, config: { enabled: false } });
  const plugin = createPlugin();
  await plugin.definition.setup(harness.ctx);
  await harness.runJob("reconcile");
  expect(await plugin.definition.onHealth!()).toMatchObject({
    status: "degraded",
    message: "Enable a company connection to begin.",
  });
});
