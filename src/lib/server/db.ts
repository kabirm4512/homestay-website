import postgres from 'postgres';

/**
 * Postgres connection (Supabase in production).
 *
 * DATABASE_URL should be the Supabase "Transaction pooler" connection string
 * (port 6543) on Vercel. Prepared statements are disabled because the pooler runs
 * in transaction mode. A few connections per serverless instance (a transaction holds one while helpers may need another).
 */

type Sql = ReturnType<typeof postgres>;

declare global {
  // eslint-disable-next-line no-var
  var __saveraSql: Sql | undefined;
}

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super('DATABASE_URL (or POSTGRES_URL) is not configured. See docs/SETUP.md.');
    this.name = 'DatabaseNotConfiguredError';
  }
}

function needsSsl(url: string): boolean {
  if (/sslmode=disable/i.test(url)) return false;
  if (/sslmode=require/i.test(url)) return true;
  return !/@(localhost|127\.0\.0\.1|db|postgres)(:|\/)/i.test(url);
}

/**
 * The connection string: DATABASE_URL, or POSTGRES_URL as set by the Vercel ↔ Supabase
 * integration. Query parameters other than sslmode (e.g. the integration's `supa=` and
 * `pgbouncer=` hints) are removed: postgres.js would send them to the server as settings.
 */
export function databaseUrl(): string | null {
  const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const sslmode = u.searchParams.get('sslmode');
    u.search = sslmode ? `?sslmode=${sslmode}` : '';
    return u.toString();
  } catch {
    return raw;
  }
}

export function getSql(): Sql {
  if (globalThis.__saveraSql) return globalThis.__saveraSql;
  const url = databaseUrl();
  if (!url) throw new DatabaseNotConfiguredError();
  const sql = postgres(url, {
    prepare: false,
    max: Number(process.env.DATABASE_POOL_MAX || 5),
    // Keep connections warm between requests: opening one costs several round trips
    // (TCP + TLS + auth). Recycle them every few minutes so none goes stale.
    idle_timeout: 30,
    max_lifetime: 60 * 5,
    connect_timeout: 10,
    ssl: needsSsl(url) ? 'require' : false,
    onnotice: () => {},
    transform: { undefined: null },
  });
  globalThis.__saveraSql = sql;
  return sql;
}

export type Tx = postgres.TransactionSql;
export type SqlOrTx = Sql | Tx;

/** Runs fn inside a transaction. */
export async function withTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const sql = getSql();
  return sql.begin(async (tx) => fn(tx)) as Promise<T>;
}

/** Serialises inventory-changing operations (7-room property: one global lock is plenty). */
export async function lockInventory(tx: Tx): Promise<void> {
  await tx`select pg_advisory_xact_lock(7311001)`;
}
