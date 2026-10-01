import crypto from 'crypto';
import type {
  CRMBooking,
  FoodOrder,
  FoodOrderItem,
  FolioCharge,
  GuestFolio,
  MenuItem,
  RentalVehicle,
  TransferRoute,
  TransportRequest,
  Guest,
} from '@/types/crm';
import { HttpError } from './http';
import { getSql } from './db';
import { nextCounter } from './counters';
import { audit } from './audit';
import { raiseStaffAlert } from './alerts';
import { listRecords, upsertRecord, getRecord } from './repos/records';
import { upsertCrmBooking, getCrmBooking } from './repos/bookings';
import { getGstConfig, getTariffData } from './repos/settings';
import { recalculateFolioTotals } from '@/lib/folio';
import { findCelebration } from '@/lib/celebrations';
import { rentalRate, transferRate, VehicleTier } from '@/lib/transport-pricing';
import { roundMoney } from '@/lib/gst';

/**
 * Guest-initiated actions (in-room QR concierge and guest portal). Every price is
 * looked up on the server; nothing the browser sends about money is trusted.
 */

async function findFolioForBooking(booking: CRMBooking): Promise<GuestFolio | null> {
  const folios = await listRecords<GuestFolio>('folios');
  return folios.find((f) => f.bookingId === booking.id) || null;
}

/** Returns the booking's folio, creating an empty one if the front desk hasn't yet. */
export async function ensureFolio(booking: CRMBooking, actor: string): Promise<GuestFolio> {
  const existing = await findFolioForBooking(booking);
  if (existing) return existing;
  const n = await nextCounter(getSql(), 'folio', 1001);
  const folio: GuestFolio = {
    id: `fol-${crypto.randomUUID()}`,
    bookingId: booking.id,
    guestId: booking.guestId,
    guestName: booking.guest?.fullName || 'Guest',
    roomNumber: booking.roomNumber,
    roomName: booking.roomName,
    folioNumber: `FOL-${new Date().getFullYear()}-${n}`,
    status: 'open',
    totalRoomCharges: 0,
    totalFbCharges: 0,
    totalAddonCharges: 0,
    totalTax: 0,
    discountAmount: 0,
    netPayable: 0,
    totalPaid: 0,
    balanceDue: 0,
    charges: [],
    payments: [],
  };
  await upsertRecord('folios', folio, actor);
  return folio;
}

async function postCharge(folio: GuestFolio, charge: Omit<FolioCharge, 'id' | 'folioId' | 'postedAt'>, actor: string): Promise<GuestFolio> {
  const gst = await getGstConfig();
  const newCharge: FolioCharge = { ...charge, id: `chg-${crypto.randomUUID()}`, folioId: folio.id, postedAt: new Date().toISOString() };
  const updated = recalculateFolioTotals(folio, [newCharge, ...folio.charges], folio.payments, gst);
  await upsertRecord('folios', updated, actor);
  return updated;
}

function requireInHouse(booking: CRMBooking, allowConfirmed = false) {
  const ok = booking.bookingStatus === 'checked_in' || (allowConfirmed && booking.bookingStatus === 'confirmed');
  if (!ok) {
    throw new HttpError(403, allowConfirmed ? 'This booking is not active.' : 'In-room services open once you are checked in.', 'NOT_CHECKED_IN');
  }
}

