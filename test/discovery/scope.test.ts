import { expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { verifyDfwScope } from "../../src/discovery/scope.js";
it("binds native organization/project/independent principal family to pinned DFW config before any subprocess call", async () => {
  const dir = await mkdtemp(join(tmpdir(), "dfw-scope-")),
    path = join(dir, "config.json");
  const config = {
    schema: "dfw.scoped-discovery-config.v1",
    organization_id: "dao",
    principal_id: "reviewer",
    project_ids: ["project"],
    reviewer: { scout_principal_id: "scout", policy_id: "name-v1" },
  };
  const body = JSON.stringify(config);
  await writeFile(path, body);
  const process: any = {
    args: ["-I", "bootstrap", "--config", path],
    pins: [{ path, sha256: createHash("sha256").update(body).digest("hex") }],
  };
  await expect(
    verifyDfwScope(process, {
      organizationId: "dao",
      projectId: "project",
      principalId: "reviewer",
      scoutPrincipalId: "scout",
      reviewerPolicyId: "name-v1",
    }),
  ).resolves.toBeUndefined();
  await expect(
    verifyDfwScope(process, {
      organizationId: "other",
      projectId: "project",
      principalId: "reviewer",
      scoutPrincipalId: "scout",
      reviewerPolicyId: "name-v1",
    }),
  ).rejects.toThrow();
  await expect(
    verifyDfwScope(process, {
      organizationId: "dao",
      projectId: "project",
      principalId: "reviewer",
    }),
  ).rejects.toThrow();
});
