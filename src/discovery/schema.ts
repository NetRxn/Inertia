import type { JsonSchema } from "@paperclipai/plugin-sdk";
export const fundingDiscoverySchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    enabled: { type: "boolean", default: false },
    key: { type: "string" },
    organizationId: { type: "string" },
    principalId: { type: "string" },
    projectId: { type: "string" },
    issueId: { type: "string" },
    portfolioRootIssueId: { type:"string",minLength:1,maxLength:128 },
    rootProjectId: { type:"string",minLength:1,maxLength:128 },
    agentId: { type: "string" },
    urgentIssueId: { type: "string" },
    publicQueries: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 10,
    },
    capabilities: { type: "array", items: { type: "string" }, maxItems: 20 },
    maximumLeads: { type: "integer", minimum: 1, maximum: 20 },
    retryAfterMs: { type: "integer", minimum: 60000, maximum: 604800000 },
    runBudgetMs: { type: "integer", minimum: 1000, maximum: 600000 },
    process: {
      type: "object",
      description:
        "Administrator-pinned local DFW bootstrap/config. Never supplied by source text or an agent tool.",
    },
    humanAlerts: {
      type: "object",
      additionalProperties: false,
      properties: {
        enabled: { type: "boolean", default: false },
        audienceAcknowledged: { type: "boolean", default: false },
      },
      required: ["enabled", "audienceAcknowledged"],
    },
    diligence: {
      type: "object",
      additionalProperties: false,
      properties: {
        issueId: { type: "string" },
        agentId: { type: "string" },
        process: { type: "object" },
        principalId: { type: "string" },
        policyId: { type: "string" },
      },
      required: ["issueId", "agentId", "process", "principalId", "policyId"],
    },
  },
};