// ------------------------------------------------------------------ food orders
export async function placeFoodOrder(input: {
  booking: CRMBooking;
  items: { menuItemId: string; quantity: number; itemNotes?: string }[];
  specialInstructions?: string;
  actor: string;
  ip?: string;
}): Promise<{ order: FoodOrder; folio: GuestFolio }> {
  requireInHouse(input.booking);
  const menu = await listRecords<MenuItem>('menuItems');
  const byId = new Map(menu.map((m) => [m.id, m]));
  const items: FoodOrderItem[] = [];
  for (const it of input.items) {
    const m = byId.get(it.menuItemId);
    if (!m) throw new HttpError(400, 'One of the dishes is no longer on the menu. Please refresh.');
    if (!m.isAvailable) throw new HttpError(409, `${m.name} is not available right now.`, 'UNAVAILABLE');
    const quantity = Math.max(1, Math.min(20, Math.floor(it.quantity)));
    items.push({
      id: `oi-${crypto.randomUUID()}`,
      menuItemId: m.id,
      itemName: m.name,
      unitPrice: m.price,
      quantity,
      lineTotal: m.price * quantity,
      itemNotes: it.itemNotes?.slice(0, 300),
    });
  }
  if (items.length === 0) throw new HttpError(400, 'Your order is empty.');
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const folio = await ensureFolio(input.booking, input.actor);
  const n = await nextCounter(getSql(), 'order', 1001);
  const order: FoodOrder = {
    id: `ord-${crypto.randomUUID()}`,
    orderNumber: `ORD-${n}`,
    roomId: input.booking.roomId,
    roomNumber: input.booking.roomNumber,
    roomName: input.booking.roomName,
    bookingId: input.booking.id,
    folioId: folio.id,
    guestName: input.booking.guest?.fullName || 'Guest',
    status: 'pending_manager_approval',
    specialInstructions: input.specialInstructions?.slice(0, 500),
    subtotal,
    deliveryCharge: 0,
    totalAmount: subtotal,
    chargePostedToFolio: true,
    whatsappNotificationSent: false,
    items,
    createdAt: new Date().toISOString(),
  };
  await upsertRecord('foodOrders', order, input.actor);
  const updatedFolio = await postCharge(
    folio,
    {
      category: 'food_beverage',
      chargeStatus: 'pending',
      title: `Food Order #${order.orderNumber} (${items.map((i) => `${i.quantity}x ${i.itemName}`).join(', ')})`,
      amount: subtotal,
      sourceReferenceType: 'food_order',
      sourceReferenceId: order.id,
    },
    input.actor
  );
  await raiseStaffAlert({
    type: 'order',
    roomNumber: order.roomNumber,
    guestName: order.guestName,
    orderDetails: `${items.map((i) => `${i.quantity}x ${i.itemName}`).join(', ')}${order.specialInstructions ? ` (${order.specialInstructions})` : ''}`,
    totalAmount: subtotal,
  });
  await audit({ actor: input.actor, action: 'create', entity: 'foodOrders', entityId: order.id, after: order, ip: input.ip });
  return { order, folio: updatedFolio };
}

export async function placeCelebration(input: { booking: CRMBooking; celebrationId: string; notes?: string; actor: string; ip?: string }) {
  requireInHouse(input.booking, true);
  const option = findCelebration(input.celebrationId);
  if (!option) throw new HttpError(400, 'Unknown celebration option.');
  const folio = await ensureFolio(input.booking, input.actor);
  const n = await nextCounter(getSql(), 'celebration', 1001);
  const order: FoodOrder = {
    id: `ord-cel-${crypto.randomUUID()}`,
    orderNumber: `CEL-${n}`,
    roomId: input.booking.roomId,
    roomNumber: input.booking.roomNumber,
    roomName: input.booking.roomName,
    bookingId: input.booking.id,
    folioId: folio.id,
    guestName: input.booking.guest?.fullName || 'Guest',
    status: 'pending_manager_approval',
    specialInstructions: `🎉 Special Celebration: ${option.title}${input.notes ? ` — ${input.notes.slice(0, 300)}` : ''}`,
    subtotal: option.price,
    deliveryCharge: 0,
    totalAmount: option.price,
    chargePostedToFolio: true,
    whatsappNotificationSent: false,
    items: [{ id: `oi-${crypto.randomUUID()}`, menuItemId: option.id, itemName: `🎉 ${option.title}`, unitPrice: option.price, quantity: 1, lineTotal: option.price }],
    createdAt: new Date().toISOString(),
  };
  await upsertRecord('foodOrders', order, input.actor);
  const updatedFolio = await postCharge(
    folio,
    {
      category: 'miscellaneous',
      chargeStatus: 'pending',
      title: `Celebration Add-on: ${option.title}`,
      amount: option.price,
      sourceReferenceType: 'food_order',
      sourceReferenceId: order.id,
      notes: input.notes?.slice(0, 300),
    },
    input.actor
  );
  await raiseStaffAlert({
    type: 'special_request',
    roomNumber: order.roomNumber,
    guestName: order.guestName,
    orderDetails: `🎉 ${option.title}${input.notes ? ` — ${input.notes.slice(0, 200)}` : ''}`,
    totalAmount: option.price,
  });
  await audit({ actor: input.actor, action: 'create', entity: 'foodOrders', entityId: order.id, after: order, ip: input.ip });
  return { order, folio: updatedFolio };
}

