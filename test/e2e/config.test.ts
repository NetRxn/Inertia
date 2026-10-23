import { it, expect } from "vitest";
import { validateConfiguration } from "../../src/worker.js";
import { manifest } from "../../src/manifest.js";
const good = () => ({
  enabled: true,
  relayUrl: "https://buzz.example",
  bridgePubkey: "a".repeat(64),
  signingKeyRef: { type: "secret_ref", secretId: "existing" },
  bindings: [
    {
      relay: "https://buzz.example",
      companyId: "co",
      issueId: "issue",
      channelId: "11111111-1111-4111-8111-111111111111",
      rootId: "b".repeat(64),
    },
  ],
  pairings: [
    {
      relay: "https://buzz.example",
      companyId: "co",
      pubkey: "c".repeat(64),
      actorUserId: "member",
      kind: "human",
      active: true,
    },
  ],
  cards: [],
});
it("accepts a complete safe configuration without resolving secrets or granting pairings", () => {
  expect(validateConfiguration(good())).toEqual({ ok: true });
});
it("returns exact field paths for malformed nested rows without echoing values", () => {
  const c: any = good();
  c.bindings[0].rootId = "private-secret";
  c.pairings[0].active = "yes";
  c.pairings[0].actorUserId = "";
  c.cards = [null];
  const result = validateConfiguration(c);
  expect(result.ok).toBe(false);
  const text = JSON.stringify(result);
  expect(text).toContain("bindings[0].rootId");
  expect(text).toContain("pairings[0].active");
  expect(text).toContain("pairings[0].actorUserId");
  expect(text).toContain("cards[0]");
  expect(text).not.toContain("private-secret");
});
it("rejects foreign relay mappings and ambiguous duplicate identity or thread routes", () => {
  const c = good();
  c.bindings.push({ ...c.bindings[0]! });
  c.pairings.push({ ...c.pairings[0]! });
  c.bindings[0]!.relay = "https://other.example";
  const result = JSON.stringify(validateConfiguration(c));
  expect(result).toContain("bindings[0].relay");
  expect(result).toContain("pairings[1]");
});
it("provides typed required row fields in the native configuration schema", () => {
  const schema = manifest.instanceConfigSchema as any;
  expect(schema.properties.bindings.items.required).toContain("rootId");
  expect(schema.properties.pairings.items.properties.active.type).toBe(
    "boolean",
  );
  expect(schema.properties.signingKeyRef.required).toContain("secretId");
});
it("requires explicit audience acknowledgment and an unambiguous start time for outbound comments", () => {
  const c: any = good();
  c.bindings[0].outboundComments = { enabled: true, notBefore: "2026-10-23T00:00:00.000Z" };
  expect(validateConfiguration(c).ok).toBe(false);
  c.bindings[0].outboundComments.audienceAcknowledged = true;
  expect(validateConfiguration(c).ok).toBe(true);
  for (const date of ["yesterday", "2026-10-23", "2026-02-30T00:00:00.000Z"]) {
    c.bindings[0].outboundComments.notBefore = date;
    expect(validateConfiguration(c).ok).toBe(false);
  }
});
it("rejects a non-string outbound boundary even when it is a valid Date object", () => {
 const c: any = good();
 c.bindings[0].outboundComments = { enabled: true, audienceAcknowledged: true, notBefore: new Date("2026-10-23T00:00:00.000Z") };
 expect(validateConfiguration(c).ok).toBe(false);
});
