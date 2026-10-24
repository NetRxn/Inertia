import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import {
  finalizeEvent,
  getPublicKey,
  type Event,
  type EventTemplate,
} from "nostr-tools";
import type { PluginDatabaseClient } from "@paperclipai/plugin-sdk";
import {
  createBridgeStore,
  BRIDGE_NAMESPACE,
} from "../../src/store/postgres.js";
import { runtimeState } from "../../src/bridge/runtime.js";
import { createBridge } from "../../src/bridge/service.js";
import { createPaperclipAdapter } from "../../src/paperclip/adapter.js";
import {
  BuzzDeliveryUnknown,
  BuzzRequestRejected,
  BuzzRetryDeferred,
} from "../../src/buzz/http.js";
import { verifyBuzzEvent } from "../../src/buzz/events.js";
import {
  createUrgentBuzzDelivery,
  urgentBuzzReceiptKey,
  type UrgentBuzzConfig,
  type UrgentBuzzDependencies,
} from "../../src/discovery/urgent.js";

vi.setConfig({ testTimeout: 60000, hookTimeout: 60000 });
const secret = new Uint8Array(32).fill(7);
const scope = { organizationId: "org", companyId: "co", issueId: "objective" };
const destination = {
  relay: "https://buzz.example",
  channelId: "00000000-0000-4000-8000-000000000001",
  rootId: "a".repeat(64),
  bridgePubkey: getPublicKey(secret),
};
const input = {
  eventKey: "material-event",
  body: "Public preliminary official-source evidence. Eligibility is unverified.",
  observedAt: "2026-10-24T00:00:00.000Z",
  sourceRef: {
    captureId: "capture",
    materialEventKey: "source-event",
    opportunityKey: "opportunity",
  },
};
let pg: PGlite,
  db: PluginDatabaseClient,
  deps: UrgentBuzzDependencies,
  config: UrgentBuzzConfig | null;
let source: boolean | Error,
  publishError: Error | null,
  sent: Event[],
  signs: number;
const receiptKey = () =>
  urgentBuzzReceiptKey({ ...scope, ...destination }, input.eventKey);
const adapter = () => createUrgentBuzzDelivery(deps);
beforeEach(async () => {
  pg = new PGlite();
  await pg.exec(`CREATE SCHEMA ${BRIDGE_NAMESPACE}`);
  for (const file of (
    await readdir(new URL("../../migrations/", import.meta.url))
  )
    .filter((x) => x.endsWith(".sql"))
    .sort())
    await pg.exec(
      await readFile(
        new URL("../../migrations/" + file, import.meta.url),
        "utf8",
      ),
    );
  db = {
    namespace: BRIDGE_NAMESPACE,
    query: async <T>(sql: string, p?: unknown[]) =>
      (await pg.query<T>(sql, p)).rows,
    execute: async (sql, p) => ({
      rowCount: (await pg.query(sql, p)).affectedRows ?? 0,
    }),
  };
  config = {
    ...scope,
    ...destination,
    enabled: true,
    audienceAcknowledged: true,
  };
  source = true;
  publishError = null;
  sent = [];
  signs = 0;
  deps = {
    scope,
    destination,
    store: createBridgeStore(db),
    runtime: runtimeState(db, scope.companyId, destination.relay),
    loadConfig: async () => structuredClone(config),
    readCurrent: async () => {
      if (source instanceof Error) throw source;
      return source;
    },
    signer: async (t) => {
      signs++;
      return finalizeEvent(t, secret);
    },
    buzz: {
      query: async () => [],
      publish: async (event) => {
        sent.push(event);
        if (publishError) throw publishError;
        return { eventId: event.id };
      },
    },
  };
});
afterEach(async () => {
  await pg.close();
});

