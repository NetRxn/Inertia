import { createHash } from "node:crypto";
import type { IssueComment } from "@paperclipai/plugin-sdk";
import type { Binding, OutboundComments } from "./types.js";
export const COMMENT_TYPE = "inertia.paperclip.comment.v1";
function iso(value: unknown): string | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  if (typeof value !== "string") return null;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value ? value : null;
}
export function validOutboundComments(value: unknown): value is OutboundComments {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return Object.keys(v).every(k => ["enabled", "audienceAcknowledged", "notBefore"].includes(k)) &&
    typeof v.enabled === "boolean" && typeof v.audienceAcknowledged === "boolean" &&
    (!v.enabled || v.audienceAcknowledged === true) && typeof v.notBefore === "string" && iso(v.notBefore) !== null;
}
export function outboundEnabled(binding: Binding): boolean {
  return validOutboundComments(binding.outboundComments) && binding.outboundComments.enabled && binding.outboundComments.audienceAcknowledged;
}
export function sameBinding(a: Binding, b: Binding): boolean {
  return a.relay === b.relay && a.companyId === b.companyId && a.issueId === b.issueId && a.channelId === b.channelId && a.rootId === b.rootId;
}
export function commentReceiptKey(binding: Binding, id: string): string {
  return "comment:" + createHash("sha256").update(JSON.stringify([COMMENT_TYPE, binding.relay, binding.companyId, binding.issueId, binding.channelId, binding.rootId, id])).digest("hex");
}
export function projectComment(binding: Binding, row: IssueComment) {
  if (!outboundEnabled(binding) || row.companyId !== binding.companyId || row.issueId !== binding.issueId ||
      typeof row.id !== "string" || !row.id || row.deletedAt != null || typeof row.body !== "string" || !row.body.trim() || Buffer.byteLength(row.body, "utf8") > 16384) return null;
  const createdAt = iso(row.createdAt);
  if (!createdAt || createdAt < binding.outboundComments!.notBefore) return null;
  // Never infer authorship from derived metadata or a display name.
  const agent = row.authorType === "agent" && typeof row.authorAgentId === "string" && !!row.authorAgentId && row.authorUserId == null;
  const user = row.authorType === "user" && typeof row.authorUserId === "string" && !!row.authorUserId && row.authorAgentId == null;
  if (!agent && !user) return null;
  return { type: COMMENT_TYPE, companyId: binding.companyId, issueId: binding.issueId, commentId: row.id, createdAt, author: agent ? "Paperclip agent" : "Paperclip member", body: row.body };
}
