import crypto from 'crypto';
import { HttpError } from '../http';

/**
 * HMAC-signed, expiring tokens for httpOnly session cookies.
 * Secret: SESSION_SECRET (required in production, at least 32 characters).
 */

let warnedDevSecret = false;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET || '';
  if (secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_INSECURE_DEV_SECRET) {
    throw new HttpError(503, 'Sign-in is not configured on the server (SESSION_SECRET missing).', 'NOT_CONFIGURED');
  }
  if (!warnedDevSecret) {
    warnedDevSecret = true;
    console.warn('[auth] SESSION_SECRET is not set; using an insecure development secret.');
  }
  return 'insecure-development-session-secret-do-not-use-in-production';
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export function createToken(claims: Record<string, unknown>, ttlSeconds: number): string {
  const payload = Buffer.from(JSON.stringify({ ...claims, exp: Date.now() + ttlSeconds * 1000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifyToken<T extends Record<string, unknown>>(token: string | null | undefined): (T & { exp: number }) | null {
  if (!token || typeof token !== 'string') return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return null;
  }
  if (!safeEqual(signature, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (typeof claims?.exp !== 'number' || claims.exp <= Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}