// ------------------------------------------------------------------ transport
export async function requestTransport(input: {
  booking: CRMBooking;
  serviceType: 'point_to_point' | 'vehicle_rental';
  routeId?: string;
  vehicleTier?: VehicleTier;
  modifiers?: string[];
  rentalVehicleId?: string;
  pickupDatetime: string;
  returnDatetime?: string;
  pickupLocation?: string;
  destinationNotes?: string;
  guestContactPhone?: string;
  actor: string;
  ip?: string;
}): Promise<{ request: TransportRequest; folio: GuestFolio }> {
  requireInHouse(input.booking, true);
  const { seasonalDateRanges } = await getTariffData();
  let quotedPrice = 0;
  let title = '';
  let request: Partial<TransportRequest> = {};
  if (input.serviceType === 'point_to_point') {
    const route = input.routeId ? await getRecord<TransferRoute>('transferRoutes', input.routeId) : null;
    if (!route || route.isActive === false) throw new HttpError(400, 'This transfer route is not available.');
    const tier = input.vehicleTier || 'sedan';
    const base = transferRate(route, input.pickupDatetime, tier, seasonalDateRanges).rate;
    const mods = (route.modifiers || []).filter((m) => (input.modifiers || []).includes(m.name));
    quotedPrice = base + mods.reduce((s, m) => s + m.extraCharge, 0);
    title = `Transfer: ${route.title}`;
    request = {
      routeId: route.id,
      routeTitle: route.title,
      vehicleTier: tier,
      selectedModifiers: mods.map((m) => ({ name: m.name, charge: m.extraCharge })),
      vendorCost: Math.round(quotedPrice * 0.75),
    };
  } else {
    const vehicle = input.rentalVehicleId ? await getRecord<RentalVehicle>('rentalVehicles', input.rentalVehicleId) : null;
    if (!vehicle || vehicle.isAvailable === false) throw new HttpError(400, 'This vehicle is not available.');
    const quote = rentalRate(vehicle, input.pickupDatetime, input.returnDatetime, seasonalDateRanges);
    quotedPrice = quote.totalRate;
    title = `Rental: ${vehicle.vehicleName} (${quote.days} day${quote.days > 1 ? 's' : ''})`;
    request = {
      rentalVehicleId: vehicle.id,
      rentalVehicleName: `${vehicle.vehicleName} (${quote.days} Day${quote.days > 1 ? 's' : ''})`,
      selectedModifiers: [],
      returnDatetime: input.returnDatetime,
      vendorCost: Math.round(quotedPrice * 0.65),
    };
  }
  const folio = await ensureFolio(input.booking, input.actor);
  const n = await nextCounter(getSql(), 'dispatch', 501);
  const full: TransportRequest = {
    id: `dsp-${crypto.randomUUID()}`,
    requestNumber: `DSP-${n}`,
    roomId: input.booking.roomId,
    roomNumber: input.booking.roomNumber,
    roomName: input.booking.roomName,
    bookingId: input.booking.id,
    folioId: folio.id,
    guestName: input.booking.guest?.fullName || 'Guest',
    guestContactPhone: (input.guestContactPhone || input.booking.guest?.phone || '').slice(0, 20),
    serviceType: input.serviceType,
    selectedModifiers: [],
    pickupDatetime: input.pickupDatetime,
    pickupLocation: (input.pickupLocation || 'Homestay Main Gate').slice(0, 200),
    destinationNotes: input.destinationNotes?.slice(0, 500),
    quotedPrice,
    vendorCost: 0,
    homestayCommission: 0,
    dispatchStatus: 'pending_confirmation',
    chargePostedToFolio: true,
    createdAt: new Date().toISOString(),
    ...request,
  } as TransportRequest;
  full.homestayCommission = full.quotedPrice - full.vendorCost;
  await upsertRecord('dispatchRequests', full, input.actor);
  const updatedFolio = await postCharge(
    folio,
    {
      category: input.serviceType === 'point_to_point' ? 'transport_transfer' : 'vehicle_rental',
      chargeStatus: 'pending',
      title: `${title} (#${full.requestNumber})`,
      amount: quotedPrice,
      sourceReferenceType: 'transport_request',
      sourceReferenceId: full.id,
    },
    input.actor
  );
  await raiseStaffAlert({
    type: 'special_request',
    roomNumber: full.roomNumber,
    guestName: full.guestName,
    orderDetails: `🚗 ${title} on ${input.pickupDatetime.replace('T', ' ')}`,
    totalAmount: quotedPrice,
  });
  await audit({ actor: input.actor, action: 'create', entity: 'dispatchRequests', entityId: full.id, after: full, ip: input.ip });
  return { request: full, folio: updatedFolio };
}

