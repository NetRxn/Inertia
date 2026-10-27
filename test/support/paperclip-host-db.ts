/**
 * A PGlite-backed PluginDatabaseClient that enforces the Paperclip host's plugin SQL boundary.
 *
 * The SQL guards below are vendored verbatim from the pinned host:
 * https://github.com/paperclipai/paperclip/blob/bba6a45f0d364cfd962ac59b3bdf2426a8222adb/server/src/services/plugin-database.ts
 * Keep in sync with the pinned host.
 *
 * Beyond the guards it mirrors the host transport: params and rows cross a plain-JSON RPC, array/object
 * params are refused (Drizzle expands arrays), every param must be referenced by a $n placeholder, and each
 * placeholder occurrence binds as its own parameter (as the host's bindSql does), and int8 columns come back
 * as strings (as postgres-js returns them).
 */
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import type { PluginDatabaseClient } from '@paperclipai/plugin-sdk';
import { BRIDGE_NAMESPACE } from '../../src/store/postgres.js';

type PluginDatabaseCoreReadTable = string;

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

type SqlRef = { schema: string; table: string; keyword: string };
type QualifiedRefPattern =
  | { pattern: RegExp; groups: "keyword-schema-table" }
  | { pattern: RegExp; groups: "schema-table"; keyword: string };

function assertIdentifier(value: string, label = "identifier"): string {
  if (!IDENTIFIER_RE.test(value)) {
    throw new Error(`Unsafe SQL ${label}: ${value}`);
  }
  return value;
}

function splitSqlStatements(input: string): string[] {
  const statements: string[] = [];
  let start = 0;
  let quote: "'" | "\"" | null = null;
  let lineComment = false;
  let blockComment = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]!;
    const next = input[i + 1];

    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (char === quote) {
        if (next === quote) {
          i += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }
    if (char === "-" && next === "-") {
      lineComment = true;
      i += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      i += 1;
      continue;
    }
    if (char === "'" || char === "\"") {
      quote = char;
      continue;
    }
    if (char === ";") {
      const statement = input.slice(start, i).trim();
      if (statement) statements.push(statement);
      start = i + 1;
    }
  }

  const trailing = input.slice(start).trim();
  if (trailing) statements.push(trailing);
  return statements;
}

function stripSqlForKeywordScan(input: string): string {
  return input
    .replace(/'([^']|'')*'/g, "''")
    .replace(/"([^"]|"")*"/g, "\"\"")
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

function normaliseSql(input: string): string {
  return stripSqlForKeywordScan(input).replace(/\s+/g, " ").trim().toLowerCase();
}

function extractQualifiedRefs(statement: string): SqlRef[] {
  const refs: SqlRef[] = [];
  const patterns: QualifiedRefPattern[] = [
    {
      pattern: /\b(from|join|references|into|update)\s+"?([A-Za-z_][A-Za-z0-9_]*)"?\."?([A-Za-z_][A-Za-z0-9_]*)"?/gi,
      groups: "keyword-schema-table",
    },
    {
      pattern: /\b(alter\s+table|create\s+table|create\s+view|drop\s+table|truncate\s+table)\s+(?:if\s+(?:not\s+)?exists\s+)?"?([A-Za-z_][A-Za-z0-9_]*)"?\."?([A-Za-z_][A-Za-z0-9_]*)"?/gi,
      groups: "keyword-schema-table",
    },
    {
      pattern: /\bcreate\s+(?:unique\s+)?index(?:\s+concurrently)?\s+(?:if\s+not\s+exists\s+)?"?[A-Za-z_][A-Za-z0-9_]*"?\s+on\s+"?([A-Za-z_][A-Za-z0-9_]*)"?\."?([A-Za-z_][A-Za-z0-9_]*)"?/gi,
      groups: "schema-table",
      keyword: "create index",
    },
  ];

  for (const { pattern, ...mapping } of patterns) {
    for (const match of statement.matchAll(pattern)) {
      if (mapping.groups === "keyword-schema-table") {
        refs.push({ keyword: match[1]!.toLowerCase(), schema: match[2]!, table: match[3]! });
      } else {
        refs.push({ keyword: mapping.keyword, schema: match[1]!, table: match[2]! });
      }
    }
  }
  return refs;
}

function assertAllowedPublicRead(
  ref: SqlRef,
  allowedCoreReadTables: ReadonlySet<string>,
): void {
  if (ref.schema !== "public") return;
  if (!allowedCoreReadTables.has(ref.table)) {
    throw new Error(`Plugin SQL references public.${ref.table}, which is not whitelisted`);
  }
  if (!["from", "join", "references"].includes(ref.keyword)) {
    throw new Error(`Plugin SQL cannot mutate or define objects in public.${ref.table}`);
  }
}

