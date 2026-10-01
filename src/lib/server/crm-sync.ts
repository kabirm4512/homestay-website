import type {
  CRMBooking,
  FoodOrder,
  GuestFolio,
  PhysicalRoom,
  StaffRole,
} from '@/types/crm';
import { HttpError } from './http';
import { audit } from './audit';
import type { StaffContext } from './auth/staff-session';
import { RecordCollection, isRecordCollection, getRecord, upsertRecord, deleteRecord, listRecords } from './repos/records';
import { upsertCrmBooking, getCrmBooking, deleteBooking, listCrmBookings } from './repos/bookings';
import { upsertPhysicalRoom, deletePhysicalRoom, findPhysicalRoom, listPhysicalRooms } from './repos/physical-rooms';
import { getGstConfig, getTariffData } from './repos/settings';
import { recalculateFolioTotals } from '@/lib/folio';
import { addCalendarDays, todayInIST } from '@/lib/tariff-calculator';
import { lastClosedDate } from './day-close';

/**
 * Server side of the CRM's data sync. The browser sends upserts/deletes per record;
 * every op is permission-checked by role, normalised (e.g. folio totals recomputed,
 * ID images moved to private storage) and written as its own row, so devices never
 * overwrite each other's work. Every write lands in the audit log.
 */

export type SyncCollection = RecordCollection | 'crmBookings' | 'physicalRooms';

export interface SyncOp {
  collection: SyncCollection;
  op: 'upsert' | 'delete';
  id: string;
  record?: Record<string, unknown>;
}

export interface SyncResult {
  collection: SyncCollection;
  id: string;
  ok: boolean;
  record?: unknown;
  deleted?: boolean;
  error?: string;
}

const MANAGER_WRITE: SyncCollection[] = [
  'crmBookings', 'physicalRooms', 'folios', 'foodOrders', 'dispatchRequests', 'housekeepingTasks',
  'expenses', 'menuItems', 'transferRoutes', 'rentalVehicles', 'activityLogs', 'staffAlerts',
];
const KITCHEN_WRITE: SyncCollection[] = ['foodOrders', 'menuItems', 'staffAlerts'];
const ADMIN_ONLY_DELETE: SyncCollection[] = ['crmBookings', 'physicalRooms', 'expenses', 'folios', 'activityLogs'];

function canWrite(role: StaffRole, c: SyncCollection, op: 'upsert' | 'delete'): boolean {
  if (role === 'admin') return true;
  if (op === 'delete' && ADMIN_ONLY_DELETE.includes(c)) return false;
  if (role === 'manager') return MANAGER_WRITE.includes(c);
  if (role === 'kitchen_staff') return op === 'upsert' && KITCHEN_WRITE.includes(c);
  return false;
}

export function readableCollections(role: StaffRole): SyncCollection[] {
  if (role === 'kitchen_staff') return ['foodOrders', 'menuItems', 'physicalRooms', 'staffAlerts'];
  const all: SyncCollection[] = [
    'crmBookings', 'physicalRooms', 'folios', 'foodOrders', 'dispatchRequests', 'housekeepingTasks',
    'menuItems', 'transferRoutes', 'rentalVehicles', 'activityLogs', 'staffAlerts',
  ];
  return role === 'admin' ? [...all, 'expenses'] : all;
}

/** Folio rules: non-admins can add payments but not change or remove existing ones, and can only void charges. */
function checkFolioChange(before: GuestFolio | null, after: GuestFolio, role: StaffRole) {
  if (!before || role === 'admin') return;
  for (const p of before.payments || []) {
    const now = (after.payments || []).find((x) => x.id === p.id);
    if (!now || now.amount !== p.amount || now.paymentMethod !== p.paymentMethod) {
      throw new HttpError(403, 'Recorded payments cannot be changed or removed. Ask an admin to make a correction.', 'LEDGER_LOCKED');
    }
  }
  for (const c of before.charges || []) {
    const now = (after.charges || []).find((x) => x.id === c.id);
    if (!now) throw new HttpError(403, 'Charges cannot be deleted; void them instead.', 'LEDGER_LOCKED');
    if (c.chargeStatus !== 'void' && now.chargeStatus !== 'void' && now.amount !== c.amount) {
      throw new HttpError(403, 'Posted charge amounts cannot be edited; void and re-post instead.', 'LEDGER_LOCKED');
    }
  }
}