// ------------------------------------------------------------------ digital check-in
export async function submitGuestCheckin(input: {
  booking: CRMBooking;
  guest: Partial<Guest>;
  specialRequests?: string;
  actor: string;
  ip?: string;
}): Promise<CRMBooking> {
  const allowed: (keyof Guest)[] = [
    'fullName', 'email', 'idType', 'idNumber', 'idDocumentUrl', 'idDocumentBackUrl', 'address', 'city', 'state',
    'nationality', 'dietaryPreferences', 'hospitalityPreferences',
  ];
  const updates: Partial<Guest> = {};
  for (const k of allowed) {
    const v = input.guest[k];
    if (typeof v !== 'string') continue;
    if (k === 'idDocumentUrl' || k === 'idDocumentBackUrl') {
      // Only a newly uploaded image (data URL) or the file already on this booking is accepted.
      if (!v.startsWith('data:') && v !== input.booking.guest?.[k]) continue;
      (updates as Record<string, unknown>)[k] = v;
      continue;
    }
    // The guest sees a masked ID number (••••1234); sending it back unchanged keeps the stored one.
    if (k === 'idNumber' && v.includes('•')) continue;
    (updates as Record<string, unknown>)[k] = v.slice(0, 500);
  }
  const hasDocs = Boolean(updates.idDocumentUrl || input.booking.guest?.idDocumentUrl || updates.idNumber);
  const next: CRMBooking = {
    ...input.booking,
    specialRequests: input.specialRequests?.slice(0, 1000) || input.booking.specialRequests,
    documentStatus: hasDocs ? 'submitted' : input.booking.documentStatus || 'pending',
    guest: { ...input.booking.guest, ...updates, documentStatus: hasDocs ? 'submitted' : input.booking.guest?.documentStatus || 'pending' },
  };
  // Guests submit details; only staff change the stay status (check-in happens at the desk).
  const { after } = await upsertCrmBooking(next, input.actor);
  await raiseStaffAlert({
    type: 'checkin',
    roomNumber: after.roomNumber,
    guestName: after.guest?.fullName || 'Guest',
    orderDetails: `📋 Digital check-in details submitted for Room ${after.roomNumber} (${after.guest?.fullName || 'Guest'})`,
    totalAmount: 0,
  });
  await audit({ actor: input.actor, action: 'guest_checkin_submitted', entity: 'booking', entityId: after.id, before: input.booking, after, ip: input.ip });
  return after;
}

// ------------------------------------------------------------------ guest views
/** A guest's own booking, without staff-only fields; ID number masked. */
export function bookingForGuest(b: CRMBooking): CRMBooking {
  const g = b.guest || ({} as Guest);
  return {
    ...b,
    notes: undefined,
    isManualRate: undefined,
    checkedInByManagerId: undefined,
    checkedOutByManagerId: undefined,
    guest: {
      ...g,
      idNumber: g.idNumber ? `${'•'.repeat(Math.max(0, g.idNumber.length - 4))}${g.idNumber.slice(-4)}` : g.idNumber,
    },
  };
}

export async function folioForGuest(booking: CRMBooking): Promise<GuestFolio | null> {
  const folio = await findFolioForBooking(booking);
  if (!folio) return null;
  return {
    ...folio,
    payments: folio.payments.map((p) => ({ ...p, collectedById: undefined })),
    totalTax: roundMoney(folio.totalTax),
  };
}

export async function ordersForGuest(booking: CRMBooking): Promise<FoodOrder[]> {
  const orders = await listRecords<FoodOrder>('foodOrders', { limit: 2000 });
  return orders.filter((o) => o.bookingId === booking.id);
}

export async function reloadCrmBooking(id: string): Promise<CRMBooking | null> {
  return getCrmBooking(id);
}
