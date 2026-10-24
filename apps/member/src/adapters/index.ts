import type { Adapters } from './types';
import { createFixtureAdapters } from './fixtures/adapters';
import { defaultFixture, FIXTURE_NOW } from './fixtures/dao';

// Export types
export type * from './types';

// Export fixture utilities
export { FIXTURE_NOW, defaultFixture } from './fixtures/dao';
export { createFixtureAdapters } from './fixtures/adapters';

// Memoize on globalThis per R8
declare global {
  var __memberAppAdapters: Adapters | undefined;
  var __memberAppAdaptersStartTime: Date | undefined;
}

/**
 * Returns a process singleton of adapters.
 * Adapter mode is chosen by MEMBER_APP_ADAPTERS env var (default: 'fixture').
 * Fixture data is anchored at process start time.
 */
export function getAdapters(): Adapters {
  if (globalThis.__memberAppAdapters) {
    return globalThis.__memberAppAdapters;
  }

  const mode = process.env.MEMBER_APP_ADAPTERS || 'fixture';

  if (mode === 'fixture') {
    // Create fixtures anchored at process start
    if (!globalThis.__memberAppAdaptersStartTime) {
      globalThis.__memberAppAdaptersStartTime = new Date();
    }
    const data = defaultFixture(globalThis.__memberAppAdaptersStartTime);
    globalThis.__memberAppAdapters = createFixtureAdapters(data);
    return globalThis.__memberAppAdapters;
  }

  throw new Error(`Unknown MEMBER_APP_ADAPTERS value: ${mode}`);
}

/**
 * Test-only helper to reset the adapters singleton.
 * @internal
 */
export function resetAdaptersForTests(): void {
  globalThis.__memberAppAdapters = undefined;
  globalThis.__memberAppAdaptersStartTime = undefined;
}
