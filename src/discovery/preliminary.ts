/** A discovery brief is evidence for further agent work, not a canonical grant packet. */
export interface PreliminaryBrief {
  contract_version: "preliminary-opportunity-v1";
  opportunityKey: string | null;
  title: string;
  sponsor: string;
  status: string;
  deadline: {
    date: string;
    precision: "date";
    timezone: null;
    quote: string;
  } | null;
  value: {
    minimum: number | null;
    maximum: number | null;
    currency: null;
    quotes: string[];
  } | null;
  source: {
    url: string;
    sha256: string;
    documentId: string;
    observedAt: string;
  };
  fit: "unknown";
  eligibility: "unknown";
  questions: string[];
  nextAction: string;
  urgent: {
    kind: "deadline_within_7_calendar_days";
    deadlineDate: string;
    daysRemaining: number;
    timeBasis: string;
    opportunityKey: string | null;
  } | null;
  materialEventKey: string | null;
  identityEvidence?: { quote: string; name: string } | null;
}
const hex = /^[a-f0-9]{64}$/;
const text = (v: unknown): v is string =>
  typeof v === "string" &&
  !!v.trim() &&
  v.length <= 10_000 &&
  !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v);
const escape = (v: string) =>
  v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/[\\`*_\[\]{}()#!|]/g, "\\$&");
function date(v: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v
  );
}
export function renderPreliminaryBrief(p: PreliminaryBrief): string {
  if (
    p.contract_version !== "preliminary-opportunity-v1" ||
    ![
      p.title,
      p.sponsor,
      p.status,
      p.source?.url,
      p.source?.documentId,
      p.nextAction,
    ].every(text) ||
    !hex.test(p.source.sha256) ||
    !Number.isFinite(Date.parse(p.source.observedAt)) ||
    p.fit !== "unknown" ||
    p.eligibility !== "unknown" ||
    !Array.isArray(p.questions) ||
    p.questions.length > 20 ||
    !p.questions.every(text)
  )
    throw Error("Invalid preliminary evidence");
  const u = new URL(p.source.url);
  if (u.protocol !== "https:" || u.username || u.password)
    throw Error("Invalid preliminary source");
  if (p.opportunityKey !== null && !text(p.opportunityKey))
    throw Error("Invalid preliminary identity");
  if (
    p.deadline &&
    (!date(p.deadline.date) ||
      p.deadline.precision !== "date" ||
      p.deadline.timezone !== null ||
      !text(p.deadline.quote))
  )
    throw Error("Invalid preliminary deadline");
  if (
    p.value &&
    (![p.value.minimum, p.value.maximum].every(
      (v) => v === null || (Number.isFinite(v) && v >= 0),
    ) ||
      p.value.currency !== null ||
      !Array.isArray(p.value.quotes) ||
      !p.value.quotes.length ||
      p.value.quotes.length > 20 ||
      !p.value.quotes.every(text) ||
      (p.value.minimum !== null &&
        p.value.maximum !== null &&
        p.value.minimum > p.value.maximum))
  )
    throw Error("Invalid preliminary value");
  if (
    p.urgent &&
    (!p.deadline ||
      p.urgent.kind !== "deadline_within_7_calendar_days" ||
      p.urgent.deadlineDate !== p.deadline.date ||
      p.urgent.opportunityKey !== p.opportunityKey ||
      !Number.isInteger(p.urgent.daysRemaining) ||
      p.urgent.daysRemaining < 0 ||
      p.urgent.daysRemaining > 7 ||
      !text(p.urgent.timeBasis) ||
      !p.materialEventKey ||
      !hex.test(p.materialEventKey))
  )
    throw Error("Invalid preliminary urgency binding");
  return [
    `# Preliminary funding discovery: ${escape(p.title)}`,
    "Captured official evidence for independent agent diligence. Not an eligibility determination or application authorization.",
    `Sponsor: ${escape(p.sponsor)}\nSource-reported status: ${escape(p.status)}`,
    `Official source: ${u.href.replace(/\(/g, "%28").replace(/\)/g, "%29")}\nObserved: ${escape(p.source.observedAt)}\nEvidence SHA256: ${p.source.sha256}`,
    p.deadline
      ? `Published deadline: ${p.deadline.date}; exact cutoff/timezone unknown.\nSource evidence: ${escape(p.deadline.quote)}`
      : "Deadline: unknown; inspect official rules.",
    p.value
      ? `Published benefit evidence (currency and applicability require confirmation): ${p.value.quotes.map(escape).join("; ")}`
      : "Benefit/amount: unknown; inspect official rules.",
    "Fit: unknown. Eligibility: unknown.\nApplication effort: unknown. Delivery effort: unknown. Reporting effort: unknown.",
    "## Remaining agent diligence",
    ...p.questions.map((q) => `- ${escape(q)}`),
    `Next agent action: ${escape(p.nextAction)}`,
    ...(p.urgent
      ? [
          `Time-critical source evidence: ${escape(p.urgent.timeBasis)}. Verify cutoff and eligibility immediately; this is not confirmation the applicant qualifies.`,
        ]
      : []),
  ].join("\n\n");
}
/** Short public urgent alert. Complete evidence/diligence remains in the native brief. */
export function renderPreliminaryAlert(p: PreliminaryBrief): string {
  renderPreliminaryBrief(p);
  if (!p.urgent || !p.deadline)
    throw Error("No validated closing-date urgency");
  const short = (value: string, limit: number) =>
    escape(value.length > limit ? value.slice(0, limit) + "…" : value);
  return [
    `Time-critical funding source: ${short(p.title, 160)}`,
    `Sponsor: ${short(p.sponsor, 160)}`,
    `Published closing date: ${p.deadline.date}; exact cutoff/timezone unknown.`,
    `Official evidence: ${short(p.deadline.quote, 1200)}`,
    `Source: ${p.source.url}\nObserved: ${p.source.observedAt}\nSHA256: ${p.source.sha256}`,
    "Eligibility and fit remain unverified. Application, delivery and reporting effort remain unknown.",
    `Next agent action: ${short(p.nextAction, 500)}`,
  ].join("\n\n");
}