/** Kitchen accounts may only change one field per collection; everything else is kept from the stored record. */
function kitchenMerge(collection: SyncCollection, before: Record<string, unknown> | null, after: Record<string, unknown>) {
  if (!before) throw new HttpError(403, 'Kitchen accounts can only update existing items.', 'FORBIDDEN');
  const field = collection === 'foodOrders' ? 'status' : collection === 'menuItems' ? 'isAvailable' : 'acknowledged';
  if (collection === 'foodOrders' && ['accepted_kitchen', 'cancelled', 'pending_manager_approval'].includes(String(after.status)) && after.status !== before.status) {
    throw new HttpError(403, 'Only managers can approve or cancel orders.', 'FORBIDDEN');
  }
  return { ...before, [field]: after[field] } as Record<string, unknown> & { id: string };
}

export async function applySyncOp(op: SyncOp, staff: StaffContext, ip?: string): Promise<SyncResult> {
  const base = { collection: op.collection, id: op.id };
  try {
    if (!op.id || typeof op.id !== 'string') throw new HttpError(400, 'Record id is required.');
    if (!canWrite(staff.role, op.collection, op.op)) {
      throw new HttpError(403, 'Your account does not have permission for this change.', 'FORBIDDEN');
    }
    const actor = `staff:${staff.id}`;

    if (op.collection === 'crmBookings') {
      if (op.op === 'delete') {
        const before = await getCrmBooking(op.id);
        await deleteBooking(op.id);
        await audit({ actor, action: 'delete', entity: 'booking', entityId: op.id, before, ip });
        return { ...base, ok: true, deleted: true };
      }
      const record = op.record as unknown as CRMBooking;
      if (!record || record.id !== op.id) throw new HttpError(400, 'Record id mismatch.');
      const { before, after } = await upsertCrmBooking(record, actor);
      await audit({ actor, action: before ? 'update' : 'create', entity: 'booking', entityId: op.id, before, after, ip });
      return { ...base, ok: true, record: after };
    }

    if (op.collection === 'physicalRooms') {
      if (op.op === 'delete') {
        const before = await deletePhysicalRoom(op.id);
        await audit({ actor, action: 'delete', entity: 'physical_room', entityId: op.id, before, ip });
        return { ...base, ok: true, deleted: true };
      }
      const record = op.record as unknown as PhysicalRoom;
      if (!record || record.id !== op.id || typeof record.roomNumber !== 'number') throw new HttpError(400, 'Invalid room record.');
      const existing = await findPhysicalRoom({ id: op.id });
      if (!existing && staff.role !== 'admin') throw new HttpError(403, 'Only admins can add rooms.', 'FORBIDDEN');
      const { before, after } = await upsertPhysicalRoom(record);
      await audit({ actor, action: before ? 'update' : 'create', entity: 'physical_room', entityId: op.id, before, after, ip });
      return { ...base, ok: true, record: after };
    }

    if (!isRecordCollection(op.collection)) throw new HttpError(400, 'Unknown collection.');
    const collection = op.collection;

    if (op.op === 'delete') {
      const before = await getRecord(collection, op.id);
      await deleteRecord(collection, op.id);
      await audit({ actor, action: 'delete', entity: collection, entityId: op.id, before, ip });
      return { ...base, ok: true, deleted: true };
    }

    let record = op.record as Record<string, unknown> & { id: string };
    if (!record || record.id !== op.id) throw new HttpError(400, 'Record id mismatch.');
    const before = await getRecord<Record<string, unknown>>(collection, op.id);

    if (staff.role === 'kitchen_staff') record = kitchenMerge(collection, before, record);
    if (collection === 'activityLogs' && before && staff.role !== 'admin') {
      throw new HttpError(403, 'Activity log entries cannot be edited.', 'LEDGER_LOCKED');
    }
    if (collection === 'expenses' && before && staff.role !== 'admin') {
      throw new HttpError(403, 'Only admins can edit recorded expenses.', 'LEDGER_LOCKED');
    }
    if (collection === 'foodOrders' && !before && staff.role !== 'admin') {
      throw new HttpError(400, 'New orders must be placed through the ordering screen.', 'USE_ORDER_API');
    }
    if (collection === 'folios') {
      const folio = record as unknown as GuestFolio;
      checkFolioChange(before as unknown as GuestFolio | null, folio, staff.role);
      // Totals are always recomputed on the server (GST included); stamp who posted what.
      const gst = await getGstConfig();
      const charges = (folio.charges || []).map((c) => (c.postedByName ? c : { ...c, postedByName: staff.fullName }));
      const payments = (folio.payments || []).map((p) =>
        p.collectedById ? p : { ...p, collectedById: staff.id, collectedByName: p.collectedByName || staff.fullName }
      );
      record = recalculateFolioTotals(folio, charges, payments, gst) as unknown as typeof record;
    }
    if (collection === 'expenses' && !before) {
      const closedUpTo = staff.role === 'admin' ? null : await lastClosedDate();
      if (closedUpTo && typeof record.expenseDate === 'string' && record.expenseDate <= closedUpTo) {
        throw new HttpError(403, `The books are closed up to ${closedUpTo}. Ask an admin to record this expense.`, 'DAY_CLOSED');
      }
      record = { ...record, loggedByName: (record.loggedByName as string) || staff.fullName, loggedById: staff.id };
    }

    await upsertRecord(collection, record, actor);
    await audit({ actor, action: before ? 'update' : 'create', entity: collection, entityId: op.id, before, after: record, ip });
    if ((collection === 'foodOrders' || collection === 'dispatchRequests') && before) {
      await syncLinkedFolioCharge(collection, before, record, actor);
    }
    return { ...base, ok: true, record };
  } catch (err) {
    if (err instanceof HttpError) return { ...base, ok: false, error: err.message };
    throw err;
  }
}

