import { beforeAll, afterAll, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import { manifest } from "../../src/manifest.js";
import { BRIDGE_NAMESPACE } from "../../src/store/postgres.js";
import { reconcileMeetingIntake } from "../../src/roundtable/intake.js";
let pg: PGlite;
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`CREATE SCHEMA ${BRIDGE_NAMESPACE}`);
  await pg.exec(
    await readFile(
      new URL("../../migrations/007_objective_intake.sql", import.meta.url),
      "utf8",
    ),
  );
}, 60000);
afterAll(async () => pg.close());
function setup(id: string) {
  const h = createTestHarness({
    manifest: {
      ...manifest,
      capabilities: [
        ...manifest.capabilities,
        "issues.read",
        "issues.create",
        "issues.update",
      ],
    },
  });
  Object.assign(h.ctx.db, {
    namespace: BRIDGE_NAMESPACE,
    query: async (q: string, p: unknown[]) => (await pg.query(q, p)).rows,
    execute: async (q: string, p: unknown[]) => ({
      rowCount: (await pg.query(q, p)).affectedRows ?? 0,
    }),
  });
  const config = {
    companyId: "co",
    meetingId: id,
    origin: "https://dao.example",
    principalId: "principal",
    nativeIntake: {
      organizationId: "org",
      intakeAgentId: "agent",
      referenceOnly: true as const,
    },
  };
  let admitted = true;
  const current = async () => admitted;
  return {
    h,
    config,
    current,
    disable: () => {
      admitted = false;
    },
  };
}
it("creates one reference-only native source exception and deduplicates repetitions using existing intake store", async () => {
  const f = setup("summary");
  const result = { state: "summary-only", code: "transcript_required" };
  const first = await reconcileMeetingIntake(
    f.h.ctx,
    f.config,
    result,
    "summary-source",
    f.current,
  );
  const second = await reconcileMeetingIntake(
    f.h.ctx,
    f.config,
    result,
    "summary-source",
    f.current,
  );
  expect(first?.status).toBe("applied");
  expect(second?.status).toBe("replayed");
  expect(second?.nativeIssueId).toBe(first?.nativeIssueId);
  const row = await f.h.ctx.issues.get(first!.nativeIssueId!, "co");
  expect(row?.title).toBe("Meeting source follow-up");
  expect(row?.description).toContain("Add the missing transcript");
  expect(row?.description).not.toContain("summary-source");
  expect(row?.description).not.toContain("drive.google.com");
  expect(row?.description).toContain("Protected meeting reference:");
});
it("updates the same native work on corrected successful publication without copying quoted instructions", async () => {
  const f = setup("correction");
  const one = await reconcileMeetingIntake(
    f.h.ctx,
    f.config,
    { state: "published" },
    "operation-1",
    f.current,
  );
  const two = await reconcileMeetingIntake(
    f.h.ctx,
    f.config,
    { state: "published" },
    "operation-2",
    f.current,
  );
  expect(two?.nativeIssueId).toBe(one?.nativeIssueId);
  expect(two?.status).toBe("applied");
  const row = await f.h.ctx.issues.get(two!.nativeIssueId!, "co");
  expect(row?.description).toContain("Review the new or corrected meeting");
  expect(row?.description).toContain("not approved tasks");
});
it("reconciles lost native create acknowledgment instead of creating a duplicate after restart", async () => {
  const f = setup("ack-loss");
  const create = f.h.ctx.issues.create;
  let creates = 0;
  f.h.ctx.issues.create = async (input) => {
    creates++;
    await create(input);
    throw Error("ack lost");
  };
  expect(
    (
      await reconcileMeetingIntake(
        f.h.ctx,
        f.config,
        { state: "summary-only", code: "transcript_required" },
        "v1",
        f.current,
      )
    )?.status,
  ).toBe("pending");
  f.h.ctx.issues.create = create;
  expect(
    (
      await reconcileMeetingIntake(
        f.h.ctx,
        f.config,
        { state: "summary-only", code: "transcript_required" },
        "v1",
        f.current,
      )
    )?.status,
  ).toBe("replayed");
  expect(creates).toBe(1);
});
it("disabled admission performs no native calls and withdrawal cancels only mapped work", async () => {
  const f = setup("withdrawal");
  const first = await reconcileMeetingIntake(
    f.h.ctx,
    f.config,
    { state: "published" },
    "v1",
    f.current,
  );
  const last = await reconcileMeetingIntake(
    f.h.ctx,
    f.config,
    { state: "blocked", code: "withdrawn" },
    "v1",
    f.current,
  );
  expect(last?.nativeIssueId).toBe(first?.nativeIssueId);
  expect((await f.h.ctx.issues.get(first!.nativeIssueId!, "co"))?.status).toBe(
    "cancelled",
  );
  f.disable();
  f.h.ctx.issues.list = async () => {
    throw Error("must not read");
  };
  expect(
    await reconcileMeetingIntake(
      f.h.ctx,
      f.config,
      { state: "published" },
      "v2",
      f.current,
    ),
  ).toBeNull();
});
