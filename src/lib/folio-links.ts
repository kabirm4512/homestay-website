import type { CRMBooking, FoodOrder, GuestFolio, TransportRequest } from '@/types/crm';

/**
 * Links money to a booking by its id ONLY. (Matching by room number attached a previous or
 * next guest's bill, orders and transfers to the wrong stay.)
 */
export function folioForBooking(folios: GuestFolio[], booking: Pick<CRMBooking, 'id'> | null | undefined): GuestFolio | null {
  if (!booking) return null;
  return folios.find((f) => f.bookingId === booking.id) || null;
}

export function ordersForBooking(orders: FoodOrder[], booking: Pick<CRMBooking, 'id'> | null | undefined): FoodOrder[] {
  if (!booking) return [];
  return orders.filter((o) => o.bookingId === booking.id);
}

export function dispatchesForBooking(list: TransportRequest[], booking: Pick<CRMBooking, 'id'> | null | undefined): TransportRequest[] {
  if (!booking) return [];
  return list.filter((d) => d.bookingId === booking.id);
}
