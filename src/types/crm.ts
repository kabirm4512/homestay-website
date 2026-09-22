export type StaffRole = 'admin' | 'manager' | 'kitchen_staff';

export type RoomCategoryCode =
  | 'deluxe_mountain'
  | 'deluxe_forest'
  | 'premium_suite'
  | 'luxury_suite'
  | 'cottage'
  | 'deluxe_pine';

export type RoomTapeStatus = 'hold' | 'confirmed' | 'checked_in' | 'maintenance' | 'available';

export type HousekeepingStatus = 'clean' | 'light_refresh' | 'deep_clean_turnover' | 'maintenance_inspection';

export type MealPlan = 'EP' | 'CP' | 'MAP' | 'AP';

export type BookingStatus = 'hold' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';

export type FoodOrderStatus =
  | 'pending'
  | 'accepted_kitchen'
  | 'preparing'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type DispatchStatus =
  | 'pending_confirmation'
  | 'confirmed_dispatched'
  | 'in_transit'
  | 'completed'
  | 'cancelled';

export type FolioStatus = 'open' | 'settled' | 'void';

export type ChargeCategory =
  | 'room_tariff'
  | 'food_beverage'
  | 'transport_transfer'
  | 'vehicle_rental'
  | 'laundry'
  | 'miscellaneous';

export type ChargeStatus = 'pending' | 'posted' | 'void';

export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'card';

export type ExpenseMasterCategory =
  | 'groceries'
  | 'utilities'
  | 'housekeeping'
  | 'maintenance'
  | 'staff_payroll'
  | 'marketing'
  | 'transport_vendor'
  | 'miscellaneous';

export interface RoomCategory {
  id: string;
  code: RoomCategoryCode;
  name: string;
  description: string;
  basePriceWeekday: number;
  basePriceWeekend: number;
  baseAdults?: number;
  maxAdults: number;
  maxChildren: number;
  extraAdultCharge?: number;
  extraChildCharge?: number;
  amenities: string[];
}

export interface PhysicalRoom {
  id: string;
  roomNumber: number; // 1 to 7
  name: string;
  categoryId: string;
  categoryCode: RoomCategoryCode;
  categoryName: string;
  floorLevel: number;
  currentStatus: RoomTapeStatus;
  housekeeping: HousekeepingStatus;
  qrSecretToken: string;
  notes?: string;
}

export interface Guest {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  idType?: string; // Passport, Aadhaar, Driver License, Voter ID, Inner Line Permit
  idDocumentUrl?: string;
  idDocumentBackUrl?: string;
  idNumber?: string;
  address?: string;
  city?: string;
  nationality?: string;
  documentStatus?: 'pending' | 'submitted' | 'verified';
  dietaryPreferences?: string; // Vegetarian, Jain, Nut Allergy, Lactose Intolerant, etc.
  hospitalityPreferences?: string; // Extra duvet, warm water flask, morning tea at 7am
  whatsappNumber?: string;
  totalLifetimeStays: number;
}

export interface CRMBooking {
  id: string;
  bookingReference: string;
  roomId: string;
  roomNumber: number;
  roomName: string;
  guestId: string;
  guest: Guest;
  checkInDate: string; // YYYY-MM-DD
  checkOutDate: string; // YYYY-MM-DD
  tapeStatus: RoomTapeStatus;
  bookingStatus: BookingStatus;
  mealPlan: MealPlan;
  adultsCount: number;
  childrenCount: number;
  extraAdultsCount?: number;
  extraChildrenCount?: number;
  extraAdultChargePerNight?: number;
  extraChildChargePerNight?: number;
  totalExtraCharges?: number;
  roomRatePerNight: number;
  totalNights: number;
  totalRoomAmount: number;
  specialRequests?: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  isManualRate?: boolean;
  notes?: string;
  documentStatus?: 'pending' | 'submitted' | 'verified';
  advancePaid?: number;
  advancePaymentMethod?: PaymentMethod;
}

export interface FolioCharge {
  id: string;
  folioId: string;
  category: ChargeCategory;
  chargeStatus: ChargeStatus;
  title: string;
  amount: number;
  sourceReferenceType?: 'booking' | 'food_order' | 'transport_request' | 'manual_adjustment';
  sourceReferenceId?: string;
  notes?: string;
  postedAt: string;
}

export interface FolioPayment {
  id: string;
  folioId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  transactionReference?: string;
  receiptNotes?: string;
  collectedAt: string;
  collectedByName?: string;
}

export interface GuestFolio {
  id: string;
  bookingId: string;
  guestId: string;
  guestName: string;
  roomNumber: number;
  roomName: string;
  folioNumber: string;
  status: FolioStatus;
  totalRoomCharges: number;
  totalFbCharges: number;
  totalAddonCharges: number;
  totalTax: number;
  discountAmount: number;
  netPayable: number;
  totalPaid: number;
  balanceDue: number;
  settledAt?: string;
  settledByName?: string;
  charges: FolioCharge[];
  payments: FolioPayment[];
}

