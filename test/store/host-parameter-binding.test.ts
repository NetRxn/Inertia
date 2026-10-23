import { expect, it, vi } from 'vitest';
import type { PluginDatabaseClient } from '@paperclipai/plugin-sdk';
import { runtimeState } from '../../src/bridge/runtime.js';
import { BRIDGE_NAMESPACE, createBridgeStore } from '../../src/store/postgres.js';

// Paperclip 2026.1012.0 bindSql interpolates each parameter through Drizzle sql.
// JS arrays expand into SQL lists, not PostgreSQL array parameters. Require scalar
// JSON at this boundary; the native-host qualification exercises actual binding.
it.each([[], ['issue'], ["issue'); DROP TABLE x; --", 'other']].map(ids => ({ ids })))('uses scalar parameters for native runtime issue sets $ids', async ({ ids }) => {
  const query = vi.fn(async (_sql: string, params?: unknown[]) => {
    expect(params?.some(Array.isArray)).toBe(false);
    expect(params?.[2]).toBe(JSON.stringify(ids));
    return [];
  });
  const execute = vi.fn(async (_sql: string, params?: unknown[]) => {
    expect(params?.some(Array.isArray)).toBe(false);
    expect(params?.[2]).toBe(JSON.stringify(ids));
    return { rowCount: 0 };
  });
  const db = { namespace: BRIDGE_NAMESPACE, query, execute } as PluginDatabaseClient;
  const runtime = runtimeState(db, 'co', 'relay');
  await runtime.uncertainCount(ids);
  await runtime.resumeBlocked(ids);
  await runtime.deliveryHealth(ids);
});

it('uses scalar JSON for native validation scan updates', async () => {
  const ids = ['comment:one', "comment:'); --"];
  const db = {
    namespace: BRIDGE_NAMESPACE,
    query: async () => ids.map(receiptKey => ({ receiptKey })),
    execute: async (_sql: string, params?: unknown[]) => {
      expect(params).toEqual([JSON.stringify(ids)]);
      return { rowCount: 2 };
    },
  } as unknown as PluginDatabaseClient;
  expect(await createBridgeStore(db).listCommentValidation('co')).toHaveLength(2);
});