/**
 * When an order or transport request changes status, its folio charge follows on the
 * server: confirmed → posted, cancelled → void. (So kitchen staff, who cannot edit
 * folios, still keep bills correct.)
 */
async function syncLinkedFolioCharge(
  collection: 'foodOrders' | 'dispatchRequests',
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  actor: string
) {
  const statusKey = collection === 'foodOrders' ? 'status' : 'dispatchStatus';
  if (before[statusKey] === after[statusKey]) return;
  const status = String(after[statusKey]);
  const posted = ['accepted_kitchen', 'preparing', 'out_for_delivery', 'delivered', 'confirmed_dispatched', 'in_transit', 'completed'];
  const target = status === 'cancelled' ? 'void' : posted.includes(status) ? 'posted' : null;
  if (!target) return;
  const folioId = after.folioId as string | undefined;
  const folios = folioId ? [await getRecord<GuestFolio>('folios', folioId)].filter(Boolean) as GuestFolio[] : [];
  for (const folio of folios) {
    if (!folio.charges.some((c) => c.sourceReferenceId === after.id && c.chargeStatus !== target)) continue;
    const charges = folio.charges.map((c) => (c.sourceReferenceId === after.id ? { ...c, chargeStatus: target as 'posted' | 'void' } : c));
    const gst = await getGstConfig();
    await upsertRecord('folios', recalculateFolioTotals(folio, charges, folio.payments, gst), actor);
  }
}

/** The CRM working set for a role (recent and upcoming data; older history stays in the database). */
export async function loadCrmState(staff: StaffContext) {
  const readable = readableCollections(staff.role);
  const since = addCalendarDays(todayInIST(), -120);
  const state: Record<string, unknown> = {};

  const tasks: Promise<void>[] = [];
  if (readable.includes('crmBookings')) {
    tasks.push(
      listCrmBookings().then((list) => {
        state.crmBookings = list.filter((b) => b.checkOutDate >= since || b.bookingStatus === 'checked_in');
      })
    );
  }
  if (readable.includes('physicalRooms')) {
    tasks.push(
      listPhysicalRooms().then((list) => {
        state.physicalRooms = staff.role === 'kitchen_staff' ? list.map((r) => ({ ...r, qrSecretToken: '' })) : list;
      })
    );
  }
  const recordLimits: Partial<Record<RecordCollection, number>> = {
    folios: 2000,
    foodOrders: 1500,
    dispatchRequests: 1000,
    housekeepingTasks: 500,
    expenses: 5000,
    activityLogs: 200,
    staffAlerts: 100,
  };
  for (const c of readable) {
    if (c === 'crmBookings' || c === 'physicalRooms') continue;
    tasks.push(
      listRecords(c as RecordCollection, { limit: recordLimits[c as RecordCollection] }).then((list) => {
        state[c] = list;
      })
    );
  }
  tasks.push(
    getTariffData().then((t) => {
      state.tariffs = t.tariffs;
      state.seasonalDateRanges = t.seasonalDateRanges;
    })
  );
  await Promise.all(tasks);

  if (staff.role === 'kitchen_staff' && Array.isArray(state.foodOrders)) {
    // Kitchen sees orders, not guest phone numbers or folio links
    state.foodOrders = (state.foodOrders as FoodOrder[]).map((o) => ({ ...o, folioId: '' }));
  }
  return state;
}