function assertNoBannedSql(statement: string): void {
  const normalized = normaliseSql(statement);
  const banned = [
    /\bcreate\s+extension\b/,
    /\bcreate\s+(?:event\s+)?trigger\b/,
    /\bcreate\s+(?:or\s+replace\s+)?function\b/,
    /\bcreate\s+language\b/,
    /\bgrant\b/,
    /\brevoke\b/,
    /\bsecurity\s+definer\b/,
    /\bcopy\b/,
    /\bcall\b/,
    /\bdo\s+(?:\$\$|language\b)/,
  ];
  const matched = banned.find((pattern) => pattern.test(normalized));
  if (matched) {
    throw new Error(`Plugin SQL contains a disallowed statement or clause: ${matched.source}`);
  }
}

export function validatePluginMigrationStatement(
  statement: string,
  namespace: string,
  coreReadTables: readonly PluginDatabaseCoreReadTable[] = [],
): void {
  assertIdentifier(namespace, "namespace");
  assertNoBannedSql(statement);

  const normalized = normaliseSql(statement);
  if (/^\s*(drop|truncate)\b/.test(normalized)) {
    throw new Error("Destructive plugin migrations are not allowed in Phase 1");
  }

  if (/\bdelete\s+from\b/.test(normalized)) {
    throw new Error("Plugin migrations cannot delete data");
  }

  const ddlOrBackfillAllowed =
    /^(create|alter|comment)\b/.test(normalized) ||
    /^(insert\s+into|update)\b/.test(normalized) ||
    (normalized.startsWith("with ") && /\b(insert\s+into|update)\b/.test(normalized));
  if (!ddlOrBackfillAllowed) {
    throw new Error("Plugin migrations may contain DDL or namespace-scoped backfill statements only");
  }

  const refs = extractQualifiedRefs(statement);
  if (refs.length === 0 && !normalized.startsWith("comment ")) {
    throw new Error("Plugin migration objects must use fully qualified schema names");
  }

  const objectRefKeywords = new Set([
    "alter table",
    "create index",
    "create table",
    "create view",
    "drop table",
    "into",
    "truncate table",
    "update",
  ]);
  const hasQualifiedObjectRef = refs.some((ref) => objectRefKeywords.has(ref.keyword));
  if (!hasQualifiedObjectRef && !normalized.startsWith("comment ")) {
    throw new Error("Plugin migration objects must use fully qualified schema names");
  }

  const allowedCoreReadTables = new Set(coreReadTables);
  for (const ref of refs) {
    if (ref.schema === namespace) continue;
    if (ref.schema === "public") {
      assertAllowedPublicRead(ref, allowedCoreReadTables);
      continue;
    }
    throw new Error(`Plugin SQL references schema "${ref.schema}" outside namespace "${namespace}"`);
  }
}

export function validatePluginRuntimeQuery(
  query: string,
  namespace: string,
  coreReadTables: readonly PluginDatabaseCoreReadTable[] = [],
): void {
  const statements = splitSqlStatements(query);
  if (statements.length !== 1) {
    throw new Error("Plugin runtime SQL must contain exactly one statement");
  }
  const statement = statements[0]!;
  assertNoBannedSql(statement);
  const normalized = normaliseSql(statement);
  if (!normalized.startsWith("select ") && !normalized.startsWith("with ")) {
    throw new Error("ctx.db.query only allows SELECT statements");
  }
  if (/\b(insert|update|delete|alter|create|drop|truncate)\b/.test(normalized)) {
    throw new Error("ctx.db.query cannot contain mutation or DDL keywords");
  }

  const allowedCoreReadTables = new Set(coreReadTables);
  for (const ref of extractQualifiedRefs(statement)) {
    if (ref.schema === namespace) continue;
    if (ref.schema === "public") {
      assertAllowedPublicRead(ref, allowedCoreReadTables);
      continue;
    }
    throw new Error(`ctx.db.query cannot read schema "${ref.schema}"`);
  }
}

export function validatePluginRuntimeExecute(query: string, namespace: string): void {
  const statements = splitSqlStatements(query);
  if (statements.length !== 1) {
    throw new Error("Plugin runtime SQL must contain exactly one statement");
  }
  const statement = statements[0]!;
  assertNoBannedSql(statement);
  const normalized = normaliseSql(statement);
  if (!/^(insert\s+into|update|delete\s+from)\b/.test(normalized)) {
    throw new Error("ctx.db.execute only allows INSERT, UPDATE, or DELETE");
  }
  if (/\b(alter|create|drop|truncate)\b/.test(normalized)) {
    throw new Error("ctx.db.execute cannot contain DDL keywords");
  }

  const refs = extractQualifiedRefs(statement);
  const target = refs.find((ref) => ["into", "update", "from"].includes(ref.keyword));
  if (!target || target.schema !== namespace) {
    throw new Error(`ctx.db.execute target must be inside plugin namespace "${namespace}"`);
  }
  for (const ref of refs) {
    if (ref.schema !== namespace) {
      throw new Error("ctx.db.execute cannot reference public or other non-plugin schemas");
    }
  }
}

