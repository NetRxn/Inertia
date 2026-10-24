import { createHash, randomUUID } from "node:crypto";
import type { Event, EventTemplate } from "nostr-tools";
import { verifyBuzzEvent, verifySignedEvent } from "../buzz/events.js";
import {
  BuzzConfigurationError,
  BuzzDeliveryUnknown,
  BuzzRequestRejected,
  BuzzRetryDeferred,
  type BuzzClient,
  type EventSigner,
} from "../buzz/http.js";
import type { RuntimeState } from "../bridge/runtime.js";
import type { BridgeStore, OutboxReceipt } from "../store/postgres.js";

export const URGENT_BUZZ_TYPE = "inertia.funding.urgent.v1";
export interface UrgentBuzzScope {
  organizationId: string;
  companyId: string;
  issueId: string;
}
export interface UrgentBuzzDestination {
  relay: string;
  channelId: string;
  rootId: string;
  bridgePubkey: string;
}
export interface UrgentBuzzConfig
  extends UrgentBuzzScope,
    UrgentBuzzDestination {
  /** Explicitly configured human-channel delivery; neither flag defaults to enabled. */
  enabled?: boolean;
  audienceAcknowledged?: boolean;
}
export interface UrgentBuzzSourceRef {
  captureId: string;
  materialEventKey: string;
  opportunityKey: string | null;
}
export interface UrgentBuzzInput {
  eventKey: string;
  /** Public preliminary evidence rendered by the trusted discovery host, never raw source instructions. */
  body: string;
  observedAt: string;
  sourceRef: UrgentBuzzSourceRef;
}
export interface UrgentBuzzResult {
  /** accepted means only an exact relay acknowledgment, never human receipt, read, or action. */
  state: "accepted" | "pending" | "blocked" | "suppressed" | "disabled";
  eventId?: string;
}
export interface UrgentBuzzDelivery {
  deliver(input: UrgentBuzzInput): Promise<UrgentBuzzResult>;
}
export interface UrgentBuzzDependencies {
  scope: UrgentBuzzScope;
  /** Pinned trusted destination. A config edit must not silently reroute historical events. */
  destination: UrgentBuzzDestination;
  loadConfig(): Promise<UrgentBuzzConfig | null>;
  signer: EventSigner;
  buzz: BuzzClient;
  store: BridgeStore;
  runtime: RuntimeState;
  /** Authoritative current source/audience/material-event validation, scoped by the host.
   * Only explicit false revokes. Failures and indeterminate outcomes remain retryable. */
  readCurrent(sourceRef: UrgentBuzzSourceRef): Promise<boolean>;
}
interface Payload extends UrgentBuzzScope, UrgentBuzzInput {
  type: typeof URGENT_BUZZ_TYPE;
}
const identifier = (v: unknown): v is string =>
  typeof v === "string" && !!v.trim() && v.length <= 255;
const instant = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString() === v;
const sourceValid = (v: UrgentBuzzSourceRef): boolean =>
  !!v &&
  identifier(v.captureId) &&
  identifier(v.materialEventKey) &&
  (v.opportunityKey === null || identifier(v.opportunityKey));
// A capture identifies one observation, not a material change. A fresh capture can
// independently reauthorize the same immutable event without creating a duplicate.
const sourceEqual = (a: UrgentBuzzSourceRef, b: UrgentBuzzSourceRef): boolean =>
  a.materialEventKey === b.materialEventKey &&
  a.opportunityKey === b.opportunityKey;
const sameScope = (a: UrgentBuzzScope, b: UrgentBuzzScope): boolean =>
  a.organizationId === b.organizationId &&
  a.companyId === b.companyId &&
  a.issueId === b.issueId;
const sameDestination = (
  a: UrgentBuzzDestination,
  b: UrgentBuzzDestination,
): boolean =>
  a.relay === b.relay &&
  a.channelId === b.channelId &&
  a.rootId === b.rootId &&
  a.bridgePubkey === b.bridgePubkey;

/** Material identity and approved destination, not body text or retry time, define idempotency. */
export function urgentBuzzReceiptKey(
  binding: UrgentBuzzScope & UrgentBuzzDestination,
  eventKey: string,
): string {
  return (
    "alert:" +
    createHash("sha256")
      .update(
        JSON.stringify([
          URGENT_BUZZ_TYPE,
          binding.organizationId,
          binding.companyId,
          binding.issueId,
          binding.relay,
          binding.channelId,
          binding.rootId,
          eventKey,
        ]),
      )
      .digest("hex")
  );
}

/** Uses Inertia's existing durable outbox and non-expiring publication claim. No new ledger,
 * scheduler, credentials, audience grants, or live connection are created by this adapter. */
