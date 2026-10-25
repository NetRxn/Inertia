import type { PluginContext } from "@paperclipai/plugin-sdk";
import { documentHash } from "./service.js";
type Documents = PluginContext["issues"]["documents"];
const prefix = (logicalKey: string) =>
  "funding-" + documentHash(logicalKey) + "-";
/** The pinned SDK cannot supply baseRevisionId for updates. Native immutable snapshots,
 * serialized by the existing owner, preserve revisions without a parallel task store. */
async function latest(
  api: Documents,
  issueId: string,
  key: string,
  companyId: string,
) {
  const start = prefix(key),
    rows = await api.list(issueId, companyId);
  const candidates = rows
    .filter((r) => r.key.startsWith(start))
    .map((r) => {
      const suffix = r.key.slice(start.length);
      if (!/^\d{10}$/.test(suffix))
        throw Error("Invalid native snapshot sequence");
      return { key: r.key, sequence: Number(suffix) };
    })
    .sort((a, b) => b.sequence - a.sequence);
  return candidates[0] ?? null;
}
export async function readNativeDocument(
  api: Documents,
  issueId: string,
  key: string,
  companyId: string,
) {
  const row = await latest(api, issueId, key, companyId);
  if (!row) return null;
  const document = await api.get(issueId, row.key, companyId);
  if (!document) throw Error("Native snapshot disappeared");
  return document;
}
export async function writeNativeDocument(
  api: Documents,
  input: Parameters<Documents["upsert"]>[0],
  options: { immutable?: true } = {},
): Promise<void> {
  const row = await latest(api, input.issueId, input.key, input.companyId);
  if (row) {
    const previous = await api.get(input.issueId, row.key, input.companyId);
    if (!previous) throw Error("Native snapshot disappeared");
    if (previous.body === input.body) return;
    if (options.immutable) throw Error("Native immutable snapshot conflict");
  }
  const next = (row?.sequence ?? 0) + 1;
  if (next > 9_999_999_999) throw Error("Native snapshot sequence exhausted");
  await api.upsert({
    ...input,
    key: prefix(input.key) + String(next).padStart(10, "0"),
    title: (input.title ?? "Funding document") + " [snapshot " + next + "]",
  });
}
