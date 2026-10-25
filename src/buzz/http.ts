import { createHash, randomUUID } from "node:crypto";
import type { Event, EventTemplate, Filter } from "nostr-tools";
import {
  verifyBuzzEvent,
  verifySignedEvent,
  type VerifiedBuzzEvent,
} from "./events.js";
export type EventSigner = (template: EventTemplate) => Event | Promise<Event>;
export interface BuzzClientConfig {
  relayUrl: string;
  signer: EventSigner;
  fetch: typeof globalThis.fetch;
  /** Unix seconds, matching Nostr created_at. */
  clock: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
  /** Total response bytes, default 1 MiB; includes chunked responses. */
  maxResponseBytes?: number;
  /** Serialized event bytes, default 64 KiB. */
  maxEventBytes?: number;
}
export interface BuzzClient {
  query(filters: readonly Filter[]): Promise<VerifiedBuzzEvent[]>;
  publish(
    event: Event,
    options?: {
      /** Durable caller knowledge that an earlier delivery may have succeeded. */
      priorUncertain?: boolean;
      /** Original persisted JSON bytes; must encode this exact signed event. */
      serializedEvent?: string;
    },
  ): Promise<{ eventId: string }>;
}
export class BuzzConfigurationError extends Error {
  override name = "BuzzConfigurationError";
}
export class BuzzResponseError extends Error {
  override name = "BuzzResponseError";
}
export class BuzzRequestRejected extends Error {
  override name = "BuzzRequestRejected";
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
export class BuzzRetryDeferred extends Error {
  override name = "BuzzRetryDeferred";
  constructor(readonly retryAfterMs: number) {
    super("Relay requested a retry beyond the inline retry budget");
  }
}
export class BuzzDeliveryUnknown extends Error {
  constructor(
    readonly eventId: string,
    options?: ErrorOptions,
  ) {
    super(
      `Delivery not confirmed for ${eventId}; reconcile or retry this exact signed event`,
      options,
    );
    this.name = "BuzzDeliveryUnknown";
  }
}
async function boundedJson(
  response: Response,
  limit: number,
): Promise<unknown> {
  const length = response.headers.get("content-length");
  if (length !== null && /^\d+$/.test(length) && Number(length) > limit) {
    await response.body?.cancel();
    throw new BuzzResponseError("Response exceeds byte limit");
  }
  if (!response.body) throw new BuzzResponseError("Empty response body");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new BuzzResponseError("Response exceeds byte limit");
      }
      chunks.push(part.value);
    }
    return JSON.parse(Buffer.concat(chunks, size).toString("utf8")) as unknown;
  } catch (cause) {
    if (cause instanceof BuzzResponseError) throw cause;
    throw new BuzzResponseError("Invalid or interrupted JSON response", {
      cause,
    });
  } finally {
    reader.releaseLock();
  }
}
export function makeBuzzHttpClient(config: BuzzClientConfig): BuzzClient {
  let relay: URL;
  try {
    relay = new URL(config.relayUrl);
  } catch (cause) {
    throw new BuzzConfigurationError("Invalid relay URL", { cause });
  }
  if (
    relay.protocol !== "https:" ||
    relay.username ||
    relay.password ||
    relay.search ||
    relay.hash ||
    relay.pathname !== "/"
  )
    throw new BuzzConfigurationError("Relay must be a bare HTTPS origin");
  const responseLimit = config.maxResponseBytes ?? 1024 * 1024;
  const eventLimit = config.maxEventBytes ?? 64 * 1024;
  for (const limit of [responseLimit, eventLimit]) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 16 * 1024 * 1024)
      throw new BuzzConfigurationError(
        "Byte limits must be between 1 byte and 16 MiB",
      );
  }
  function boundEvent(raw: unknown): VerifiedBuzzEvent {
    if (Buffer.byteLength(JSON.stringify(raw) ?? "") > eventLimit)
      throw new BuzzConfigurationError("Event exceeds byte limit");
    const verified = verifyBuzzEvent(raw);
    const servers = verified.event.tags.filter((tag) => tag[0] === "server");
    if (
      servers.length > 1 ||
      servers.some((tag) => tag.length !== 2 || tag[1] !== relay.host)
    )
      throw new BuzzConfigurationError("Foreign or ambiguous relay server tag");
    for (const tag of verified.event.tags.filter(
      (tag) => tag[0] === "e" && tag[2],
    )) {
      const hint = new URL(tag[2]!);
      if (
        !["https:", "wss:"].includes(hint.protocol) ||
        hint.host !== relay.host ||
        hint.username ||
        hint.password ||
        hint.search ||
        hint.hash ||
        hint.pathname !== "/"
      )
        throw new BuzzConfigurationError("Foreign relay reference");
    }
    return verified;
  }
  const sleep =
    config.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  async function backoff(attempt: number, response?: Response): Promise<void> {
    const raw = response?.headers.get("retry-after");
    const seconds = raw && /^\d+$/.test(raw.trim()) ? Number(raw) : undefined;
    const retryMs =
      seconds !== undefined
        ? seconds * 1000
        : raw
          ? Math.max(0, Date.parse(raw) - config.clock() * 1000)
          : 0;
    if (retryMs > 30_000) throw new BuzzRetryDeferred(retryMs);
    const random = (config.random ?? Math.random)();
    const jitter = Number.isFinite(random)
      ? Math.max(0, Math.min(1, random))
      : 0;
    await sleep(
      Math.max(
        Number.isFinite(retryMs) ? retryMs : 0,
        100 * 2 ** attempt * (1 + jitter),
      ),
    );
  }
  async function request(
    path: "/query" | "/events",
    body: string,
    priorUncertain = false,
    publication?: Event,
  ): Promise<{ value: unknown; priorUncertain: boolean }> {
    const url = relay.origin + path;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (publication && Math.abs(config.clock() - publication.created_at) > 900)
        return reconcile(publication);
      const template: EventTemplate = {
        kind: 27235,
        created_at: config.clock(),
        content: "",
        tags: [
          ["u", url],
          ["method", "POST"],
          ["nonce", randomUUID()],
          ["payload", createHash("sha256").update(body).digest("hex")],
        ],
      };
      const expected = JSON.stringify(template);
      let auth: Event;
      try {
        auth = verifySignedEvent(await config.signer(template));
        if (
          JSON.stringify({
            kind: auth.kind,
            created_at: auth.created_at,
            content: auth.content,
            tags: auth.tags,
          }) !== expected
        )
          throw new Error("Signer changed HTTP authorization payload");
      } catch (cause) {
        if (priorUncertain)
          throw new Error("Signer failed after an uncertain delivery", {
            cause,
          });
        throw new BuzzConfigurationError("Cannot sign HTTP authorization", {
          cause,
        });
      }
      // Signing may be asynchronous: never send a now-stale publication.
      if (publication && Math.abs(config.clock() - publication.created_at) > 900)
        return reconcile(publication);
      let response: Response;
      try {
        response = await config.fetch(url, {
          method: "POST",
          redirect: "error",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Nostr ${Buffer.from(JSON.stringify(auth)).toString("base64")}`,
          },
          body,
          signal: AbortSignal.timeout(15_000),
        });
      } catch (cause) {
        if (attempt === 2) throw new Error("Buzz request failed", { cause });
        priorUncertain = true;
        await backoff(attempt);
        continue;
      }
      if (
        response.redirected ||
        (response.url && response.url !== url) ||
        (response.status >= 300 && response.status < 400)
      ) {
        await response.body?.cancel();
        throw new BuzzResponseError(
          "Unexpected relay redirect or response URL",
        );
      }
      if ([429, 500, 502, 503, 504].includes(response.status) && attempt < 2) {
        await response.body?.cancel();
        priorUncertain = true;
        await backoff(attempt, response);
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        if (
          response.status >= 400 &&
          response.status < 500 &&
          response.status !== 429 &&
          !priorUncertain
        )
          throw new BuzzRequestRejected(
            `Buzz HTTP ${response.status}`,
            response.status,
          );
        throw new BuzzResponseError(
          `Buzz HTTP ${response.status} after uncertain delivery`,
        );
      }
      return {
        value: await boundedJson(response, responseLimit),
        priorUncertain,
      };
    }
    throw new Error("Buzz request exhausted");
  }
  async function reconcile(event: Event): Promise<{
    value: unknown;
    priorUncertain: boolean;
  }> {
    try {
      const { value } = await request(
        "/query",
        JSON.stringify([{ ids: [event.id] }]),
      );
      if (!Array.isArray(value))
        throw new BuzzResponseError("Expected Buzz event array");
      const events = value.map(boundEvent);
      // Verification alone is insufficient: require the original signature too.
      if (
        !events.some(
          (found) => JSON.stringify(found.event) === JSON.stringify(event),
        )
      )
        throw new BuzzResponseError("Exact signed publication not found");
      return {
        value: { event_id: event.id, accepted: true },
        priorUncertain: true,
      };
    } catch (cause) {
      // Absence, membership denial, and query failures cannot prove non-delivery.
      throw new BuzzDeliveryUnknown(event.id, { cause });
    }
  }
  return {
    async query(filters) {
      const { value } = await request("/query", JSON.stringify(filters));
      if (!Array.isArray(value))
        throw new BuzzResponseError("Expected Buzz event array");
      return value.map(boundEvent);
    },
    async publish(raw, options = {}) {
      const { event } = boundEvent(raw);
      let body = JSON.stringify(event);
      if (options.serializedEvent !== undefined) {
        try {
          if (Buffer.byteLength(options.serializedEvent) > eventLimit)
            throw new Error("Persisted event exceeds byte limit");
          const persisted = boundEvent(JSON.parse(options.serializedEvent)).event;
          if (JSON.stringify(persisted) !== body)
            throw new Error("Persisted bytes do not match the signed event");
          body = options.serializedEvent;
        } catch (cause) {
          throw new BuzzConfigurationError("Invalid persisted publication bytes", {
            cause,
          });
        }
      }
      let result: { value: unknown; priorUncertain: boolean };
      try {
        result = await request("/events", body, options.priorUncertain, event);
      } catch (cause) {
        if (
          cause instanceof BuzzConfigurationError ||
          cause instanceof BuzzRequestRejected ||
          cause instanceof BuzzDeliveryUnknown
        )
          throw cause;
        throw new BuzzDeliveryUnknown(event.id, { cause });
      }
      const value = result.value;
      if (
        !value ||
        typeof value !== "object" ||
        !("event_id" in value) ||
        value.event_id !== event.id ||
        !("accepted" in value) ||
        typeof value.accepted !== "boolean"
      )
        throw new BuzzDeliveryUnknown(event.id, {
          cause: new BuzzResponseError(
            "Malformed or mismatched publication receipt",
          ),
        });
      if (!value.accepted) {
        if (result.priorUncertain) throw new BuzzDeliveryUnknown(event.id);
        throw new BuzzRequestRejected("Buzz rejected the expected event");
      }
      return { eventId: event.id };
    },
  };
}