export function createUrgentBuzzDelivery(
  d: UrgentBuzzDependencies,
): UrgentBuzzDelivery {
  const binding = structuredClone({ ...d.scope, ...d.destination });
  let relay: URL;
  try {
    relay = new URL(binding.relay);
  } catch {
    throw Error("Invalid urgent delivery destination.");
  }
  if (
    ![binding.organizationId, binding.companyId, binding.issueId].every(
      identifier,
    ) ||
    relay.protocol !== "https:" ||
    relay.origin !== binding.relay ||
    relay.username ||
    relay.password ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      binding.channelId,
    ) ||
    !/^[0-9a-f]{64}$/.test(binding.rootId) ||
    !/^[0-9a-f]{64}$/.test(binding.bridgePubkey)
  )
    throw Error("Invalid urgent delivery destination.");

  const result = (
    state: UrgentBuzzResult["state"],
    row?: OutboxReceipt | null,
  ): UrgentBuzzResult => ({ state, ...(row ? { eventId: row.eventId } : {}) });
  async function configuration(
    row?: OutboxReceipt | null,
  ): Promise<UrgentBuzzResult["state"] | null> {
    let cfg: UrgentBuzzConfig | null;
    try {
      cfg = await d.loadConfig();
    } catch {
      return "pending";
    }
    // A foreign tenant cannot mutate even a known receipt in this worker's scope.
    if (cfg && !sameScope(cfg, binding)) return "blocked";
    if (!cfg || cfg.enabled !== true || cfg.audienceAcknowledged !== true) {
      if (row) await d.store.suppressOutbox(row.receiptKey);
      return "disabled";
    }
    if (!sameDestination(cfg, binding)) {
      if (row) await d.store.suppressOutbox(row.receiptKey);
      return "blocked";
    }
    return null;
  }
  async function gate(
    sourceRef: UrgentBuzzSourceRef,
    row?: OutboxReceipt | null,
  ): Promise<UrgentBuzzResult["state"] | null> {
    const before = await configuration(row);
    if (before) return before;
    let current: boolean;
    try {
      current = await d.readCurrent(structuredClone(sourceRef));
    } catch {
      return "pending";
    }
    if (current === false) {
      if (row) await d.store.suppressOutbox(row.receiptKey);
      return "suppressed";
    }
    // A source read can outlast a destination/audience revocation.
    return current === true ? configuration(row) : "pending";
  }
  function validateRecord(row: OutboxReceipt, input: UrgentBuzzInput): Event {
    const { event, channelId, rootId } = verifyBuzzEvent(row.event);
    const payload = JSON.parse(event.content) as Payload;
    if (
      row.receiptKey !== urgentBuzzReceiptKey(binding, input.eventKey) ||
      row.relay !== binding.relay ||
      row.eventId !== event.id ||
      event.pubkey !== binding.bridgePubkey ||
      channelId !== binding.channelId ||
      rootId !== binding.rootId ||
      payload.type !== URGENT_BUZZ_TYPE ||
      !sameScope(payload, binding) ||
      payload.eventKey !== input.eventKey ||
      !sourceValid(payload.sourceRef) ||
      !sourceEqual(payload.sourceRef, input.sourceRef) ||
      !instant(payload.observedAt) ||
      event.created_at !== Math.floor(Date.parse(payload.observedAt) / 1000) ||
      typeof payload.body !== "string" ||
      !payload.body.trim() ||
      Buffer.byteLength(payload.body) > 16384 ||
      JSON.stringify(event.tags) !== JSON.stringify(tags(row.receiptKey))
    )
      throw Error("Urgent delivery receipt binding mismatch.");
    return event;
  }
  function tags(receiptKey: string): string[][] {
    return [
      ["h", binding.channelId],
      ["e", binding.rootId, "", "root"],
      ["e", binding.rootId, "", "reply"],
      ["inertia", receiptKey],
    ];
  }
  return {
    async deliver(raw): Promise<UrgentBuzzResult> {
      // Snapshot all caller-owned values before the first asynchronous boundary.
      if (!raw || typeof raw !== "object") return result("blocked");
      const candidate = structuredClone(raw);
      if (!identifier(candidate.eventKey) || !sourceValid(candidate.sourceRef))
        return result("blocked");
      const input: UrgentBuzzInput = {
        eventKey: candidate.eventKey,
        body: candidate.body,
        observedAt: candidate.observedAt,
        sourceRef: {
          captureId: candidate.sourceRef.captureId,
          materialEventKey: candidate.sourceRef.materialEventKey,
          opportunityKey: candidate.sourceRef.opportunityKey,
        },
      };
      if (
        !identifier(input.eventKey) ||
        !sourceValid(input.sourceRef) ||
        !instant(input.observedAt) ||
        typeof input.body !== "string" ||
        !input.body.trim() ||
        Buffer.byteLength(input.body) > 16384
      )
        return result("blocked");
      const receiptKey = urgentBuzzReceiptKey(binding, input.eventKey);
      let row: OutboxReceipt | null = null;
      try {
        row = await d.store.getOutbox(receiptKey);
        if (row) {
          try {
            validateRecord(row, input);
          } catch {
            return result("blocked", row);
          }
          // Acceptance is a historical transport fact. Re-reading cannot retract a sent event.
          if (row.state === "delivered") return result("accepted", row);
          if (row.state === "suppressed") return result("suppressed", row);
        }
        const initial = await gate(input.sourceRef, row);
        if (initial) return result(initial, row);
        if (!row) {
          const payload: Payload = {
            type: URGENT_BUZZ_TYPE,
            organizationId: binding.organizationId,
            companyId: binding.companyId,
            issueId: binding.issueId,
            eventKey: input.eventKey,
            body: input.body,
            observedAt: input.observedAt,
            sourceRef: input.sourceRef,
          };
          const template: EventTemplate = {
            kind: 9,
            created_at: Math.floor(Date.parse(input.observedAt) / 1000),
            content: JSON.stringify(payload),
            tags: tags(receiptKey),
          };
          const expected = JSON.stringify(template);
          let event: Event;
          try {
            event = verifySignedEvent(await d.signer(template));
            if (
              event.pubkey !== binding.bridgePubkey ||
              JSON.stringify({
                kind: event.kind,
                created_at: event.created_at,
                content: event.content,
                tags: event.tags,
              }) !== expected
            )
              throw Error("Signer changed urgent event template.");
          } catch {
            return result("blocked");
          }
          await d.runtime.scopeReceipt(receiptKey, binding.issueId);
          await d.store.putOutbox({
            receiptKey,
            relay: binding.relay,
            eventId: event.id,
            event,
          });
          // On a concurrent insert, only the immutable winning event may be sent.
          row = await d.store.getOutbox(receiptKey);
          if (!row) return result("pending");
        }
        let event: Event;
        try {
          event = validateRecord(row, input);
        } catch {
          return result("blocked", row);
        }
        if (row.state === "delivered") return result("accepted", row);
        if (row.state === "suppressed") return result("suppressed", row);
        const preclaim = await gate(input.sourceRef, row);
        if (preclaim) return result(preclaim, row);
        if (row.state === "blocked") return result("blocked", row);
        if (row.state === "publishing") return result("pending", row);
        const token = randomUUID();
        if (!(await d.store.claimCommentDelivery(receiptKey, token))) {
          const current = await d.store.getOutbox(receiptKey);
          return result(
            current?.state === "delivered"
              ? "accepted"
              : current?.state === "suppressed"
                ? "suppressed"
                : current?.state === "blocked"
                  ? "blocked"
                  : "pending",
            current ?? row,
          );
        }
        // Revalidate after claiming too. Suppression wins before I/O; claims never expire.
        const final = await gate(input.sourceRef, row);
        const claimed = await d.store.getOutbox(receiptKey);
        if (
          final ||
          !claimed ||
          claimed.publishToken !== token ||
          claimed.suppressionRequested
        ) {
          await d.store.finishCommentDelivery(receiptKey, token, "pending");
          return result(
            final ?? (claimed?.suppressionRequested ? "suppressed" : "pending"),
            row,
          );
        }
        try {
          const accepted = await d.buzz.publish(event);
          if (accepted.eventId !== row.eventId)
            throw new BuzzDeliveryUnknown(row.eventId);
        } catch (error) {
          const blocked =
            error instanceof BuzzConfigurationError ||
            error instanceof BuzzRequestRejected;
          const cause =
            error instanceof BuzzDeliveryUnknown ? error.cause : error;
          const retryAfterMs =
            cause instanceof BuzzRetryDeferred ? cause.retryAfterMs : 0;
          await d.store.finishCommentDelivery(
            receiptKey,
            token,
            blocked ? "blocked" : "pending",
            retryAfterMs,
          );
          const current = await d.store.getOutbox(receiptKey);
          return result(
            current?.state === "suppressed"
              ? "suppressed"
              : blocked
                ? "blocked"
                : "pending",
            row,
          );
        }
        // If saving acceptance fails, retain the uncertain publishing claim; never steal it.
        if (
          !(await d.store.finishCommentDelivery(receiptKey, token, "delivered"))
        )
          return result("pending", row);
        return result("accepted", row);
      } catch {
        // Outages are not revocation, and no exception grants permission to regenerate or publish.
        return result("pending", row);
      }
    },
  };
}
