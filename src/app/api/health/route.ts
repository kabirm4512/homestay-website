import { handler, ok, fail } from '@/lib/server/http';
import { getSql } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

/** Uptime check: app + database reachable and migrated. */
export const GET = handler('health', async () => {
  const sql = getSql();
  const started = Date.now();
  try {
    await sql`select 1 from pms.settings limit 1`;
  } catch {
    return fail(503, 'Database not reachable or not migrated');
  }
  const dbMs = Date.now() - started;
  return ok({ status: 'ok', dbMs, region: process.env.VERCEL_REGION || null, time: new Date().toISOString() });
});