/** The host's bindSql placeholder rules, rendering each occurrence as its own positional parameter. */
function bindSql(statement: string, params: readonly unknown[] = []): { text: string; values: unknown[] } {
  if (params.length === 0) return { text: statement, values: [] };
  const values: unknown[] = [];
  let text = '';
  let cursor = 0;
  const placeholderPattern = /\$(\d+)/g;
  const seen = new Set<number>();

  for (const match of statement.matchAll(placeholderPattern)) {
    const index = Number(match[1]);
    if (!Number.isInteger(index) || index < 1 || index > params.length) {
      throw new Error(`SQL placeholder $${match[1]} has no matching parameter`);
    }
    text += statement.slice(cursor, match.index) + `$${values.length + 1}`;
    values.push(params[index - 1]);
    seen.add(index);
    cursor = match.index! + match[0].length;
  }
  text += statement.slice(cursor);
  if (seen.size !== params.length) {
    throw new Error("Every ctx.db parameter must be referenced by a $n placeholder");
  }
  return { text, values };
}

/** Params cross the worker RPC as JSON; Drizzle would expand arrays and has no binding for objects. */
function overRpc(params: readonly unknown[] | undefined): unknown[] {
  const wire = JSON.parse(JSON.stringify(params ?? [])) as unknown[];
  for (const [index, value] of wire.entries()) {
    if (value !== null && typeof value === 'object') {
      throw new Error(`ctx.db parameter $${index + 1} is an array or object, which the host cannot bind`);
    }
  }
  return wire;
}

export interface HostDb {
  /** The client to hand to plugin code. */
  db: PluginDatabaseClient;
  /** Raw PGlite for test seeding and inspection; never hand it to plugin code. */
  pg: PGlite;
  /** Split a migration file and apply each statement through the host migration validator. */
  applyMigration(sql: string): Promise<void>;
  /** Make the next statement matching pattern fail as a host error would, `times` times. */
  failWhen(pattern: RegExp, times?: number): void;
  close(): Promise<void>;
}

export const migration007 = new URL('../../migrations/007_objective_intake.sql', import.meta.url);
export const migration009 = new URL('../../migrations/009_org_profile.sql', import.meta.url);

/** A host-boundary database with the plugin namespace and the given migration files applied. */
export async function createHostDb(migrations: URL[] = [migration007, migration009]): Promise<HostDb> {
  // postgres-js (the host driver) returns int8 as a string; PGlite would return a number.
  const pg = new PGlite({ parsers: { 20: (value: string) => value } });
  await pg.exec(`CREATE SCHEMA IF NOT EXISTS "${BRIDGE_NAMESPACE}"`);
  const failures: Array<{ pattern: RegExp; times: number }> = [];

  function injected(sql: string): void {
    const failure = failures.find(f => f.times > 0 && f.pattern.test(sql));
    if (failure) {
      failure.times -= 1;
      throw new Error('Injected host database failure.');
    }
  }

  async function run(sql: string, params: unknown[] | undefined) {
    const bound = bindSql(sql, overRpc(params));
    injected(sql);
    return pg.query(bound.text, bound.values);
  }

  const db: PluginDatabaseClient = {
    namespace: BRIDGE_NAMESPACE,
    async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
      validatePluginRuntimeQuery(sql, BRIDGE_NAMESPACE);
      const result = await run(sql, params);
      return JSON.parse(JSON.stringify(result.rows)) as T[];
    },
    async execute(sql: string, params?: unknown[]): Promise<{ rowCount: number }> {
      validatePluginRuntimeExecute(sql, BRIDGE_NAMESPACE);
      const result = await run(sql, params);
      return { rowCount: result.affectedRows ?? 0 };
    }
  };

  async function applyMigration(sql: string): Promise<void> {
    for (const statement of splitSqlStatements(sql)) {
      validatePluginMigrationStatement(statement, BRIDGE_NAMESPACE);
      await pg.exec(statement);
    }
  }

  for (const file of migrations) {
    await applyMigration(await readFile(file, 'utf8'));
  }

  return {
    db,
    pg,
    applyMigration,
    failWhen(pattern: RegExp, times = 1) {
      failures.push({ pattern, times });
    },
    close: () => pg.close()
  };
}
