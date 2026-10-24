import { expect, it } from "vitest";
import {
  readNativeDocument,
  writeNativeDocument,
} from "../../src/discovery/documents.js";
it("uses append-only <=64-character native keys and resolves latest sequence, including lost create acknowledgment", async () => {
  const docs = new Map<string, any>();
  let lost = false;
  const api: any = {
    list: async () => [...docs.values()].reverse(),
    get: async (_i: string, k: string) => docs.get(k) ?? null,
    upsert: async (v: any) => {
      if (docs.has(v.key)) throw Error("baseRevisionId required");
      expect(v.key.length).toBeLessThanOrEqual(64);
      docs.set(v.key, v);
      if (lost) {
        lost = false;
        throw Error("ack lost");
      }
      return v;
    },
  };
  const input = {
    companyId: "c",
    issueId: "i",
    key: "funding-discovery-continuation",
    title: "Continuation",
    body: "one",
  };
  await writeNativeDocument(api, input);
  lost = true;
  await expect(
    writeNativeDocument(api, { ...input, body: "two" }),
  ).rejects.toThrow("ack lost");
  await writeNativeDocument(api, { ...input, body: "two" });
  expect(docs.size).toBe(2);
  expect((await readNativeDocument(api, "i", input.key, "c"))?.body).toBe(
    "two",
  );
});
