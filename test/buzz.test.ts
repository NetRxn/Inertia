import { describe, expect, it } from "vitest";
import { finalizeEvent, verifyEvent, type EventTemplate } from "nostr-tools";
import { createHash } from "node:crypto";
import { verifyBuzzEvent } from "../src/buzz/events.js";
import { makeBuzzHttpClient } from "../src/buzz/http.js";
const key = new Uint8Array(32).fill(1); // Public fixture key, never a deployment identity.
const channel = "bf290cba-a856-449b-b9d3-9e6fa5d0684b";
const root = "ab".repeat(32);
const sign = (event: EventTemplate) => finalizeEvent(event, key);
const message = (tags: string[][] = [["h", channel]]) =>
  sign({
    kind: 9,
    created_at: 1_700_000_000,
    content: "Prepare the meeting notes",
    tags,
  });
const config = (fetch: typeof globalThis.fetch) => ({
  relayUrl: "https://relay.example",
  signer: sign,
  fetch,
  clock: () => 1_700_000_000,
});
describe("signed Buzz input", () => {
  it("derives routing only from a genuinely signed event", () => {
    const event = message([
      ["h", channel],
      ["e", root, "", "root"],
    ]);
    expect(verifyBuzzEvent(event)).toMatchObject({
      event: { id: event.id },
      channelId: channel,
      rootId: event.id,
    });
  });
  it("rejects tampered content even if nostr-tools previously cached signature validity", () => {
    const event = message();
    event.content = "tampered";
    expect(() => verifyBuzzEvent(event)).toThrow();
  });
  it("rejects wrong IDs, signatures, and fake verified flags", () => {
    for (const change of [
      { id: "aa".repeat(32) },
      { sig: "bb".repeat(64) },
      { pubkey: "cc".repeat(32) },
    ])
      expect(() =>
        verifyBuzzEvent({ ...message(), ...change, verified: true }),
      ).toThrow();
  });
  it.each([
    [],
    [
      ["h", channel],
      ["h", channel],
    ],
    [["h", "not-a-uuid"]],
    [
      ["h", channel],
      ["e", root, "", "root"],
      ["e", root, "", "root"],
    ],
    [
      ["h", channel],
      ["e", "invalid", "", "root"],
    ],
    [
      ["h", channel],
      ["e", root],
    ],
  ])("rejects missing, ambiguous or malformed routing: %j", (...tags) => {
    expect(() => verifyBuzzEvent(message(tags as string[][]))).toThrow();
  });
  it("rejects auxiliary event kinds", () => {
    expect(() =>
      verifyBuzzEvent(
        sign({
          kind: 9040,
          created_at: 1,
          content: "",
          tags: [["h", channel]],
        }),
      ),
    ).toThrow();
  });
  it("uses reply as root for a reply to a top-level message", () => {
    expect(
      verifyBuzzEvent(
        message([
          ["h", channel],
          ["e", root, "", "reply"],
        ]),
      ).rootId,
    ).toBe(root);
  });
});
describe("Buzz HTTP wire contract", () => {
  it("queries using exact body-bound NIP98 POST and verifies returned events", async () => {
    const event = message();
    let requestBody = "";
    let auth: ReturnType<typeof sign> | undefined;
    const client = makeBuzzHttpClient(
      config(async (url, init) => {
        expect(url).toBe("https://relay.example/query");
        expect(init?.method).toBe("POST");
        expect(init?.redirect).toBe("error");
        requestBody = init?.body as string;
        auth = JSON.parse(
          Buffer.from(
            new Headers(init?.headers).get("Authorization")!.slice(6),
            "base64",
          ).toString(),
        );
        return Response.json([event]);
      }),
    );
    const received = await client.query([{ kinds: [9], "#h": [channel] }]);
    expect(requestBody).toBe(JSON.stringify([{ kinds: [9], "#h": [channel] }]));
    expect(auth && verifyEvent(auth)).toBe(true);
    expect(auth).toMatchObject({ kind: 27235, created_at: 1_700_000_000 });
    expect(auth?.tags).toEqual(
      expect.arrayContaining([
        ["u", "https://relay.example/query"],
        ["method", "POST"],
        ["payload", createHash("sha256").update(requestBody).digest("hex")],
      ]),
    );
    expect(received[0]?.event.id).toBe(event.id);
  });
  it("preserves outbound event across retry while renewing HTTP authentication", async () => {
    const bodies: string[] = [];
    const auths: string[] = [];
    const event = message();
    const client = makeBuzzHttpClient({
      ...config(async (_, init) => {
        bodies.push(init?.body as string);
        auths.push(new Headers(init?.headers).get("Authorization")!);
        return bodies.length === 1
          ? new Response("", { status: 503 })
          : Response.json({ event_id: event.id, accepted: true, message: "" });
      }),
      sleep: async () => {},
    });
    expect(await client.publish(event)).toEqual({ eventId: event.id });
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toBe(bodies[1]);
    expect(auths[0]).not.toBe(auths[1]);
  });
  it("rejects relay refusal and mismatched receipt instead of calling them success", async () => {
    for (const reply of [
      { event_id: message().id, accepted: false, message: "denied" },
      { event_id: "00".repeat(32), accepted: true, message: "" },
    ])
      await expect(
        makeBuzzHttpClient(config(async () => Response.json(reply))).publish(
          message(),
        ),
      ).rejects.toThrow();
  });
  it("rejects unsafe relay URLs", () => {
    for (const relayUrl of [
      "http://remote.example",
      "https://user:pass@relay.example",
      "https://relay.example/path",
      "https://relay.example?x=1",
    ])
      expect(() =>
        makeBuzzHttpClient({ ...config(globalThis.fetch), relayUrl }),
      ).toThrow();
  });
  it("rejects redirects and foreign response origins", async () => {
    for (const response of [
      new Response("", {
        status: 302,
        headers: { location: "https://evil.example" },
      }),
      Object.defineProperty(Response.json([]), "url", {
        value: "https://evil.example/query",
      }),
    ])
      await expect(
        makeBuzzHttpClient(config(async () => response)).query([]),
      ).rejects.toThrow();
  });
  it("rejects malformed response and tampered relay events", async () => {
    for (const response of [
      { events: [] },
      [{ ...message(), content: "tampered" }],
    ])
      await expect(
        makeBuzzHttpClient(config(async () => Response.json(response))).query(
          [],
        ),
      ).rejects.toThrow();
  });
});
describe("transport trust boundaries", () => {
  it("rejects signed foreign relay references and server tags", async () => {
    for (const tags of [
      [
        ["h", channel],
        ["e", root, "wss://other.example", "root"],
      ],
      [
        ["h", channel],
        ["server", "other.example"],
      ],
      [
        ["h", channel],
        ["server", "relay.example"],
        ["server", "relay.example"],
      ],
    ]) {
      const event = message(tags);
      await expect(
        makeBuzzHttpClient(config(async () => Response.json([event]))).query(
          [],
        ),
      ).rejects.toThrow();
    }
  });
  it("accepts same-relay wss reference hints", async () => {
    const event = message([
      ["h", channel],
      ["e", root, "wss://relay.example", "root"],
      ["server", "relay.example"],
    ]);
    expect(
      (
        await makeBuzzHttpClient(
          config(async () => Response.json([event])),
        ).query([])
      )[0]?.rootId,
    ).toBe(event.id);
  });
  it("cannot publish moderation commands", async () => {
    const event = sign({
      kind: 9040,
      created_at: 1,
      content: "",
      tags: [["h", channel]],
    });
    let calls = 0;
    await expect(
      makeBuzzHttpClient(
        config(async () => {
          calls++;
          return Response.json({});
        }),
      ).publish(event),
    ).rejects.toThrow();
    expect(calls).toBe(0);
  });
  it("keeps verified routing immutable and isolated from caller mutation", () => {
    const event = message();
    const verified = verifyBuzzEvent(event);
    event.tags[0]![1] = "changed";
    expect(verified.event.tags[0]?.[1]).toBe(channel);
    expect(() => {
      verified.event.content = "changed";
    }).toThrow();
  });
  it("reports exhausted delivery as unknown with the stable event ID", async () => {
    const event = message();
    let calls = 0;
    const client = makeBuzzHttpClient({
      ...config(async () => {
        calls++;
        throw new TypeError("connection interrupted");
      }),
      sleep: async () => {},
    });
    await expect(client.publish(event)).rejects.toMatchObject({
      name: "BuzzDeliveryUnknown",
      eventId: event.id,
    });
    expect(calls).toBe(3);
  });
});
describe("bounded responses and delivery outcomes", () => {
  it("rejects an oversized response stream and cancels it before draining", async () => {
    let cancelled = false;
    let pulls = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls++;
        controller.enqueue(new Uint8Array(600_000));
        if (pulls === 5) controller.close();
      },
      cancel() {
        cancelled = true;
      },
    });
    await expect(
      makeBuzzHttpClient(config(async () => new Response(stream))).query([]),
    ).rejects.toMatchObject({ name: "BuzzResponseError" });
    expect(cancelled).toBe(true);
    expect(pulls).toBeLessThanOrEqual(3);
  });
  it("does not download a response whose declared length exceeds the limit", async () => {
    let cancelled = false;
    const response = new Response(
      new ReadableStream({
        cancel() {
          cancelled = true;
        },
      }),
      { headers: { "content-length": "2000000" } },
    );
    await expect(
      makeBuzzHttpClient(config(async () => response)).query([]),
    ).rejects.toMatchObject({ name: "BuzzResponseError" });
    expect(cancelled).toBe(true);
  });
  it("reports definitive 403 refusal without retry or unknown delivery", async () => {
    let calls = 0;
    await expect(
      makeBuzzHttpClient(
        config(async () => {
          calls++;
          return new Response("", { status: 403 });
        }),
      ).publish(message()),
    ).rejects.toMatchObject({ name: "BuzzRequestRejected", status: 403 });
    expect(calls).toBe(1);
  });
  it("reports signer configuration failures before network delivery", async () => {
    let calls = 0;
    const client = makeBuzzHttpClient({
      ...config(async () => {
        calls++;
        return Response.json({});
      }),
      signer: () => {
        throw new Error("signer unavailable");
      },
    });
    await expect(client.publish(message())).rejects.toMatchObject({
      name: "BuzzConfigurationError",
    });
    expect(calls).toBe(0);
  });
  it("reports malformed or mismatched successful publication receipts as unknown", async () => {
    const event = message();
    for (const response of [
      Response.json({ event_id: "00".repeat(32), accepted: true }),
      new Response("broken JSON"),
      Response.json({}),
    ])
      await expect(
        makeBuzzHttpClient(config(async () => response)).publish(event),
      ).rejects.toMatchObject({
        name: "BuzzDeliveryUnknown",
        eventId: event.id,
      });
  });
  it("reports an explicit matching rejected receipt as definitive", async () => {
    const event = message();
    await expect(
      makeBuzzHttpClient(
        config(async () =>
          Response.json({
            event_id: event.id,
            accepted: false,
            message: "denied",
          }),
        ),
      ).publish(event),
    ).rejects.toMatchObject({ name: "BuzzRequestRejected" });
  });
  it("does not erase uncertainty from an earlier failed delivery when retry gets 403", async () => {
    let calls = 0;
    const event = message();
    await expect(
      makeBuzzHttpClient({
        ...config(async () => {
          calls++;
          if (calls === 1) throw new Error("body lost");
          return new Response("", { status: 403 });
        }),
        sleep: async () => {},
      }).publish(event),
    ).rejects.toMatchObject({ name: "BuzzDeliveryUnknown", eventId: event.id });
  });
});
describe("pinned Buzz thread and retry rules", () => {
  it("resolves all four root/reply combinations like buzz_core::nip10", () => {
    const reply = "cd".repeat(32);
    for (const [tags, expected] of [
      [[], undefined],
      [[["e", root, "", "root"]], undefined],
      [[["e", reply, "", "reply"]], reply],
      [
        [
          ["e", root, "", "root"],
          ["e", reply, "", "reply"],
        ],
        root,
      ],
    ] as [string[][], string | undefined][]) {
      const event = message([["h", channel], ...tags]);
      expect(verifyBuzzEvent(event).rootId).toBe(expected ?? event.id);
    }
  });
  it("honors Retry-After seconds before retry", async () => {
    let calls = 0;
    const delays: number[] = [];
    await makeBuzzHttpClient({
      ...config(async () =>
        ++calls === 1
          ? new Response("", { status: 429, headers: { "Retry-After": "2" } })
          : Response.json([]),
      ),
      sleep: async (ms) => {
        delays.push(ms);
      },
    }).query([]);
    expect(delays[0]).toBeGreaterThanOrEqual(2000);
    expect(delays[0]).toBeLessThanOrEqual(30_000);
  });
  it("refuses oversized outbound events before contacting the relay", async () => {
    let calls = 0;
    const event = sign({
      kind: 9,
      created_at: 1,
      content: "x".repeat(100_000),
      tags: [["h", channel]],
    });
    await expect(
      makeBuzzHttpClient(
        config(async () => {
          calls++;
          return Response.json({});
        }),
      ).publish(event),
    ).rejects.toMatchObject({ name: "BuzzConfigurationError" });
    expect(calls).toBe(0);
  });
});
it("uses configurable bounded response bytes", async () => {
  await expect(
    makeBuzzHttpClient({
      ...config(async () => Response.json([message()])),
      maxResponseBytes: 10,
    }).query([]),
  ).rejects.toMatchObject({ name: "BuzzResponseError" });
});
it("honors HTTP-date Retry-After and uses bounded jitter", async () => {
  const delays: number[] = [];
  let calls = 0;
  const client = makeBuzzHttpClient({
    ...config(async () =>
      ++calls === 1
        ? new Response("", {
            status: 503,
            headers: {
              "Retry-After": new Date(1_700_000_002_000).toUTCString(),
            },
          })
        : Response.json([]),
    ),
    random: () => 0.5,
    sleep: async (ms) => {
      delays.push(ms);
    },
  });
  await client.query([]);
  expect(delays).toEqual([2000]);
  calls = 0;
  delays.length = 0;
  await makeBuzzHttpClient({
    ...config(async () =>
      ++calls === 1 ? new Response("", { status: 503 }) : Response.json([]),
    ),
    random: () => 0.5,
    sleep: async (ms) => {
      delays.push(ms);
    },
  }).query([]);
  expect(delays).toEqual([150]);
});
it("defers long Retry-After rather than retrying earlier than requested", async () => {
  let calls = 0;
  const delays: number[] = [];
  await expect(
    makeBuzzHttpClient({
      ...config(async () => {
        calls++;
        return new Response("", {
          status: 429,
          headers: { "Retry-After": "120" },
        });
      }),
      sleep: async (ms) => {
        delays.push(ms);
      },
    }).query([]),
  ).rejects.toMatchObject({ name: "BuzzRetryDeferred", retryAfterMs: 120_000 });
  expect(calls).toBe(1);
  expect(delays).toEqual([]);
});
it("keeps delivery uncertain if the signer fails after a network interruption", async () => {
  let signs = 0;
  const event = message();
  await expect(
    makeBuzzHttpClient({
      ...config(async () => {
        throw new Error("lost body");
      }),
      signer: (template) => {
        if (++signs === 2) throw new Error("signer unavailable");
        return sign(template);
      },
      sleep: async () => {},
    }).publish(event),
  ).rejects.toMatchObject({ name: "BuzzDeliveryUnknown", eventId: event.id });
});

