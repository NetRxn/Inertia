import { beforeAll, afterAll, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import type { PluginDatabaseClient } from "@paperclipai/plugin-sdk";
import { BRIDGE_NAMESPACE } from "../../src/store/postgres.js";
import { createRuntimeOwner } from "../../src/bridge/ownership.js";
let pg: PGlite;
let db: PluginDatabaseClient;
const scope = {
  companyId: "co",
  namespaceScope: "https://dao.example",
  key: "roundtable:meeting",
};
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`CREATE SCHEMA ${BRIDGE_NAMESPACE}`);
  await pg.exec(
    await readFile(
      new URL("../../migrations/004_runtime_state.sql", import.meta.url),
      "utf8",
    ),
  );
  db = {
    namespace: BRIDGE_NAMESPACE,
    query: async <T>(q: string, p?: unknown[]) =>
      (await pg.query<T>(q, p)).rows,
    execute: async (q, p) => ({
      rowCount: (await pg.query(q, p)).affectedRows ?? 0,
    }),
  };
}, 60000);
afterAll(async () => pg.close());
it("has exactly one owner across concurrent separate instances and releases after completion", async () => {
  const a = createRuntimeOwner(db, { workerId: "worker-a", runId: "run-a" });
  const b = createRuntimeOwner(db, { workerId: "worker-b", runId: "run-b" });
  let inside = 0;
  let max = 0;
  await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      (i % 2 ? a : b).own(scope, async () => {
        max = Math.max(max, ++inside);
        await new Promise((r) => setTimeout(r, 20));
        inside--;
        return "done";
      }),
    ),
  );
  expect(max).toBe(1);
  expect(await a.inspect(scope)).toBeNull();
  expect(await b.own(scope, async () => 42)).toBe(42);
});
it("crash leftovers survive reconstruction and cannot be stolen by time or ordinary retries", async () => {
  const a = createRuntimeOwner(db, {
    workerId: "dead-incarnation",
    runId: "crashed-run",
  });
  await db.execute(
    `INSERT INTO "${BRIDGE_NAMESPACE}".bridge_runtime(company_id,relay,state_key,value) VALUES($1,$2,$3,$4::jsonb)`,
    [
      scope.companyId,
      scope.namespaceScope,
      "exclusive-owner:" + scope.key,
      JSON.stringify({
        token: "crash-token",
        workerId: "dead-incarnation",
        runId: "crashed-run",
      }),
    ],
  );
  const restart = createRuntimeOwner(db, {
    workerId: "new-incarnation",
    runId: "new-run",
  });
  expect(await restart.own(scope, async () => 42)).toBeNull();
  expect(
    await restart.recoverStopped(scope, "crash-token", async () => false),
  ).toBe(false);
  expect(await a.inspect(scope)).toMatchObject({ token: "crash-token" });
  let checked = "";
  expect(
    await restart.recoverStopped(scope, "crash-token", async (worker) => {
      checked = worker;
      return true;
    }),
  ).toBe(true);
  expect(checked).toBe("dead-incarnation");
  expect(await restart.own(scope, async () => 42)).toBe(42);
});
it("stale recovery token cannot delete a newly acquired owner", async () => {
  const a = createRuntimeOwner(db, {
    workerId: "new-worker",
    runId: "new-run",
  });
  await a.own(scope, async () => {
    expect(await a.recoverStopped(scope, "old-token", async () => true)).toBe(
      false,
    );
    expect(await a.inspect(scope)).toMatchObject({ workerId: "new-worker" });
  });
});
it("separates companies and targets, and redacts SQL failures", async () => {
  const a = createRuntimeOwner(db, { workerId: "worker", runId: "run" });
  await a.own(scope, async () =>
    expect(await a.own({ ...scope, companyId: "other" }, async () => 42)).toBe(
      42,
    ),
  );
  expect(() =>
    createRuntimeOwner(
      { ...db, namespace: "public" },
      { workerId: "worker", runId: "run" },
    ),
  ).toThrow();
  const bad = createRuntimeOwner(
    {
      ...db,
      execute: async () => {
        throw Error("secret SQL");
      },
    },
    { workerId: "worker", runId: "run" },
  );
  await expect(bad.own(scope, async () => 42)).rejects.toThrow(
    /^Native ownership unavailable\.$/,
  );
});
