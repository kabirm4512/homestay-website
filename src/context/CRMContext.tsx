'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
  Guest,
  ManagerActivityLog,
} from '@/types/crm';
import { generateUniversalBookingId } from '@/lib/booking-id';
import {
  calculateDynamicTariff as calculateCanonicalTariff,
  DynamicTariffResult,
  resolveRoomTariffs,
  resolveSeasonForNight,
  nightsBetween,
} from '@/lib/tariff-calculator';
import { fetchLiveTariffs, parseTariffResponse, publishLiveTariffs } from '@/lib/live-tariffs';
import { adminPostJson } from '@/lib/admin-api';
import { recalculateFolioTotals, apportionTax, accommodationGstForTotal } from '@/lib/folio';
import { DEFAULT_GST_CONFIG, GstConfig } from '@/lib/gst';
import { rentalRate, transferRate } from '@/lib/transport-pricing';

type SyncCollectionName =
  | 'physicalRooms'
  | 'crmBookings'
  | 'folios'
  | 'foodOrders'
  | 'dispatchRequests'
  | 'housekeepingTasks'
  | 'expenses'
  | 'menuItems'
  | 'transferRoutes'
  | 'rentalVehicles'
  | 'activityLogs';

interface ClientSyncOp {
  collection: SyncCollectionName;
  op: 'upsert' | 'delete';
  id: string;
  record?: Record<string, unknown>;
}

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
  /** 'ready' once live tariffs have loaded from the server; prices must not be shown/saved before. */
  tariffsStatus: 'loading' | 'ready' | 'error';
  /** GST rules from /api/tariffs (configurable on the server). */
  gstConfig: GstConfig;
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
  /** Placed and priced on the server; resolves null if it could not be placed. */
  createFoodOrder: (order: Omit<FoodOrder, 'id' | 'orderNumber' | 'createdAt'>) => Promise<FoodOrder | null>;
  updateFoodOrderStatus: (orderId: string, status: FoodOrderStatus) => void;
  toggleMenuItemAvailability: (itemId: string) => void;
  createTransportRequest: (request: Omit<TransportRequest, 'id' | 'requestNumber' | 'createdAt' | 'homestayCommission'>) => Promise<TransportRequest | null>;
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
  managerActivityLogs: ManagerActivityLog[];
  logManagerActivity: (activity: Omit<ManagerActivityLog, 'id' | 'timestamp'>) => ManagerActivityLog;
  approveFoodOrder: (orderId: string, managerInfo: { id: string; name: string }) => void;
  rejectFoodOrder: (orderId: string, reason: string, managerInfo: { id: string; name: string }) => void;
  completeCheckoutWithSettlement: (
    bookingId: string,
    checkoutData: {
      paymentMethod: PaymentMethod;
      amountCollected: number;
      transactionReference?: string;
      notes?: string;
      managerId: string;
      managerName: string;
    }
  ) => void;
  checkInRoom: (bookingId: string, managerInfo?: { id: string; name: string }) => void;
  checkOutRoom: (bookingId: string) => void;

  // Manual Room Assignment & Guest Document Management
  createManualBooking: (bookingData: {
    roomId: string;
    checkInDate: string;
    checkOutDate: string;
    roomRatePerNight: number;
    totalRoomAmount?: number;
    mealPlan: MealPlan;
    adultsCount: number;
    childrenCount: number;
    infantsCount?: number;
    extraAdultChargePerNight?: number;
    extraChildChargePerNight?: number;
    status: RoomTapeStatus;
    specialRequests?: string;
    notes?: string;
    isManualRate?: boolean;
    advancePaid?: number;
    advancePaymentMethod?: PaymentMethod;
    gstAmount?: number;
    sourceBookingId?: string;
    guest: {
      fullName: string;
      phone: string;
      email?: string;
      idType?: string;
      idNumber?: string;
      idDocumentUrl?: string;
      idDocumentBackUrl?: string;
      address?: string;
      city?: string;
      state?: string;
      nationality?: string;
      dietaryPreferences?: string;
      hospitalityPreferences?: string;
    };
  }) => CRMBooking;
  updateBookingGuestDetails: (
    bookingId: string,
    guestUpdates: Partial<Guest>,
    bookingUpdates?: Partial<CRMBooking>
  ) => void;
  updateBookingDocumentStatus: (
    bookingId: string,
    status: 'pending' | 'submitted' | 'verified'
  ) => void;

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
  updateSeasonalRange: (id: string, updates: Partial<SeasonalDateRange>) => Promise<boolean>;
  deleteSeasonalRange: (id: string) => Promise<boolean>;
  /** Saves to the server first; resolves true only when the live site will see the change. */
  updateRoomTariffs: (roomId: string, tariffs: RoomSeasonalTariffs) => Promise<boolean>;
  /** Canonical engine (same as website & server). Returns null when the stay cannot be priced. */
  calculateDynamicTariff: (
    roomId: string,
    checkIn: string,
    checkOut: string,
    mealPlan?: MealPlan,
    adultsCount?: number,
    childrenCount?: number
  ) => DynamicTariffResult | null;
  getSeasonForDate: (dateStr: string) => {
    seasonType: 'season' | 'off_season' | 'regular';
    seasonName: string;
  };
  calculateDynamicTransferRate: (
    route: TransferRoute,
    dateStr: string,
    tier: 'wagonr' | 'sedan' | 'suv'
  ) => {
    rate: number;
    baseRate: number;
    seasonType: 'season' | 'off_season' | 'regular';
    seasonName: string;
    isSurgeApplied: boolean;
  };
  calculateDynamicRentalRate: (
    vehicle: RentalVehicle,
    startDateStr: string,
    endDateStr?: string
  ) => {
    totalRate: number;
    days: number;
    dailyAvgRate: number;
    breakdown: { date: string; rate: number; seasonType: 'season' | 'off_season' | 'regular'; seasonName: string }[];
  };

  // Staff User Management (Admin Managed)
  staffAccounts: StaffAccount[];
  currentUser: StaffAccount | null;
  setCurrentUser: (user: StaffAccount | null) => void;
  addStaffAccount: (account: Omit<StaffAccount, 'id' | 'createdAt'>) => Promise<StaffAccount>;
  updateStaffAccount: (id: string, updates: Partial<StaffAccount>) => Promise<void>;
  deleteStaffAccount: (id: string) => Promise<{ success: boolean; error?: string }>;
  authenticateStaff: (identifier: string, password: string) => Promise<{ success: boolean; user?: StaffAccount; error?: string }>;
  /** 'checking' until the server has said whether a staff member is signed in. */
  authStatus: 'checking' | 'signed_in' | 'signed_out';
  signOut: () => Promise<void>;
  changeOwnPassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;

  // Fresh Start / Operational Data Reset
  resetAllOperationalData: () => void;
}

// Folio arithmetic (incl. GST) is shared with the server.
export { recalculateFolioTotals };

const CRMContext = createContext<CRMContextType | undefined>(undefined);

