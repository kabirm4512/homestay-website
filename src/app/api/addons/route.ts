import { handler, ok } from '@/lib/server/http';
import { listRecords } from '@/lib/server/repos/records';
import type { MenuItem, RentalVehicle, TransferRoute } from '@/types/crm';

export const dynamic = 'force-dynamic';

/**
 * Public catalogue: in-room dining menu, transfer routes and rental vehicles.
 * (Staff edit these through the CRM; see /api/crm/mutate.)
 */
export const GET = handler('addons.get', async () => {
  const [menuItems, transferRoutes, rentalVehicles] = await Promise.all([
    listRecords<MenuItem>('menuItems'),
    listRecords<TransferRoute>('transferRoutes'),
    listRecords<RentalVehicle>('rentalVehicles'),
  ]);
  return ok({
    data: {
      menuItems,
      transferRoutes: transferRoutes.filter((r) => r.isActive !== false),
      rentalVehicles,
    },
  });
});