it("persists a real signature before transport and reports relay acceptance, not human read", async () => {
  deps.buzz.publish = async (event) => {
    const row = await deps.store.getOutbox(receiptKey());
    expect(row).toMatchObject({ state: "publishing", eventId: event.id });
    expect(verifyBuzzEvent(row!.event).event).toEqual(event);
    sent.push(event);
    return { eventId: event.id };
  };
  const result = await adapter().deliver(input);
  expect(result).toEqual({ state: "accepted", eventId: sent[0]!.id });
  expect(result).not.toHaveProperty("read");
  expect(JSON.parse(sent[0]!.content)).toMatchObject({
    type: "inertia.funding.urgent.v1",
    organizationId: "org",
    issueId: "objective",
    body: input.body,
    sourceRef: input.sourceRef,
  });
  expect(await adapter().deliver(input)).toEqual(result);
  expect(sent).toHaveLength(1);
  expect(signs).toBe(1);
});
it("reuses the exact durable event after unknown delivery and adapter reconstruction", async () => {
  publishError = new BuzzDeliveryUnknown("unknown");
  expect((await adapter().deliver(input)).state).toBe("pending");
  const saved = await deps.store.getOutbox(receiptKey());
  expect(saved!.state).toBe("pending");
  publishError = null;
  expect(
    (
      await adapter().deliver({
        ...input,
        observedAt: "2026-10-24T01:00:00.000Z",
        body: "Changed caller text must not regenerate the event.",
      })
    ).state,
  ).toBe("accepted");
  expect(sent).toHaveLength(2);
  expect(sent[1]).toEqual(sent[0]);
  expect(signs).toBe(1);
});
it("does not suppress on source-read failure but terminally suppresses explicit source revocation", async () => {
  publishError = new BuzzDeliveryUnknown("unknown");
  await adapter().deliver(input);
  publishError = null;
  source = Error("source temporarily unavailable");
  expect((await adapter().deliver(input)).state).toBe("pending");
  expect((await deps.store.getOutbox(receiptKey()))!.state).toBe("pending");
  source = false;
  expect((await adapter().deliver(input)).state).toBe("suppressed");
  source = true;
  expect((await adapter().deliver(input)).state).toBe("suppressed");
  expect(sent).toHaveLength(1);
});
it("checks authoritative evidence before signing and again after signing before publication", async () => {
  source = false;
  expect((await adapter().deliver(input)).state).toBe("suppressed");
  expect(signs).toBe(0);
  source = true;
  deps.signer = (t) => {
    signs++;
    source = false;
    return finalizeEvent(t, secret);
  };
  expect((await adapter().deliver(input)).state).toBe("suppressed");
  expect(sent).toHaveLength(0);
  expect((await deps.store.getOutbox(receiptKey()))!.state).toBe("suppressed");
});
it.each(["missing", "disabled", "audience"] as const)(
  "is fail-closed for %s configuration",
  async (mode) => {
    if (mode === "missing") config = null;
    else if (mode === "disabled") delete config!.enabled;
    else config!.audienceAcknowledged = false;
    expect((await adapter().deliver(input)).state).toBe("disabled");
    expect(signs).toBe(0);
    expect(sent).toHaveLength(0);
  },
);
it("permanently suppresses a queued event when its configured destination is disabled", async () => {
  publishError = new BuzzDeliveryUnknown("unknown");
  await adapter().deliver(input);
  publishError = null;
  config!.enabled = false;
  expect((await adapter().deliver(input)).state).toBe("disabled");
  expect((await deps.store.getOutbox(receiptKey()))!.state).toBe("suppressed");
  config!.enabled = true;
  expect((await adapter().deliver(input)).state).toBe("suppressed");
  expect(sent).toHaveLength(1);
});
it.each([
  "organizationId",
  "companyId",
  "issueId",
  "channelId",
  "rootId",
  "relay",
  "bridgePubkey",
] as const)(
  "blocks a current %s binding mismatch without rerouting",
  async (field) => {
    publishError = new BuzzDeliveryUnknown("unknown");
    await adapter().deliver(input);
    publishError = null;
    config![field] =
      field === "relay"
        ? "https://other.example"
        : field === "channelId"
          ? "00000000-0000-4000-8000-000000000002"
          : ["rootId", "bridgePubkey"].includes(field)
            ? "b".repeat(64)
            : "foreign";
    expect((await adapter().deliver(input)).state).toBe("blocked");
    expect(sent).toHaveLength(1);
    expect(signs).toBe(1);
  },
);
it("rejects a signer that changes template data or signs with the wrong key", async () => {
  deps.signer = (t) => finalizeEvent({ ...t, content: "changed" }, secret);
  expect((await adapter().deliver(input)).state).toBe("blocked");
  expect(await deps.store.getOutbox(receiptKey())).toBeNull();
  deps.signer = (t) => finalizeEvent(t, new Uint8Array(32).fill(8));
  expect((await adapter().deliver(input)).state).toBe("blocked");
  expect(sent).toHaveLength(0);
});
it("durably defers rate limiting and requires explicit resumption after rejection", async () => {
  publishError = new BuzzDeliveryUnknown("unknown", {
    cause: new BuzzRetryDeferred(60000),
  });
  expect((await adapter().deliver(input)).state).toBe("pending");
  publishError = null;
  expect((await adapter().deliver(input)).state).toBe("pending");
  expect(sent).toHaveLength(1);
  await pg.query(
    `UPDATE ${BRIDGE_NAMESPACE}.bridge_outbox SET next_attempt_at=now()-interval '1 second'`,
  );
  publishError = new BuzzRequestRejected("denied", 403);
  expect((await adapter().deliver(input)).state).toBe("blocked");
  publishError = null;
  expect((await adapter().deliver(input)).state).toBe("blocked");
  expect(sent).toHaveLength(2);
  await deps.runtime.resumeBlocked([scope.issueId]);
  expect((await adapter().deliver(input)).state).toBe("accepted");
  expect(sent).toHaveLength(3);
  expect(signs).toBe(1);
});
it("never steals an interrupted publishing claim and requires targeted stopped-worker recovery", async () => {
  publishError = new BuzzDeliveryUnknown("unknown");
  await adapter().deliver(input);
  publishError = null;
  expect(
    await deps.store.claimCommentDelivery(receiptKey(), "stopped-owner"),
  ).toBe(true);
  expect((await adapter().deliver(input)).state).toBe("pending");
  await deps.runtime.resumeBlocked([scope.issueId]);
  expect((await deps.store.getOutbox(receiptKey()))!.state).toBe("publishing");
  expect(
    await deps.store.recoverCommentDelivery(receiptKey(), "wrong-owner"),
  ).toBe(false);
  expect(
    await deps.store.recoverCommentDelivery(receiptKey(), "stopped-owner"),
  ).toBe(true);
  expect((await adapter().deliver(input)).state).toBe("accepted");
  expect(sent).toHaveLength(2);
  expect(sent[1]).toEqual(sent[0]);
});
it("leaves alert rows exclusively to the specialized validator during base bridge reconciliation", async () => {
  publishError = new BuzzDeliveryUnknown("unknown");
  await adapter().deliver(input);
  publishError = null;
  await createBridge({
    store: deps.store,
    runtime: deps.runtime,
    signer: deps.signer,
    buzz: deps.buzz,
    clock: () => 1792800000,
    native: createPaperclipAdapter({ issues: {} } as never),
    loadConfig: async () => ({
      relay: destination.relay,
      bridgePubkey: destination.bridgePubkey,
      companyId: scope.companyId,
      bindings: [
        { ...destination, companyId: scope.companyId, issueId: scope.issueId },
      ],
      cards: [],
      pairings: [],
    }),
  }).reconcile();
  expect(sent).toHaveLength(1);
  expect((await deps.store.getOutbox(receiptKey()))!.state).toBe("pending");
});
it("rechecks destination revocation that occurs during the final source read", async () => {
  let reads = 0;
  deps.readCurrent = async () => {
    if (++reads === 3) config!.enabled = false;
    return true;
  };
  expect((await adapter().deliver(input)).state).toBe("disabled");
  expect(sent).toHaveLength(0);
  expect((await deps.store.getOutbox(receiptKey()))!.state).toBe("suppressed");
});
it("does not include surplus source reference properties in the public event", async () => {
  const supplied = {
    ...input,
    sourceRef: { ...input.sourceRef, internalSecret: "never-export" },
  };
  expect((await adapter().deliver(supplied)).state).toBe("accepted");
  expect(sent[0]!.content).not.toContain("never-export");
  expect(sent[0]!.content).not.toContain("internalSecret");
});
it("permits only one publisher while another call is in flight", async () => {
  let release!: () => void, reached!: () => void;
  const paused = new Promise<void>((r) => {
      reached = r;
    }),
    resume = new Promise<void>((r) => {
      release = r;
    });
  deps.buzz.publish = async (event) => {
    sent.push(event);
    reached();
    await resume;
    return { eventId: event.id };
  };
  const running = adapter().deliver(input);
  await paused;
  try {
    expect((await adapter().deliver(input)).state).toBe("pending");
    expect(sent).toHaveLength(1);
  } finally {
    release();
  }
  expect((await running).state).toBe("accepted");
});
it("records source revocation during in-flight unknown delivery without stealing its claim", async () => {
  let release!: () => void, reached!: () => void;
  const paused = new Promise<void>((r) => {
      reached = r;
    }),
    resume = new Promise<void>((r) => {
      release = r;
    });
  deps.buzz.publish = async (event) => {
    sent.push(event);
    reached();
    await resume;
    throw new BuzzDeliveryUnknown(event.id);
  };
  const running = adapter().deliver(input);
  await paused;
  try {
    source = false;
    expect((await adapter().deliver(input)).state).toBe("suppressed");
    expect(await deps.store.getOutbox(receiptKey())).toMatchObject({
      state: "publishing",
      suppressionRequested: true,
    });
  } finally {
    release();
  }
  expect((await running).state).toBe("suppressed");
  expect((await deps.store.getOutbox(receiptKey()))!.state).toBe("suppressed");
  expect(sent).toHaveLength(1);
});
it("retains a non-expiring claim if acceptance persistence fails", async () => {
  const finish = deps.store.finishCommentDelivery;
  deps.store = {
    ...deps.store,
    finishCommentDelivery: async (...args) => {
      if (args[2] === "delivered") throw Error("database unavailable");
      return finish(...args);
    },
  };
  expect((await adapter().deliver(input)).state).toBe("pending");
  expect((await deps.store.getOutbox(receiptKey()))!.state).toBe("publishing");
  deps.store = { ...deps.store, finishCommentDelivery: finish };
  expect((await adapter().deliver(input)).state).toBe("pending");
  expect(sent).toHaveLength(1);
});
it("uses the actual signed Buzz HTTP transport without a native wakeup or user-read claim", async () => {
  const { makeBuzzHttpClient } = await import("../../src/buzz/http.js");
  const published: string[] = [];
  deps.buzz = makeBuzzHttpClient({
    relayUrl: destination.relay,
    signer: deps.signer,
    clock: () => 1792800000,
    fetch: (async (url: string | URL | Request, init?: RequestInit) => {
      expect(url).toBe(destination.relay + "/events");
      const auth = JSON.parse(
        Buffer.from(
          (init!.headers as Record<string, string>).Authorization!.slice(6),
          "base64",
        ).toString(),
      );
      expect(auth.kind).toBe(27235);
      expect(auth.tags).toContainEqual(["u", destination.relay + "/events"]);
      published.push(String(init!.body));
      const event = JSON.parse(String(init!.body));
      expect(await deps.store.getOutbox(receiptKey())).toMatchObject({
        state: "publishing",
        eventId: event.id,
      });
      return new Response(
        JSON.stringify({ event_id: event.id, accepted: true }),
        { status: 200 },
      );
    }) as typeof fetch,
  });
  const outcome = await adapter().deliver(input);
  expect(outcome).toEqual({
    state: "accepted",
    eventId: JSON.parse(published[0]!).id,
  });
  expect(published).toHaveLength(1);
  expect((await deps.store.getOutbox(receiptKey()))!.state).toBe("delivered");
});
it("deduplicates new capture proofs for the same material event and retries the immutable original", async () => {
  publishError = new BuzzDeliveryUnknown("unknown");
  await adapter().deliver(input);
  publishError = null;
  const fresh = {
    ...input,
    observedAt: "2026-10-24T01:00:00.000Z",
    sourceRef: { ...input.sourceRef, captureId: "new-capture" },
  };
  const checked: string[] = [];
  deps.readCurrent = async (ref) => {
    checked.push(ref.captureId);
    return ref.captureId === "new-capture";
  };
  expect((await adapter().deliver(fresh)).state).toBe("accepted");
  expect(checked).toEqual(["new-capture", "new-capture", "new-capture"]);
  expect(sent).toHaveLength(2);
  expect(sent[1]).toEqual(sent[0]);
  expect(signs).toBe(1);
  expect(
    (
      await adapter().deliver({
        ...fresh,
        sourceRef: { ...fresh.sourceRef, captureId: "third-capture" },
      })
    ).state,
  ).toBe("accepted");
  expect(sent).toHaveLength(2);
});
