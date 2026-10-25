import { COMMENT_TYPE, outboundEnabled, sameBinding, commentReceiptKey, projectComment } from "./outbound-comments.js";
import { createHash, randomUUID } from "node:crypto";
import { verifyBuzzEvent, verifySignedEvent } from "../buzz/events.js";
import {
  BuzzConfigurationError,
  BuzzRequestRejected,
  BuzzDeliveryUnknown,
  BuzzRetryDeferred,
  type BuzzClient,
  type EventSigner,
} from "../buzz/http.js";
import { resolveCommand } from "./policy.js";
import type { Binding, BridgeCommand, TrustedBridgeConfig } from "./types.js";
import {
  sourceMarker,
  interactionDigest,
  type PaperclipAdapter,
} from "../paperclip/adapter.js";
import type { RuntimeState } from "./runtime.js";
import type { BridgeStore, InboxReceipt, OutboxReceipt } from "../store/postgres.js";
export interface BridgeDependencies {
  store: BridgeStore;
  native: PaperclipAdapter;
  loadConfig: () => Promise<TrustedBridgeConfig>;
  buzz: BuzzClient;
  signer: EventSigner;
  clock: () => number;
  runtime: RuntimeState;
}
export interface IngressOutcome {
  status: "applied" | "replayed" | "rejected" | "uncertain";
  sourceEventId?: string;
  nativeId?: string;
  receiptKey?: string;
  code?: string;
}
export interface HealthSummary {
  inFlightPublications?: number;
  state: "idle" | "progressing" | "retrying" | "uncertain" | "blocked";
  blocked?: number;
  oldestPendingAgeSeconds?: number;
  pending: number;
  uncertain: number;
  message: string;
}
interface GuidanceCommand {
  kind: "guidance";
  binding: Binding;
  actorUserId: string;
  authorPubkey: string;
  sourceEventId: string;
  message: string;
}
interface Outcome {
  nativeId: string;
  message: string;
}
export function createBridge(d: BridgeDependencies) {
  async function makeReceipt(row: InboxReceipt, observed?: Outcome) {
    if (!observed && row.state !== "applied" && row.state !== "rejected")
      return;
    const outcome = observed ?? (row.outcome as Outcome);
    const template = {
      kind: 9,
      created_at: Math.floor(new Date(row.createdAt).getTime() / 1000),
      content: JSON.stringify({
        sourceEventId: row.eventId,
        issueId: row.destination.issueId,
        nativeId: outcome.nativeId,
        status: observed ? "observed" : row.state,
        message: outcome.message,
      }),
      tags: [
        ["h", row.destination.channelId],
        ["e", row.destination.rootId, "", "root"],
        ["e", row.eventId, "", "reply"],
        ["inertia", row.receiptKey],
      ],
    };
    const event = verifySignedEvent(await d.signer(template));
    const cfg = await d.loadConfig();
    if (
      event.pubkey !== cfg.bridgePubkey ||
      event.kind !== template.kind ||
      event.content !== template.content ||
      event.created_at !== template.created_at ||
      JSON.stringify(event.tags) !== JSON.stringify(template.tags)
    )
      throw Error("Receipt signing configuration is invalid.");
    await d.runtime.scopeReceipt(
      observed ? "observed:" + row.receiptKey : row.receiptKey,
      row.destination.issueId,
    );
    await d.store.putOutbox({
      receiptKey: observed ? "observed:" + row.receiptKey : row.receiptKey,
      relay: row.relay,
      eventId: event.id,
      event,
    });
  }
  async function mirrorComments(cfg: TrustedBridgeConfig) {
    let scanFailed = false;
    for (const binding of cfg.bindings) {
      if (!outboundEnabled(binding)) continue;
      try {
      const ingress = await d.store.listCommentIngress(binding);
      const comments = await d.native.listComments(binding);
      const eligible = comments.map(row => ({ row, projection: projectComment(binding, row) }))
        .filter(x => x.projection !== null)
        .sort((a,b) => a.projection!.createdAt.localeCompare(b.projection!.createdAt) || a.row.id.localeCompare(b.row.id));
      let queued = 0;
      for (const { row, projection } of eligible) {
        if (ingress.some(receipt => {
          const c = receipt.command as import("./types.js").CommentCommand;
          const outcome = receipt.outcome as { nativeId?: string } | null;
          return (receipt.state === "applied" && outcome?.nativeId === row.id) ||
            (row.authorUserId === c.actorUserId && row.body === c.body + "\n\n" + sourceMarker(c.binding, c.sourceEventId));
        })) continue;
        const receiptKey = commentReceiptKey(binding, row.id);
        if (await d.store.getOutbox(receiptKey)) continue;
        const fresh = await d.loadConfig();
        if (!fresh.bindings.some(b => sameBinding(b,binding) && outboundEnabled(b) && projectComment(b,row))) continue;
        const template = {
          kind: 9, created_at: Math.floor(Date.parse(projection!.createdAt)/1000),
          tags: [["h", binding.channelId], ["e", binding.rootId, "", "root"], ["e", binding.rootId, "", "reply"], ["inertia", receiptKey]],
          content: JSON.stringify(projection),
        };
        const event = verifySignedEvent(await d.signer(template));
        if (event.pubkey !== fresh.bridgePubkey || event.kind !== template.kind || event.created_at !== template.created_at || event.content !== template.content || JSON.stringify(event.tags) !== JSON.stringify(template.tags))
          throw Error("Comment signing configuration is invalid.");
        await d.runtime.scopeReceipt(receiptKey, binding.issueId);
        await d.store.putOutbox({ receiptKey, relay: binding.relay, eventId: event.id, event });
        if (++queued >= 100) break;
      }
      } catch { scanFailed = true; }
    }
    return scanFailed;
  }
  async function validateQueuedComment(row: OutboxReceipt): Promise<boolean> {
    const signed = verifyBuzzEvent(row.event);
    const payload = JSON.parse(signed.event.content) as { type?: string; companyId?: string; issueId?: string; commentId?: string };
    const cfg = await d.loadConfig();
    if (!(cfg.companyId === payload.companyId || (!cfg.companyId && cfg.bindings.some(b => b.companyId === payload.companyId)))) return false;
    const binding = cfg.bindings.find(b => b.companyId === payload.companyId && b.issueId === payload.issueId && b.relay === row.relay && b.channelId === signed.channelId && b.rootId === signed.rootId);
    const suppress = async () => { await d.store.suppressOutbox(row.receiptKey); return false; };
    if (!binding || !outboundEnabled(binding) || signed.event.pubkey !== cfg.bridgePubkey || payload.type !== COMMENT_TYPE || !payload.commentId || commentReceiptKey(binding,payload.commentId) !== row.receiptKey) return suppress();
    const current = (await d.native.listComments(binding)).find(c => c.id === payload.commentId);
    const projection = current && projectComment(binding,current);
    if (!projection || JSON.stringify(projection) !== signed.event.content) return suppress();
    const latest = await d.loadConfig();
    if (!latest.bindings.some(b => sameBinding(b,binding) && outboundEnabled(b) && projectComment(b,current!)) || latest.bridgePubkey !== signed.event.pubkey) return suppress();
    return true;
  }
  async function invalidateCommentSnapshots(cfg: TrustedBridgeConfig): Promise<boolean> {
    let failed = false;
    for (const companyId of new Set(cfg.companyId ? [cfg.companyId] : cfg.bindings.map(b => b.companyId))) {
      for (const row of await d.store.listCommentValidation(companyId)) {
        try { await validateQueuedComment(row); }
        catch { failed = true; } // A read outage does not hide later invalidations.
      }
    }
    return failed;
  }
  async function deliver() {
    const cfg = await d.loadConfig();
    let pending = 0;
    const cursor = await d.runtime.get<{
      createdAt: string;
      receiptKey: string;
    }>("delivery-cursor");
    const batch = await d.store.listOutbox(100, cursor ?? undefined);
    for (const row of batch) {
      // Urgent alerts require their own authoritative source/destination validation.
      if (row.receiptKey.startsWith("alert:")) continue;
      if (row.relay !== cfg.relay) continue;
      const signed = verifyBuzzEvent(row.event);
      const payload = JSON.parse(signed.event.content) as { type?: string; companyId?: string; issueId?: string; commentId?: string };
      const isComment = row.receiptKey.startsWith("comment:");
      if (isComment) {
        try { if (!await validateQueuedComment(row)) continue; }
        catch { pending++; continue; }
      }
      if (
        signed.event.pubkey !== cfg.bridgePubkey ||
        !cfg.bindings.some(
          (b) =>
            b.channelId === signed.channelId &&
            b.rootId === signed.rootId &&
            b.issueId === payload.issueId,
        )
      )
        continue;
      // Linearization point: suppression and publication cannot both win pending.
      // No expiry: a timed-out host RPC does not cancel its worker handler.
      const token = isComment ? randomUUID() : null;
      if (token && !await d.store.claimCommentDelivery(row.receiptKey,token)) continue;
      try {
        const result = await d.buzz.publish(verifySignedEvent(row.event));
        if (result.eventId !== row.eventId)
          throw Error("Unexpected delivery ID.");
        if (token) await d.store.finishCommentDelivery(row.receiptKey,token,"delivered");
        else await d.store.markDelivered(row.receiptKey);
      } catch (error) {
        const blocked = error instanceof BuzzConfigurationError || error instanceof BuzzRequestRejected;
        const cause = error instanceof BuzzDeliveryUnknown ? error.cause : error;
        const retryAfterMs = cause instanceof BuzzRetryDeferred ? cause.retryAfterMs : 0;
        if (token) {
          await d.store.finishCommentDelivery(row.receiptKey,token,blocked ? "blocked" : "pending",retryAfterMs);
        } else {
          if (blocked) await d.store.markBlocked(row.receiptKey);
          if (retryAfterMs) await d.store.markDeferred(row.receiptKey,retryAfterMs);
        }
        if (blocked) await d.runtime.set("delivery-blocked",true);
        pending++;
      }
    }
    const last = batch.at(-1);
    await d.runtime.set(
      "delivery-cursor",
      batch.length === 100 && last
        ? { createdAt: String(last.createdAt), receiptKey: last.receiptKey }
        : null,
    );
    return pending;
  }
  async function reconcile(): Promise<HealthSummary> {
    const cfg = await d.loadConfig();
    let uncertain = 0;
    for (let row of await d.store.listRecoverable()) {
      if (
        !cfg.bindings.some(
          (b) =>
            b.relay === row.relay &&
            b.companyId === row.destination.companyId &&
            b.issueId === row.destination.issueId &&
            b.channelId === row.destination.channelId &&
            b.rootId === row.destination.rootId,
        )
      )
        continue;
      if (row.state === "applying" || row.state === "uncertain") {
        const c = row.command as BridgeCommand | GuidanceCommand;
        if (
          !cfg.pairings.some(
            (p) =>
              p.active &&
              p.kind === "human" &&
              p.companyId === c.binding.companyId &&
              p.pubkey === c.authorPubkey &&
              p.actorUserId === c.actorUserId,
          )
        ) {
          uncertain++;
          continue;
        }
        try {
          if (c.kind === "guidance") {
            await d.store.saveOutcome(row, "rejected", {
              nativeId: c.binding.issueId,
              message: c.message,
            });
          } else if (c.kind === "comment") {
            const match = (await d.native.listComments(c.binding)).find(
              (x) =>
                x.authorUserId === c.actorUserId &&
                x.body ===
                  c.body + "\n\n" + sourceMarker(c.binding, c.sourceEventId),
            );
            if (match)
              await d.store.saveOutcome(row, "applied", {
                nativeId: match.id,
                message: "Comment added.",
              });
            else {
              uncertain++;
              continue;
            }
          } else {
            const current = await d.native.getInteraction(
              c.binding,
              c.card.interactionId,
            );
            if (
              current.status === "pending" ||
              current.addresseeUserId ||
              current.addresseeAgentId
            ) {
              uncertain++;
              continue;
            }
            await makeReceipt(row, {
              nativeId: current.id,
              message:
                "Native decision is " +
                current.status +
                ". Your request outcome remains unknown; no action is attributed and no mutation will be retried.",
            });
            uncertain++;
            continue;
          }
        } catch {
          uncertain++;
          continue;
        }
        row = (await d.store.get(row))!;
      }
      await makeReceipt(row);
    }
    const invalidationFailed = await invalidateCommentSnapshots(await d.loadConfig());
    const commentScanFailed = await mirrorComments(await d.loadConfig()) || invalidationFailed;
    let pending = await deliver();
    const summary = await d.runtime.deliveryHealth(
      cfg.bindings.map((b) => b.issueId),
    );
    if (summary) pending = summary.pending;
    uncertain = await d.runtime.uncertainCount(
      cfg.bindings.map((b) => b.issueId),
    );
    const blocked = summary?.blocked ?? 0;
    const inFlightPublications = summary?.publishing ?? 0;
    return {
      inFlightPublications,
      blocked,
      oldestPendingAgeSeconds: summary?.oldest
        ? Math.max(
            0,
            d.clock() - Math.floor(new Date(summary.oldest).getTime() / 1000),
          )
        : 0,
      state: inFlightPublications
        ? "uncertain"
        : blocked
        ? "blocked"
        : uncertain
          ? "uncertain"
          : pending || commentScanFailed
            ? "retrying"
            : "idle",
      pending,
      uncertain,
      message: inFlightPublications
        ? "Publication is in flight or interrupted. Do not retry its claim until the prior worker is verified stopped; use targeted same-event recovery."
        : blocked
        ? "Receipt delivery blocked; check the connection and explicitly resume blocked receipts."
        : uncertain
          ? "Native outcome needs review; no mutation will be retried."
          : commentScanFailed
            ? "Native comment synchronization will retry automatically."
          : pending
            ? "Receipt delivery will retry automatically."
            : "Connected and up to date.",
    };
  }
  async function ingest(raw: unknown): Promise<IngressOutcome> {
    let input;
    try {
      input = verifyBuzzEvent(raw);
    } catch {
      return { status: "rejected", code: "invalid_event" };
    }
    const cfg = await d.loadConfig();
    const server = input.event.tags.filter((t) => t[0] === "server");
    if (
      server.some((t) => t.length !== 2 || t[1] !== new URL(cfg.relay).host) ||
      server.length > 1
    )
      return { status: "rejected", code: "foreign_relay" };
    for (const tag of input.event.tags.filter((t) => t[0] === "e" && t[2])) {
      try {
        const u = new URL(tag[2]!);
        if (
          !["https:", "wss:"].includes(u.protocol) ||
          u.host !== new URL(cfg.relay).host ||
          u.username ||
          u.password ||
          u.search ||
          u.hash ||
          u.pathname !== "/"
        )
          throw Error();
      } catch {
        return { status: "rejected", code: "foreign_relay" };
      }
    }
    const command = resolveCommand(input, cfg);
    if (command.kind === "rejection") {
      if (
        ["unsupported_command", "invalid_card", "invalid_content"].includes(
          command.code,
        )
      ) {
        const binding = cfg.bindings.find(
          (b) =>
            b.relay === cfg.relay &&
            b.channelId === input.channelId &&
            b.rootId === input.rootId,
        )!;
        const pairing = cfg.pairings.find(
          (p) =>
            p.relay === cfg.relay &&
            p.companyId === binding.companyId &&
            p.pubkey === input.event.pubkey &&
            p.active &&
            p.kind === "human",
        )!;
        const key = { relay: cfg.relay, eventId: input.event.id };
        const receiptKey = createHash("sha256")
          .update(JSON.stringify([key.relay, key.eventId]))
          .digest("hex");
        const guidance: GuidanceCommand = {
          kind: "guidance",
          binding,
          actorUserId: pairing.actorUserId,
          authorPubkey: input.event.pubkey,
          sourceEventId: input.event.id,
          message: command.message,
        };
        const claimed = await d.store.claim(key, {
          destination: binding,
          command: guidance,
          receiptKey,
        });
        if (claimed === "claimed")
          await d.store.saveOutcome(key, "rejected", {
            nativeId: binding.issueId,
            message: command.message,
          });
        const row = await d.store.get(key);
        if (row) await makeReceipt(row);
        await deliver();
        return {
          status: "rejected",
          sourceEventId: input.event.id,
          code: command.code,
          receiptKey,
        };
      }
      return {
        status: "rejected",
        sourceEventId: input.event.id,
        code: command.code,
      };
    }
    const key = { relay: cfg.relay, eventId: input.event.id };
    const receiptKey = createHash("sha256")
      .update(JSON.stringify([key.relay, key.eventId]))
      .digest("hex");
    const claim = await d.store.claim(key, {
      destination: command.binding,
      command,
      receiptKey,
    });
    if (claim !== "claimed") {
      return {
        status:
          claim.state === "applying" || claim.state === "uncertain"
            ? "uncertain"
            : "replayed",
        sourceEventId: key.eventId,
        receiptKey,
        ...(claim.outcome
          ? { nativeId: (claim.outcome as Outcome).nativeId }
          : {}),
      };
    }
    // Check revocation immediately before mutation, not merely when claimed.
    const fresh = resolveCommand(input, await d.loadConfig());
    if (
      fresh.kind === "rejection" ||
      JSON.stringify(fresh) !== JSON.stringify(command)
    ) {
      await d.store.saveOutcome(key, "rejected", {
        nativeId: command.binding.issueId,
        message: "Identity or binding changed; reconnect before retrying.",
      });
      await makeReceipt((await d.store.get(key))!);
      await deliver();
      return {
        status: "rejected",
        sourceEventId: key.eventId,
        receiptKey,
        code: "configuration_changed",
      };
    }
    let outcome: Outcome;
    try {
      if (command.kind === "comment") {
        const result = await d.native.comment(command);
        outcome = { nativeId: result.id, message: "Comment added." };
      } else {
        const result = await d.native.respond(command);
        outcome = {
          nativeId: result.interaction.id,
          message: result.applied
            ? "Decision recorded."
            : "Native decision already " +
              result.interaction.status +
              ". Open Paperclip for the authoritative result.",
        };
      }
    } catch {
      await d.store.markUncertain(key);
      return { status: "uncertain", sourceEventId: key.eventId, receiptKey };
    }
    await d.store.saveOutcome(key, "applied", outcome);
    await makeReceipt((await d.store.get(key))!);
    await deliver();
    return {
      status: "applied",
      sourceEventId: key.eventId,
      nativeId: outcome.nativeId,
      receiptKey,
    };
  }
  async function renderInteraction(binding: Binding, id: string) {
    const cfg = await d.loadConfig();
    if (
      !cfg.bindings.some(
        (b) =>
          b.companyId === binding.companyId &&
          b.issueId === binding.issueId &&
          b.channelId === binding.channelId &&
          b.rootId === binding.rootId &&
          b.relay === binding.relay,
      )
    )
      throw Error("Decision thread is not bound.");
    const row = await d.native.getInteraction(binding, id);
    if (
      row.addresseeUserId ||
      row.addresseeAgentId ||
      row.kind !== "request_confirmation" ||
      row.payload.target ||
      row.payload.toolAction ||
      row.payload.secretProposal
    )
      throw Error("Use the native Paperclip decision view.");
    const digest = interactionDigest(row);
    const token = createHash("sha256")
      .update(
        JSON.stringify([
          binding.relay,
          binding.companyId,
          binding.issueId,
          binding.channelId,
          binding.rootId,
          id,
          digest,
        ]),
      )
      .digest("hex");
    const card = {
      token,
      companyId: binding.companyId,
      issueId: binding.issueId,
      interactionId: id,
      digest,
    };
    await d.store.putCard(card);
    const template = {
      kind: 9,
      created_at: d.clock(),
      tags: [
        ["h", binding.channelId],
        ["e", binding.rootId, "", "root"],
        ["e", binding.rootId, "", "reply"],
      ],
      content: JSON.stringify({
        issueId: binding.issueId,
        interactionId: id,
        title: row.title,
        status: row.status,
        prompt: row.payload.prompt,
        accept: "/inertia accept " + token,
        reject: "/inertia reject " + token,
      }),
    };
    const event = verifySignedEvent(await d.signer(template));
    if (
      event.pubkey !== cfg.bridgePubkey ||
      event.content !== template.content ||
      JSON.stringify(event.tags) !== JSON.stringify(template.tags) ||
      event.kind !== 9
    )
      throw Error("Receipt signing configuration is invalid.");
    await d.runtime.scopeReceipt("card:" + token, binding.issueId);
    await d.store.putOutbox({
      receiptKey: "card:" + token,
      relay: binding.relay,
      eventId: event.id,
      event,
    });
    await deliver();
    return card;
  }
  return { ingest, reconcile, renderInteraction };
}
