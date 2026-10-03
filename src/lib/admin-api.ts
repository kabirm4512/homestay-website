'use client';

/**
 * Client helper for staff-only API writes. The staff session is an httpOnly cookie set
 * at sign-in, so requests only need to be same-origin; a 401 means the session ended.
 */

export interface AdminPostResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
}

export async function adminRequestJson<T = unknown>(
  url: string,
  options: { method?: 'POST' | 'DELETE' | 'PATCH' | 'PUT'; body?: unknown } = {}
): Promise<AdminPostResult<T>> {
  try {
    const res = await fetch(url, {
      method: options.method || 'POST',
      headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      credentials: 'same-origin',
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(65_000),
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.success) return { ok: true, status: res.status, data: json as T };
    const fallback =
      res.status === 401
        ? 'Your session has ended. Please sign in again; the change was not saved.'
        : res.status === 403
        ? 'Your account does not have permission for this change.'
        : res.status === 413
        ? 'The request is too large (photos too big). Use smaller photos and try again.'
        : `Request failed (${res.status})`;
    return { ok: false, status: res.status, data: json as T, error: json?.error || fallback };
  } catch {
    return { ok: false, status: 0, data: null, error: 'Could not reach the server (or it took too long). The change may not be saved; please try again.' };
  }
}

/** POSTs JSON to a staff endpoint. */
export async function adminPostJson<T = unknown>(url: string, body: unknown): Promise<AdminPostResult<T>> {
  return adminRequestJson<T>(url, { method: 'POST', body });
}
