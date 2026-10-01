/**
 * Booking add-on prices. The live values are stored on the server (settings
 * 'booking_addon_rates', served with /api/tariffs); these are only the defaults.
 */
export const AIRPORT_TRANSFER_RATE = 2800; // one-way Bagdogra (IXB) / NJP transfer, per booking
export const BIKE_RENTAL_RATE_PER_NIGHT = 800; // scooty / bike rental, per night of stay

export function calculateAddonCharges(params: {
  includeAirportTransfer: boolean;
  includeBikeRental: boolean;
  nights: number;
  /** Live rates from /api/tariffs (fall back to the defaults above). */
  rates?: { airportTransfer: number; bikeRentalPerNight: number } | null;
}): { transferCharge: number; bikeCharge: number; total: number } {
  const transferRate = params.rates?.airportTransfer ?? AIRPORT_TRANSFER_RATE;
  const bikeRate = params.rates?.bikeRentalPerNight ?? BIKE_RENTAL_RATE_PER_NIGHT;
  const transferCharge = params.includeAirportTransfer ? transferRate : 0;
  const bikeCharge = params.includeBikeRental ? bikeRate * Math.max(0, params.nights) : 0;
  return { transferCharge, bikeCharge, total: transferCharge + bikeCharge };
}
