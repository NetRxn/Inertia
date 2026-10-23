import { validOutboundComments } from "./bridge/outbound-comments.js";
import type { JsonSchema } from "@paperclipai/plugin-sdk";
const text = { type: "string", minLength: 1 };
const hex = { type: "string", pattern: "^[0-9a-f]{64}$" };
const relay = {
  type: "string",
  description:
    "Bare HTTPS origin without credentials, path, query or fragment.",
};
const object = (properties: Record<string, unknown>, required: string[]) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});
export const configurationSchema: JsonSchema = {
  type: "object",
  properties: {
    enabled: { type: "boolean", default: false },
    relayUrl: relay,
    bridgePubkey: hex,
    signingKeyRef: object(
      {
        type: { const: "secret_ref" },
        secretId: text,
        version: {
          anyOf: [{ type: "integer", minimum: 1 }, { const: "latest" }],
        },
      },
      ["type", "secretId"],
    ),
    bindings: {
      type: "array",
      items: object(
        {
          relay,
          companyId: text,
          issueId: text,
          channelId: {
            type: "string",
            pattern:
              "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
          },
          rootId: hex,
          outboundComments: object({
            enabled: { type: "boolean", default: false },
            audienceAcknowledged: { type: "boolean", description: "I authorize sharing native comment text with everyone who can read this Buzz thread." },
            notBefore: { type: "string", description: "Earliest creation time to export, canonical UTC ISO timestamp including milliseconds." },
          }, ["enabled", "audienceAcknowledged", "notBefore"]),
        },
        ["relay", "companyId", "issueId", "channelId", "rootId"],
      ),
    },
    pairings: {
      type: "array",
      items: object(
        {
          relay,
          companyId: text,
          pubkey: hex,
          actorUserId: text,
          kind: { enum: ["human", "agent"] },
          active: { type: "boolean" },
        },
        ["relay", "companyId", "pubkey", "actorUserId", "kind", "active"],
      ),
    },
    cards: {
      type: "array",
      items: object(
        {
          token: { type: "string", pattern: "^[a-zA-Z0-9_-]{32,128}$" },
          companyId: text,
          issueId: text,
          interactionId: text,
          digest: hex,
        },
        ["token", "companyId", "issueId", "interactionId", "digest"],
      ),
    },
  },
  additionalProperties: false,
};
const isObject = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const isText = (x: unknown) => typeof x === "string" && x.trim().length > 0;
const isHex = (x: unknown) => typeof x === "string" && /^[0-9a-f]{64}$/.test(x);
export function validateConfiguration(
  c: Record<string, unknown>,
  companyId?: string,
): { ok: boolean; errors?: string[] } {
  const errors: string[] = [];
  const error = (path: string, what: string) => errors.push(path + ": " + what);
  if (c.enabled !== undefined && typeof c.enabled !== "boolean")
    error("enabled", "use true or false.");
  if (c.enabled !== true)
    return errors.length ? { ok: false, errors } : { ok: true };
  let origin = "";
  try {
    if (typeof c.relayUrl !== "string") throw Error();
    const u = new URL(c.relayUrl);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.search ||
      u.hash ||
      u.pathname !== "/"
    )
      throw Error();
    origin = u.origin;
  } catch {
    error("relayUrl", "use a bare HTTPS Buzz origin.");
  }
  if (!isHex(c.bridgePubkey))
    error(
      "bridgePubkey",
      "use a 64-character lowercase hexadecimal public key.",
    );
  if (!isObject(c.signingKeyRef))
    error("signingKeyRef", "select an existing Paperclip secret reference.");
  else {
    if (c.signingKeyRef.type !== "secret_ref")
      error("signingKeyRef.type", "use secret_ref.");
    if (!isText(c.signingKeyRef.secretId))
      error("signingKeyRef.secretId", "select an existing secret ID.");
    const v = c.signingKeyRef.version;
    if (
      v !== undefined &&
      v !== "latest" &&
      !(typeof v === "number" && Number.isSafeInteger(v) && v >= 1)
    )
      error("signingKeyRef.version", "use latest or a positive integer.");
  }
  for (const name of ["bindings", "pairings", "cards"] as const) {
    const rows = c[name];
    if (!Array.isArray(rows)) {
      error(name, "provide a list (empty is allowed).");
      continue;
    }
    const seen = new Set<string>();
    rows.forEach((row: unknown, i: number) => {
      const path = name + "[" + i + "]";
      if (!isObject(row)) {
        error(path, "provide an object.");
        return;
      }
      for (const field of name === "bindings"
        ? ["companyId", "issueId"]
        : name === "pairings"
          ? ["companyId", "actorUserId"]
          : ["companyId", "issueId", "interactionId"])
        if (!isText(row[field]))
          error(path + "." + field, "provide the verified native ID.");
      if (companyId && row.companyId !== companyId)
        error(path + ".companyId", "must match the company being configured.");
      if (name !== "cards" && row.relay !== origin)
        error(path + ".relay", "must exactly match the relayUrl origin.");
      if (name === "bindings") {
        if (row.outboundComments !== undefined && !validOutboundComments(row.outboundComments))
          error(path + ".outboundComments", "provide enabled, explicit audience acknowledgment and a canonical UTC start timestamp.");
        if (
          typeof row.channelId !== "string" ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            row.channelId,
          )
        )
          error(path + ".channelId", "provide the Buzz channel UUID.");
        if (!isHex(row.rootId))
          error(
            path + ".rootId",
            "provide the 64-character signed thread-root ID.",
          );
      }
      if (name === "pairings") {
        if (!isHex(row.pubkey))
          error(
            path + ".pubkey",
            "provide the verified 64-character public key.",
          );
        if (!["human", "agent"].includes(String(row.kind)))
          error(path + ".kind", "use human or agent.");
        if (typeof row.active !== "boolean")
          error(path + ".active", "use true or false.");
      }
      if (name === "cards") {
        if (
          typeof row.token !== "string" ||
          !/^[a-zA-Z0-9_-]{32,128}$/.test(row.token)
        )
          error(path + ".token", "use a bridge-generated card token.");
        if (!isHex(row.digest))
          error(
            path + ".digest",
            "use the recorded 64-character native card digest.",
          );
      }
      const key = JSON.stringify(
        name === "bindings"
          ? [row.relay, row.channelId, row.rootId]
          : name === "pairings"
            ? [row.relay, row.companyId, row.pubkey]
            : [row.token],
      );
      if (seen.has(key))
        error(
          path,
          "duplicate routing, identity or card mapping; keep exactly one.",
        );
      seen.add(key);
    });
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}
