/** Read-only member projection. Publication does not imply eligibility or readiness. */
export type FundingRoute = "direct" | "partner" | "next-cycle" | "monitor" | "standing-benefit";
export interface FundingOpportunity {
  id: string;
  sponsor: string | null;
  program: string;
  route: FundingRoute | null;
  summary: string | null;
  deadline: string | null;
  benefit: string | null;
  effort: string | null;
  nextStep: string | null;
  sourceUrl: string | null;
  observedAt: string | null;
  initiativeId: string | null;
}
export interface FundingOpportunityPage {
  schema: "inertia.member-funding-opportunities.v1";
  opportunities: FundingOpportunity[];
  nextCursor: string | null;
}
export interface FundingPageRequest { limit: number; cursor: string | null }
export const MAX_FUNDING_PAGE_BYTES = 256 * 1024;
const id = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(v);
const text = (v: unknown, max: number) => typeof v === "string" && !!v.trim() && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
const nullableText = (v: unknown, max: number) => v === null || text(v, max);
function exact(v: unknown, keys: string[]): asserts v is Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).length !== keys.length || !keys.every(k=>Object.hasOwn(v,k)))
    throw Error("Invalid member funding fields");
}
function dateOnly(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v;
}
function instant(v: unknown): boolean {
  return typeof v === "string" && v.length <= 40 &&
    /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(v) &&
    dateOnly(v.slice(0,10)) && Number.isFinite(Date.parse(v));
}
function sourceUrl(v: unknown): boolean {
  if (v === null) return true;
  if (!text(v,2048)) return false;
  try { const u=new URL(v as string); return ["https:","http:"].includes(u.protocol) && !!u.hostname && !u.username && !u.password; }
  catch { return false; }
}
export function parseFundingPageRequest(raw: unknown): FundingPageRequest {
  exact(raw,["limit","cursor"]);
  if (!Number.isSafeInteger(raw.limit) || Number(raw.limit)<1 || Number(raw.limit)>100 || !(raw.cursor===null || id(raw.cursor)))
    throw Error("Invalid bounded member funding page");
  return {limit:Number(raw.limit),cursor:raw.cursor as string|null};
}
/** Exact allowlist rejects private extras rather than silently forwarding them. */
export function parseFundingOpportunityPage(raw: unknown, request: FundingPageRequest={limit:100,cursor:null}): FundingOpportunityPage {
  const q=parseFundingPageRequest(request);
  exact(raw,["schema","opportunities","nextCursor"]);
  if (raw.schema!=="inertia.member-funding-opportunities.v1" || !Array.isArray(raw.opportunities) || raw.opportunities.length>q.limit ||
      !(raw.nextCursor===null || id(raw.nextCursor))) throw Error("Invalid member funding page");
  let previous=q.cursor;
  for (const row of raw.opportunities) {
    exact(row,["id","sponsor","program","route","summary","deadline","benefit","effort","nextStep","sourceUrl","observedAt","initiativeId"]);
    if (!id(row.id) || previous!==null && row.id<=previous || !text(row.program,500) || !nullableText(row.sponsor,500) ||
        !(row.route===null || typeof row.route==="string" && ["direct","partner","next-cycle","monitor","standing-benefit"].includes(row.route)) ||
        !nullableText(row.summary,2000) || !(row.deadline===null || dateOnly(row.deadline) || instant(row.deadline)) ||
        !nullableText(row.benefit,1000) || !nullableText(row.effort,1000) || !nullableText(row.nextStep,1000) ||
        !sourceUrl(row.sourceUrl) || !(row.observedAt===null || instant(row.observedAt)) || !(row.initiativeId===null || id(row.initiativeId)))
      throw Error("Invalid member funding opportunity");
    previous=row.id;
  }
  if (raw.nextCursor!==null && (q.cursor!==null && raw.nextCursor<=q.cursor || previous!==null && raw.nextCursor<previous))
    throw Error("Member funding cursor did not advance");
  if (new TextEncoder().encode(JSON.stringify(raw)).byteLength>MAX_FUNDING_PAGE_BYTES) throw Error("Member funding page too large");
  return structuredClone(raw) as unknown as FundingOpportunityPage;
}
