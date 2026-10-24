import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import { schema } from './schema';

export type Db = ReturnType<typeof drizzlePg<typeof schema>> | ReturnType<typeof drizzlePglite<typeof schema>>;
export type DbDriver = 'node-postgres' | 'pglite';

// Memoize on globalThis per R3
declare global {
  var __memberAppDb: Db | undefined;
  var __memberAppDbDriver: DbDriver | undefined;
  var __memberAppPglite: PGlite | undefined;
}

export function getDb(): Db {
  if (globalThis.__memberAppDb) {
    return globalThis.__memberAppDb;
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    // Use node-postgres with DATABASE_URL
    const pool = new Pool({ connectionString: databaseUrl });
    const db = drizzlePg({ client: pool, schema });
    globalThis.__memberAppDb = db;
    globalThis.__memberAppDbDriver = 'node-postgres';
    return db;
  } else {
    // Use PGlite
    const pgliteDir = process.env.MEMBER_APP_PGLITE_DIR ?? 'data/pglite';

    if (!globalThis.__memberAppPglite) {
      globalThis.__memberAppPglite = new PGlite(pgliteDir);
    }

    const db = drizzlePglite({ client: globalThis.__memberAppPglite, schema });
    globalThis.__memberAppDb = db;
    globalThis.__memberAppDbDriver = 'pglite';
    return db;
  }
}

export function getDbDriver(): DbDriver {
  if (globalThis.__memberAppDbDriver) {
    return globalThis.__memberAppDbDriver;
  }
  // Check DATABASE_URL to determine driver without creating the db
  return process.env.DATABASE_URL ? 'node-postgres' : 'pglite';
}
