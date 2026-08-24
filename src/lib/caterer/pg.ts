// Postgres connection for the CMS store.
//
// Asked in three places — the content store, the uploader and the image route —
// which must all agree, for the same reason ./blob spells out: a disagreement
// means content written to one backend and read from another.
//
// Why Postgres at all, with a Blob backend already here: Vercel's Hobby plan
// meters Blob by operations, and this store is operation-hungry by design — one
// blob per record, read uncached so a save is visible immediately. That ran the
// account's monthly Blob allowance out in a week and the store was suspended,
// which took every content route down with it. The same records as rows are a
// rounding error against a free Postgres tier: the whole catalogue is well under
// a megabyte, and a read is a query rather than a metered object fetch.
import "server-only";
import { Pool, type QueryResultRow } from "pg";

// Vercel's Neon integration sets DATABASE_URL; POSTGRES_URL is what its older
// Postgres integration used, and is still what some projects carry.
export function postgresUrl(): string | undefined {
  const url = process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();
  return url || undefined;
}

export function isPostgresConfigured(): boolean {
  return Boolean(postgresUrl());
}

// Which schema the two tables live in.
//
// One free Postgres instance is often shared by several sites — this one came
// out of a database attached to a different project — and two deployments of
// this same codebase would otherwise both want `caterer_shard` in `public` and
// silently serve each other's content. A schema per site keeps them apart, and
// costs nothing when a database is not shared.
//
// Change it only with data in mind: pointing a live deployment at a different
// schema does not move its records, it hides them behind an empty store that
// then seeds itself.
const DEFAULT_SCHEMA = "caterer_cms";

// Interpolated into DDL, so it is checked rather than trusted: lowercase ASCII
// identifier, which is also the only form that survives Postgres folding an
// unquoted name.
const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/;

export function pgSchema(): string {
  const configured = process.env.CATERER_PG_SCHEMA?.trim().toLowerCase();
  if (!configured) return DEFAULT_SCHEMA;
  if (!SAFE_IDENTIFIER.test(configured)) {
    throw new Error(
      `CATERER_PG_SCHEMA must be a lowercase identifier (letters, digits, underscore), got: ${configured}`
    );
  }
  return configured;
}

export function shardTable(): string {
  return `${pgSchema()}.caterer_shard`;
}

export function uploadTable(): string {
  return `${pgSchema()}.caterer_upload`;
}

// One pool per instance, created on first use rather than at module load: the
// backend picker has the same rule, and a module evaluated before the platform
// has injected the environment would otherwise pin the wrong connection — or
// none — for the life of the instance.
//
// `max: 1` because the instance is a single serverless invocation handling one
// request at a time; more sockets per instance only spends the database's
// connection budget faster. Neon's pooled endpoint fans out on its side.
let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;
  const connectionString = postgresUrl();
  if (!connectionString) {
    throw new Error(
      "Postgres is not configured: set DATABASE_URL (or POSTGRES_URL)."
    );
  }
  pool = new Pool({
    connectionString,
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  // Without a listener, a socket dropped while idle (Neon suspends an idle
  // database) reaches the process as an unhandled 'error' event and takes it
  // down. The pool discards the client either way; the next query dials again.
  pool.on("error", (err) => {
    console.error("[caterer] idle Postgres client error:", err.message);
  });
  return pool;
}

// The two tables the CMS needs, created on demand so a fresh database needs no
// migration step before it can serve. Both are addressed by the same relative
// paths the fs and blob backends use, so nothing above the storage layer can
// tell which one is carrying it.
//
// Ensured once per instance and memoised as the promise, not the result, so
// concurrent first requests wait on one round trip instead of racing to create
// the same tables.
let schemaReady: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  return (schemaReady ??= (async () => {
    try {
      const schema = pgSchema();
      await getPool().query(`
        CREATE SCHEMA IF NOT EXISTS ${schema};
        CREATE TABLE IF NOT EXISTS ${schema}.caterer_shard (
          path       text PRIMARY KEY,
          content    text NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS ${schema}.caterer_upload (
          name         text PRIMARY KEY,
          content_type text NOT NULL,
          bytes        bytea NOT NULL,
          created_at   timestamptz NOT NULL DEFAULT now()
        );
      `);
    } catch (err) {
      // A failed bootstrap must not be remembered as done — the next request
      // has to be able to try again.
      schemaReady = null;
      throw err;
    }
  })());
}

export async function pgQuery<T extends QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  await ensureSchema();
  const result = await getPool().query<T>(sql, params);
  return result.rows;
}
