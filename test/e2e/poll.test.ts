import { it, expect } from "vitest";
import { pollBinding } from "../../src/bridge/reconcile.js";
it("never advances checkpoint after incomplete saturated timestamp boundary", async () => {
  let saved = false;
  const event = { event: { created_at: 10 } };
  await expect(
    pollBinding({
      binding: { channelId: "c", rootId: "r" } as any,
      since: 0,
      query: async () => Array(100).fill(event),
      ingest: async () => ({ status: "applied" }),
      save: async () => {
        saved = true;
      },
    }),
  ).rejects.toThrow("timestamp");
  expect(saved).toBe(false);
});
it("uses overlapping timestamp and saves only after all dispositions", async () => {
  let saved = 0;
  let applied = 0;
  await pollBinding({
    binding: { channelId: "c", rootId: "r" } as any,
    since: 8,
    query: async (filters) => {
      expect(filters[0]?.since).toBe(0);
      return [{ event: { created_at: 10 } }] as any;
    },
    ingest: async () => {
      applied++;
      return { status: "applied" };
    },
    save: async (n) => {
      expect(applied).toBe(1);
      saved = n;
    },
  });
  expect(saved).toBe(10);
});

it("ignores a future-dated event without pausing valid neighbors or advancing its checkpoint", async () => {
  let saved = -1;
  let ingested = 0;
  await pollBinding({
    binding: { channelId: "c", rootId: "r" } as any,
    since: 0,
    query: async () =>
      [
        { event: { created_at: Math.floor(Date.now() / 1000) + 86400 } },
        { event: { created_at: 10 } },
      ] as any,
    ingest: async () => {
      ingested++;
      return { status: "applied" };
    },
    save: async (n) => {
      saved = n;
    },
  });
  expect(saved).toBe(10);
  expect(ingested).toBe(1);
});

it("looks back one day to recover delayed signed events", async () => {
  let since = -1;
  await pollBinding({
    binding: { channelId: "c", rootId: "r" } as any,
    since: 100000,
    query: async (f) => {
      since = f[0]!.since!;
      return [];
    },
    ingest: async () => ({ status: "applied" }),
    save: async () => {},
  });
  expect(since).toBe(13600);
});
it("persists bounded backlog progress and completes on the next native run", async () => {
  let progress: any = null;
  let saved = 0;
  const common = {
    binding: { channelId: "c", rootId: "r" } as any,
    since: 0,
    maxPages: 1,
    ingest: async () => ({ status: "applied" }) as const,
    save: async (n: number) => {
      saved = n;
    },
    saveProgress: async (p: any) => {
      progress = p;
    },
  };
  expect(
    await pollBinding({
      ...common,
      query: async () =>
        Array.from({ length: 100 }, (_, i) => ({
          event: { created_at: 1000 - i },
        })) as any,
    }),
  ).toBe(false);
  expect(saved).toBe(0);
  expect(progress).toEqual({ until: 901, newest: 1000 });
  expect(
    await pollBinding({
      ...common,
      progress,
      query: async (f) => {
        expect(f[0]?.until).toBe(901);
        return [];
      },
    }),
  ).toBe(true);
  expect(saved).toBe(1000);
  expect(progress).toBeNull();
});
