import type { Adapters } from './types';
import { createFixtureAdapters } from './fixtures/adapters';
import { defaultFixture, FIXTURE_NOW } from './fixtures/dao';
import { createLiveAdapters } from './live';
import { createMemoryWorkSource } from './memory-work';
import { createPaperclipWorkSource, paperclipConfig } from './paperclip';

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

/** Production runs on real data unless fixtures are asked for explicitly. */
export function adapterMode(env: Record<string, string | undefined> = process.env): string {
  return env.MEMBER_APP_ADAPTERS || (env.NODE_ENV === 'production' ? 'live' : 'fixture');
}

/**
 * Returns a process singleton of adapters.
 * Adapter mode is chosen by MEMBER_APP_ADAPTERS env var (default: 'live' in production, 'fixture' otherwise).
 * Fixture data is anchored at process start time.
 */
export function getAdapters(): Adapters {
  if (globalThis.__memberAppAdapters) {
    return globalThis.__memberAppAdapters;
  }

  const mode = adapterMode();

  if (mode === 'fixture') {
    // Create fixtures anchored at process start
    if (!globalThis.__memberAppAdaptersStartTime) {
      globalThis.__memberAppAdaptersStartTime = new Date();
    }
    const data = defaultFixture(globalThis.__memberAppAdaptersStartTime);
    globalThis.__memberAppAdapters = createFixtureAdapters(data);
    return globalThis.__memberAppAdapters;
  }

  if (mode === 'live') {
    // A real organization. Work runs in Paperclip when it is configured,
    // otherwise in a process-memory engine until one is connected.
    const paperclip = paperclipConfig(process.env);
    const work = paperclip
      ? createPaperclipWorkSource(paperclip)
      : createMemoryWorkSource(undefined, async () => {
          const { getDb } = await import('../db/client');
          const { getOrganization } = await import('../org/organization');
          const profile = (await getOrganization(getDb()))?.profile;
          return (profile?.initiatives ?? [])
            .filter((i) => i.status === 'accepted' && i.workId)
            .map((i) => ({ id: i.workId!, title: i.title, adopted: i.adopted }));
        });
    globalThis.__memberAppAdapters = createLiveAdapters(work);
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