export interface MenuItem {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string;
  price: number;
  itemType: 'beverage' | 'snack' | 'main' | 'breakfast' | 'thali' | 'sides';
  isAvailable: boolean;
  isLateNightEligible: boolean;
  prepTimeMinutes: number;
  imageUrl?: string;
}

export interface FoodOrderItem {
  id: string;
  orderId?: string;
  menuItemId: string;
  itemName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  itemNotes?: string;
}

export interface FoodOrder {
  id: string;
  orderNumber: string;
  roomId: string;
  roomNumber: number;
  roomName: string;
  bookingId: string;
  folioId: string;
  guestName: string;
  status: FoodOrderStatus;
  specialInstructions?: string;
  subtotal: number;
  deliveryCharge: number;
  totalAmount: number;
  chargePostedToFolio: boolean;
  whatsappNotificationSent: boolean;
  items: FoodOrderItem[];
  createdAt: string;
}

export interface RouteModifier {
  id: string;
  routeId: string;
  name: string;
  extraCharge: number;
  extraDurationHours: number;
}

export interface RouteVehicleTariff {
  priceWagonR: number;
  priceSedan: number;
  priceSUV: number;
}

export interface RouteSeasonalTariffs {
  season?: Partial<RouteVehicleTariff>;
  offSeason?: Partial<RouteVehicleTariff>;
}

export interface TransferRoute {
  id: string;
  title: string;
  origin: string;
  destination: string;
  priceWagonR: number;
  priceSedan: number;
  priceSUV: number;
  estimatedDurationHours: number;
  isActive: boolean;
  modifiers: RouteModifier[];
  seasonalTariffs?: RouteSeasonalTariffs;
}

export interface VehicleSeasonalTariffs {
  seasonRatePerDay?: number;
  offSeasonRatePerDay?: number;
}

export interface RentalVehicle {
  id: string;
  vehicleName: string;
  vehicleType: 'scooty' | 'bike' | 'car';
  ratePerDay: number;
  depositRequired: number;
  isAvailable: boolean;
  imageUrl?: string;
  specs?: string;
  seasonalTariffs?: VehicleSeasonalTariffs;
}

export interface TransportRequest {
  id: string;
  requestNumber: string;
  roomId: string;
  roomNumber: number;
  roomName: string;
  bookingId: string;
  folioId: string;
  guestName: string;
  guestContactPhone: string;
  serviceType: 'point_to_point' | 'vehicle_rental';
  routeId?: string;
  routeTitle?: string;
  vehicleTier?: 'wagonr' | 'sedan' | 'suv';
  rentalVehicleId?: string;
  rentalVehicleName?: string;
  selectedModifiers: { name: string; charge: number }[];
  pickupDatetime: string;
  returnDatetime?: string;
  pickupLocation: string;
  destinationNotes?: string;
  quotedPrice: number;
  vendorCost: number;
  homestayCommission: number;
  dispatchStatus: DispatchStatus;
  assignedDriverName?: string;
  assignedDriverPhone?: string;
  vehiclePlateNumber?: string;
  confirmedAt?: string;
  chargePostedToFolio: boolean;
  createdAt: string;
}

export interface HousekeepingTask {
  id: string;
  roomId: string;
  roomNumber: number;
  roomName: string;
  scheduleDate: string;
  taskType: HousekeepingStatus;
  status: 'pending' | 'in_progress' | 'inspected' | 'completed';
  assignedToName: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  checklist: {
    linens_changed: boolean;
    toiletries_restocked: boolean;
    fireplace_prepped: boolean;
    balcony_cleaned: boolean;
  };
  notes?: string;
  completedAt?: string;
}

export interface Expense {
  id: string;
  expenseDate: string; // YYYY-MM-DD
  amount: number;
  paymentMethod: PaymentMethod;
  masterCategory: ExpenseMasterCategory;
  subTag: string;
  vendorPayee?: string;
  description: string;
  billReceiptUrl?: string;
  loggedByName: string;
  createdAt: string;
}

export interface StaffAccount {
  id: string;
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role: StaffRole;
  isActive: boolean;
  createdAt: string;
}

export interface SeasonalDateRange {
  id: string;
  name: string; // e.g. "Summer Peak 2026", "Durga Puja & Diwali Peak", "Monsoon Off-Season"
  seasonType: 'season' | 'off_season';
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  description?: string;
}

export interface MealPlanRates {
  EP: number; // Room Only
  CP: number; // Bed & Breakfast
  MAP: number; // Half Board (Breakfast + Lunch or Dinner)
  AP: number; // Full Board (All Meals)
}

export interface RoomSeasonalTariffs {
  regular: MealPlanRates;
  season: MealPlanRates;
  offSeason: MealPlanRates;
  weekendSurchargePercent?: number;
  extraAdultRate?: number;
  extraChildRate?: number;
}

