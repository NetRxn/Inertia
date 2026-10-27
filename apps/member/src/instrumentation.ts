/**
 * Next.js instrumentation hook for automatic member sync.
 * Only runs in Node.js runtime (not Edge).
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Dynamically import Node-only modules
    const { getDb } = await import('./db/client');
    const { runMigrations } = await import('./db/migrate');
    const { getAdapters } = await import('./adapters/index');
    const { syncMembers } = await import('./identity/sync');

    // Guard against multiple invocations
    if (globalThis.__memberAppSyncIntervalStarted) {
      return;
    }
    globalThis.__memberAppSyncIntervalStarted = true;

    const intervalMinutes = parseInt(process.env.MEMBER_SYNC_INTERVAL_MINUTES || '15', 10);

    async function performSync() {
      try {
        const db = getDb();
        await runMigrations(db);
        const adapters = getAdapters();
        const result = await syncMembers(db, adapters.directory);
        console.log(`[sync] Member sync complete: ${result.added} added, ${result.updated} updated, ${result.deactivated} deactivated`);
      } catch (error) {
        console.error('[sync] Member sync failed:', error);
        // Don't crash the server
      }
    }

    // Run once at startup
    performSync();

    // Then run on interval
    setInterval(performSync, intervalMinutes * 60 * 1000);
  }
}

// Global flag to prevent multiple interval starts
declare global {
  var __memberAppSyncIntervalStarted: boolean | undefined;
}
