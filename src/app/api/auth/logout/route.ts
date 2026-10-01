import { NextResponse } from 'next/server';
import { NO_STORE } from '@/lib/server/http';
import { clearStaffSession } from '@/lib/server/auth/staff-session';

export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({ success: true }, { headers: NO_STORE });
  clearStaffSession(response);
  return response;
}
