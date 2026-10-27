import { objectiveIntakeJobDeclaration, objectiveSourceContextToolDeclaration, objectiveIntakeCapabilities } from "./intake/host.js";
import { meetingExtractionTools } from "./roundtable/extraction.js";
import { centralTools, centralCapabilities } from "./central/host.js";
import { publicDraftingTools, publicDraftingCapabilities, publicGapPlanReviewTool } from "./drafting/host.js";
import { fundingDiscoveryManifest } from "./discovery/host.js";
import { roundtableJobDeclaration } from "./roundtable/host.js";
import { configurationSchema } from "./config.js";
import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
export const manifest: PaperclipPluginManifestV1 = {
  id: "netrxn.inertia",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Inertia · Buzz connection",
  description:
    "One conversation across Buzz and Paperclip, with signed identities and recoverable delivery.",
  author: "NetRxn",
  categories: ["connector"],
  minimumHostVersion: "2026.1012.0",
  capabilities: [
    ...fundingDiscoveryManifest.capabilities,
    "ui.detailTab.register",
    "ui.page.register",
    ...objectiveIntakeCapabilities,
    ...publicDraftingCapabilities,
    ...centralCapabilities,
    "companies.read",
    "issues.read",
    "issues.create",
    "issues.update",
    "issue.comments.read",
    "issue.comments.create",
    "issue.comments.create_human_attributed",
    "issue.interactions.read",
    "issue.interactions.respond",
    "database.namespace.read",
    "database.namespace.write",
    "database.namespace.migrate",
    "jobs.schedule",
    "http.outbound",
    "secrets.read-ref",
  ],
  entrypoints: { worker: "dist/src/worker.js", ui: "dist/ui" },
  ui: { slots: [{ type: "detailTab", id: "member-packet", displayName: "Packet", exportName: "MemberPacketTab", entityTypes: ["issue"] }, { type: "companySettingsPage", id: "integrations", displayName: "Integrations", exportName: "IntegrationsSettingsPage", routePath: "integrations" }] },
  database: { migrationsDir: "migrations" },
  tools: [...fundingDiscoveryManifest.tools, ...publicDraftingTools.map(({ operation: _, ...tool }) => tool), (({operation:_,...tool})=>tool)(publicGapPlanReviewTool), ...meetingExtractionTools, objectiveSourceContextToolDeclaration, ...centralTools.map(({ operation: _, ...tool }) => tool)],
  jobs: [
    ...fundingDiscoveryManifest.jobs,
    roundtableJobDeclaration,
    objectiveIntakeJobDeclaration,
    {
      jobKey: "backfill-conversations",
      displayName: "Backfill connected conversations",
      description:
        "Recover older signed messages in bounded, resumable batches.",
    },
    {
      jobKey: "retry-blocked-deliveries",
      displayName: "Retry blocked deliveries",
      description: "Run after correcting relay access or connection settings.",
    },
    {
      jobKey: "reconcile",
      displayName: "Keep Buzz connected",
      schedule: "* * * * *",
    },
  ],
  instanceConfigSchema: configurationSchema,
};
export default manifest;
