import { getSql } from './db';
import { HttpError, clientIp } from './http';

/**
 * Fixed-window rate limit stored in Postgres, so it holds across serverless instances.
 * Throws HttpError(429) when the limit is exceeded.
 */
export async function rateLimit(request: Request, bucket: string, limit: number, windowSeconds: number, extraKey = ''): Promise<void> {
  if (process.env.DISABLE_RATE_LIMIT === '1') return;
  const key = `${bucket}:${clientIp(request)}${extraKey ? `:${extraKey}` : ''}`;
  const sql = getSql();
  const rows = await sql<{ count: number }[]>`
    insert into pms.rate_limits as rl (key, window_start, count)
    values (${key}, now(), 1)
    on conflict (key) do update set
      count = case when rl.window_start < now() - make_interval(secs => ${windowSeconds}) then 1 else rl.count + 1 end,
      window_start = case when rl.window_start < now() - make_interval(secs => ${windowSeconds}) then now() else rl.window_start end
    returning count`;
  if ((rows[0]?.count ?? 0) > limit) {
    throw new HttpError(429, 'Too many attempts. Please wait a few minutes and try again.', 'RATE_LIMITED');
  }
}
