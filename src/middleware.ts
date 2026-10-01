import { NextResponse, type NextRequest } from 'next/server';

/**
 * Defence in depth for the JSON API: a state-changing request must come from this site.
 * (Session cookies are SameSite=Lax as well.) Requests without an Origin header, such as
 * server-to-server calls and scripts, are allowed and still need a valid session.
 */
export function middleware(request: NextRequest) {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return NextResponse.next();
  const origin = request.headers.get('origin');
  if (!origin) return NextResponse.next();
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  let originHost = '';
  try {
    originHost = new URL(origin).host;
  } catch {}
  if (!host || originHost !== host) {
    return NextResponse.json({ success: false, error: 'Cross-site request blocked.', code: 'BAD_ORIGIN' }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = { matcher: '/api/:path*' };
