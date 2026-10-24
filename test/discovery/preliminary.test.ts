import { expect, it } from "vitest";
import {
  renderPreliminaryBrief,
  type PreliminaryBrief,
} from "../../src/discovery/preliminary.js";
import { preliminary } from "./fixtures.js";

it("renders timely preliminary official evidence without requiring packet or inventing eligibility", () => {
  const r = renderPreliminaryBrief(preliminary);
  expect(r).toContain("2026-10-27");
  expect(r).toContain("cutoff/timezone unknown");
  expect(r).toContain("Eligibility: unknown");
  expect(r).toContain("Application effort: unknown");
  expect(r).toContain("independent agent diligence");
  expect(r).not.toContain("ready for submission");
});
it("escapes source prose and rejects broken deadline/urgent source binding", () => {
  expect(
    renderPreliminaryBrief({
      ...preliminary,
      title: "<script>[click](bad)</script>",
    }),
  ).not.toContain("<script>");
  expect(() =>
    renderPreliminaryBrief({
      ...preliminary,
      deadline: { ...preliminary.deadline!, date: "2026-02-30" },
    }),
  ).toThrow();
  expect(() =>
    renderPreliminaryBrief({
      ...preliminary,
      urgent: { ...preliminary.urgent!, deadlineDate: "2026-12-31" },
    }),
  ).toThrow();
});
