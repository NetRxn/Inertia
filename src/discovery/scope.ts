import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import type { DiscoveryProcessConfig } from "./stdio.js";
/** Pinned administrator mapping, separate from untrusted tool parameters and subprocess output. */
export async function verifyDfwScope(
  process: DiscoveryProcessConfig,
  expected: {
    organizationId: string;
    projectId: string;
    principalId: string;
    scoutPrincipalId?: string;
    reviewerPolicyId?: string;
  },
) {
  const indices = process.args.flatMap((v, i) => (v === "--config" ? [i] : []));
  if (indices.length !== 1) throw Error("DFW scoped config argument required");
  const path = process.args[indices[0]! + 1],
    pin = process.pins.find((p) => p.path === path);
  if (!path || !pin || (await stat(path)).size > 1024 * 1024)
    throw Error("DFW scope config must be pinned and bounded");
  const bytes = await readFile(path);
  if (createHash("sha256").update(bytes).digest("hex") !== pin.sha256)
    throw Error("DFW scope config pin mismatch");
  const c = JSON.parse(bytes.toString("utf8"));
  if (
    c.schema !== "dfw.scoped-discovery-config.v1" ||
    c.organization_id !== expected.organizationId ||
    c.principal_id !== expected.principalId ||
    !Array.isArray(c.project_ids) ||
    !c.project_ids.includes(expected.projectId)
  )
    throw Error("DFW/native scope mismatch");
  if (expected.scoutPrincipalId !== undefined) {
    if (
      !expected.reviewerPolicyId ||
      expected.principalId === expected.scoutPrincipalId ||
      c.reviewer?.scout_principal_id !== expected.scoutPrincipalId ||
      c.reviewer?.policy_id !== expected.reviewerPolicyId
    )
      throw Error("DFW independent reviewer scope mismatch");
  } else if (c.reviewer !== undefined)
    throw Error("Reviewer process cannot act as scout");
}
