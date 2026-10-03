import { NextResponse } from 'next/server';
import { ZodError, ZodSchema } from 'zod';
import { log } from './logger';
import { DatabaseNotConfiguredError, ensureHealthyPool, markPoolHealthy, resetSql } from './db';

export const NO_STORE = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' };

/** An error whose message is safe to show to the client. */
export class HttpError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Public, shared data: the CDN may serve it for a few seconds, then refreshes in the background. */
export const PUBLIC_SHORT_CACHE = { 'Cache-Control': 'public, max-age=0, s-maxage=10, stale-while-revalidate=60' };

export function ok(body: Record<string, unknown>, init: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json({ success: true, ...body }, { status: init.status || 200, headers: { ...NO_STORE, ...(init.headers || {}) } });
}

export function fail(status: number, error: string, code?: string) {
  return NextResponse.json({ success: false, error, ...(code ? { code } : {}) }, { status, headers: NO_STORE });
}

/** Parses and validates a JSON body. Throws HttpError(400) with a readable message. */
export async function readJson<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  const raw = await request.json().catch(() => {
    throw new HttpError(400, 'Request body must be valid JSON.');
  });
  return parseWith(schema, raw);
}

export function parseWith<T>(schema: ZodSchema<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new HttpError(400, formatZodError(result.error), 'VALIDATION_FAILED');
  }
  return result.data;
}

function formatZodError(err: ZodError): string {
  const first = err.issues[0];
  if (!first) return 'Invalid request.';
  const path = first.path.length ? `${first.path.join('.')}: ` : '';
  return `Invalid request. ${path}${first.message}`;
}

class RequestTimeout extends Error {}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RequestTimeout()), ms);
  });
  return Promise.race([work, timeout]).finally(() => timer && clearTimeout(timer));
}

export interface HandlerOptions {
  /** Time limit for one attempt (default: 10 s for reads, 25 s for writes). */
  timeoutMs?: number;
}

/**
 * Wraps a route handler: maps HttpError to its status, logs everything else as 500, and
 * never lets a request hang. Before work it checks a possibly stale database pool; a read
 * that still times out gets a fresh pool and one retry; a write that times out gets a
 * fresh pool and a 503 so the next attempt works (writes are never retried automatically).
 */
export function handler<A extends unknown[]>(name: string, fn: (...args: A) => Promise<Response>, options: HandlerOptions = {}) {
  return async (...args: A): Promise<Response> => {
    const request = args[0] instanceof Request ? args[0] : null;
    const isRead = !request || request.method === 'GET' || request.method === 'HEAD';
    const limit = options.timeoutMs ?? (isRead ? 10_000 : 25_000);
    try {
      await ensureHealthyPool();
      let response: Response;
      try {
        response = await withTimeout(fn(...args), limit);
      } catch (err) {
        if (!(err instanceof RequestTimeout)) throw err;
        log.error(`${name}.timeout`, err);
        resetSql();
        if (!isRead) throw new HttpError(503, 'The server took too long. Nothing may have been saved; please try again.', 'TIMEOUT');
        response = await withTimeout(fn(...args), limit);
      }
      markPoolHealthy();
      return response;
    } catch (err) {
      if (err instanceof RequestTimeout) {
        resetSql();
        return fail(503, 'The server is taking too long. Please try again.', 'TIMEOUT');
      }
      if (err instanceof HttpError) return fail(err.status, err.message, err.code);
      if (err instanceof DatabaseNotConfiguredError) {
        log.error(`${name}.db_not_configured`, err);
        return fail(503, 'The service is not configured yet. Please try again later.', 'NOT_CONFIGURED');
      }
      log.error(`${name}.failed`, err);
      return fail(500, 'Something went wrong. Please try again.');
    }
  };
}

export function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for') || '';
  return (fwd.split(',')[0] || request.headers.get('x-real-ip') || 'unknown').trim();
}
