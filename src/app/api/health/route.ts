import { handler, ok, fail } from '@/lib/server/http';
import { getSql } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

/** Uptime check: app + database reachable and migrated. */
export const GET = handler('health', async () => {
  const sql = getSql();
  const [row] = await sql<{ ok: boolean }[]>`select to_regclass('pms.settings') is not null as ok`;
  if (!row?.ok) return fail(503, 'Database not migrated');
  return ok({ status: 'ok', time: new Date().toISOString() });
});
