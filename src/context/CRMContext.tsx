'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  StaffRole,
  PhysicalRoom,
  CRMBooking,
  GuestFolio,
  MenuItem,
  FoodOrder,
  TransportRequest,
  HousekeepingTask,
  Expense,
  TransferRoute,
  RentalVehicle,
  RoomTapeStatus,
  FoodOrderStatus,
  DispatchStatus,
  FolioPayment,
  FolioCharge,
  PaymentMethod,
  StaffAccount,
  MealPlan,
  SeasonalDateRange,
  RoomSeasonalTariffs,
} from '@/types/crm';
import {
  INITIAL_PHYSICAL_ROOMS,
  INITIAL_BOOKINGS,
  INITIAL_FOLIOS,
  INITIAL_MENU_ITEMS,
  INITIAL_FOOD_ORDERS,
  INITIAL_DISPATCH_REQUESTS,
  INITIAL_HOUSEKEEPING_TASKS,
  INITIAL_EXPENSES,
  INITIAL_TRANSFER_ROUTES,
  INITIAL_RENTAL_VEHICLES,
  INITIAL_STAFF_ACCOUNTS,
  INITIAL_SEASONAL_DATE_RANGES,
  INITIAL_ROOM_SEASONAL_TARIFFS,
} from '@/lib/crm-data';

interface ToastState {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface CRMContextType {
  role: StaffRole;
  setRole: (role: StaffRole) => void;
  rooms: PhysicalRoom[];
  bookings: CRMBooking[];
  folios: GuestFolio[];
  menuItems: MenuItem[];
  foodOrders: FoodOrder[];
  dispatchRequests: TransportRequest[];
  housekeepingTasks: HousekeepingTask[];
  expenses: Expense[];
  transferRoutes: TransferRoute[];
  rentalVehicles: RentalVehicle[];
  seasonalDateRanges: SeasonalDateRange[];
  roomTariffs: Record<string, RoomSeasonalTariffs>;
  toast: ToastState | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;

  // Actions
  updateRoomStatus: (roomId: string, status: RoomTapeStatus) => void;
  updateGuestPreferences: (
    guestId: string,
    updates: { dietaryPreferences?: string; hospitalityPreferences?: string; idDocumentUrl?: string; phone?: string; fullName?: string }
  ) => void;
  toggleHousekeepingCheck: (
    taskId: string,
    checkItem: 'linens_changed' | 'toiletries_restocked' | 'fireplace_prepped' | 'balcony_cleaned'
  ) => void;
  updateHousekeepingStatus: (taskId: string, status: 'pending' | 'in_progress' | 'inspected' | 'completed') => void;
  createFoodOrder: (order: Omit<FoodOrder, 'id' | 'orderNumber' | 'createdAt'>) => FoodOrder;
  updateFoodOrderStatus: (orderId: string, status: FoodOrderStatus) => void;
  toggleMenuItemAvailability: (itemId: string) => void;
  createTransportRequest: (request: Omit<TransportRequest, 'id' | 'requestNumber' | 'createdAt' | 'homestayCommission'>) => TransportRequest;
  confirmDispatchRequest: (
    requestId: string,
    details: { assignedDriverName: string; assignedDriverPhone: string; vehiclePlateNumber: string; vendorCost?: number }
  ) => void;
  cancelDispatchRequest: (requestId: string) => void;
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  deleteExpense: (expenseId: string) => void;
  addFolioCharge: (folioId: string, charge: Omit<FolioCharge, 'id' | 'postedAt'>) => void;
  addFolioPayment: (folioId: string, payment: Omit<FolioPayment, 'id' | 'collectedAt'>) => void;
  settleFolio: (folioId: string, paymentMethod: PaymentMethod, notes?: string) => void;
  checkInRoom: (bookingId: string) => void;
  checkOutRoom: (bookingId: string) => void;

  // Menu Management CRUD (In-Room Dining)
  addMenuItem: (item: Omit<MenuItem, 'id'>) => MenuItem;
  updateMenuItem: (id: string, updates: Partial<MenuItem>) => void;
  deleteMenuItem: (id: string) => void;

  // Travel & Add-ons CRUD
  addTransferRoute: (route: Omit<TransferRoute, 'id'>) => TransferRoute;
  updateTransferRoute: (id: string, updates: Partial<TransferRoute>) => void;
  deleteTransferRoute: (id: string) => void;
  addRentalVehicle: (vehicle: Omit<RentalVehicle, 'id'>) => RentalVehicle;
  updateRentalVehicle: (id: string, updates: Partial<RentalVehicle>) => void;
  deleteRentalVehicle: (id: string) => void;

  // Seasonal Pricing & Dynamic Tariffs
  addSeasonalRange: (range: Omit<SeasonalDateRange, 'id'>) => SeasonalDateRange;
  updateSeasonalRange: (id: string, updates: Partial<SeasonalDateRange>) => void;
  deleteSeasonalRange: (id: string) => void;
  updateRoomTariffs: (roomId: string, tariffs: RoomSeasonalTariffs) => void;
  calculateDynamicTariff: (
    roomId: string,
    checkIn: string,
    checkOut: string,
    mealPlan?: MealPlan
  ) => {
    totalAmount: number;
    nights: number;
    avgRatePerNight: number;
    breakdown: { date: string; rateName: string; seasonType: 'season' | 'off_season' | 'regular'; amount: number }[];
  };

