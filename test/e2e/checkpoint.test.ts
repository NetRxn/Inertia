import { vi, it, expect } from "vitest";
// PGlite initializes PostgreSQL WASM per fixture. Shared cloud CPU can make
// startup slow; this fixture-only budget does not change application deadlines.
vi.setConfig({ testTimeout: 60000, hookTimeout: 60000 });
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import type { PluginDatabaseClient } from "@paperclipai/plugin-sdk";
import { BRIDGE_NAMESPACE } from "../../src/store/postgres.js";
import { checkpoints } from "../../src/bridge/reconcile.js";
import { runtimeState } from "../../src/bridge/runtime.js";
it("persists monotonic scan progress and company-isolated runtime state across restart", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(`CREATE SCHEMA ${BRIDGE_NAMESPACE}`);
    for (const file of ["002_checkpoint.sql", "004_runtime_state.sql"])
      await pg.exec(
        await readFile(
          new URL("../../migrations/" + file, import.meta.url),
          "utf8",
        ),
      );
    const db: PluginDatabaseClient = {
      namespace: BRIDGE_NAMESPACE,
      query: async <T>(s: string, p?: unknown[]) =>
        (await pg.query<T>(s, p)).rows,
      execute: async (s, p) => ({
        rowCount: (await pg.query(s, p)).affectedRows ?? 0,
      }),
    };
    const b = {
      companyId: "co",
      issueId: "i",
      relay: "https://buzz.example",
      channelId: "c",
      rootId: "r",
    };
    await checkpoints(db).save(b, 12);
    await checkpoints(db).save(b, 8);
    expect(await checkpoints(db).get(b)).toBe(12);
    await runtimeState(db, "co", b.relay).set("delivery", { receiptKey: "r" });
    expect(await runtimeState(db, "co", b.relay).get("delivery")).toEqual({
      receiptKey: "r",
    });
    expect(await runtimeState(db, "other", b.relay).get("delivery")).toBeNull();
  } finally {
    await pg.close();
  }
});
