import { handler, ok } from '@/lib/server/http';
import { requireStaff, ROLES } from '@/lib/server/auth/staff-session';
import { loadCrmState } from '@/lib/server/crm-sync';

export const dynamic = 'force-dynamic';

/** Staff: the CRM working set for the signed-in role. */
export const GET = handler('crm.state', async (request: Request) => {
  const staff = await requireStaff(request, ROLES.ALL);
  return ok({ state: await loadCrmState(staff), serverTime: new Date().toISOString() });
});
