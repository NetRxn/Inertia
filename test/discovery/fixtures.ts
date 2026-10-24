import type { PreliminaryBrief } from "../../src/discovery/preliminary.js";
export const preliminary: PreliminaryBrief = {
  contract_version: "preliminary-opportunity-v1",
  opportunityKey: "corporate:2026",
  title: "Community awards",
  sponsor: "Synthetic official sponsor",
  status: "open",
  deadline: {
    date: "2026-10-27",
    precision: "date",
    timezone: null,
    quote: "Applications close October 27, 2026",
  },
  value: null,
  source: {
    url: "https://sponsor.example/funding",
    sha256: "a".repeat(64),
    documentId: "doc",
    observedAt: "2026-10-24T12:00:00+00:00",
  },
  fit: "unknown",
  eligibility: "unknown",
  questions: ["Verify applicant category"],
  nextAction:
    "Continue independent agent diligence using official eligibility rules.",
  urgent: {
    kind: "deadline_within_7_calendar_days",
    deadlineDate: "2026-10-27",
    daysRemaining: 3,
    timeBasis: "America/Chicago business date; sponsor cutoff unknown",
    opportunityKey: "corporate:2026",
  },
  materialEventKey: "b".repeat(64),
};
