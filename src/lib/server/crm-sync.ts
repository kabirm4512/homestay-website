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
import { RecordCollection, isRecordCollection, getRecord, upsertRecord, deleteRecord, listRecords, listRecordsMany } from './repos/records';
import { upsertCrmBooking, getCrmBooking, deleteBooking, listCrmBookings } from './repos/bookings';
import { upsertPhysicalRoom, deletePhysicalRoom, findPhysicalRoom, listPhysicalRooms } from './repos/physical-rooms';
import { getTariffData } from './repos/settings';
import { addCalendarDays, isCalendarDate, todayInIST } from '@/lib/tariff-calculator';
import { saveFolioFromDevice, setLinkedChargeStatus } from './folio-store';
import { createExpense, reviewExpense } from './expenses';
import { ensureGstModeApplied } from './gst-sweep';
import { createRoomHold, releaseRoomHold } from './tape-actions';
import type { Expense, RoomBlock } from '@/types/crm';

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
  'expenses', 'menuItems', 'transferRoutes', 'rentalVehicles', 'activityLogs', 'staffAlerts', 'roomBlocks',
];
const KITCHEN_WRITE: SyncCollection[] = ['foodOrders', 'menuItems', 'staffAlerts'];
const ADMIN_ONLY_DELETE: SyncCollection[] = ['crmBookings', 'physicalRooms', 'expenses', 'folios', 'activityLogs'];

function canWrite(role: StaffRole, c: SyncCollection, op: 'upsert' | 'delete'): boolean {
  // Recorded money is never deleted, by anyone: an admin voids it with a reason instead.
  if (op === 'delete' && (c === 'expenses' || c === 'folios')) return false;
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
    'menuItems', 'transferRoutes', 'rentalVehicles', 'activityLogs', 'staffAlerts', 'roomBlocks',
  ];
  // Managers see their own expenses (the server filters them); admins see all.
  return [...all, 'expenses'];
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
      const { before, after } = await upsertCrmBooking(record, actor, { role: staff.role, actorName: staff.fullName });
      await audit({ actor, action: before ? 'update' : 'create', entity: 'booking', entityId: op.id, before, after, ip });
      return { ...base, ok: true, record: after };
    }

    if (op.collection === 'physicalRooms') {
      if (op.op === 'delete') {
        const before = await deletePhysicalRoom(op.id);
        await audit({ actor, action: 'delete', entity: 'physical_room', entityId: op.id, before, ip });
        return { ...base, ok: true, deleted: true };
      }
      let record = op.record as unknown as PhysicalRoom;
      if (!record || record.id !== op.id || typeof record.roomNumber !== 'number') throw new HttpError(400, 'Invalid room record.');
      const existing = await findPhysicalRoom({ id: op.id });
      if (!existing && staff.role !== 'admin') throw new HttpError(403, 'Only admins can add rooms.', 'FORBIDDEN');
      if (existing && staff.role !== 'admin') {
        // Desk staff change status, housekeeping and notes only. Room number, category
        // (which drives website inventory) and the QR secret stay as the admin set them.
        record = {
          ...record,
          roomNumber: existing.roomNumber,
          name: existing.name,
          categoryId: existing.categoryId,
          categoryCode: existing.categoryCode,
          categoryName: existing.categoryName,
          floorLevel: existing.floorLevel,
          qrSecretToken: existing.qrSecretToken,
        };
      }
      const { before, after } = await upsertPhysicalRoom(record);
      await audit({ actor, action: before ? 'update' : 'create', entity: 'physical_room', entityId: op.id, before, after, ip });
      return { ...base, ok: true, record: after };
    }

    if (!isRecordCollection(op.collection)) throw new HttpError(400, 'Unknown collection.');
    const collection = op.collection;

    if (collection === 'roomBlocks') {
      // Holds have their own rules: same code path as /api/room-holds.
      if (op.op === 'delete') {
        const res = await releaseRoomHold(op.id, staff, ip);
        return res.ended[0] ? { ...base, ok: true, record: res.ended[0] } : { ...base, ok: true, deleted: true };
      }
      const existing = await getRecord<RoomBlock>('roomBlocks', op.id);
      if (existing) throw new HttpError(409, 'A hold cannot be edited here. Extend or release it from the tape chart.', 'HOLD_LOCKED');
      const b = (op.record || {}) as unknown as RoomBlock;
      const [saved] = await createRoomHold(
        { ids: [op.id], roomIds: [b.roomId], fromDate: b.fromDate, toDate: b.toDate, reason: b.reason, guestName: b.guestName, guestPhone: b.guestPhone },
        staff,
        ip
      );
      return { ...base, ok: true, record: saved };
    }

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
    if (collection === 'expenses') {
      // Managers log (signed, server-stamped); admins approve or void. Same rules as /api/expenses.
      const saved = before
        ? await reviewExpense(op.id, record as unknown as Partial<Expense>, staff, ip)
        : (await createExpense(record as unknown as Expense, staff, ip)).expense;
      return { ...base, ok: true, record: saved };
    }
    if (collection === 'foodOrders' && !before && staff.role !== 'admin') {
      throw new HttpError(400, 'New orders must be placed through the ordering screen.', 'USE_ORDER_API');
    }
    if (collection === 'folios') {
      // Locked, merged and rule-checked against the stored bill (see folio-store.ts)
      const saved = await saveFolioFromDevice(record as unknown as GuestFolio, staff, ip);
      return { ...base, ok: true, record: saved };
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
  if (!folioId) return;
  await setLinkedChargeStatus(folioId, String(after.id), target as 'posted' | 'void', actor, target === 'void' ? String(after.rejectionReason || 'Order / request cancelled') : undefined);
}

/** The CRM working set for a role (recent and upcoming data; older history stays in the database). */
export async function loadCrmState(staff: StaffContext) {
  await ensureGstModeApplied();
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
    roomBlocks: 500,
  };
  const recordCollections = readable.filter((c) => c !== 'crmBookings' && c !== 'physicalRooms') as RecordCollection[];
  tasks.push(
    listRecordsMany(recordCollections, recordLimits).then((byCollection) => {
      for (const c of recordCollections) state[c] = byCollection[c] || [];
    })
  );
  tasks.push(
    getTariffData().then((t) => {
      state.tariffs = t.tariffs;
      state.seasonalDateRanges = t.seasonalDateRanges;
    })
  );
  await Promise.all(tasks);

  if (staff.role === 'manager' && Array.isArray(state.expenses)) {
    state.expenses = (state.expenses as Expense[]).filter((e) => e.loggedById === staff.id);
  }
  if (staff.role === 'kitchen_staff' && Array.isArray(state.foodOrders)) {
    // Kitchen sees orders, not guest phone numbers or folio links
    state.foodOrders = (state.foodOrders as FoodOrder[]).map((o) => ({ ...o, folioId: '' }));
  }
  return state;
}