  // Staff User Management (Admin Managed)
  staffAccounts: StaffAccount[];
  currentUser: StaffAccount | null;
  setCurrentUser: (user: StaffAccount | null) => void;
  addStaffAccount: (account: Omit<StaffAccount, 'id' | 'createdAt'>) => Promise<StaffAccount>;
  updateStaffAccount: (id: string, updates: Partial<StaffAccount>) => Promise<void>;
  deleteStaffAccount: (id: string) => Promise<{ success: boolean; error?: string }>;
  authenticateStaff: (identifier: string, password: string) => Promise<{ success: boolean; user?: StaffAccount; error?: string }>;
}

export function recalculateFolioTotals(
  folio: GuestFolio,
  charges: FolioCharge[],
  payments: FolioPayment[] = folio.payments
): GuestFolio {
  const roomCharges = charges
    .filter((c) => c.category === 'room_tariff' && c.chargeStatus !== 'void')
    .reduce((sum, c) => sum + c.amount, 0);
  const fbCharges = charges
    .filter((c) => c.category === 'food_beverage' && c.chargeStatus !== 'void')
    .reduce((sum, c) => sum + c.amount, 0);
  const addonCharges = charges
    .filter((c) => ['transport_transfer', 'vehicle_rental', 'laundry', 'miscellaneous'].includes(c.category) && c.chargeStatus !== 'void')
    .reduce((sum, c) => sum + c.amount, 0);

  const totalSubtotal = roomCharges + fbCharges + addonCharges - folio.discountAmount;
  const tax = Math.round(totalSubtotal * 0.05 * 10) / 10; // 5% GST
  const netPayable = totalSubtotal + tax;
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const balanceDue = Math.max(0, netPayable - totalPaid);
  const isSettled = balanceDue <= 0 && netPayable > 0;

  return {
    ...folio,
    charges,
    payments,
    totalRoomCharges: roomCharges,
    totalFbCharges: fbCharges,
    totalAddonCharges: addonCharges,
    totalTax: tax,
    netPayable,
    totalPaid,
    balanceDue,
    status: isSettled ? 'settled' : folio.status === 'settled' && balanceDue > 0 ? 'open' : folio.status,
    settledAt: isSettled ? (folio.settledAt || new Date().toISOString()) : folio.settledAt,
  };
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

export function CRMProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<StaffRole>('admin');
  const [rooms, setRooms] = useState<PhysicalRoom[]>(INITIAL_PHYSICAL_ROOMS);
  const [bookings, setBookings] = useState<CRMBooking[]>(INITIAL_BOOKINGS);
  const [folios, setFolios] = useState<GuestFolio[]>(INITIAL_FOLIOS);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(INITIAL_MENU_ITEMS);
  const [foodOrders, setFoodOrders] = useState<FoodOrder[]>(INITIAL_FOOD_ORDERS);
  const [dispatchRequests, setDispatchRequests] = useState<TransportRequest[]>(INITIAL_DISPATCH_REQUESTS);
  const [housekeepingTasks, setHousekeepingTasks] = useState<HousekeepingTask[]>(INITIAL_HOUSEKEEPING_TASKS);
  const [expenses, setExpenses] = useState<Expense[]>(INITIAL_EXPENSES);
  const [transferRoutes, setTransferRoutes] = useState<TransferRoute[]>(INITIAL_TRANSFER_ROUTES);
  const [rentalVehicles, setRentalVehicles] = useState<RentalVehicle[]>(INITIAL_RENTAL_VEHICLES);
  const [seasonalDateRanges, setSeasonalDateRanges] = useState<SeasonalDateRange[]>(INITIAL_SEASONAL_DATE_RANGES);
  const [roomTariffs, setRoomTariffs] = useState<Record<string, RoomSeasonalTariffs>>(INITIAL_ROOM_SEASONAL_TARIFFS);
  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>(INITIAL_STAFF_ACCOUNTS);
  const [currentUser, setCurrentUserState] = useState<StaffAccount | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToast({ id, message, type });
    setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 4000);
  }, []);

  // Sync to/from localStorage for persistence across reloads
  useEffect(() => {
    try {
      const savedRole = localStorage.getItem('wp_crm_role') as StaffRole;
      if (savedRole && ['admin', 'manager', 'kitchen_staff'].includes(savedRole)) {
        setRoleState(savedRole);
      }
      const savedRooms = localStorage.getItem('wp_crm_rooms');
      if (savedRooms) setRooms(JSON.parse(savedRooms));

      const savedBookings = localStorage.getItem('wp_crm_bookings');
      if (savedBookings) setBookings(JSON.parse(savedBookings));

      const savedHousekeeping = localStorage.getItem('wp_crm_housekeeping');
      if (savedHousekeeping) setHousekeepingTasks(JSON.parse(savedHousekeeping));

      const savedMenuItems = localStorage.getItem('wp_crm_menu_items');
      if (savedMenuItems) setMenuItems(JSON.parse(savedMenuItems));

      const savedOrders = localStorage.getItem('wp_crm_food_orders');
      if (savedOrders) setFoodOrders(JSON.parse(savedOrders));

      const savedDispatch = localStorage.getItem('wp_crm_dispatch');
      if (savedDispatch) setDispatchRequests(JSON.parse(savedDispatch));

      const savedExpenses = localStorage.getItem('wp_crm_expenses');
      if (savedExpenses) setExpenses(JSON.parse(savedExpenses));

      const savedFolios = localStorage.getItem('wp_crm_folios');
      if (savedFolios) setFolios(JSON.parse(savedFolios));

      const savedRoutes = localStorage.getItem('wp_crm_transfer_routes');
      if (savedRoutes) setTransferRoutes(JSON.parse(savedRoutes));

      const savedVehicles = localStorage.getItem('wp_crm_rental_vehicles');
      if (savedVehicles) setRentalVehicles(JSON.parse(savedVehicles));

      const savedRanges = localStorage.getItem('wp_crm_seasonal_ranges');
      if (savedRanges) setSeasonalDateRanges(JSON.parse(savedRanges));

      const savedTariffs = localStorage.getItem('wp_crm_room_tariffs');
      if (savedTariffs) setRoomTariffs(JSON.parse(savedTariffs));

      const savedStaff = localStorage.getItem('wp_crm_staff_accounts');
      if (savedStaff) {
        const parsed = JSON.parse(savedStaff);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filter out legacy hardcoded demo accounts ('staff-2' and 'staff-3') if present
          const cleanedStaff = parsed.filter(
            (acc: StaffAccount) => acc.id !== 'staff-2' && acc.id !== 'staff-3'
          );
          // Ensure at least one active admin account is present
          const hasAdmin = cleanedStaff.some((acc: StaffAccount) => acc.role === 'admin' && acc.isActive);
          const finalStaff = hasAdmin ? cleanedStaff : [...INITIAL_STAFF_ACCOUNTS, ...cleanedStaff];
          setStaffAccounts(finalStaff);
          localStorage.setItem('wp_crm_staff_accounts', JSON.stringify(finalStaff));
        } else {
          setStaffAccounts(INITIAL_STAFF_ACCOUNTS);
          localStorage.setItem('wp_crm_staff_accounts', JSON.stringify(INITIAL_STAFF_ACCOUNTS));
        }
      } else {
        setStaffAccounts(INITIAL_STAFF_ACCOUNTS);
      }

      const savedUser = localStorage.getItem('wp_crm_current_user');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        if (parsedUser.id === 'staff-2' || parsedUser.id === 'staff-3') {
          localStorage.removeItem('wp_crm_current_user');
          localStorage.removeItem('homestay_admin_token');
          localStorage.removeItem('homestay_admin_user');
        } else {
          setCurrentUserState(parsedUser);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const setRole = (newRole: StaffRole) => {
    setRoleState(newRole);
    try {
      localStorage.setItem('wp_crm_role', newRole);
    } catch {
      // ignore
    }
    showToast(`Switched active role to ${newRole.replace('_', ' ').toUpperCase()}`, 'info');
  };

  const updateRoomStatus = (roomId: string, status: RoomTapeStatus) => {
    setRooms((prev) => {
      const updated = prev.map((r) => (r.id === roomId ? { ...r, currentStatus: status } : r));
      try {
        localStorage.setItem('wp_crm_rooms', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    showToast(`Room status updated to ${status}`);
  };

  const updateGuestPreferences = (
    guestId: string,
    updates: { dietaryPreferences?: string; hospitalityPreferences?: string; idDocumentUrl?: string; phone?: string; fullName?: string }
  ) => {
    setBookings((prev) => {
      const updated = prev.map((b) => {
        if (b.guestId === guestId) {
          return {
            ...b,
            guest: {
              ...b.guest,
              ...updates,
            },
          };
        }
        return b;
      });
      try {
        localStorage.setItem('wp_crm_bookings', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    showToast('Guest profile and hospitality preferences saved');
  };

  const toggleHousekeepingCheck = (
    taskId: string,
    checkItem: 'linens_changed' | 'toiletries_restocked' | 'fireplace_prepped' | 'balcony_cleaned'
  ) => {
    setHousekeepingTasks((prev) => {
      const updated = prev.map((task) => {
        if (task.id === taskId) {
          const updatedChecklist = {
            ...task.checklist,
            [checkItem]: !task.checklist[checkItem],
          };
          const allChecked = Object.values(updatedChecklist).every(Boolean);
          return {
            ...task,
            checklist: updatedChecklist,
            status: allChecked ? ('completed' as const) : ('in_progress' as const),
            completedAt: allChecked ? new Date().toISOString() : undefined,
          };
        }
        return task;
      });
      try {
        localStorage.setItem('wp_crm_housekeeping', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const updateHousekeepingStatus = (taskId: string, status: 'pending' | 'in_progress' | 'inspected' | 'completed') => {
    setHousekeepingTasks((prev) => {
      const updated = prev.map((task) => {
        if (task.id === taskId) {
          return {
            ...task,
            status,
            completedAt: status === 'completed' ? new Date().toISOString() : undefined,
          };
        }
        return task;
      });
      try {
        localStorage.setItem('wp_crm_housekeeping', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    showToast(`Housekeeping task marked as ${status}`);
  };

  // Add line charge to a folio and recalculate totals
  const addFolioCharge = (folioId: string, chargeData: Omit<FolioCharge, 'id' | 'postedAt'>) => {
    const newCharge: FolioCharge = {
      ...chargeData,
      id: `chg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      postedAt: new Date().toISOString(),
    };

    setFolios((prev) => {
      const updated = prev.map((folio) => {
        if (folio.id === folioId) {
          return recalculateFolioTotals(folio, [newCharge, ...folio.charges]);
        }
        return folio;
      });

      try {
        localStorage.setItem('wp_crm_folios', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const addFolioPayment = (folioId: string, paymentData: Omit<FolioPayment, 'id' | 'collectedAt'>) => {
    const newPayment: FolioPayment = {
      ...paymentData,
      id: `pay-${Date.now()}`,
      collectedAt: new Date().toISOString(),
    };

    setFolios((prev) => {
      const updated = prev.map((folio) => {
        if (folio.id === folioId) {
          const payments = [newPayment, ...folio.payments];
          return recalculateFolioTotals(folio, folio.charges, payments);
        }
        return folio;
      });

      try {
        localStorage.setItem('wp_crm_folios', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });

    showToast(`Payment of ₹${paymentData.amount.toLocaleString('en-IN')} recorded successfully`);
  };

  const settleFolio = (folioId: string, paymentMethod: PaymentMethod, notes?: string) => {
    const targetFolio = folios.find((f) => f.id === folioId);
    if (!targetFolio) return;

    if (targetFolio.balanceDue > 0) {
      addFolioPayment(folioId, {
        folioId,
        amount: targetFolio.balanceDue,
        paymentMethod,
        receiptNotes: notes || 'Folio check-out final settlement',
        collectedByName: role === 'admin' ? 'Administrator' : 'Duty Manager',
      });
    }

    setFolios((prev) => {
      const updated = prev.map((f) => (f.id === folioId ? { ...f, status: 'settled' as const, settledAt: new Date().toISOString() } : f));
      try {
        localStorage.setItem('wp_crm_folios', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    showToast(`Folio #${targetFolio.folioNumber} settled in full.`);
  };

  // QR Food Order Creation
  const createFoodOrder = (orderData: Omit<FoodOrder, 'id' | 'orderNumber' | 'createdAt'>): FoodOrder => {
    const orderNumber = `ORD-${1000 + foodOrders.length + 1}`;
    const newOrder: FoodOrder = {
      ...orderData,
      id: `ord-${Date.now()}`,
      orderNumber,
      createdAt: new Date().toISOString(),
    };

    setFoodOrders((prev) => {
      const updated = [newOrder, ...prev];
      try {
        localStorage.setItem('wp_crm_food_orders', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });

    // Automatically post line charge to guest folio as "pending"
    if (orderData.folioId) {
      addFolioCharge(orderData.folioId, {
        folioId: orderData.folioId,
        category: 'food_beverage',
        chargeStatus: 'pending',
        title: `Food Order #${orderNumber} (${orderData.items.map((i) => `${i.quantity}x ${i.itemName}`).join(', ')})`,
        amount: orderData.totalAmount,
        sourceReferenceType: 'food_order',
        sourceReferenceId: newOrder.id,
      });
    }

    showToast(`Food Order ${orderNumber} placed and charged to Folio as Pending!`);
    return newOrder;
  };

  const updateFoodOrderStatus = (orderId: string, status: FoodOrderStatus) => {
    setFoodOrders((prev) => {
      const updated = prev.map((ord) => {
        if (ord.id === orderId) {
          return { ...ord, status };
        }
        return ord;
      });
      try {
        localStorage.setItem('wp_crm_food_orders', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });

    // If order delivered or accepted, confirm the folio charge to posted; if cancelled, void and recalculate!
    if (['accepted_kitchen', 'preparing', 'delivered'].includes(status)) {
      setFolios((prev) => {
        const updated = prev.map((fol) => ({
          ...fol,
          charges: fol.charges.map((c) =>
            c.sourceReferenceId === orderId ? { ...c, chargeStatus: 'posted' as const } : c
          ),
        }));
        try {
          localStorage.setItem('wp_crm_folios', JSON.stringify(updated));
        } catch {}
        return updated;
      });
    } else if (status === 'cancelled') {
      setFolios((prev) => {
        const updated = prev.map((fol) => {
          const hasCharge = fol.charges.some((c) => c.sourceReferenceId === orderId);
          if (!hasCharge) return fol;
          const newCharges = fol.charges.map((c) =>
            c.sourceReferenceId === orderId ? { ...c, chargeStatus: 'void' as const } : c
          );
          return recalculateFolioTotals(fol, newCharges);
        });
        try {
          localStorage.setItem('wp_crm_folios', JSON.stringify(updated));
        } catch {}
        return updated;
      });
    }

    showToast(`Order status updated to ${status.replace('_', ' ')}`);
  };

  const toggleMenuItemAvailability = (itemId: string) => {
    setMenuItems((prev) => {
      let nextStatus = false;
      const updated = prev.map((item) => {
        if (item.id === itemId) {
          nextStatus = !item.isAvailable;
          return { ...item, isAvailable: nextStatus };
        }
        return item;
      });
      try {
        localStorage.setItem('wp_crm_menu_items', JSON.stringify(updated));
      } catch {}
      const targetItem = prev.find((i) => i.id === itemId);
      showToast(`${targetItem?.name || 'Item'} is now ${nextStatus ? 'IN STOCK' : 'OUT OF STOCK'}`);
      return updated;
    });
  };

  // QR Transport / Dispatch creation
  const createTransportRequest = (
    requestData: Omit<TransportRequest, 'id' | 'requestNumber' | 'createdAt' | 'homestayCommission'>
  ): TransportRequest => {
    const requestNumber = `DSP-${500 + dispatchRequests.length + 1}`;
    const vendorCost = requestData.vendorCost || Math.round(requestData.quotedPrice * 0.75);
    const homestayCommission = requestData.quotedPrice - vendorCost;

    const newRequest: TransportRequest = {
      ...requestData,
      id: `dsp-${Date.now()}`,
      requestNumber,
      vendorCost,
      homestayCommission,
      createdAt: new Date().toISOString(),
    };

    setDispatchRequests((prev) => {
      const updated = [newRequest, ...prev];
      try {
        localStorage.setItem('wp_crm_dispatch', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });

    // Automatically post to Folio as pending
    if (requestData.folioId) {
      addFolioCharge(requestData.folioId, {
        folioId: requestData.folioId,
        category: requestData.serviceType === 'point_to_point' ? 'transport_transfer' : 'vehicle_rental',
        chargeStatus: 'pending',
        title: `${requestData.serviceType === 'point_to_point' ? 'Transfer' : 'Rental'}: ${requestData.routeTitle || requestData.rentalVehicleName} (#${requestNumber})`,
        amount: requestData.quotedPrice,
        sourceReferenceType: 'transport_request',
        sourceReferenceId: newRequest.id,
      });
    }

    showToast(`Transport Request ${requestNumber} submitted! Awaiting Manager dispatch.`);
    return newRequest;
  };

  const confirmDispatchRequest = (
    requestId: string,
    details: { assignedDriverName: string; assignedDriverPhone: string; vehiclePlateNumber: string; vendorCost?: number }
  ) => {
    setDispatchRequests((prev) => {
      const updated = prev.map((req) => {
        if (req.id === requestId) {
          const vendorCost = details.vendorCost ?? req.vendorCost;
          const commission = req.quotedPrice - vendorCost;
          return {
            ...req,
            ...details,
            vendorCost,
            homestayCommission: commission,
            dispatchStatus: 'confirmed_dispatched' as DispatchStatus,
            confirmedAt: new Date().toISOString(),
          };
        }
        return req;
      });
      try {
        localStorage.setItem('wp_crm_dispatch', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });

    // Also mark the folio charge as 'posted' and persist to localStorage
    setFolios((prev) => {
      const updated = prev.map((fol) => ({
        ...fol,
        charges: fol.charges.map((c) =>
          c.sourceReferenceId === requestId ? { ...c, chargeStatus: 'posted' as const } : c
        ),
      }));
      try {
        localStorage.setItem('wp_crm_folios', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    showToast('Transport dispatch confirmed and driver details assigned.');
  };

  const cancelDispatchRequest = (requestId: string) => {
    setDispatchRequests((prev) => {
      const updated = prev.map((req) => (req.id === requestId ? { ...req, dispatchStatus: 'cancelled' as DispatchStatus } : req));
      try {
        localStorage.setItem('wp_crm_dispatch', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // Void charge on folio AND recalculate folio totals so guest is not billed!
    setFolios((prev) => {
      const updated = prev.map((fol) => {
        const hasCharge = fol.charges.some((c) => c.sourceReferenceId === requestId);
        if (!hasCharge) return fol;
        const newCharges = fol.charges.map((c) =>
          c.sourceReferenceId === requestId ? { ...c, chargeStatus: 'void' as const } : c
        );
        return recalculateFolioTotals(fol, newCharges);
      });
      try {
        localStorage.setItem('wp_crm_folios', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    showToast('Transport request cancelled and folio charge voided.');
  };

  // Expenses Logger (Admin Only)
  const addExpense = (expenseData: Omit<Expense, 'id' | 'createdAt'>) => {
    const newExpense: Expense = {
      ...expenseData,
      id: `exp-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    setExpenses((prev) => {
      const updated = [newExpense, ...prev];
      try {
        localStorage.setItem('wp_crm_expenses', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });

    showToast(`Logged expense of ₹${expenseData.amount.toLocaleString('en-IN')} under ${expenseData.masterCategory}`);
  };

  const deleteExpense = (expenseId: string) => {
    setExpenses((prev) => {
      const updated = prev.filter((e) => e.id !== expenseId);
      try {
        localStorage.setItem('wp_crm_expenses', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
    showToast('Expense entry deleted.');
  };

  // Check-In and Check-Out actions
  const checkInRoom = (bookingId: string) => {
    const bk = bookings.find((b) => b.id === bookingId);
    if (!bk) return;

    setBookings((prev) => {
      const updated = prev.map((b) => (b.id === bookingId ? { ...b, tapeStatus: 'checked_in' as const, bookingStatus: 'checked_in' as const, checkedInAt: new Date().toISOString() } : b));
      try {
        localStorage.setItem('wp_crm_bookings', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setRooms((prev) => {
      const updated = prev.map((r) => (r.id === bk.roomId ? { ...r, currentStatus: 'checked_in' as const } : r));
      try {
        localStorage.setItem('wp_crm_rooms', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    showToast(`Room ${bk.roomNumber} (${bk.guest.fullName}) is now Checked-In! In-Room QR is now active.`);
  };

  const checkOutRoom = (bookingId: string) => {
    const bk = bookings.find((b) => b.id === bookingId);
    if (!bk) return;

    setBookings((prev) => {
      const updated = prev.map((b) => (b.id === bookingId ? { ...b, tapeStatus: 'available' as const, bookingStatus: 'checked_out' as const, checkedOutAt: new Date().toISOString() } : b));
      try {
        localStorage.setItem('wp_crm_bookings', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setRooms((prev) => {
      const updated = prev.map((r) => (r.id === bk.roomId ? { ...r, currentStatus: 'available' as const, housekeeping: 'deep_clean_turnover' as const } : r));
      try {
        localStorage.setItem('wp_crm_rooms', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // Auto-create a turnover housekeeping task
    const newTask: HousekeepingTask = {
      id: `hk-${Date.now()}`,
      roomId: bk.roomId,
      roomNumber: bk.roomNumber,
      roomName: bk.roomName,
      scheduleDate: new Date().toISOString().split('T')[0],
      taskType: 'deep_clean_turnover',
      status: 'pending',
      assignedToName: 'Dawa Lepcha',
      priority: 'high',
      checklist: {
        linens_changed: false,
        toiletries_restocked: false,
        fireplace_prepped: false,
        balcony_cleaned: false,
      },
      notes: `Turnover clean following check-out of ${bk.guest.fullName}.`,
    };
    setHousekeepingTasks((prev) => {
      const updated = [newTask, ...prev];
      try {
        localStorage.setItem('wp_crm_housekeeping', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    showToast(`Room ${bk.roomNumber} checked out. Turnover deep cleaning scheduled.`);
  };

  // Staff Account & Authentication Actions
  const setCurrentUser = (user: StaffAccount | null) => {
    setCurrentUserState(user);
    try {
      if (user) {
        localStorage.setItem('wp_crm_current_user', JSON.stringify(user));
        setRoleState(user.role);
        localStorage.setItem('wp_crm_role', user.role);
      } else {
        localStorage.removeItem('wp_crm_current_user');
      }
    } catch {
      // ignore
    }
  };

  const addStaffAccount = async (accountData: Omit<StaffAccount, 'id' | 'createdAt'>): Promise<StaffAccount> => {
    const newAccount: StaffAccount = {
      ...accountData,
      id: `staff-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setStaffAccounts((prev) => {
      const updated = [...prev, newAccount];
      try {
        localStorage.setItem('wp_crm_staff_accounts', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    showToast(`Staff member "${newAccount.fullName}" added as ${newAccount.role.replace('_', ' ').toUpperCase()}`);
    return newAccount;
  };

  const updateStaffAccount = async (id: string, updates: Partial<StaffAccount>): Promise<void> => {
    setStaffAccounts((prev) => {
      const updated = prev.map((acc) => (acc.id === id ? { ...acc, ...updates } : acc));
      try {
        localStorage.setItem('wp_crm_staff_accounts', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (currentUser?.id === id) {
      setCurrentUserState((prev) => (prev ? { ...prev, ...updates } : null));
      try {
        const stored = localStorage.getItem('wp_crm_current_user');
        if (stored) {
          localStorage.setItem('wp_crm_current_user', JSON.stringify({ ...JSON.parse(stored), ...updates }));
        }
      } catch {}
    }
    showToast('Staff profile updated successfully');
  };

  const deleteStaffAccount = async (id: string): Promise<{ success: boolean; error?: string }> => {
    const target = staffAccounts.find((a) => a.id === id);
    if (!target) return { success: false, error: 'Staff account not found' };

    if (currentUser?.id === id) {
      showToast('Cannot delete your own active account while logged in.', 'error');
      return { success: false, error: 'Cannot delete your own active account.' };
    }

    if (target.role === 'admin') {
      const activeAdmins = staffAccounts.filter((a) => a.role === 'admin' && a.id !== id && a.isActive);
      if (activeAdmins.length === 0) {
        showToast('Cannot delete the last active administrator account.', 'error');
        return { success: false, error: 'At least one active admin account is required.' };
      }
    }

    setStaffAccounts((prev) => {
      const updated = prev.filter((acc) => acc.id !== id);
      try {
        localStorage.setItem('wp_crm_staff_accounts', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    showToast(`Account for "${target.fullName}" removed`);
    return { success: true };
  };

  const authenticateStaff = async (
    identifier: string,
    password: string
  ): Promise<{ success: boolean; user?: StaffAccount; error?: string }> => {
    const cleanId = identifier.trim().toLowerCase();
    const found = staffAccounts.find(
      (acc) =>
        (acc.email.toLowerCase() === cleanId ||
          acc.fullName.toLowerCase() === cleanId ||
          (acc.role === 'admin' && (cleanId === 'info.saverahomestay@gmail.com' || cleanId === 'admin'))) &&
        acc.password === password
    );

    if (!found) {
      return { success: false, error: 'Invalid email or password. Please check your credentials.' };
    }

    if (!found.isActive) {
      return { success: false, error: 'This account has been deactivated. Please contact the administrator.' };
    }

    setCurrentUser(found);
    setRoleState(found.role);
    try {
      localStorage.setItem('wp_crm_role', found.role);
      localStorage.setItem('wp_crm_current_user', JSON.stringify(found));
    } catch {}

    showToast(`Signed in as ${found.fullName} (${found.role.replace('_', ' ').toUpperCase()})`);
    return { success: true, user: found };
  };

  // =========================================================================
  // Menu Management CRUD (In-Room Dining)
  // =========================================================================
  const addMenuItem = (item: Omit<MenuItem, 'id'>): MenuItem => {
    const newItem: MenuItem = { ...item, id: `menu-${Date.now()}` };
    setMenuItems((prev) => {
      const updated = [...prev, newItem];
      try {
        localStorage.setItem('wp_crm_menu_items', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    showToast(`Added "${newItem.name}" to dining menu`);
    return newItem;
  };

  const updateMenuItem = (id: string, updates: Partial<MenuItem>) => {
    setMenuItems((prev) => {
      const updated = prev.map((m) => (m.id === id ? { ...m, ...updates } : m));
      try {
        localStorage.setItem('wp_crm_menu_items', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    showToast('Menu item updated');
  };

  const deleteMenuItem = (id: string) => {
    setMenuItems((prev) => {
      const updated = prev.filter((m) => m.id !== id);
      try {
        localStorage.setItem('wp_crm_menu_items', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    showToast('Dish removed from menu');
  };

  // =========================================================================
  // Travel Add-ons & Transfers CRUD
  // =========================================================================
  const addTransferRoute = (route: Omit<TransferRoute, 'id'>): TransferRoute => {
    const newRoute: TransferRoute = { ...route, id: `route-${Date.now()}` };
    setTransferRoutes((prev) => {
      const updated = [...prev, newRoute];
      try {
        localStorage.setItem('wp_crm_transfer_routes', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    showToast(`Added transfer route "${newRoute.title}"`);
    return newRoute;
  };

  const updateTransferRoute = (id: string, updates: Partial<TransferRoute>) => {
    setTransferRoutes((prev) => {
      const updated = prev.map((r) => (r.id === id ? { ...r, ...updates } : r));
      try {
        localStorage.setItem('wp_crm_transfer_routes', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    showToast('Transfer route updated');
  };

  const deleteTransferRoute = (id: string) => {
    setTransferRoutes((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      try {
        localStorage.setItem('wp_crm_transfer_routes', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    showToast('Transfer route removed');
  };

  const addRentalVehicle = (vehicle: Omit<RentalVehicle, 'id'>): RentalVehicle => {
    const newVehicle: RentalVehicle = { ...vehicle, id: `veh-${Date.now()}` };
    setRentalVehicles((prev) => {
      const updated = [...prev, newVehicle];
      try {
        localStorage.setItem('wp_crm_rental_vehicles', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    showToast(`Added vehicle "${newVehicle.vehicleName}"`);
    return newVehicle;
  };

  const updateRentalVehicle = (id: string, updates: Partial<RentalVehicle>) => {
    setRentalVehicles((prev) => {
      const updated = prev.map((v) => (v.id === id ? { ...v, ...updates } : v));
      try {
        localStorage.setItem('wp_crm_rental_vehicles', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    showToast('Rental vehicle updated');
  };

  const deleteRentalVehicle = (id: string) => {
    setRentalVehicles((prev) => {
      const updated = prev.filter((v) => v.id !== id);
      try {
        localStorage.setItem('wp_crm_rental_vehicles', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    showToast('Rental vehicle removed');
  };

  // =========================================================================
  // Seasonal Date Ranges & Dynamic Tariffs
  // =========================================================================
  const addSeasonalRange = (rangeData: Omit<SeasonalDateRange, 'id'>): SeasonalDateRange => {
    const newRange: SeasonalDateRange = { ...rangeData, id: `season-${Date.now()}` };
    setSeasonalDateRanges((prev) => {
      const updated = [...prev, newRange];
      try {
        localStorage.setItem('wp_crm_seasonal_ranges', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    showToast(`Added seasonal period "${newRange.name}"`);
    return newRange;
  };

  const updateSeasonalRange = (id: string, updates: Partial<SeasonalDateRange>) => {
    setSeasonalDateRanges((prev) => {
      const updated = prev.map((r) => (r.id === id ? { ...r, ...updates } : r));
      try {
        localStorage.setItem('wp_crm_seasonal_ranges', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    showToast('Seasonal period updated');
  };

  const deleteSeasonalRange = (id: string) => {
    setSeasonalDateRanges((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      try {
        localStorage.setItem('wp_crm_seasonal_ranges', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    showToast('Seasonal period removed');
  };

  const updateRoomTariffs = (roomId: string, tariffs: RoomSeasonalTariffs) => {
    setRoomTariffs((prev) => {
      const updated = { ...prev, [roomId]: tariffs };
      try {
        localStorage.setItem('wp_crm_room_tariffs', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    showToast('Room seasonal tariffs saved successfully');
  };

  const calculateDynamicTariff = (
    roomId: string,
    checkIn: string,
    checkOut: string,
    mealPlan: MealPlan = 'CP'
  ) => {
    const tariffs = roomTariffs[roomId] || INITIAL_ROOM_SEASONAL_TARIFFS[roomId] || {
      regular: { EP: 4000, CP: 4500, MAP: 5500, AP: 6500 },
      season: { EP: 6000, CP: 6800, MAP: 8000, AP: 9200 },
      offSeason: { EP: 3200, CP: 3600, MAP: 4400, AP: 5200 },
      weekendSurchargePercent: 10,
    };

    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = end.getTime() - start.getTime();
    const nights = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));

    let totalAmount = 0;
    const breakdown: {
      date: string;
      rateName: string;
      seasonType: 'season' | 'off_season' | 'regular';
      amount: number;
    }[] = [];

    const curr = new Date(start);
    for (let i = 0; i < nights; i++) {
      const dateStr = curr.toISOString().split('T')[0];
      const dayOfWeek = curr.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;

      let seasonType: 'season' | 'off_season' | 'regular' = 'regular';
      let matchedSeasonName = 'Regular Tariff';

      for (const range of seasonalDateRanges) {
        if (dateStr >= range.startDate && dateStr <= range.endDate) {
          seasonType = range.seasonType;
          matchedSeasonName = range.name;
          break;
        }
      }

      let baseNightlyRate = tariffs.regular[mealPlan] || tariffs.regular.CP;
      if (seasonType === 'season') {
        baseNightlyRate = tariffs.season[mealPlan] || tariffs.season.CP;
      } else if (seasonType === 'off_season') {
        baseNightlyRate = tariffs.offSeason[mealPlan] || tariffs.offSeason.CP;
      }

      if (isWeekend && tariffs.weekendSurchargePercent && seasonType === 'regular') {
        baseNightlyRate = Math.round(baseNightlyRate * (1 + tariffs.weekendSurchargePercent / 100));
        matchedSeasonName += ' (Weekend)';
      }

      totalAmount += baseNightlyRate;
      breakdown.push({
        date: dateStr,
        rateName: `${matchedSeasonName} (${mealPlan})`,
        seasonType,
        amount: baseNightlyRate,
      });

      curr.setDate(curr.getDate() + 1);
    }

    const avgRatePerNight = Math.round(totalAmount / nights);

    return {
      totalAmount,
      nights,
      avgRatePerNight,
      breakdown,
    };
  };

  return (
    <CRMContext.Provider
      value={{
        role,
        setRole,
        rooms,
        bookings,
        folios,
        menuItems,
        foodOrders,
        dispatchRequests,
        housekeepingTasks,
        expenses,
        transferRoutes,
        rentalVehicles,
        seasonalDateRanges,
        roomTariffs,
        toast,
        showToast,
        updateRoomStatus,
        updateGuestPreferences,
        toggleHousekeepingCheck,
        updateHousekeepingStatus,
        createFoodOrder,
        updateFoodOrderStatus,
        toggleMenuItemAvailability,
        createTransportRequest,
        confirmDispatchRequest,
        cancelDispatchRequest,
        addExpense,
        deleteExpense,
        addFolioCharge,
        addFolioPayment,
        settleFolio,
        checkInRoom,
        checkOutRoom,
        addMenuItem,
        updateMenuItem,
        deleteMenuItem,
        addTransferRoute,
        updateTransferRoute,
        deleteTransferRoute,
        addRentalVehicle,
        updateRentalVehicle,
        deleteRentalVehicle,
        addSeasonalRange,
        updateSeasonalRange,
        deleteSeasonalRange,
        updateRoomTariffs,
        calculateDynamicTariff,
        staffAccounts,
        currentUser,
        setCurrentUser,
        addStaffAccount,
        updateStaffAccount,
        deleteStaffAccount,
        authenticateStaff,
      }}
    >
      {children}
    </CRMContext.Provider>
  );
}

export function useCRM() {
  const context = useContext(CRMContext);
  if (!context) {
    throw new Error('useCRM must be used within a CRMProvider');
  }
  return context;
}
