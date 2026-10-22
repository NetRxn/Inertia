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
    "companies.read",
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
  entrypoints: { worker: "dist/src/worker.js" },
  database: { migrationsDir: "migrations" },
  jobs: [
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
  instanceConfigSchema: {
    type: "object",
    properties: {
      enabled: { type: "boolean", default: false },
      relayUrl: { type: "string", description: "Bare HTTPS Buzz relay origin" },
      bridgePubkey: { type: "string", pattern: "^[0-9a-f]{64}$" },
      signingKeyRef: {
        type: "object",
        description:
          "Paperclip secret_ref binding containing a hex Nostr secret key",
      },
      bindings: { type: "array", items: { type: "object" } },
      pairings: { type: "array", items: { type: "object" } },
      cards: { type: "array", items: { type: "object" } },
    },
    additionalProperties: false,
  },
};
export default manifest;
