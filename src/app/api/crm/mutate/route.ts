import { z } from 'zod';
import { handler, ok, readJson, clientIp } from '@/lib/server/http';
import { requireStaff, ROLES } from '@/lib/server/auth/staff-session';
import { applySyncOp, SyncOp } from '@/lib/server/crm-sync';

export const dynamic = 'force-dynamic';

const Body = z.object({
  ops: z
    .array(
      z.object({
        collection: z.enum([
          'crmBookings', 'physicalRooms', 'folios', 'foodOrders', 'dispatchRequests', 'housekeepingTasks',
          'expenses', 'menuItems', 'transferRoutes', 'rentalVehicles', 'activityLogs', 'staffAlerts',
        ]),
        op: z.enum(['upsert', 'delete']),
        id: z.string().min(1).max(200),
        record: z.record(z.unknown()).optional(),
      })
    )
    .min(1)
    .max(50),
});

/** Staff: apply CRM changes record by record (permission-checked, audited). */
export const POST = handler('crm.mutate', async (request: Request) => {
  const staff = await requireStaff(request, ROLES.ALL);
  const { ops } = await readJson(request, Body);
  const ip = clientIp(request);
  const results = [];
  for (const op of ops) {
    results.push(await applySyncOp(op as SyncOp, staff, ip));
  }
  return ok({ results });
});
