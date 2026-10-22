import { finalizeEvent, verifyEvent } from "nostr-tools";
import { makeBuzzHttpClient } from "../src/buzz/http.js";
// Deliberately public deterministic fixture key. Never load this example in production.
const fixtureKey = new Uint8Array(32).fill(1);
const channelId = "bf290cba-a856-449b-b9d3-9e6fa5d0684b";
const incoming = finalizeEvent(
  {
    kind: 9,
    created_at: 1_700_000_000,
    tags: [["h", channelId]],
    content: "Please prepare the Roundtable notes for publication.",
  },
  fixtureKey,
);
const outgoing = finalizeEvent(
  {
    kind: 9,
    created_at: 1_700_000_001,
    tags: [
      ["h", channelId],
      ["e", incoming.id, "", "root"],
      ["e", incoming.id, "", "reply"],
    ],
    content:
      "Meeting notes received. Publication work can now be linked to the same thread.",
  },
  fixtureKey,
);
let attempts = 0;
const client = makeBuzzHttpClient({
  relayUrl: "https://fixture.invalid",
  signer: (template) => finalizeEvent(template, fixtureKey),
  clock: () => 1_700_000_002,
  sleep: async () => {},
  fetch: async (url, init) => {
    const authorization = new Headers(init?.headers).get("Authorization")!;
    if (
      !verifyEvent(
        JSON.parse(Buffer.from(authorization.slice(6), "base64").toString()),
      )
    )
      throw new Error("Invalid fixture request signature");
    if (String(url).endsWith("/query")) return Response.json([incoming]);
    attempts++;
    if (attempts === 1) return new Response("", { status: 503 });
    return Response.json({
      event_id: outgoing.id,
      accepted: true,
      message: "",
    });
  },
});
console.log(
  "Inertia Buzz transport dry run. No network, real signed fixture events.",
);
const [received] = await client.query([{ kinds: [9], "#h": [channelId] }]);
console.log(`Verified message: ${received?.event.content}`);
console.log(`Resolved channel: ${received?.channelId}`);
const receipt = await client.publish(outgoing);
console.log(
  `Relay outage recovered in ${attempts} attempts with one stable event ID: ${receipt.eventId}`,
);
console.log(
  "Transport ready for native Paperclip task binding. No task or website publication was created.",
);
