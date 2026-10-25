import { getEventHash, verifyEvent, type Event } from "nostr-tools";
const hex64 = /^[0-9a-f]{64}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export interface VerifiedBuzzEvent {
  readonly event: Event;
  readonly channelId: string;
  readonly rootId: string;
  readonly replyId?: string;
}
/** Never pass an untrusted object directly to nostr-tools: it caches verification on a symbol. */
export function verifySignedEvent(raw: unknown): Event {
  if (!raw || typeof raw !== "object") throw new Error("Invalid event");
  const value = raw as Record<string, unknown>;
  if (
    typeof value.id !== "string" ||
    !hex64.test(value.id) ||
    typeof value.pubkey !== "string" ||
    !hex64.test(value.pubkey) ||
    typeof value.sig !== "string" ||
    !/^[0-9a-f]{128}$/.test(value.sig) ||
    typeof value.content !== "string" ||
    !Number.isSafeInteger(value.kind) ||
    (value.kind as number) < 0 ||
    !Number.isSafeInteger(value.created_at) ||
    (value.created_at as number) < 0 ||
    !Array.isArray(value.tags) ||
    !value.tags.every(
      (tag) =>
        Array.isArray(tag) &&
        tag.length > 0 &&
        tag.every((part) => typeof part === "string"),
    )
  ) {
    throw new Error("Invalid event shape");
  }
  const event: Event = {
    id: value.id,
    pubkey: value.pubkey,
    sig: value.sig,
    content: value.content,
    kind: value.kind as number,
    created_at: value.created_at as number,
    tags: value.tags.map((tag) => [...tag]),
  };
  if (getEventHash(event) !== event.id || !verifyEvent(event))
    throw new Error("Invalid event ID or signature");
  for (const tag of event.tags) Object.freeze(tag);
  Object.freeze(event.tags);
  return Object.freeze(event);
}
/** Initial bridge surface is channel messages only; no moderation or approval authority is implied. */
export function verifyBuzzEvent(raw: unknown): VerifiedBuzzEvent {
  const event = verifySignedEvent(raw);
  if (event.kind !== 9) throw new Error("Unsupported Buzz event kind");
  const channels = event.tags.filter((tag) => tag[0] === "h");
  const channel = channels[0]?.[1];
  if (
    channels.length !== 1 ||
    channels[0]?.length !== 2 ||
    !channel ||
    !uuid.test(channel)
  )
    throw new Error("Ambiguous or invalid channel tag");
  const references = event.tags.filter((tag) => tag[0] === "e");
  for (const tag of references) {
    if (
      tag.length < 4 ||
      tag.length > 5 ||
      !tag[1] ||
      !hex64.test(tag[1]) ||
      !["root", "reply", "mention"].includes(tag[3] ?? "")
    )
      throw new Error("Ambiguous or invalid event reference");
  }
  const roots = references.filter((tag) => tag[3] === "root");
  const replies = references.filter((tag) => tag[3] === "reply");
  if (roots.length > 1 || replies.length > 1)
    throw new Error("Duplicate thread routing tag");
  const rootId = replies[0]?.[1] ? (roots[0]?.[1] ?? replies[0][1]!) : event.id;
  const replyId = replies[0]?.[1];
  return Object.freeze({
    event,
    channelId: channel,
    rootId,
    ...(replyId ? { replyId } : {}),
  });
}
