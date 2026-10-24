import type { Adapters } from './types.js';
import { createFixtureAdapters } from './fixtures/adapters.js';
import { defaultFixture, FIXTURE_NOW } from './fixtures/dao.js';

// Export types
export type * from './types.js';

// Export fixture utilities
export { FIXTURE_NOW, defaultFixture } from './fixtures/dao.js';
export { createFixtureAdapters } from './fixtures/adapters.js';

// Process-wide singleton for adapters
let adaptersInstance: Adapters | null = null;
const processStartTime = new Date();

/**
 * Returns a process singleton of adapters.
 * Adapter mode is chosen by MEMBER_APP_ADAPTERS env var (default: 'fixture').
 * Fixture data is anchored at process start time.
 */
export function getAdapters(): Adapters {
  if (adaptersInstance) {
    return adaptersInstance;
  }

  const mode = process.env.MEMBER_APP_ADAPTERS || 'fixture';

  if (mode === 'fixture') {
    // Create fixtures anchored at process start
    const data = defaultFixture(processStartTime);
    adaptersInstance = createFixtureAdapters(data);
    return adaptersInstance;
  }

  throw new Error(`Unknown MEMBER_APP_ADAPTERS value: ${mode}`);
}
