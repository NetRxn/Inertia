import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import { schema } from './schema';

export type Db = ReturnType<typeof drizzlePg<typeof schema>> | ReturnType<typeof drizzlePglite<typeof schema>>;

// Memoize on globalThis per R3
declare global {
  var __memberAppDb: Db | undefined;
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
    return db;
  } else {
    // Use PGlite
    const pgliteDir = process.env.MEMBER_APP_PGLITE_DIR ?? 'data/pglite';

    if (!globalThis.__memberAppPglite) {
      globalThis.__memberAppPglite = new PGlite(pgliteDir);
    }

    const db = drizzlePglite({ client: globalThis.__memberAppPglite, schema });
    globalThis.__memberAppDb = db;
    return db;
  }
}