export function CRMProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<StaffRole>('admin');
  const [rooms, setRooms] = useState<PhysicalRoom[]>([]);
  const [bookings, setBookings] = useState<CRMBooking[]>([]);
  const [folios, setFolios] = useState<GuestFolio[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [foodOrders, setFoodOrders] = useState<FoodOrder[]>([]);
  const [dispatchRequests, setDispatchRequests] = useState<TransportRequest[]>([]);
  const [housekeepingTasks, setHousekeepingTasks] = useState<HousekeepingTask[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [transferRoutes, setTransferRoutes] = useState<TransferRoute[]>([]);
  const [rentalVehicles, setRentalVehicles] = useState<RentalVehicle[]>([]);
  // Live pricing data: always loaded from the server (GET /api/tariffs); never seeded or cached locally.
  const [seasonalDateRanges, setSeasonalDateRanges] = useState<SeasonalDateRange[]>([]);
  const [roomTariffs, setRoomTariffs] = useState<Record<string, RoomSeasonalTariffs>>({});
  const [tariffsStatus, setTariffsStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [gstConfig, setGstConfig] = useState<GstConfig>(DEFAULT_GST_CONFIG);
  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>([]);
  const [currentUser, setCurrentUserState] = useState<StaffAccount | null>(null);
  const [authStatus, setAuthStatus] = useState<'checking' | 'signed_in' | 'signed_out'>('checking');
  const [managerActivityLogs, setManagerActivityLogs] = useState<ManagerActivityLog[]>([]);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToast({ id, message, type });
    setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 4000);
  }, []);

  // =========================================================================
  // Server sync engine
  // -------------------------------------------------------------------------
  // The server (Postgres) is the only source of truth. Staff devices load the
  // working set from /api/crm/state, and every local change is diffed record by
  // record and sent to /api/crm/mutate (permission-checked and audited there).
  // The server's copy of each saved record is applied back to state, and state is
  // refreshed every few seconds so all devices stay in step. Guests (QR concierge,
  // portal) never write these collections; they use the guest APIs instead.
  // =========================================================================
  const isStaffRef = useRef(false);
  const pendingOpsRef = useRef(0);
  const opQueueRef = useRef<ClientSyncOp[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const settersRef = useRef<Record<SyncCollectionName, React.Dispatch<React.SetStateAction<any[]>>>>({
    physicalRooms: setRooms as React.Dispatch<React.SetStateAction<any[]>>,
    crmBookings: setBookings as React.Dispatch<React.SetStateAction<any[]>>,
    folios: setFolios as React.Dispatch<React.SetStateAction<any[]>>,
    foodOrders: setFoodOrders as React.Dispatch<React.SetStateAction<any[]>>,
    dispatchRequests: setDispatchRequests as React.Dispatch<React.SetStateAction<any[]>>,
    housekeepingTasks: setHousekeepingTasks as React.Dispatch<React.SetStateAction<any[]>>,
    expenses: setExpenses as React.Dispatch<React.SetStateAction<any[]>>,
    menuItems: setMenuItems as React.Dispatch<React.SetStateAction<any[]>>,
    transferRoutes: setTransferRoutes as React.Dispatch<React.SetStateAction<any[]>>,
    rentalVehicles: setRentalVehicles as React.Dispatch<React.SetStateAction<any[]>>,
    activityLogs: setManagerActivityLogs as React.Dispatch<React.SetStateAction<any[]>>,
  });

  /** Puts the server's copy of a record into state (no sync back). */
  const applyServerRecord = useCallback((collection: SyncCollectionName, id: string, record: unknown, deleted?: boolean) => {
    const setter = settersRef.current[collection];
    if (!setter) return;
    setter((prev: any[]) => {
      if (deleted) return prev.filter((x) => x.id !== id);
      const exists = prev.some((x) => x.id === id);
      return exists ? prev.map((x) => (x.id === id ? record : x)) : [record, ...prev];
    });
  }, []);

  const applyState = useCallback((state: Record<string, any>) => {
    if (Array.isArray(state.physicalRooms)) setRooms(state.physicalRooms);
    if (Array.isArray(state.crmBookings)) setBookings(state.crmBookings);
    if (Array.isArray(state.folios)) setFolios(state.folios);
    if (Array.isArray(state.foodOrders)) setFoodOrders(state.foodOrders);
    if (Array.isArray(state.dispatchRequests)) setDispatchRequests(state.dispatchRequests);
    if (Array.isArray(state.housekeepingTasks)) setHousekeepingTasks(state.housekeepingTasks);
    if (Array.isArray(state.expenses)) setExpenses(state.expenses);
    if (Array.isArray(state.menuItems)) setMenuItems(state.menuItems);
    if (Array.isArray(state.transferRoutes)) setTransferRoutes(state.transferRoutes);
    if (Array.isArray(state.rentalVehicles)) setRentalVehicles(state.rentalVehicles);
    if (Array.isArray(state.activityLogs)) setManagerActivityLogs(state.activityLogs);
    if (state.tariffs && Array.isArray(state.seasonalDateRanges)) {
      setRoomTariffs(state.tariffs);
      setSeasonalDateRanges(state.seasonalDateRanges);
      setTariffsStatus('ready');
    }
  }, []);

  const handleSignedOut = useCallback(() => {
    isStaffRef.current = false;
    setCurrentUserState(null);
    setAuthStatus('signed_out');
    setBookings([]);
    setFolios([]);
    setFoodOrders([]);
    setDispatchRequests([]);
    setHousekeepingTasks([]);
    setExpenses([]);
    setManagerActivityLogs([]);
    setStaffAccounts([]);
  }, []);

  const refreshState = useCallback(async () => {
    if (!isStaffRef.current) return;
    try {
      const res = await fetch('/api/crm/state', { cache: 'no-store' });
      if (res.status === 401) {
        handleSignedOut();
        return;
      }
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json.state && pendingOpsRef.current === 0) applyState(json.state);
    } catch {
      // offline: keep what we have; the next poll retries
    }
  }, [applyState, handleSignedOut]);

  const flushOps = useCallback(async () => {
    flushTimerRef.current = null;
    const raw = opQueueRef.current.splice(0);
    if (raw.length === 0) return;
    // Last change per record wins (state updaters can run twice in development)
    const latest = new Map<string, ClientSyncOp>();
    for (const op of raw) latest.set(`${op.collection}:${op.id}`, op);
    const ops = Array.from(latest.values());

    pendingOpsRef.current += 1;
    let firstError: string | null = null;
    try {
      for (let i = 0; i < ops.length; i += 50) {
        const res = await fetch('/api/crm/mutate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ops: ops.slice(i, i + 50) }),
        });
        const json = await res.json().catch(() => null);
        if (res.status === 401) {
          firstError = 'Your session has expired. Please sign in again; the last change was not saved.';
          handleSignedOut();
          break;
        }
        if (!res.ok || !json?.success) {
          firstError = json?.error || (res.status === 413 ? 'That upload is too large to save.' : 'Could not save to the server.');
          continue;
        }
        for (const r of json.results as { collection: SyncCollectionName; id: string; ok: boolean; record?: unknown; deleted?: boolean; error?: string }[]) {
          if (r.ok) applyServerRecord(r.collection, r.id, r.record, r.deleted);
          else if (!firstError) firstError = r.error || 'A change could not be saved.';
        }
      }
    } catch {
      firstError = 'You appear to be offline. The last change was not saved to the server.';
    } finally {
      pendingOpsRef.current -= 1;
    }
    if (firstError) {
      showToastRef.current(firstError, 'error');
      await refreshState(); // put the screen back in step with what was actually saved
    }
  }, [applyServerRecord, handleSignedOut, refreshState]);

  /** Diffs a collection before/after a local change and queues the record-level writes. */
  const queueSync = useCallback(
    (collection: SyncCollectionName, prev: { id: string }[], next: { id: string }[]) => {
      if (!isStaffRef.current) return;
      const before = new Map(prev.map((r) => [r.id, r]));
      const after = new Map(next.map((r) => [r.id, r]));
      after.forEach((rec, id) => {
        const old = before.get(id);
        if (!old || JSON.stringify(old) !== JSON.stringify(rec)) {
          opQueueRef.current.push({ collection, op: 'upsert', id, record: rec as unknown as Record<string, unknown> });
        }
      });
      before.forEach((_rec, id) => {
        if (!after.has(id)) opQueueRef.current.push({ collection, op: 'delete', id });
      });
      if (opQueueRef.current.length > 0 && !flushTimerRef.current) {
        flushTimerRef.current = setTimeout(() => void flushOps(), 0);
      }
    },
    [flushOps]
  );

  /** Public catalogue for guest devices (menu, transfers, rentals, room list). */
  const loadPublicCatalog = useCallback(async () => {
    try {
      const [addonsRes, roomsRes] = await Promise.all([
        fetch('/api/addons', { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
        fetch('/api/physical-rooms', { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
      ]);
      if (addonsRes?.success && addonsRes.data) {
        if (Array.isArray(addonsRes.data.menuItems)) setMenuItems(addonsRes.data.menuItems);
        if (Array.isArray(addonsRes.data.transferRoutes)) setTransferRoutes(addonsRes.data.transferRoutes);
        if (Array.isArray(addonsRes.data.rentalVehicles)) setRentalVehicles(addonsRes.data.rentalVehicles);
      }
      if (roomsRes?.success && Array.isArray(roomsRes.data)) setRooms(roomsRes.data);
    } catch {}
  }, []);

  const loadStaffAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/staff', { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && Array.isArray(json.staff)) setStaffAccounts(json.staff);
    } catch {}
  }, []);

  const startStaffSession = useCallback(
    async (user: StaffAccount) => {
      // Load the staff working set BEFORE showing the staff screens, so they never render
      // with the public (partial) room list a signed-out visitor gets.
      isStaffRef.current = !user.mustChangePassword;
      if (!user.mustChangePassword) await refreshState();
      setCurrentUserState(user);
      setRoleState(user.role);
      setAuthStatus('signed_in');
      if (!user.mustChangePassword && user.role === 'admin') await loadStaffAccounts();
    },
    [refreshState, loadStaffAccounts]
  );

  // Initial load: who is signed in? Then load the right data.
  useEffect(() => {
    try {
      // Remove the old insecure session keys. Old front-desk DATA is left in place until an
      // admin moves it to the server (see LegacyDataMigration); only the plain-text passwords
      // in the old staff list are stripped now.
      ['wp_crm_current_user', 'wp_crm_role', 'savera_admin_session', 'homestay_admin_token', 'homestay_admin_user'].forEach((k) =>
        localStorage.removeItem(k)
      );
      const oldStaff = localStorage.getItem('wp_crm_staff_accounts');
      if (oldStaff && oldStaff.includes('"password"')) {
        const list = JSON.parse(oldStaff);
        if (Array.isArray(list)) {
          localStorage.setItem(
            'wp_crm_staff_accounts',
            JSON.stringify(list.map(({ password: _pw, ...rest }: { password?: string }) => rest))
          );
        }
      }
    } catch {}

    let cancelled = false;
    fetchLiveTariffs(true)
      .then((live) => {
        if (cancelled) return;
        setRoomTariffs(live.tariffs);
        setSeasonalDateRanges(live.seasonalDateRanges);
        setGstConfig(live.gstConfig);
        setTariffsStatus('ready');
      })
      .catch(() => !cancelled && setTariffsStatus('error'));

    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then(async (json) => {
        if (cancelled) return;
        if (json?.success && json.user) {
          await startStaffSession(json.user as StaffAccount);
        } else {
          setAuthStatus('signed_out');
          await loadPublicCatalog();
        }
      })
      .catch(() => {
        if (cancelled) return;
        setAuthStatus('signed_out');
        void loadPublicCatalog();
      });

    // Keep every staff device in step (and pick up guest orders, check-ins, alerts)
    const poll = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (pendingOpsRef.current === 0) void refreshState();
    }, 8000);
    const onFocus = () => void refreshState();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      clearInterval(poll);
      window.removeEventListener('focus', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Admin-only UI preview of another role's screens (server permissions still follow the account). */
  const setRole = useCallback((newRole: StaffRole) => {
    setRoleState(newRole);
    showToast(`Previewing the ${newRole.replace('_', ' ').toUpperCase()} view`, 'info');
  }, [showToast]);

  const updateRoomStatus = (roomId: string, status: RoomTapeStatus) => {
    setRooms((prev) => {
      const updated = prev.map((r) => (r.id === roomId ? { ...r, currentStatus: status } : r));
      try {
        queueSync('physicalRooms', prev, updated);
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
        queueSync('crmBookings', prev, updated);
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
        queueSync('housekeepingTasks', prev, updated);
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
        queueSync('housekeepingTasks', prev, updated);
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
        queueSync('folios', prev, updated);
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
        queueSync('folios', prev, updated);
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
        queueSync('folios', prev, updated);
      } catch {}
      return updated;
    });
    showToast(`Folio #${targetFolio.folioNumber} settled in full.`);
  };

  // QR Food Order Creation
  /**
   * In-room dining order (QR concierge / staff). Placed on the server, which prices it
   * from the live menu, posts the folio charge and alerts the front desk.
   */
  const createFoodOrder = async (orderData: Omit<FoodOrder, 'id' | 'orderNumber' | 'createdAt'>): Promise<FoodOrder | null> => {
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'food_order',
          bookingId: orderData.bookingId,
          items: orderData.items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity, itemNotes: i.itemNotes })),
          notes: orderData.specialInstructions,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success || !json.order) {
        showToast(json?.error || 'Could not place the order. Please try again or call reception.', 'error');
        return null;
      }
      const order = json.order as FoodOrder;
      applyServerRecord('foodOrders', order.id, order);
      if (json.folio) applyServerRecord('folios', json.folio.id, json.folio);
      showToast(`Food Order ${order.orderNumber} placed & sent to Manager Approval Gate!`);
      return order;
    } catch {
      showToast('You appear to be offline. The order was not placed.', 'error');
      return null;
    }
  };

  const logManagerActivity = (activity: Omit<ManagerActivityLog, 'id' | 'timestamp'>): ManagerActivityLog => {
    const newEntry: ManagerActivityLog = {
      ...activity,
      id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
    };
    setManagerActivityLogs((prev) => {
      const updated = [newEntry, ...prev].slice(0, 200);
      try {
        queueSync('activityLogs', prev, updated);
      } catch {}
      return updated;
    });
    return newEntry;
  };

  const approveFoodOrder = (orderId: string, managerInfo: { id: string; name: string }) => {
    setFoodOrders((prev) => {
      const updated = prev.map((ord) => {
        if (ord.id === orderId) {
          return {
            ...ord,
            status: 'accepted_kitchen' as FoodOrderStatus,
            approvedByManagerId: managerInfo.id,
            approvedByManagerName: managerInfo.name,
            approvedAt: new Date().toISOString(),
          };
        }
        return ord;
      });
      try {
        queueSync('foodOrders', prev, updated);
      } catch {}
      return updated;
    });

    const targetOrder = foodOrders.find((o) => o.id === orderId);
    logManagerActivity({
      managerId: managerInfo.id,
      managerName: managerInfo.name,
      action: 'order_approval',
      bookingId: targetOrder?.bookingId,
      roomNumber: targetOrder?.roomNumber,
      guestName: targetOrder?.guestName,
      amount: targetOrder?.totalAmount,
      notes: `Approved order #${targetOrder?.orderNumber} after inventory stock verification. Released to kitchen.`,
    });


    showToast(`Order approved by ${managerInfo.name} & released to live kitchen orders!`);
  };

  const rejectFoodOrder = (orderId: string, reason: string, managerInfo: { id: string; name: string }) => {
    setFoodOrders((prev) => {
      const updated = prev.map((ord) => {
        if (ord.id === orderId) {
          return {
            ...ord,
            status: 'cancelled' as FoodOrderStatus,
            rejectionReason: reason,
          };
        }
        return ord;
      });
      try {
        queueSync('foodOrders', prev, updated);
      } catch {}
      return updated;
    });

    // Void the pending charge on the folio
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
        queueSync('folios', prev, updated);
      } catch {}
      return updated;
    });

    const targetOrder = foodOrders.find((o) => o.id === orderId);
    logManagerActivity({
      managerId: managerInfo.id,
      managerName: managerInfo.name,
      action: 'order_rejection',
      bookingId: targetOrder?.bookingId,
      roomNumber: targetOrder?.roomNumber,
      guestName: targetOrder?.guestName,
      amount: targetOrder?.totalAmount,
      notes: `Rejected order #${targetOrder?.orderNumber}. Reason: ${reason}`,
    });


    showToast(`Order rejected and folio charge voided.`);
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
        queueSync('foodOrders', prev, updated);
      } catch {
        // ignore
      }
      return updated;
    });

    // Notify backend server for real-time sync across all staff tablets

    // If order delivered or accepted, confirm the folio charge to posted; if cancelled, void and recalculate!
    // The server also posts/voids the folio charge when an order's status changes;
    // kitchen accounts only change the order itself.
    if (currentUser?.role === 'kitchen_staff') {
      showToast(`Order status updated to ${status.replace('_', ' ')}`);
      return;
    }
    if (['accepted_kitchen', 'preparing', 'delivered'].includes(status)) {
      setFolios((prev) => {
        const updated = prev.map((fol) => ({
          ...fol,
          charges: fol.charges.map((c) =>
            c.sourceReferenceId === orderId ? { ...c, chargeStatus: 'posted' as const } : c
          ),
        }));
        try {
          queueSync('folios', prev, updated);
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
          queueSync('folios', prev, updated);
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
        queueSync('menuItems', prev, updated);
      } catch {}
      const targetItem = prev.find((i) => i.id === itemId);
      showToast(`${targetItem?.name || 'Item'} is now ${nextStatus ? 'IN STOCK' : 'OUT OF STOCK'}`);
      return updated;
    });
  };

  // QR Transport / Dispatch creation
  /** Transfer / rental request (QR concierge / staff), priced and recorded on the server. */
  const createTransportRequest = async (
    requestData: Omit<TransportRequest, 'id' | 'requestNumber' | 'createdAt' | 'homestayCommission'>
  ): Promise<TransportRequest | null> => {
    try {
      const res = await fetch('/api/guest/transport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: requestData.bookingId,
          serviceType: requestData.serviceType,
          routeId: requestData.routeId,
          vehicleTier: requestData.vehicleTier,
          modifiers: (requestData.selectedModifiers || []).map((m) => m.name),
          rentalVehicleId: requestData.rentalVehicleId,
          pickupDatetime: requestData.pickupDatetime,
          returnDatetime: requestData.returnDatetime,
          pickupLocation: requestData.pickupLocation,
          destinationNotes: requestData.destinationNotes,
          guestContactPhone: requestData.guestContactPhone,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success || !json.request) {
        showToast(json?.error || 'Could not submit the transport request.', 'error');
        return null;
      }
      const request = json.request as TransportRequest;
      applyServerRecord('dispatchRequests', request.id, request);
      if (json.folio) applyServerRecord('folios', json.folio.id, json.folio);
      showToast(`Transport Request ${request.requestNumber} submitted! Awaiting Manager dispatch.`);
      return request;
    } catch {
      showToast('You appear to be offline. The request was not sent.', 'error');
      return null;
    }
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
        queueSync('dispatchRequests', prev, updated);
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
        queueSync('folios', prev, updated);
      } catch {}
      return updated;
    });

    showToast('Transport dispatch confirmed and driver details assigned.');
  };

  const cancelDispatchRequest = (requestId: string) => {
    setDispatchRequests((prev) => {
      const updated = prev.map((req) => (req.id === requestId ? { ...req, dispatchStatus: 'cancelled' as DispatchStatus } : req));
      try {
        queueSync('dispatchRequests', prev, updated);
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
        queueSync('folios', prev, updated);
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
        queueSync('expenses', prev, updated);
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
        queueSync('expenses', prev, updated);
      } catch {
        // ignore
      }
      return updated;
    });
    showToast('Expense entry deleted.');
  };

  // Check-In and Check-Out actions
  const checkInRoom = (bookingId: string, managerInfo?: { id: string; name: string }) => {
    const bk = bookings.find((b) => b.id === bookingId);
    if (!bk) return;

    const mgrId = managerInfo?.id || currentUser?.id || 'staff-1';
    const mgrName = managerInfo?.name || currentUser?.fullName || 'Duty Manager';

    setBookings((prev) => {
      const updated = prev.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              tapeStatus: 'checked_in' as const,
              bookingStatus: 'checked_in' as const,
              checkedInAt: new Date().toISOString(),
              checkedInByManagerId: mgrId,
              checkedInByManagerName: mgrName,
            }
          : b
      );
      try {
        queueSync('crmBookings', prev, updated);
      } catch {}
      return updated;
    });

    setRooms((prev) => {
      const updated = prev.map((r) => (r.id === bk.roomId ? { ...r, currentStatus: 'checked_in' as const } : r));
      try {
        queueSync('physicalRooms', prev, updated);
      } catch {}
      return updated;
    });


    logManagerActivity({
      managerId: mgrId,
      managerName: mgrName,
      action: 'check_in',
      bookingId: bk.id,
      bookingReference: bk.bookingReference,
      roomNumber: bk.roomNumber,
      guestName: bk.guest.fullName,
      notes: `Guest checked into Room ${bk.roomNumber}. In-room QR activated.`,
    });

    showToast(`Room ${bk.roomNumber} (${bk.guest.fullName}) checked in by ${mgrName}!`);
  };

  const completeCheckoutWithSettlement = (
    bookingId: string,
    checkoutData: {
      paymentMethod: PaymentMethod;
      amountCollected: number;
      transactionReference?: string;
      notes?: string;
      managerId: string;
      managerName: string;
    }
  ) => {
    const bk = bookings.find((b) => b.id === bookingId);
    if (!bk) return;

    const targetFolio = folios.find((f) => f.bookingId === bookingId || f.roomNumber === bk.roomNumber);

    // 1. If payment collected, add folio payment
    if (targetFolio && checkoutData.amountCollected > 0) {
      addFolioPayment(targetFolio.id, {
        folioId: targetFolio.id,
        amount: checkoutData.amountCollected,
        paymentMethod: checkoutData.paymentMethod,
        transactionReference: checkoutData.transactionReference,
        receiptNotes: checkoutData.notes || `Collected on checkout by ${checkoutData.managerName}`,
        collectedByName: checkoutData.managerName,
        collectedById: checkoutData.managerId,
      });
    }

    // 2. Mark folio as settled
    if (targetFolio) {
      setFolios((prev) => {
        const updated = prev.map((f) =>
          f.id === targetFolio.id
            ? {
                ...f,
                status: 'settled' as const,
                settledAt: new Date().toISOString(),
                settledByName: checkoutData.managerName,
                balanceDue: Math.max(0, f.balanceDue - checkoutData.amountCollected),
                totalPaid: f.totalPaid + checkoutData.amountCollected,
              }
            : f
        );
        try {
          queueSync('folios', prev, updated);
        } catch {}
        return updated;
      });
    }

    // 3. Mark booking as checked out
    const now = new Date().toISOString();
    setBookings((prev) => {
      const updated = prev.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              tapeStatus: 'available' as const,
              bookingStatus: 'checked_out' as const,
              checkedOutAt: now,
              checkedOutByManagerId: checkoutData.managerId,
              checkedOutByManagerName: checkoutData.managerName,
            }
          : b
      );
      try {
        queueSync('crmBookings', prev, updated);
      } catch {}
      return updated;
    });

    // 4. Update room status to available, housekeeping to deep_clean_turnover
    setRooms((prev) => {
      const updated = prev.map((r) =>
        r.id === bk.roomId
          ? { ...r, currentStatus: 'available' as const, housekeeping: 'deep_clean_turnover' as const }
          : r
      );
      try {
        queueSync('physicalRooms', prev, updated);
      } catch {}
      return updated;
    });


    // 5. Create housekeeping turnover task
    const newTask: HousekeepingTask = {
      id: `hk-${Date.now()}`,
      roomId: bk.roomId,
      roomNumber: bk.roomNumber,
      roomName: bk.roomName,
      scheduleDate: now.split('T')[0],
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
      notes: `Checkout turnover completed by Manager ${checkoutData.managerName}`,
    };

    setHousekeepingTasks((prev) => {
      const updated = [newTask, ...prev];
      try {
        queueSync('housekeepingTasks', prev, updated);
      } catch {}
      return updated;
    });

    // 6. Log manager activity
    logManagerActivity({
      managerId: checkoutData.managerId,
      managerName: checkoutData.managerName,
      action: 'check_out',
      bookingId: bk.id,
      bookingReference: bk.bookingReference,
      roomNumber: bk.roomNumber,
      guestName: bk.guest.fullName,
      amount: checkoutData.amountCollected,
      paymentMethod: checkoutData.paymentMethod,
      notes: `Guest checkout completed. Folio settled. Collected ₹${checkoutData.amountCollected} via ${checkoutData.paymentMethod}. ${checkoutData.notes || ''}`.trim(),
    });

    showToast(`Room ${bk.roomNumber} (${bk.guest.fullName}) successfully checked out by ${checkoutData.managerName}!`);
  };

  const checkOutRoom = (bookingId: string) => {
    const bk = bookings.find((b) => b.id === bookingId);
    if (!bk) return;

    const mgrId = currentUser?.id || 'staff-1';
    const mgrName = currentUser?.fullName || 'Duty Manager';

    completeCheckoutWithSettlement(bookingId, {
      paymentMethod: 'cash',
      amountCollected: 0,
      managerId: mgrId,
      managerName: mgrName,
      notes: 'Direct checkout without extra balance collection',
    });
  };

  // Manual Booking & Room Assignment with Manual Tariff Overrides
  const createManualBooking = (bookingData: {
    roomId: string;
    checkInDate: string;
    checkOutDate: string;
    roomRatePerNight: number;
    totalRoomAmount?: number;
    mealPlan: MealPlan;
    adultsCount: number;
    childrenCount: number;
    infantsCount?: number;
    extraAdultChargePerNight?: number;
    extraChildChargePerNight?: number;
    status: RoomTapeStatus;
    specialRequests?: string;
    notes?: string;
    isManualRate?: boolean;
    advancePaid?: number;
    advancePaymentMethod?: PaymentMethod;
    /** GST on the room charges (from the shared GST rules); computed here if omitted. */
    gstAmount?: number;
    /** Website request this booking fulfils. */
    sourceBookingId?: string;
    guest: {
      fullName: string;
      phone: string;
      email?: string;
      idType?: string;
      idNumber?: string;
      idDocumentUrl?: string;
      idDocumentBackUrl?: string;
      address?: string;
      city?: string;
      state?: string;
      nationality?: string;
      dietaryPreferences?: string;
      hospitalityPreferences?: string;
    };
  }): CRMBooking => {
    const room = rooms.find((r) => r.id === bookingData.roomId) || rooms[0];
    const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const guestId = `guest-${uid()}`;
    const bookingId = `bk-${uid()}`;
    const existingRefs = bookings.map((b) => b.bookingReference);
    const bookingReference = generateUniversalBookingId(bookingData.checkInDate, existingRefs);

    // Calculate nights (IST calendar dates)
    const totalNights = Math.max(1, nightsBetween(bookingData.checkInDate, bookingData.checkOutDate) ?? 1);

    // Extra person charges calculation
    const extraAdultsCount = Math.max(0, (bookingData.adultsCount || 2) - 2);
    const extraChildrenCount = Math.max(0, bookingData.childrenCount || 0);
    const tariffs = resolveRoomTariffs(room.id, roomTariffs);
    const extraAdultRate = bookingData.extraAdultChargePerNight ?? tariffs?.extraAdultRate ?? 0;
    const extraChildRate = bookingData.extraChildChargePerNight ?? tariffs?.extraChildRate ?? 0;
    const extraAdultsTotal = extraAdultsCount * extraAdultRate * totalNights;
    const extraChildrenTotal = extraChildrenCount * extraChildRate * totalNights;
    const totalExtraCharges = extraAdultsTotal + extraChildrenTotal;

    const baseRoomStayAmount = totalNights * bookingData.roomRatePerNight;
    const totalRoomAmount = bookingData.totalRoomAmount ?? (baseRoomStayAmount + totalExtraCharges);

    const docStatus: 'pending' | 'submitted' =
      bookingData.guest.idDocumentUrl || bookingData.guest.idNumber ? 'submitted' : 'pending';

    const newGuest: Guest = {
      id: guestId,
      fullName: bookingData.guest.fullName || 'Guest',
      phone: bookingData.guest.phone || '',
      email: bookingData.guest.email,
      idType: bookingData.guest.idType || 'Aadhaar Card',
      idNumber: bookingData.guest.idNumber,
      idDocumentUrl: bookingData.guest.idDocumentUrl,
      idDocumentBackUrl: bookingData.guest.idDocumentBackUrl,
      address: bookingData.guest.address,
      city: bookingData.guest.city,
      state: bookingData.guest.state,
      nationality: bookingData.guest.nationality || 'Indian',
      documentStatus: docStatus,
      dietaryPreferences: bookingData.guest.dietaryPreferences,
      hospitalityPreferences: bookingData.guest.hospitalityPreferences,
      whatsappNumber: bookingData.guest.phone ? bookingData.guest.phone.replace(/[^0-9]/g, '') : undefined,
      totalLifetimeStays: 1,
    };

    const newBooking: CRMBooking = {
      id: bookingId,
      bookingReference,
      roomId: room.id,
      roomNumber: room.roomNumber,
      roomName: room.name,
      guestId,
      guest: newGuest,
      checkInDate: bookingData.checkInDate,
      checkOutDate: bookingData.checkOutDate,
      tapeStatus: bookingData.status,
      bookingStatus:
        bookingData.status === 'checked_in'
          ? 'checked_in'
          : bookingData.status === 'hold'
          ? 'hold'
          : 'confirmed',
      mealPlan: bookingData.mealPlan,
      adultsCount: bookingData.adultsCount || 2,
      childrenCount: bookingData.childrenCount || 0,
      infantsCount: bookingData.infantsCount || 0,
      extraAdultsCount,
      extraChildrenCount,
      extraAdultChargePerNight: extraAdultRate,
      extraChildChargePerNight: extraChildRate,
      totalExtraCharges,
      roomRatePerNight: bookingData.roomRatePerNight,
      totalNights,
      totalRoomAmount,
      specialRequests: bookingData.specialRequests,
      isManualRate: bookingData.isManualRate !== false,
      notes: bookingData.notes,
      documentStatus: docStatus,
      advancePaid: bookingData.advancePaid || 0,
      advancePaymentMethod: bookingData.advancePaymentMethod,
      checkedInAt: bookingData.status === 'checked_in' ? new Date().toISOString() : undefined,
    };

    // Auto-create Folio with itemized stay charges
    const folioId = `fol-${uid()}`;
    const folioNumber = `FOL-${new Date().getFullYear()}-${room.roomNumber}-${uid().slice(0, 4).toUpperCase()}`;
    const chargesList: FolioCharge[] = [];

    // Base Room Charge
    const baseRoomTitle = totalExtraCharges > 0
      ? `Base Stay Tariff: ${room.name} (${totalNights} night${totalNights > 1 ? 's' : ''} @ ₹${bookingData.roomRatePerNight.toLocaleString('en-IN')}/nt)`
      : `Stay Tariff: ${room.name} (${totalNights} night${totalNights > 1 ? 's' : ''} @ ₹${bookingData.roomRatePerNight.toLocaleString('en-IN')}/nt ${bookingData.isManualRate !== false ? '[Manual Rate Override]' : ''})`;

    chargesList.push({
      id: `chg-${Date.now()}-room`,
      folioId,
      category: 'room_tariff',
      chargeStatus: 'posted',
      title: baseRoomTitle,
      amount: totalExtraCharges > 0 ? (totalRoomAmount - totalExtraCharges) : totalRoomAmount,
      sourceReferenceType: 'booking',
      sourceReferenceId: bookingId,
      postedAt: new Date().toISOString(),
    });

    // Extra Adult Surcharge itemization
    if (extraAdultsTotal > 0) {
      chargesList.push({
        id: `chg-${Date.now()}-adult`,
        folioId,
        category: 'room_tariff',
        chargeStatus: 'posted',
        title: `Extra Adult Charge (${extraAdultsCount} guest${extraAdultsCount > 1 ? 's' : ''} × ${totalNights} nt @ ₹${extraAdultRate.toLocaleString('en-IN')}/nt)`,
        amount: extraAdultsTotal,
        sourceReferenceType: 'booking',
        sourceReferenceId: bookingId,
        postedAt: new Date().toISOString(),
      });
    }

    // Extra Child Surcharge itemization
    if (extraChildrenTotal > 0) {
      chargesList.push({
        id: `chg-${Date.now()}-child`,
        folioId,
        category: 'room_tariff',
        chargeStatus: 'posted',
        title: `Extra Child Charge (${extraChildrenCount} child${extraChildrenCount > 1 ? 'ren' : ''} × ${totalNights} nt @ ₹${extraChildRate.toLocaleString('en-IN')}/nt)`,
        amount: extraChildrenTotal,
        sourceReferenceType: 'booking',
        sourceReferenceId: bookingId,
        postedAt: new Date().toISOString(),
      });
    }

    const payments: FolioPayment[] = [];
    if (bookingData.advancePaid && bookingData.advancePaid > 0) {
      payments.push({
        id: `pay-${Date.now()}-adv`,
        folioId,
        amount: bookingData.advancePaid,
        paymentMethod: bookingData.advancePaymentMethod || 'upi',
        receiptNotes: 'Advance deposit on manual booking reservation',
        collectedAt: new Date().toISOString(),
        collectedByName: currentUser?.fullName || 'Duty Manager',
        collectedById: currentUser?.id,
      });
    }

    // GST on accommodation: per-night slab (₹7,500 line) via the shared rules
    const roomGst = bookingData.gstAmount ?? accommodationGstForTotal(totalRoomAmount, totalNights, gstConfig);
    const taxedCharges = apportionTax(chargesList, roomGst, gstConfig);
    newBooking.gstAmount = roomGst;
    if (bookingData.sourceBookingId) newBooking.sourceBookingId = bookingData.sourceBookingId;

    const initialFolio: GuestFolio = recalculateFolioTotals(
      {
        id: folioId,
        bookingId,
        guestId,
        guestName: newGuest.fullName,
        roomNumber: room.roomNumber,
        roomName: room.name,
        folioNumber,
        status: 'open',
        totalRoomCharges: totalRoomAmount,
        totalFbCharges: 0,
        totalAddonCharges: 0,
        totalTax: 0,
        discountAmount: 0,
        netPayable: totalRoomAmount,
        totalPaid: bookingData.advancePaid || 0,
        balanceDue: Math.max(0, totalRoomAmount - (bookingData.advancePaid || 0)),
        charges: taxedCharges,
        payments,
      },
      taxedCharges,
      payments,
      gstConfig
    );

    // Update state & persistence
    setBookings((prev) => {
      const updated = [newBooking, ...prev];
      try {
        queueSync('crmBookings', prev, updated);
      } catch {}
      return updated;
    });

    // Sync new reservation to server so guest can immediately log in from mobile device

    setFolios((prev) => {
      const updated = [initialFolio, ...prev];
      try {
        queueSync('folios', prev, updated);
      } catch {}
      return updated;
    });

    // If reservation is currently active, update physical room tape status
    setRooms((prev) => {
      const updated = prev.map((r) => (r.id === room.id ? { ...r, currentStatus: bookingData.status } : r));
      try {
        queueSync('physicalRooms', prev, updated);
      } catch {}
      return updated;
    });

    showToast(`Manual reservation ${bookingReference} created & assigned to Room ${room.roomNumber}!`);
    return newBooking;
  };

  // Update Guest Details & Document Upload (CRM and Guest self-check-in sync)
  const updateBookingGuestDetails = (
    bookingId: string,
    guestUpdates: Partial<Guest>,
    bookingUpdates?: Partial<CRMBooking>
  ) => {
    setBookings((prev) => {
      const updated = prev.map((b) => {
        if (b.id === bookingId) {
          const updatedDocStatus: 'pending' | 'submitted' | 'verified' =
            guestUpdates.documentStatus ||
            b.documentStatus ||
            (guestUpdates.idDocumentUrl || guestUpdates.idNumber ? 'submitted' : 'pending');

          const updatedGuest: Guest = {
            ...b.guest,
            ...guestUpdates,
            documentStatus: updatedDocStatus,
          };

          return {
            ...b,
            ...bookingUpdates,
            guest: updatedGuest,
            documentStatus: updatedDocStatus,
          };
        }
        return b;
      });

      try {
        queueSync('crmBookings', prev, updated);
        const updatedTarget = updated.find((b) => b.id === bookingId);
        if (updatedTarget) {
        }
      } catch {}
      return updated;
    });

    // Also update folio guestName if name changed
    if (guestUpdates.fullName) {
      setFolios((prev) => {
        const updated = prev.map((fol) =>
          fol.bookingId === bookingId ? { ...fol, guestName: guestUpdates.fullName! } : fol
        );
        try {
          queueSync('folios', prev, updated);
        } catch {}
        return updated;
      });
    }

    showToast('Guest details & documents updated successfully');
  };

  const updateBookingDocumentStatus = (
    bookingId: string,
    status: 'pending' | 'submitted' | 'verified'
  ) => {
    setBookings((prev) => {
      const updated = prev.map((b) => {
        if (b.id === bookingId) {
          return {
            ...b,
            documentStatus: status,
            guest: {
              ...b.guest,
              documentStatus: status,
            },
          };
        }
        return b;
      });
      try {
        queueSync('crmBookings', prev, updated);
        const updatedTarget = updated.find((b) => b.id === bookingId);
        if (updatedTarget) {
        }
      } catch {}
      return updated;
    });
    showToast(`Guest document verification marked as ${status.toUpperCase()}`);
  };

  // Staff Account & Authentication Actions (server-side accounts; nothing secret in the browser)
  const signOut = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    handleSignedOut();
    void loadPublicCatalog();
  }, [handleSignedOut, loadPublicCatalog]);

  const setCurrentUser = useCallback(
    (user: StaffAccount | null) => {
      if (!user) {
        void signOut();
        return;
      }
      setCurrentUserState(user);
      setRoleState(user.role);
    },
    [signOut]
  );

  const addStaffAccount = async (accountData: Omit<StaffAccount, 'id' | 'createdAt'>): Promise<StaffAccount> => {
    const res = await fetch('/api/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: accountData.email,
        fullName: accountData.fullName,
        phone: accountData.phone || undefined,
        role: accountData.role,
        password: accountData.password,
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      const message = json?.error || 'Could not create the staff account.';
      showToast(message, 'error');
      throw new Error(message);
    }
    const created = json.staff as StaffAccount;
    setStaffAccounts((prev) => [...prev, created]);
    showToast(`Login created for "${created.fullName}" (${created.role.replace('_', ' ').toUpperCase()}). They must set a new password at first sign-in.`);
    return created;
  };

  const updateStaffAccount = async (id: string, updates: Partial<StaffAccount>): Promise<void> => {
    const res = await fetch(`/api/staff/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: updates.fullName,
        email: updates.email,
        phone: updates.phone,
        role: updates.role,
        isActive: updates.isActive,
        newPassword: updates.password || undefined,
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      const message = json?.error || 'Could not update the staff account.';
      showToast(message, 'error');
      throw new Error(message);
    }
    const saved = json.staff as StaffAccount;
    setStaffAccounts((prev) => prev.map((acc) => (acc.id === id ? saved : acc)));
    if (currentUser?.id === id) setCurrentUserState(saved);
    showToast(updates.password ? 'Password reset. The user must choose a new one at next sign-in.' : 'Staff profile updated successfully');
  };

  const deleteStaffAccount = async (id: string): Promise<{ success: boolean; error?: string }> => {
    const target = staffAccounts.find((a) => a.id === id);
    const res = await fetch(`/api/staff/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      const error = json?.error || 'Could not delete the staff account.';
      showToast(error, 'error');
      return { success: false, error };
    }
    setStaffAccounts((prev) => prev.filter((acc) => acc.id !== id));
    showToast(`Account for "${target?.fullName || 'staff member'}" removed`);
    return { success: true };
  };

  const authenticateStaff = useCallback(
    async (identifier: string, password: string): Promise<{ success: boolean; user?: StaffAccount; error?: string }> => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: identifier.trim(), password }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success || !json.user) {
          return { success: false, error: json?.error || 'Invalid email or password. Please check your credentials.' };
        }
        const user = json.user as StaffAccount;
        await startStaffSession(user);
        if (!user.mustChangePassword) showToast(`Signed in as ${user.fullName} (${user.role.replace('_', ' ').toUpperCase()})`);
        return { success: true, user };
      } catch {
        return { success: false, error: 'Could not reach the server. Please check your connection.' };
      }
    },
    [startStaffSession, showToast]
  );

  const changeOwnPassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await fetch('/api/auth/password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) return { success: false, error: json?.error || 'Could not change the password.' };
        if (json.user) await startStaffSession(json.user as StaffAccount);
        showToast('Password updated.');
        return { success: true };
      } catch {
        return { success: false, error: 'Could not reach the server.' };
      }
    },
    [startStaffSession, showToast]
  );

  // =========================================================================
  // Menu Management CRUD (In-Room Dining)
  // =========================================================================


  const addMenuItem = (item: Omit<MenuItem, 'id'>): MenuItem => {
    const newItem: MenuItem = { ...item, id: `menu-${Date.now()}` };
    setMenuItems((prev) => {
      const updated = [...prev, newItem];
      try {
        queueSync('menuItems', prev, updated);
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
        queueSync('menuItems', prev, updated);
      } catch {}
      return updated;
    });
    showToast('Menu item updated');
  };

  const deleteMenuItem = (id: string) => {
    setMenuItems((prev) => {
      const updated = prev.filter((m) => m.id !== id);
      try {
        queueSync('menuItems', prev, updated);
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
        queueSync('transferRoutes', prev, updated);
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
        queueSync('transferRoutes', prev, updated);
      } catch {}
      return updated;
    });
    showToast('Transfer route updated');
  };

  const deleteTransferRoute = (id: string) => {
    setTransferRoutes((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      try {
        queueSync('transferRoutes', prev, updated);
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
        queueSync('rentalVehicles', prev, updated);
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
        queueSync('rentalVehicles', prev, updated);
      } catch {}
      return updated;
    });
    showToast('Rental vehicle updated');
  };

  const deleteRentalVehicle = (id: string) => {
    setRentalVehicles((prev) => {
      const updated = prev.filter((v) => v.id !== id);
      try {
        queueSync('rentalVehicles', prev, updated);
      } catch {}
      return updated;
    });
    showToast('Rental vehicle removed');
  };

  // =========================================================================
  // Seasonal Date Ranges & Dynamic Tariffs
  // =========================================================================
  // Applies a server response ({ tariffs, seasonalDateRanges }) to CRM state and to every
  // other mounted pricing consumer on this page.
  const applyServerTariffs = (json: unknown) => {
    const live = parseTariffResponse(json);
    setRoomTariffs(live.tariffs);
    setSeasonalDateRanges(live.seasonalDateRanges);
    setGstConfig(live.gstConfig);
    setTariffsStatus('ready');
    publishLiveTariffs(live);
  };

  const saveTariffChange = async (payload: Record<string, unknown>, successMessage: string): Promise<boolean> => {
    const result = await adminPostJson('/api/tariffs', payload);
    if (!result.ok) {
      showToast(result.error || 'Could not save to the server. The live site was not changed.', 'error');
      return false;
    }
    try {
      applyServerTariffs(result.data);
    } catch {
      // Saved, but the response was unexpected: reload to be certain we show what the server has.
      try {
        applyServerTariffs({ success: true, data: await fetchLiveTariffs(true) });
      } catch {}
    }
    showToast(successMessage);
    return true;
  };

  const addSeasonalRange = (rangeData: Omit<SeasonalDateRange, 'id'>): SeasonalDateRange => {
    const newRange: SeasonalDateRange = { ...rangeData, id: `season-${Date.now()}` };
    void saveTariffChange(
      { type: 'seasonal_range_upsert', range: newRange },
      `Added seasonal period "${newRange.name}"`
    );
    return newRange;
  };

  const updateSeasonalRange = async (id: string, updates: Partial<SeasonalDateRange>): Promise<boolean> => {
    const existing = seasonalDateRanges.find((r) => r.id === id);
    if (!existing) {
      showToast('That seasonal period no longer exists. Please refresh.', 'error');
      return false;
    }
    return saveTariffChange(
      { type: 'seasonal_range_upsert', range: { ...existing, ...updates, id } },
      'Seasonal period updated'
    );
  };

  const deleteSeasonalRange = async (id: string): Promise<boolean> => {
    return saveTariffChange({ type: 'seasonal_range_delete', id }, 'Seasonal period removed');
  };

  const updateRoomTariffs = async (roomId: string, tariffs: RoomSeasonalTariffs): Promise<boolean> => {
    return saveTariffChange({ roomId, tariffs }, 'Room seasonal tariffs saved to the live site');
  };

  // Canonical engine: identical maths to the public website and the booking API.
  const calculateDynamicTariff = (
    roomId: string,
    checkIn: string,
    checkOut: string,
    mealPlan: MealPlan = 'CP',
    adultsCount: number = 2,
    childrenCount: number = 0
  ): DynamicTariffResult | null => {
    if (tariffsStatus !== 'ready') return null;
    return calculateCanonicalTariff({
      roomId,
      checkIn,
      checkOut,
      mealPlan,
      adultsCount,
      childrenCount,
      tariffsMap: roomTariffs,
      seasonalDateRanges,
    });
  };

  const getSeasonForDate = (dateStr: string) => {
    if (!dateStr) return { seasonType: 'regular' as const, seasonName: 'Regular Season' };
    const dateOnly = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    // Same season resolution as the room pricing engine (peak wins over off-season on overlap)
    const resolved = resolveSeasonForNight(dateOnly, seasonalDateRanges);
    if (resolved.seasonType === 'regular') {
      return { seasonType: 'regular' as const, seasonName: 'Regular Season' };
    }
    return { seasonType: resolved.seasonType, seasonName: resolved.name };
  };

  // Transfer & rental pricing: shared with the server (which re-prices guest requests)
  const calculateDynamicTransferRate = (route: TransferRoute, dateStr: string, tier: 'wagonr' | 'sedan' | 'suv') =>
    transferRate(route, dateStr, tier, seasonalDateRanges);

  const calculateDynamicRentalRate = (vehicle: RentalVehicle, startDateStr: string, endDateStr?: string) =>
    rentalRate(vehicle, startDateStr, endDateStr, seasonalDateRanges);

  /** Admin: deletes all bookings, bills, orders, dispatch, housekeeping and expenses on the server. */
  const resetAllOperationalData = useCallback(() => {
    if (currentUser?.role !== 'admin') {
      showToast('Only an admin can reset operational data.', 'error');
      return;
    }
    queueSync('crmBookings', bookings, []);
    queueSync('folios', folios, []);
    queueSync('expenses', expenses, []);
    queueSync('foodOrders', foodOrders, []);
    queueSync('dispatchRequests', dispatchRequests, []);
    queueSync('housekeepingTasks', housekeepingTasks, []);
    const cleanRooms: PhysicalRoom[] = rooms.map((r) => ({ ...r, currentStatus: 'available' as RoomTapeStatus, housekeeping: 'clean' as const, notes: '' }));
    queueSync('physicalRooms', rooms, cleanRooms);
    setBookings([]);
    setFolios([]);
    setExpenses([]);
    setFoodOrders([]);
    setDispatchRequests([]);
    setHousekeepingTasks([]);
    setRooms(cleanRooms);
    showToast('Operational data is being cleared on the server (bookings, bills, orders, expenses).', 'success');
  }, [currentUser, queueSync, bookings, folios, expenses, foodOrders, dispatchRequests, housekeepingTasks, rooms, showToast]);

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
        tariffsStatus,
        gstConfig,
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
        managerActivityLogs,
        logManagerActivity,
        approveFoodOrder,
        rejectFoodOrder,
        completeCheckoutWithSettlement,
        checkInRoom,
        checkOutRoom,
        createManualBooking,
        updateBookingGuestDetails,
        updateBookingDocumentStatus,
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
        getSeasonForDate,
        calculateDynamicTransferRate,
        calculateDynamicRentalRate,
        staffAccounts,
        currentUser,
        setCurrentUser,
        addStaffAccount,
        updateStaffAccount,
        deleteStaffAccount,
        authenticateStaff,
        authStatus,
        signOut,
        changeOwnPassword,
        resetAllOperationalData,
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