describe("durable publication uncertainty and aged reconciliation", () => {
  it.each([403, 409])("preserves caller uncertainty across a fresh HTTP %s rejection", async (status) => {
    const event = message();
    const client = makeBuzzHttpClient(config(async () => new Response("", { status })));
    await expect(client.publish(event, { priorUncertain: true })).rejects.toMatchObject({
      name: "BuzzDeliveryUnknown", eventId: event.id,
    });
  });
  it("preserves caller uncertainty for a matching refused receipt", async () => {
    const event = message();
    const client = makeBuzzHttpClient(config(async () => Response.json({ event_id: event.id, accepted: false })));
    await expect(client.publish(event, { priorUncertain: true })).rejects.toMatchObject({
      name: "BuzzDeliveryUnknown", eventId: event.id,
    });
  });
  it.each([-901, 901])("reconciles absolute clock skew %s by exact ID without publishing", async (skew) => {
    const event = message();
    const requests: { url: string; body: unknown }[] = [];
    const client = makeBuzzHttpClient({
      ...config(async (url, init) => {
        requests.push({ url: String(url), body: JSON.parse(init?.body as string) });
        return String(url).endsWith("/query") ? Response.json([event]) : Response.json({ event_id: event.id, accepted: true });
      }),
      clock: () => 1_700_000_000 + skew,
    });
    await expect(client.publish(event)).resolves.toEqual({ eventId: event.id });
    expect(requests).toEqual([{ url: "https://relay.example/query", body: [{ ids: [event.id] }] }]);
  });
  it.each(["absent", "forged", "other-event", "denied", "failed"])("leaves aged %s readback unknown and never sends a stale event", async (outcome) => {
    const event = message();
    const urls: string[] = [];
    const client = makeBuzzHttpClient({
      ...config(async (url) => {
        urls.push(String(url));
        if (String(url).endsWith("/events")) return new Response("", { status: 403 });
        if (outcome === "failed") throw new Error("connection interrupted");
        if (outcome === "denied") return new Response("", { status: 403 });
        return Response.json(outcome === "absent" ? [] : outcome === "forged"
          ? [{ ...event, content: "forged same ID" }]
          : [sign({ kind: 9, created_at: event.created_at, tags: event.tags, content: "different event" })]);
      }),
      clock: () => 1_700_000_901,
      sleep: async () => {},
    });
    await expect(client.publish(event, { priorUncertain: true })).rejects.toMatchObject({ name: "BuzzDeliveryUnknown", eventId: event.id });
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.every((url) => url === "https://relay.example/query")).toBe(true);
  });
  it("rechecks age after retry backoff rather than sending a stale retry", async () => {
    const event = message();
    let now = event.created_at;
    const urls: string[] = [];
    const client = makeBuzzHttpClient({
      ...config(async (url) => {
        urls.push(String(url));
        if (String(url).endsWith("/query")) return Response.json([event]);
        throw new Error("accepted but response lost");
      }),
      clock: () => now,
      sleep: async () => { now += 901; },
    });
    await expect(client.publish(event)).resolves.toEqual({ eventId: event.id });
    expect(urls).toEqual(["https://relay.example/events", "https://relay.example/query"]);
  });
  it.each([-900, 900])("still publishes at the inclusive freshness boundary %s", async (skew) => {
    const event = message();
    const urls: string[] = [];
    const client = makeBuzzHttpClient({
      ...config(async (url) => {
        urls.push(String(url));
        return Response.json({ event_id: event.id, accepted: true });
      }),
      clock: () => event.created_at + skew,
    });
    await expect(client.publish(event)).resolves.toEqual({ eventId: event.id });
    expect(urls).toEqual(["https://relay.example/events"]);
  });
});
it("does not treat another valid signature over the same ID as the exact signed event", async () => {
  const event = { ...message(), sig: "3cc7ac356e5c14282d456cf76dc95461adfe0f7d366298008df17118277ee1d605c307a6c2602842e143a7709cc8cfabb79689b46277da49d35edfdd68f469e9" };
  // Same fixture key and event hash, independently signed with fixed auxiliary randomness.
  const alternative = { ...event, sig: "3a242c5fd2c0c741f0d98ea19bc33fb6139860d0fde7ebe4e53b595f3cf9ee937f926cf4f3f79ee9756d5745ffb3938aa41eb3498c2b808b3cc8f2504c7452a4" };
  expect(verifyEvent(alternative)).toBe(true);
  expect(alternative.id).toBe(event.id);
  expect(alternative.sig).not.toBe(event.sig);
  const client = makeBuzzHttpClient({
    ...config(async () => Response.json([alternative])),
    clock: () => event.created_at + 901,
  });
  await expect(client.publish(event)).rejects.toMatchObject({ name: "BuzzDeliveryUnknown", eventId: event.id });
});
it("rechecks freshness after asynchronous authentication signing", async () => {
  const event = message();
  let now = event.created_at;
  const urls: string[] = [];
  const client = makeBuzzHttpClient({
    ...config(async (url) => {
      urls.push(String(url));
      return String(url).endsWith("/query") ? Response.json([event]) : Response.json({ event_id: event.id, accepted: true });
    }),
    clock: () => now,
    signer: async (template) => { now = event.created_at + 901; return sign(template); },
  });
  await expect(client.publish(event)).resolves.toEqual({ eventId: event.id });
  expect(urls).toEqual(["https://relay.example/query"]);
});
it("publishes the verified persisted bytes verbatim on every fresh retry", async () => {
  const event = message();
  const serializedEvent = JSON.stringify(event, null, 2);
  const bodies: string[] = [];
  const client = makeBuzzHttpClient({
    ...config(async (_, init) => {
      bodies.push(init?.body as string);
      return bodies.length === 1 ? new Response("", { status: 503 }) : Response.json({ event_id: event.id, accepted: true });
    }),
    sleep: async () => {},
  });
  await expect(client.publish(event, { serializedEvent })).resolves.toEqual({ eventId: event.id });
  expect(bodies).toEqual([serializedEvent, serializedEvent]);
});
it.each(["invalid JSON", "mismatched event", "oversized bytes"])("refuses %s persisted bytes before delivery", async (variant) => {
  const event = message();
  const serializedEvent = variant === "invalid JSON" ? "{" : variant === "oversized bytes" ? " ".repeat(100_000) + JSON.stringify(event) : JSON.stringify({ ...event, content: "changed" });
  let calls = 0;
  const client = makeBuzzHttpClient(config(async () => { calls++; return Response.json({ event_id: event.id, accepted: true }); }));
  await expect(client.publish(event, { serializedEvent })).rejects.toMatchObject({ name: "BuzzConfigurationError" });
  expect(calls).toBe(0);
});
it("preserves the direct deferred-retry cause from aged readback", async () => {
  const event = message();
  const urls: string[] = [];
  const delays: number[] = [];
  const client = makeBuzzHttpClient({
    ...config(async (url) => {
      urls.push(String(url));
      return new Response("", {
        status: 429,
        headers: { "Retry-After": "120" },
      });
    }),
    clock: () => event.created_at + 901,
    sleep: async (ms) => { delays.push(ms); },
  });
  await expect(client.publish(event, { priorUncertain: true })).rejects.toMatchObject({
    name: "BuzzDeliveryUnknown",
    eventId: event.id,
    cause: { name: "BuzzRetryDeferred", retryAfterMs: 120_000 },
  });
  expect(urls).toEqual(["https://relay.example/query"]);
  expect(delays).toEqual([]);
});
