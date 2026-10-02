import { NextResponse } from 'next/server';
import { ZodError, ZodSchema } from 'zod';
import { log } from './logger';
import { DatabaseNotConfiguredError } from './db';

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

/** Wraps a route handler: maps HttpError to its status, logs everything else as 500. */
export function handler<A extends unknown[]>(name: string, fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // Never leave a request hanging: answer 503 after 25 s so the screen can recover.
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new HttpError(503, 'The server is taking too long. Please try again.', 'TIMEOUT')), 25000);
      });
      return await Promise.race([fn(...args), timeout]);
    } catch (err) {
      if (err instanceof HttpError && err.code === 'TIMEOUT') log.error(`${name}.timeout`, err);
      if (err instanceof HttpError) return fail(err.status, err.message, err.code);
      if (err instanceof DatabaseNotConfiguredError) {
        log.error(`${name}.db_not_configured`, err);
        return fail(503, 'The service is not configured yet. Please try again later.', 'NOT_CONFIGURED');
      }
      log.error(`${name}.failed`, err);
      return fail(500, 'Something went wrong. Please try again.');
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
}

export function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for') || '';
  return (fwd.split(',')[0] || request.headers.get('x-real-ip') || 'unknown').trim();
}
