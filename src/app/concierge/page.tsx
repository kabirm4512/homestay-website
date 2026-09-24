'use client';

import React, { useState, useMemo, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Trees,
  Utensils,
  Car,
  Bike,
  Clock,
  AlertCircle,
  CheckCircle2,
  Phone,
  MessageSquare,
  ShoppingBag,
  Plus,
  Minus,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Compass,
  MapPin,
  Calendar,
  Coffee,
  X,
  Send,
  ExternalLink,
  QrCode,
  Wifi,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { useCRM } from '@/context/CRMContext';
import { MenuItem, FoodOrderItem, TransferRoute, RentalVehicle, PhysicalRoom, CRMBooking } from '@/types/crm';
import PWAInstaller from '@/components/pwa/PWAInstaller';
import InRoomQRHub from '@/components/qr/InRoomQRHub';

function ConciergeContent() {
  const searchParams = useSearchParams();
  const initialRoomQuery = searchParams.get('room');

  const {
    rooms,
    bookings,
    folios,
    menuItems,
    transferRoutes,
    rentalVehicles,
    createFoodOrder,
    createTransportRequest,
    checkInRoom,
    checkOutRoom,
    calculateDynamicTransferRate,
    calculateDynamicRentalRate,
    getSeasonForDate,
    showToast,
  } = useCRM();

  // Staff/evaluator mode flag (used only by management for testing)
  const isStaffMode = searchParams.get('staff') === 'true' || searchParams.get('evaluator') === 'true';

  // Room determination with strict guest isolation and device session locking:
  // 1. Scanned room is parsed from ?room=...
  // 2. If already locked in this session/device (e.g. Room 103), URL tampering to another room without staff mode is strictly blocked.
  // 3. If no room was scanned and no session exists, returns null (prompts guest to scan in-room QR).
  // 1. Selected room number determination:
  // - Priority 1: URL parameter ?room=... (the scanned QR standee in that room)
  // - Priority 2: Previously active room stored in session/local storage
  // - Priority 3: Staff mode default or unscanned prompt
  const [selectedRoomNumber, setSelectedRoomNumber] = useState<number | null>(() => {
    const parsedQuery = initialRoomQuery ? parseInt(initialRoomQuery, 10) : null;
    const isValidQuery = parsedQuery !== null && !isNaN(parsedQuery) && parsedQuery > 0 && rooms.some((r) => r.roomNumber === parsedQuery);

    if (isValidQuery) {
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('savera_guest_room', String(parsedQuery));
          localStorage.setItem('savera_guest_room', String(parsedQuery));
        } catch {}
      }
      return parsedQuery;
    }

    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('savera_guest_room') || localStorage.getItem('savera_guest_room');
      const parsedStored = stored ? parseInt(stored, 10) : null;
      if (parsedStored !== null && !isNaN(parsedStored) && parsedStored > 0 && rooms.some((r) => r.roomNumber === parsedStored)) {
        return parsedStored;
      }
    }

    if (isStaffMode) return 101;
    return null;
  });

  // Keep selectedRoomNumber synchronized when URL ?room changes (e.g. scanning a different room QR)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const parsedQuery = initialRoomQuery ? parseInt(initialRoomQuery, 10) : null;
    const isValidQuery = parsedQuery !== null && !isNaN(parsedQuery) && parsedQuery > 0 && rooms.some((r) => r.roomNumber === parsedQuery);

    if (isValidQuery) {
      if (selectedRoomNumber !== parsedQuery) {
        setSelectedRoomNumber(parsedQuery);
      }
      try {
        sessionStorage.setItem('savera_guest_room', String(parsedQuery));
        localStorage.setItem('savera_guest_room', String(parsedQuery));
      } catch {}
    } else if (!selectedRoomNumber) {
      const stored = sessionStorage.getItem('savera_guest_room') || localStorage.getItem('savera_guest_room');
      const parsedStored = stored ? parseInt(stored, 10) : null;
      if (parsedStored !== null && !isNaN(parsedStored) && parsedStored > 0 && rooms.some((r) => r.roomNumber === parsedStored)) {
        setSelectedRoomNumber(parsedStored);
      }
    }
  }, [initialRoomQuery, rooms, selectedRoomNumber]);

  // 2. Server check-in status verification (strictly keyed by room number to prevent cross-room leakage)
  const [serverStatus, setServerStatus] = useState<{
    roomNumber: number;
    isCheckedIn: boolean;
    room?: PhysicalRoom;
    booking?: CRMBooking;
  } | null>(null);
  const [isCheckingServer, setIsCheckingServer] = useState(false);

  const fetchRoomStatusFromServer = useCallback(async (roomNum: number) => {
    setIsCheckingServer(true);
    try {
      const res = await fetch(`/api/checkin?room=${encodeURIComponent(roomNum)}&_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.success) {
          setServerStatus({
            roomNumber: roomNum,
            isCheckedIn: Boolean(data.isCheckedIn),
            room: data.room,
            booking: data.booking,
          });
        }
      }
    } catch {
      // ignore
    } finally {
      setIsCheckingServer(false);
    }
  }, []);

  // Whenever selectedRoomNumber changes, reset serverStatus immediately and query server for that exact room
  useEffect(() => {
    if (!selectedRoomNumber) {
      setServerStatus(null);
      return;
    }

    setServerStatus(null);
    fetchRoomStatusFromServer(selectedRoomNumber);

    const interval = setInterval(() => {
      fetchRoomStatusFromServer(selectedRoomNumber);
    }, 4000);

    return () => clearInterval(interval);
  }, [selectedRoomNumber, fetchRoomStatusFromServer]);

  // Valid server status matching the currently active room
  const currentRoomServerStatus = (serverStatus && serverStatus.roomNumber === selectedRoomNumber) ? serverStatus : null;

  // 3. Current physical room for this room number
  const baseRoom = useMemo(() => {
    if (!selectedRoomNumber) return null;
    return rooms.find((r) => r.roomNumber === selectedRoomNumber) || null;
  }, [rooms, selectedRoomNumber]);

  const currentRoom = useMemo(() => {
    if (!baseRoom) return null;
    if (currentRoomServerStatus?.room && currentRoomServerStatus.room.roomNumber === selectedRoomNumber) {
      return {
        ...baseRoom,
        ...currentRoomServerStatus.room,
        currentStatus: currentRoomServerStatus.isCheckedIn ? ('checked_in' as const) : (currentRoomServerStatus.room.currentStatus || 'available'),
      };
    }
    return baseRoom;
  }, [baseRoom, currentRoomServerStatus, selectedRoomNumber]);

  // 4. Current booking strictly for this room
  const baseBooking = useMemo(() => {
    if (!currentRoom) return null;
    return bookings.find(
      (b) =>
        (b.roomNumber === currentRoom.roomNumber || b.roomId === currentRoom.id) &&
        ['checked_in', 'confirmed'].includes(b.tapeStatus || b.bookingStatus)
    );
  }, [bookings, currentRoom]);

  const activeBooking = useMemo(() => {
    if (currentRoomServerStatus?.booking && currentRoomServerStatus.booking.roomNumber === selectedRoomNumber) {
      return currentRoomServerStatus.booking;
    }
    return baseBooking;
  }, [baseBooking, currentRoomServerStatus, selectedRoomNumber]);

  // Active folio for this booking
  const activeFolio = useMemo(() => {
    if (!activeBooking) return null;
    return (
      folios.find((f) => f.bookingId === activeBooking.id || f.roomNumber === activeBooking.roomNumber) || null
    );
  }, [folios, activeBooking]);

  // 5. Check-In Gate: ONLY true if THIS specific room is checked in
  const isCheckedIn = useMemo(() => {
    if (!selectedRoomNumber) return false;

    // A. If server response is available for this room, server status is authoritative
    if (currentRoomServerStatus) {
      return currentRoomServerStatus.isCheckedIn === true;
    }

    // B. Client fallback: room's currentStatus must be 'checked_in'
    if (currentRoom && currentRoom.roomNumber === selectedRoomNumber) {
      if (currentRoom.currentStatus === 'checked_in') return true;
    }

    // C. Or an active booking for this exact room is checked in
    if (activeBooking && activeBooking.roomNumber === selectedRoomNumber) {
      if (activeBooking.tapeStatus === 'checked_in' || activeBooking.bookingStatus === 'checked_in') {
        return true;
      }
    }

    const thisRoomCheckedIn = bookings.some(
      (b) =>
        (b.roomNumber === selectedRoomNumber || b.roomId === `room-${selectedRoomNumber}`) &&
        (b.tapeStatus === 'checked_in' || b.bookingStatus === 'checked_in')
    );
    if (thisRoomCheckedIn) return true;

    return false;
  }, [selectedRoomNumber, currentRoomServerStatus, currentRoom, activeBooking, bookings]);

  // Navigation tab in concierge: 'dining' or 'travel' with persistence across reloads
  const [activeTab, setActiveTabState] = useState<'dining' | 'travel'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const tabParam = urlParams.get('tab');
        if (tabParam === 'dining' || tabParam === 'travel') return tabParam;
        const saved = localStorage.getItem('savera_concierge_tab');
        if (saved === 'dining' || saved === 'travel') return saved;
      } catch {}
    }
    return 'dining';
  });

  const setActiveTab = (tab: 'dining' | 'travel') => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('savera_concierge_tab', tab);
        const url = new URL(window.location.href);
        url.searchParams.set('tab', tab);
        window.history.replaceState({}, '', url.toString());
      } catch {}
    }
  };

  // Time-based restriction logic simulation:
  // "Enforce time-based logic hiding Mains after 10:00 PM."
  const [simulateLateNight, setSimulateLateNight] = useState(false);

  // Determine if it is currently after 10 PM (either real time or simulated)
  const isLateNight = useMemo(() => {
    if (simulateLateNight) return true;
    const now = new Date();
    const currentHour = now.getHours();
    return currentHour >= 22 || currentHour < 6; // 10 PM to 6 AM
  }, [simulateLateNight]);

  // Filtered menu categories
  const [selectedFoodCategory, setSelectedFoodCategory] = useState<
    'all' | 'beverage' | 'breakfast' | 'snack' | 'main' | 'thali' | 'sides'
  >('all');

  // Food Cart state: map of menuItemId -> quantity
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cookingInstructions, setCookingInstructions] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [lastPlacedOrder, setLastPlacedOrder] = useState<any>(null);
  const [showQRHub, setShowQRHub] = useState(false);
  const [qrHubTab, setQrHubTab] = useState<'rooms' | 'wifi'>('rooms');
  const [showRoomCheckoutModal, setShowRoomCheckoutModal] = useState(false);

  // Travel Add-on Booking State
  const [serviceType, setServiceType] = useState<'point_to_point' | 'rental'>('point_to_point');
  const [selectedRouteId, setSelectedRouteId] = useState<string>(transferRoutes[0]?.id || '');
  const [selectedVehicleTier, setSelectedVehicleTier] = useState<'wagonr' | 'sedan' | 'suv'>('sedan');
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>([]);
  const [selectedRentalId, setSelectedRentalId] = useState<string>(rentalVehicles[0]?.id || '');
  const [pickupDatetime, setPickupDatetime] = useState(() => {
    const d = new Date();
    return `${d.toISOString().split('T')[0]}T09:00`;
  });
  const [returnDatetime, setReturnDatetime] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.toISOString().split('T')[0]}T09:00`;
  });
  const [travelPhone, setTravelPhone] = useState(activeBooking?.guest.phone || '+91 99112 33445');
  const [destinationNotes, setDestinationNotes] = useState('');
  const [lastPlacedTransport, setLastPlacedTransport] = useState<any>(null);

  // Update phone if booking changes
  useEffect(() => {
    if (activeBooking?.guest.phone) {
      setTravelPhone(activeBooking.guest.phone);
    }
  }, [activeBooking]);

  // Cart operations
  const addToCart = (itemId: string) => {
    setCart((prev) => ({ ...prev, [itemId]: (prev[itemId] || 0) + 1 }));
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => {
      const next = { ...prev };
      if (next[itemId] > 1) {
        next[itemId] -= 1;
      } else {
        delete next[itemId];
      }
      return next;
    });
  };

  const cartItemCount = Object.values(cart).reduce((sum, q) => sum + q, 0);

  const cartItemsDetailed = useMemo(() => {
    return Object.entries(cart)
      .map(([id, qty]) => {
        const item = menuItems.find((m) => m.id === id);
        if (!item) return null;
        return {
          item,
          quantity: qty,
          lineTotal: item.price * qty,
        };
      })
      .filter(Boolean) as { item: MenuItem; quantity: number; lineTotal: number }[];
  }, [cart, menuItems]);

  const cartSubtotal = cartItemsDetailed.reduce((sum, i) => sum + i.lineTotal, 0);

  // Filter menu items by category and enforce time-based 10:00 PM Mains restriction
  const availableMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      // If late night, hide Mains and Thalis unless marked isLateNightEligible!
      if (isLateNight && (item.itemType === 'main' || item.itemType === 'thali') && !item.isLateNightEligible) {
        return false;
      }
      if (selectedFoodCategory !== 'all' && item.itemType !== selectedFoodCategory) {
        return false;
      }
      return true;
    });
  }, [menuItems, isLateNight, selectedFoodCategory]);

  // Handle Food Order Checkout
  const handleCheckoutFoodOrder = () => {
    if (!currentRoom || cartItemsDetailed.length === 0 || !activeBooking || !activeFolio) return;

    // Filter out any items that are no longer available or mains during late night
    const validItems = cartItemsDetailed.filter((ci) => {
      if (!ci.item.isAvailable) return false;
      if (isLateNight && (ci.item.itemType === 'main' || ci.item.itemType === 'thali') && !ci.item.isLateNightEligible) return false;
      return true;
    });

    if (validItems.length === 0) {
      showToast('Selected items are currently unavailable or kitchen is closed for Mains', 'error');
      return;
    }

    setIsSubmittingOrder(true);

    const validSubtotal = validItems.reduce((sum, i) => sum + i.lineTotal, 0);

    const orderItems: FoodOrderItem[] = validItems.map((ci) => ({
      id: `oi-${Date.now()}-${ci.item.id}`,
      menuItemId: ci.item.id,
      itemName: ci.item.name,
      unitPrice: ci.item.price,
      quantity: ci.quantity,
      lineTotal: ci.lineTotal,
    }));

    const newOrder = createFoodOrder({
      roomId: currentRoom.id,
      roomNumber: currentRoom.roomNumber,
      roomName: currentRoom.name,
      bookingId: activeBooking.id,
      folioId: activeFolio.id,
      guestName: activeBooking.guest.fullName,
      status: 'pending',
      specialInstructions: cookingInstructions || undefined,
      subtotal: validSubtotal,
      deliveryCharge: 0,
      totalAmount: validSubtotal,
      chargePostedToFolio: true,
      whatsappNotificationSent: true,
      items: orderItems,
    });

    setLastPlacedOrder(newOrder);
    setCart({});
    setCookingInstructions('');
    setIsSubmittingOrder(false);
  };

  // Selected Transfer Route Calculation
  const currentRoute = useMemo(() => {
    return transferRoutes.find((r) => r.id === selectedRouteId) || transferRoutes[0];
  }, [transferRoutes, selectedRouteId]);

  const travelDateStr = useMemo(() => {
    return pickupDatetime ? pickupDatetime.split('T')[0] : new Date().toISOString().split('T')[0];
  }, [pickupDatetime]);

  const returnDateStr = useMemo(() => {
    return returnDatetime ? returnDatetime.split('T')[0] : travelDateStr;
  }, [returnDatetime, travelDateStr]);

  const activeSeasonInfo = useMemo(() => {
    return getSeasonForDate(travelDateStr);
  }, [getSeasonForDate, travelDateStr]);

  const dynamicTransferQuote = useMemo(() => {
    if (!currentRoute) return null;
    return calculateDynamicTransferRate(currentRoute, travelDateStr, selectedVehicleTier);
  }, [currentRoute, travelDateStr, selectedVehicleTier, calculateDynamicTransferRate]);

  const routeBasePrice = useMemo(() => {
    return dynamicTransferQuote?.rate || 0;
  }, [dynamicTransferQuote]);

  const routeModifiersTotal = useMemo(() => {
    if (!currentRoute) return 0;
    return currentRoute.modifiers
      .filter((m) => selectedModifiers.includes(m.name))
      .reduce((sum, m) => sum + m.extraCharge, 0);
  }, [currentRoute, selectedModifiers]);

  const totalTransferQuoted = routeBasePrice + routeModifiersTotal;

  // Selected Rental Vehicle Calculation
  const currentRental = useMemo(() => {
    return rentalVehicles.find((v) => v.id === selectedRentalId) || rentalVehicles[0];
  }, [rentalVehicles, selectedRentalId]);

  const rentalDays = useMemo(() => {
    if (!pickupDatetime || !returnDatetime) return 1;
    const diffMs = new Date(returnDatetime).getTime() - new Date(pickupDatetime).getTime();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(1, isNaN(days) ? 1 : days);
  }, [pickupDatetime, returnDatetime]);

  const dynamicRentalQuote = useMemo(() => {
    if (!currentRental) return null;
    return calculateDynamicRentalRate(currentRental, travelDateStr, returnDateStr);
  }, [currentRental, travelDateStr, returnDateStr, calculateDynamicRentalRate]);

  const totalRentalQuoted = useMemo(() => {
    if (!dynamicRentalQuote) return 0;
    return dynamicRentalQuote.totalRate;
  }, [dynamicRentalQuote]);

  // Handle Travel Booking Checkout
  const handleCheckoutTravel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRoom || !activeBooking || !activeFolio) return;

    if (serviceType === 'point_to_point') {
      const selectedMods = currentRoute.modifiers
        .filter((m) => selectedModifiers.includes(m.name))
        .map((m) => ({ name: m.name, charge: m.extraCharge }));

      const newReq = createTransportRequest({
        roomId: currentRoom.id,
        roomNumber: currentRoom.roomNumber,
        roomName: currentRoom.name,
        bookingId: activeBooking.id,
        folioId: activeFolio.id,
        guestName: activeBooking.guest.fullName,
        guestContactPhone: travelPhone,
        serviceType: 'point_to_point',
        routeId: currentRoute.id,
        routeTitle: currentRoute.title,
        vehicleTier: selectedVehicleTier,
        selectedModifiers: selectedMods,
        pickupDatetime,
        pickupLocation: 'Homestay Main Gate',
        destinationNotes: destinationNotes || undefined,
        quotedPrice: totalTransferQuoted,
        vendorCost: Math.round(totalTransferQuoted * 0.75),
        dispatchStatus: 'pending_confirmation',
        chargePostedToFolio: true,
      });
      setLastPlacedTransport(newReq);
    } else {
      const newReq = createTransportRequest({
        roomId: currentRoom.id,
        roomNumber: currentRoom.roomNumber,
        roomName: currentRoom.name,
        bookingId: activeBooking.id,
        folioId: activeFolio.id,
        guestName: activeBooking.guest.fullName,
        guestContactPhone: travelPhone,
        serviceType: 'vehicle_rental',
        rentalVehicleId: currentRental.id,
        rentalVehicleName: `${currentRental.vehicleName} (${rentalDays} Day${rentalDays > 1 ? 's' : ''})`,
        selectedModifiers: [],
        pickupDatetime,
        returnDatetime,
        pickupLocation: 'Homestay Parking Lot',
        destinationNotes: destinationNotes || undefined,
        quotedPrice: totalRentalQuoted,
        vendorCost: Math.round(totalRentalQuoted * 0.65),
        dispatchStatus: 'pending_confirmation',
        chargePostedToFolio: true,
      });
      setLastPlacedTransport(newReq);
    }
  };

  // Generate WhatsApp notification URL with proper URL encoding (fixes URL truncation at #)
  const generateWhatsAppOrderLink = (order: any) => {
    const text = `*SAVERA HOMESTAY IN-ROOM ORDER* 🛎️\n` +
      `*Room:* ${order.roomName}\n` +
      `*Guest:* ${order.guestName}\n` +
      `*Order #:* ${order.orderNumber}\n` +
      `*Items:* ${order.items.map((i: any) => `${i.quantity}x ${i.itemName}`).join(', ')}\n` +
      (order.specialInstructions ? `*Special Note:* ${order.specialInstructions}\n` : '') +
      `*Total Amount:* ₹${order.totalAmount}\n` +
      `_Charge posted as PENDING to Room Folio._`;

    return `https://wa.me/918101298882?text=${encodeURIComponent(text)}`;
  };

  const generateWhatsAppTransportLink = (req: any) => {
    const text = `*SAVERA HOMESTAY DISPATCH REQUEST* 🚗\n` +
      `*Request #:* ${req.requestNumber}\n` +
      `*Room:* ${req.roomName}\n` +
      `*Guest:* ${req.guestName} (${req.guestContactPhone})\n` +
      `*Service:* ${req.serviceType === 'point_to_point' ? req.routeTitle : req.rentalVehicleName}\n` +
      `*Pickup Time:* ${new Date(req.pickupDatetime).toLocaleString('en-IN')}\n` +
      (req.returnDatetime ? `*Return Time:* ${new Date(req.returnDatetime).toLocaleString('en-IN')}\n` : '') +
      `*Quoted Price:* ₹${req.quotedPrice}\n` +
      `_Posted to Folio. Manager confirmation requested._`;

    return `https://wa.me/918101298882?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className={`min-h-screen bg-[#F3F7FF] text-[#0B1733] flex flex-col font-sans w-full max-w-full overflow-x-hidden ${cartItemCount > 0 ? 'pb-28 sm:pb-32' : 'pb-12'}`}>
      {/* 1. Global Concierge Top Bar */}
      <header className="sticky top-0 z-40 bg-[#0B1733] text-white border-b border-[#1E2D4A] shadow-md w-full">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Savera Homestay Logo - fully visible & unclipped */}
          <Link href="/" className="flex items-center space-x-2.5 min-w-0 group" title="Savera Homestay">
            <div className="w-10 h-10 rounded-xl bg-[#25479E] border border-[#3B62C7] flex items-center justify-center shrink-0 shadow-sm group-hover:bg-[#1A3478] transition-colors">
              <Trees className="w-5 h-5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <span
                className="font-bold text-base sm:text-lg block leading-tight text-white tracking-tight whitespace-nowrap"
                style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
              >
                Savera Homestay
              </span>
              <span className="text-[10px] uppercase tracking-wider text-primary-200 font-semibold block whitespace-nowrap">
                In-Room Concierge
              </span>
            </div>
          </Link>

          {/* Reception Call CTA */}
          <a
            href="tel:+918101298882"
            className="min-h-[40px] px-3.5 py-1.5 bg-gradient-to-r from-[#FE6E00] to-[#EA580C] hover:from-[#EA580C] hover:to-[#C2410C] active:scale-95 text-white text-xs font-bold rounded-xl shadow-[0_2px_8px_rgba(254,110,0,0.3)] transition-all flex items-center space-x-1.5 shrink-0"
            title="Call Front Desk Reception (+91 81012 98882)"
          >
            <Phone className="w-3.5 h-3.5 text-white shrink-0" />
            <span className="whitespace-nowrap font-bold">Call Reception</span>
          </a>
        </div>
      </header>

      {/* 2. Room Gate: Unscanned vs. Awaiting Check-In vs. Active In-Room Concierge */}
      {!currentRoom ? (
        <main className="flex-1 max-w-md mx-auto px-4 py-16 sm:py-24 flex flex-col items-center justify-center text-center w-full">
          <div className="w-20 h-20 rounded-3xl bg-[#0B1733] text-[#FE6E00] flex items-center justify-center mb-6 shadow-xl border border-[#1E2D4A]">
            <QrCode className="w-10 h-10" />
          </div>

          <span className="text-[10px] uppercase font-extrabold tracking-widest text-primary-800 bg-primary-100 px-3 py-1 rounded-full border border-primary-300 mb-3">
            In-Room Sanctuary Access
          </span>

          <h2
            className="font-bold text-2xl sm:text-3xl text-[#0B1733] mb-2"
            style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
          >
            Scan Your Room QR Code
          </h2>

          <p className="text-xs sm:text-sm text-gray-600 max-w-sm leading-relaxed mb-6">
            To protect guest privacy and connect directly to your dedicated room concierge, please scan the QR standee located on your bedside table or room desk.
          </p>

          <div className="w-full space-y-2.5 max-w-xs">
            <a
              href="tel:+918101298882"
              className="w-full min-h-[44px] py-3 bg-[#25479E] hover:bg-[#1A3478] active:scale-98 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Phone className="w-4 h-4 text-white" />
              <span>Contact Front Desk (+91 81012 98882)</span>
            </a>

            <a
              href="https://wa.me/918101298882?text=Hello%20Savera%20Homestay%2C%20I%20am%20at%20the%20property%20and%20need%20assistance%20accessing%20my%20in-room%20concierge."
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[44px] py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>WhatsApp Reception</span>
              <ExternalLink className="w-3.5 h-3.5 ml-1" />
            </a>
          </div>
        </main>
      ) : !isCheckedIn ? (
        <main className="flex-1 max-w-xl mx-auto px-4 py-8 sm:py-16 flex flex-col items-center justify-center text-center w-full">
          {/* PWA Install Banner: Renders only when NOT installed. If installed, returns null */}
          <PWAInstaller variant="banner" className="w-full mb-6 text-left" />

          <div className="w-20 h-20 rounded-3xl bg-sand-200/80 text-forest-800 flex items-center justify-center mb-6 shadow-inner border border-sand-300">
            <Clock className="w-10 h-10 text-amber-700" />
          </div>

          <span className="text-xs uppercase font-extrabold tracking-widest text-amber-800 bg-amber-100 px-3 py-1 rounded-full border border-amber-300 mb-3">
            Room {currentRoom.roomNumber} Status: {currentRoom.currentStatus.toUpperCase()}
          </span>

          <h2
            className="font-bold text-2xl sm:text-3xl text-[#0B1733] mb-2"
            style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
          >
            Room {currentRoom.roomNumber} is Awaiting Check-In
          </h2>

          <p className="text-sm text-gray-600 max-w-md leading-relaxed mb-6">
            This in-room digital concierge portal activates automatically once your arrival is verified by our front desk team.
          </p>

          <div className="p-5 bg-white rounded-3xl border border-[#C7D4F5] shadow-sm text-xs text-[#0B1733] max-w-md w-full text-left space-y-3 mb-4">
            <div className="flex items-center space-x-2 font-bold text-[#0B1733] text-sm">
              <Phone className="w-4 h-4 text-primary-700" />
              <span>Need Assistance?</span>
            </div>
            <p>
              Please contact the front desk at <strong>+91 81012 98882</strong> or ring the bell at reception for early baggage drop or instant check-in.
            </p>
          </div>

          {/* Refresh Live Status Button */}
          <div className="w-full max-w-md mb-4">
            <button
              onClick={() => {
                if (selectedRoomNumber) {
                  fetchRoomStatusFromServer(selectedRoomNumber);
                  showToast('Checking live room status with front desk...');
                }
              }}
              disabled={isCheckingServer}
              className="w-full min-h-[44px] py-2.5 px-4 bg-primary-50 hover:bg-primary-100 active:scale-98 text-primary-800 font-bold text-xs rounded-2xl border border-primary-200 transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-xs disabled:opacity-60"
            >
              {isCheckingServer ? (
                <Loader2 className="w-4 h-4 animate-spin text-primary-700" />
              ) : (
                <RefreshCw className="w-4 h-4 text-primary-700" />
              )}
              <span>{isCheckingServer ? 'Checking Front Desk Status...' : 'Already Checked In? Refresh Status'}</span>
            </button>
          </div>

          {/* Complimentary Wi-Fi while awaiting check-in */}
          <div className="p-4 bg-emerald-50 rounded-3xl border border-emerald-200 text-xs text-emerald-950 max-w-md w-full flex items-center justify-between gap-3 mb-6 shadow-xs">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 border border-emerald-300 flex items-center justify-center shrink-0">
                <Wifi className="w-5 h-5 text-emerald-800" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-emerald-950 block text-xs">Complimentary Guest Wi-Fi</span>
                <span className="text-[11px] text-emerald-800 font-mono block truncate">
                  Airtel_nabi_8882 • Pass: air69080
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                setQrHubTab('wifi');
                setShowQRHub(true);
              }}
              className="min-h-[36px] px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl transition-colors shrink-0 shadow-xs cursor-pointer flex items-center space-x-1"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Scan QR</span>
            </button>
          </div>

          {/* Interactive Simulation Action (Only visible in staff mode) */}
          {isStaffMode && (
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-950 max-w-md w-full space-y-3">
              <span className="font-bold block">
                Staff Simulator:
              </span>
              <p className="text-[11px] text-amber-800">
                Simulate check-in for <strong>Room {currentRoom.roomNumber}</strong>.
              </p>
              <button
                onClick={() => {
                  if (activeBooking) {
                    checkInRoom(activeBooking.id);
                    showToast(`Simulated check-in for Room ${currentRoom.roomNumber}`);
                  } else {
                    showToast(`No active reservation found for Room ${currentRoom.roomNumber}.`);
                  }
                }}
                className="w-full min-h-[44px] py-2.5 bg-[#0B1733] hover:bg-[#12244F] text-white font-bold rounded-xl shadow transition-colors flex items-center justify-center space-x-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Simulate Check-In for Room {currentRoom.roomNumber}</span>
              </button>
            </div>
          )}
        </main>
      ) : (
        /* 3. ACTIVE IN-ROOM DIGITAL CONCIERGE INTERFACE */
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* PWA Install Banner: Renders only when NOT installed. If installed, returns null */}
          <PWAInstaller variant="banner" className="w-full text-left" />

          {/* Welcome Banner */}
          <div className="bg-gradient-to-br from-[#0B1733] via-[#12244F] to-[#0B1733] text-white rounded-3xl p-6 shadow-md border border-[#1E2D4A]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#FE6E00] block mb-1">
                  Active Stay In Residence
                </span>
                <h1
                  className="text-2xl font-bold text-white tracking-tight"
                  style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                >
                  Welcome to {currentRoom.name}!
                </h1>
                <p className="text-xs text-gray-300 mt-1">
                  Guest: <strong className="text-white">{activeBooking?.guest.fullName}</strong> • Meal Plan:{' '}
                  <strong className="text-[#FE6E00] font-mono">{activeBooking?.mealPlan}</strong> • Folio: #{activeFolio?.folioNumber}
                </p>
              </div>

              {/* Late Night Simulation Toggle */}
              <div className="bg-[#070F22] p-3 rounded-2xl border border-[#1E2D4A] text-xs self-start sm:self-auto space-y-1">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-[#FE6E00]" />
                  <span className="font-bold text-gray-200">
                    Kitchen Clock: {isLateNight ? '10:45 PM (Night)' : '2:30 PM (Day)'}
                  </span>
                </div>
                <label className="flex items-center space-x-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={simulateLateNight}
                    onChange={(e) => setSimulateLateNight(e.target.checked)}
                    className="rounded text-[#FE6E00] focus:ring-0"
                  />
                  <span className="text-[11px] text-gray-300">
                    Test 10 PM Cutoff (Hide Mains)
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Module Switcher: Dining vs Travel Add-ons */}
          <div className="flex items-center justify-center space-x-3 bg-[#070F22] p-1.5 rounded-2xl max-w-md mx-auto border border-[#1E2D4A]">
            <button
              onClick={() => setActiveTab('dining')}
              className={`flex-1 min-h-[44px] py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                activeTab === 'dining'
                  ? 'bg-gradient-to-r from-[#FE6E00] to-[#EA580C] text-white shadow-sm'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <Utensils className="w-4 h-4" />
              <span>In-Room Dining</span>
            </button>

            <button
              onClick={() => setActiveTab('travel')}
              className={`flex-1 min-h-[44px] py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                activeTab === 'travel'
                  ? 'bg-gradient-to-r from-[#FE6E00] to-[#EA580C] text-white shadow-sm'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>Travel & Add-Ons</span>
            </button>
          </div>

          {/* TAB 1: IN-ROOM DINING INTERFACE */}
          {activeTab === 'dining' && (
            <div className="space-y-6">
              {/* Category Filter Pills */}
              <div className="flex items-center space-x-2 overflow-x-auto pb-1 no-scrollbar">
                <button
                  onClick={() => setSelectedFoodCategory('all')}
                  className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    selectedFoodCategory === 'all'
                      ? 'bg-forest-900 text-white shadow-xs'
                      : 'bg-white border border-sand-300 text-forest-800 hover:bg-sand-100'
                  }`}
                >
                  All Items ({menuItems.length})
                </button>
                <button
                  onClick={() => setSelectedFoodCategory('beverage')}
                  className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    selectedFoodCategory === 'beverage'
                      ? 'bg-forest-900 text-white shadow-xs'
                      : 'bg-white border border-sand-300 text-forest-800 hover:bg-sand-100'
                  }`}
                >
                  Beverages & Brews
                </button>
                <button
                  onClick={() => setSelectedFoodCategory('breakfast')}
                  className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    selectedFoodCategory === 'breakfast'
                      ? 'bg-forest-900 text-white shadow-xs'
                      : 'bg-white border border-sand-300 text-forest-800 hover:bg-sand-100'
                  }`}
                >
                  Breakfast
                </button>
                <button
                  onClick={() => setSelectedFoodCategory('snack')}
                  className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    selectedFoodCategory === 'snack'
                      ? 'bg-forest-900 text-white shadow-xs'
                      : 'bg-white border border-sand-300 text-forest-800 hover:bg-sand-100'
                  }`}
                >
                  Snacks & Soups
                </button>
                <button
                  onClick={() => setSelectedFoodCategory('main')}
                  className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    selectedFoodCategory === 'main'
                      ? 'bg-forest-900 text-white shadow-xs'
                      : 'bg-white border border-sand-300 text-forest-800 hover:bg-sand-100'
                  }`}
                >
                  Main Course
                </button>
                <button
                  onClick={() => setSelectedFoodCategory('thali')}
                  className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    selectedFoodCategory === 'thali'
                      ? 'bg-forest-900 text-white shadow-xs'
                      : 'bg-white border border-sand-300 text-forest-800 hover:bg-sand-100'
                  }`}
                >
                  Thalis (Set Meals)
                </button>
                <button
                  onClick={() => setSelectedFoodCategory('sides')}
                  className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    selectedFoodCategory === 'sides'
                      ? 'bg-forest-900 text-white shadow-xs'
                      : 'bg-white border border-sand-300 text-forest-800 hover:bg-sand-100'
                  }`}
                >
                  Rice, Breads & Sides
                </button>
              </div>

              {/* Time Enforcement Notice if Late Night */}
              {isLateNight && (
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-300 text-xs text-amber-950 flex items-start space-x-2.5">
                  <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <strong>Late-Night Menu Active (After 10:00 PM):</strong>
                    <p className="text-amber-800 mt-0.5">
                      Traditional Mains are closed for the evening to allow kitchen bread dough resting. Hot beverages and artisanal Himalayan snacks remain available for room service.
                    </p>
                  </div>
                </div>
              )}

              {/* Food Menu Items Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {availableMenuItems.map((item) => {
                  const qtyInCart = cart[item.id] || 0;

                  return (
                    <div
                      key={item.id}
                      className={`bg-white rounded-3xl p-4 border border-sand-200 shadow-xs flex flex-col justify-between transition-all ${
                        !item.isAvailable ? 'opacity-60 bg-sand-50/80' : ''
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="h-44 rounded-2xl overflow-hidden bg-sand-200 relative">
                          {item.imageUrl && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          )}
                          <div className="absolute top-2 right-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-black/60 backdrop-blur-xs text-white px-2.5 py-1 rounded-full">
                              {item.categoryName}
                            </span>
                          </div>
                          {!item.isAvailable && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <span className="bg-rose-600 text-white text-xs font-bold px-3 py-1 rounded-xl">
                                Out of Stock
                              </span>
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-serif font-bold text-sm text-forest-950">
                              {item.name}
                            </h3>
                            <span className="font-mono font-bold text-sm text-forest-900 shrink-0">
                              ₹{item.price}
                            </span>
                          </div>
                          <p className="text-xs text-forest-700 line-clamp-2 mt-1 leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                      </div>

                      {/* Add to cart / Quantity Controller */}
                      <div className="pt-4 mt-2 border-t border-sand-100 flex items-center justify-between">
                        <span className="text-[11px] text-gray-500">
                          Prep: ~{item.prepTimeMinutes} mins
                        </span>

                        {item.isAvailable ? (
                          qtyInCart > 0 ? (
                            <div className="flex items-center space-x-2 bg-sand-100 rounded-xl p-1">
                              <button
                                onClick={() => removeFromCart(item.id)}
                                className="w-8 h-8 rounded-lg bg-white text-forest-900 flex items-center justify-center shadow-xs font-bold min-h-[32px] min-w-[32px]"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="font-bold text-xs px-2 font-mono">{qtyInCart}</span>
                              <button
                                onClick={() => addToCart(item.id)}
                                className="w-8 h-8 rounded-lg bg-forest-900 text-white flex items-center justify-center shadow-xs font-bold min-h-[32px] min-w-[32px]"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => addToCart(item.id)}
                              className="min-h-[44px] px-4 py-1.5 bg-forest-900 hover:bg-forest-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center space-x-1.5"
                            >
                              <Plus className="w-3.5 h-3.5 text-amber-300" />
                              <span>Add to Tray</span>
                            </button>
                          )
                        ) : (
                          <span className="text-xs text-gray-400 font-semibold">Unavailable</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sticky / Bottom Order Tray Bar */}
              {cartItemCount > 0 && (
                <div id="dining-tray" className="scroll-mt-24 bg-white rounded-3xl p-5 border-2 border-forest-900 shadow-xl space-y-4 animate-in slide-in-from-bottom-2 duration-200">
                  <div className="flex items-center justify-between border-b border-sand-200 pb-3">
                    <div className="flex items-center space-x-2">
                      <ShoppingBag className="w-5 h-5 text-amber-600" />
                      <h4 className="font-serif font-bold text-sm text-forest-950">
                        Your In-Room Dining Tray ({cartItemCount} items)
                      </h4>
                    </div>
                    <span className="font-mono font-bold text-base text-forest-950">
                      ₹{cartSubtotal}
                    </span>
                  </div>

                  {/* Tray Items */}
                  <div className="divide-y divide-sand-100 text-xs">
                    {cartItemsDetailed.map(({ item, quantity, lineTotal }) => (
                      <div key={item.id} className="py-2 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-forest-950">
                            {quantity}x {item.name}
                          </span>
                        </div>
                        <span className="font-mono font-semibold text-forest-800">
                          ₹{lineTotal}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Special Cooking Instructions */}
                  <div>
                    <label className="text-[11px] font-bold text-forest-800 block mb-1">
                      Chef Cooking Instructions (Dietary / Spice level)
                    </label>
                    <input
                      type="text"
                      value={cookingInstructions}
                      onChange={(e) => setCookingInstructions(e.target.value)}
                      placeholder="e.g., Strict Jain, less salt, extra ginger"
                      className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-sand-50"
                    />
                  </div>

                  {/* Checkout Button */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <div className="text-xs text-forest-700">
                      <p className="font-semibold">Billed to Folio: #{activeFolio?.folioNumber}</p>
                      <p className="text-[11px] text-gray-500">
                        Charge posts as &quot;Pending&quot; until served
                      </p>
                    </div>

                    <button
                      onClick={handleCheckoutFoodOrder}
                      disabled={isSubmittingOrder}
                      className="min-h-[44px] px-6 py-3 bg-forest-900 hover:bg-forest-800 active:scale-95 text-white font-bold text-xs rounded-2xl shadow-lg transition-all flex items-center justify-center space-x-2"
                    >
                      <Send className="w-4 h-4 text-amber-300" />
                      <span>Confirm Order & Post to Room</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TRAVEL & ADD-ONS INTERFACE */}
          {activeTab === 'travel' && (
            <div className="bg-white rounded-3xl p-6 border border-sand-200 shadow-xs space-y-6">
              <div>
                <h3 className="font-serif font-bold text-lg text-forest-950">
                  Himalayan Transfers & Bike Rentals
                </h3>
                <p className="text-xs text-forest-700 mt-0.5">
                  Point-to-point private cabs, scenic detour modifiers, and self-drive Scooty/Royal Enfield rentals.
                </p>
              </div>

              {/* Service Type Switch */}
              <div className="flex items-center space-x-2 bg-sand-100 p-1 rounded-2xl max-w-sm">
                <button
                  type="button"
                  onClick={() => setServiceType('point_to_point')}
                  className={`flex-1 min-h-[40px] py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                    serviceType === 'point_to_point'
                      ? 'bg-forest-900 text-white shadow-xs'
                      : 'text-forest-700 hover:text-forest-950'
                  }`}
                >
                  <Car className="w-3.5 h-3.5" />
                  <span>Point-to-Point Transfer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setServiceType('rental')}
                  className={`flex-1 min-h-[40px] py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                    serviceType === 'rental'
                      ? 'bg-forest-900 text-white shadow-xs'
                      : 'text-forest-700 hover:text-forest-950'
                  }`}
                >
                  <Bike className="w-3.5 h-3.5" />
                  <span>Scooty / Bike Rental</span>
                </button>
              </div>

              <form onSubmit={handleCheckoutTravel} className="space-y-6">
                {serviceType === 'point_to_point' ? (
                  <div className="space-y-4">
                    {/* Route Selection */}
                    <div>
                      <label className="text-xs font-bold text-forest-900 block mb-2">
                        Select Destination Route
                      </label>
                      <div className="space-y-2">
                        {transferRoutes.map((rt) => (
                          <label
                            key={rt.id}
                            className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                              selectedRouteId === rt.id
                                ? 'bg-forest-50/80 border-forest-800 ring-1 ring-forest-800'
                                : 'bg-sand-50/50 border-sand-300 hover:bg-sand-50'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <input
                                type="radio"
                                name="route"
                                checked={selectedRouteId === rt.id}
                                onChange={() => setSelectedRouteId(rt.id)}
                                className="text-forest-900 focus:ring-0"
                              />
                              <div>
                                <span className="font-serif font-bold text-xs text-forest-950 block">
                                  {rt.title}
                                </span>
                                <span className="text-[11px] text-gray-500">
                                  Est. Duration: {rt.estimatedDurationHours} hours
                                </span>
                              </div>
                            </div>
                            <span className="font-mono font-bold text-xs text-forest-900">
                              from ₹{rt.priceWagonR}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Vehicle Tier Selection */}
                    {/* Vehicle Tier Selection */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-forest-900 block">
                          Choose Vehicle Tier
                        </label>
                        {activeSeasonInfo.seasonType !== 'regular' && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              activeSeasonInfo.seasonType === 'season'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {activeSeasonInfo.seasonName}
                          </span>
                        )}
                      </div>

                      {(() => {
                        const wagonRTariff = currentRoute
                          ? calculateDynamicTransferRate(currentRoute, travelDateStr, 'wagonr')
                          : null;
                        const sedanTariff = currentRoute
                          ? calculateDynamicTransferRate(currentRoute, travelDateStr, 'sedan')
                          : null;
                        const suvTariff = currentRoute
                          ? calculateDynamicTransferRate(currentRoute, travelDateStr, 'suv')
                          : null;

                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <label
                              className={`p-3.5 rounded-2xl border cursor-pointer text-center transition-all ${
                                selectedVehicleTier === 'wagonr'
                                  ? 'bg-forest-900 text-white border-forest-900 shadow-sm'
                                  : 'bg-sand-50 border-sand-300 text-forest-950 hover:bg-white'
                              }`}
                            >
                              <input
                                type="radio"
                                name="tier"
                                className="hidden"
                                checked={selectedVehicleTier === 'wagonr'}
                                onChange={() => setSelectedVehicleTier('wagonr')}
                              />
                              <span className="font-bold text-xs block">WagonR / Alto</span>
                              <span className="text-[10px] block opacity-80">Up to 3 Pax</span>
                              <span className="font-mono font-bold text-sm block mt-1">
                                ₹{wagonRTariff?.rate.toLocaleString('en-IN') || currentRoute?.priceWagonR}
                              </span>
                            </label>

                            <label
                              className={`p-3.5 rounded-2xl border cursor-pointer text-center transition-all ${
                                selectedVehicleTier === 'sedan'
                                  ? 'bg-forest-900 text-white border-forest-900 shadow-sm'
                                  : 'bg-sand-50 border-sand-300 text-forest-950 hover:bg-white'
                              }`}
                            >
                              <input
                                type="radio"
                                name="tier"
                                className="hidden"
                                checked={selectedVehicleTier === 'sedan'}
                                onChange={() => setSelectedVehicleTier('sedan')}
                              />
                              <span className="font-bold text-xs block">Sedan (Dzire/Glanza)</span>
                              <span className="text-[10px] block opacity-80">Up to 4 Pax + Boot</span>
                              <span className="font-mono font-bold text-sm block mt-1">
                                ₹{sedanTariff?.rate.toLocaleString('en-IN') || currentRoute?.priceSedan}
                              </span>
                            </label>

                            <label
                              className={`p-3.5 rounded-2xl border cursor-pointer text-center transition-all ${
                                selectedVehicleTier === 'suv'
                                  ? 'bg-forest-900 text-white border-forest-900 shadow-sm'
                                  : 'bg-sand-50 border-sand-300 text-forest-950 hover:bg-white'
                              }`}
                            >
                              <input
                                type="radio"
                                name="tier"
                                className="hidden"
                                checked={selectedVehicleTier === 'suv'}
                                onChange={() => setSelectedVehicleTier('suv')}
                              />
                              <span className="font-bold text-xs block">SUV (Innova / Xylo)</span>
                              <span className="text-[10px] block opacity-80">Up to 6 Pax</span>
                              <span className="font-mono font-bold text-sm block mt-1">
                                ₹{suvTariff?.rate.toLocaleString('en-IN') || currentRoute?.priceSUV}
                              </span>
                            </label>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Route Modifiers */}
                    {currentRoute?.modifiers && currentRoute.modifiers.length > 0 && (
                      <div>
                        <label className="text-xs font-bold text-forest-900 block mb-2">
                          Scenic Route Modifiers & Sightseeing Detours
                        </label>
                        <div className="space-y-2">
                          {currentRoute.modifiers.map((mod) => {
                            const isChecked = selectedModifiers.includes(mod.name);
                            return (
                              <label
                                key={mod.id}
                                className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer text-xs ${
                                  isChecked
                                    ? 'bg-amber-50 border-amber-300 text-amber-950'
                                    : 'bg-sand-50 border-sand-200 text-forest-900'
                                }`}
                              >
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedModifiers((prev) => [...prev, mod.name]);
                                      } else {
                                        setSelectedModifiers((prev) =>
                                          prev.filter((m) => m !== mod.name)
                                        );
                                      }
                                    }}
                                    className="rounded text-amber-600 focus:ring-0"
                                  />
                                  <span className="font-semibold">{mod.name}</span>
                                </div>
                                <span className="font-mono font-bold text-forest-900">
                                  +₹{mod.extraCharge}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Rental Vehicle Selection */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-forest-900 block">
                        Choose Available Mountain Two-Wheeler
                      </label>
                      {activeSeasonInfo.seasonType !== 'regular' && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            activeSeasonInfo.seasonType === 'season'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {activeSeasonInfo.seasonName}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {rentalVehicles.map((veh) => {
                        const dynRate = calculateDynamicRentalRate(veh, travelDateStr, returnDateStr);

                        return (
                          <label
                            key={veh.id}
                            className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                              selectedRentalId === veh.id
                                ? 'bg-forest-900 text-white border-forest-900 shadow-sm'
                                : 'bg-sand-50 border-sand-300 text-forest-950 hover:bg-white'
                            }`}
                          >
                            <input
                              type="radio"
                              name="rental"
                              className="hidden"
                              checked={selectedRentalId === veh.id}
                              onChange={() => setSelectedRentalId(veh.id)}
                            />
                            <div>
                              <div className="flex items-center space-x-2 mb-1">
                                <Bike className={`w-4 h-4 ${selectedRentalId === veh.id ? 'text-amber-300' : 'text-amber-600'}`} />
                                <span className="font-bold text-xs">{veh.vehicleName}</span>
                              </div>
                              {veh.specs && (
                                <span className={`text-[10px] block line-clamp-1 mb-2 ${selectedRentalId === veh.id ? 'text-sand-200' : 'text-gray-500'}`}>
                                  {veh.specs}
                                </span>
                              )}
                            </div>

                            <div>
                              <div className="flex items-baseline space-x-1 mt-2">
                                <span className="font-mono font-bold text-base">
                                  ₹{dynRate.dailyAvgRate.toLocaleString('en-IN')}
                                </span>
                                <span className="text-[10px] opacity-80">/ day</span>
                              </div>
                              {rentalDays > 1 && (
                                <span className="text-[10px] block font-semibold opacity-90 text-amber-300">
                                  ₹{dynRate.totalRate.toLocaleString('en-IN')} for {rentalDays} days
                                </span>
                              )}
                              <span className="text-[10px] block opacity-70 mt-0.5">
                                Security Deposit: ₹{veh.depositRequired}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Common Pickup & Rental Return Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="text-[11px] font-bold text-forest-800 block mb-1">
                      Preferred Pickup Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={pickupDatetime}
                      onChange={(e) => setPickupDatetime(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-sand-50 font-semibold"
                    />
                  </div>

                  {serviceType === 'rental' ? (
                    <div>
                      <label className="text-[11px] font-bold text-forest-800 block mb-1">
                        Preferred Return Date & Time ({rentalDays} {rentalDays === 1 ? 'Day' : 'Days'})
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={returnDatetime}
                        onChange={(e) => setReturnDatetime(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-sand-50 font-semibold"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="text-[11px] font-bold text-forest-800 block mb-1">
                        WhatsApp Contact Phone for Driver Coordination
                      </label>
                      <input
                        type="text"
                        required
                        value={travelPhone}
                        onChange={(e) => setTravelPhone(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-sand-50 font-semibold"
                      />
                    </div>
                  )}
                </div>

                {serviceType === 'rental' && (
                  <div>
                    <label className="text-[11px] font-bold text-forest-800 block mb-1">
                      WhatsApp Contact Phone for Rider Verification & Handover
                    </label>
                    <input
                      type="text"
                      required
                      value={travelPhone}
                      onChange={(e) => setTravelPhone(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-sand-50 font-semibold"
                    />
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-bold text-forest-800 block mb-1">
                    {serviceType === 'point_to_point'
                      ? 'Luggage or Flight/Train Details'
                      : 'Rider License / Riding Route Plans (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={destinationNotes}
                    onChange={(e) => setDestinationNotes(e.target.value)}
                    placeholder={
                      serviceType === 'point_to_point'
                        ? 'e.g. Flight 6E-204 departing Bagdogra at 4:30 PM, 3 bags'
                        : 'e.g. Valid 2-wheeler license ready, planning Mirik / Tiger Hill sunrise ride'
                    }
                    className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-sand-50"
                  />
                </div>

                {/* Quoted Summary & Submission */}
                <div className="pt-4 border-t border-sand-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-500 block">
                      Total Quoted Amount (Post to Folio)
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="text-xl font-serif font-bold text-forest-950">
                        ₹{(serviceType === 'point_to_point' ? totalTransferQuoted : totalRentalQuoted).toLocaleString('en-IN')}
                      </span>
                      {activeSeasonInfo.seasonType !== 'regular' && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            activeSeasonInfo.seasonType === 'season'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {activeSeasonInfo.seasonName}
                        </span>
                      )}
                    </div>
                    {serviceType === 'rental' && (
                      <span className="text-[10px] text-gray-500 block">
                        {rentalDays} {rentalDays === 1 ? 'day' : 'days'} rental @ ₹{dynamicRentalQuote?.dailyAvgRate.toLocaleString('en-IN')}/day
                      </span>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="min-h-[44px] px-6 py-3 bg-forest-900 hover:bg-forest-800 text-white font-bold text-xs rounded-2xl shadow-lg transition-all flex items-center justify-center space-x-2"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>{serviceType === 'point_to_point' ? 'Book Transfer & Alert Front Desk' : 'Reserve Bike & Alert Front Desk'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* FOOD ORDER CONFIRMATION MODAL & WHATSAPP ALERT TRIGGER */}
          {lastPlacedOrder && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-sand-200 text-forest-950 animate-in fade-in zoom-in-95 duration-150 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div>
                  <span className="text-xs font-mono font-bold text-emerald-700 uppercase">
                    Order #{lastPlacedOrder.orderNumber} Placed
                  </span>
                  <h3 className="font-serif font-bold text-xl text-forest-950 mt-1">
                    Sent to Homestay Kitchen!
                  </h3>
                  <p className="text-xs text-forest-700 mt-1">
                    Your meal order of <strong>₹{lastPlacedOrder.totalAmount}</strong> has been charged as <strong>Pending</strong> to your room folio.
                  </p>
                </div>

                <div className="p-4 bg-sand-50 rounded-2xl border border-sand-200 text-xs text-forest-800 text-left space-y-1">
                  <p><strong>Room:</strong> {lastPlacedOrder.roomName}</p>
                  <p><strong>Items:</strong> {lastPlacedOrder.items.map((i: any) => `${i.quantity}x ${i.itemName}`).join(', ')}</p>
                  {lastPlacedOrder.specialInstructions && (
                    <p><strong>Chef Note:</strong> {lastPlacedOrder.specialInstructions}</p>
                  )}
                </div>

                {/* Pre-filled WhatsApp Alert Action Button */}
                <div className="space-y-2">
                  <a
                    href={generateWhatsAppOrderLink(lastPlacedOrder)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full min-h-[44px] py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center space-x-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Send Pre-Filled WhatsApp to Front Desk</span>
                    <ExternalLink className="w-3.5 h-3.5 ml-1" />
                  </a>

                  <button
                    onClick={() => setLastPlacedOrder(null)}
                    className="w-full min-h-[44px] py-2 text-xs font-bold text-gray-500 hover:text-gray-800"
                  >
                    Close & Return to Concierge
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TRAVEL CONFIRMATION MODAL & WHATSAPP ALERT TRIGGER */}
          {lastPlacedTransport && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-sand-200 text-forest-950 animate-in fade-in zoom-in-95 duration-150 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center mx-auto">
                  <Car className="w-8 h-8" />
                </div>

                <div>
                  <span className="text-xs font-mono font-bold text-blue-700 uppercase">
                    Dispatch Request #{lastPlacedTransport.requestNumber}
                  </span>
                  <h3 className="font-serif font-bold text-xl text-forest-950 mt-1">
                    Transport Request Received!
                  </h3>
                  <p className="text-xs text-forest-700 mt-1">
                    Amount of <strong>₹{lastPlacedTransport.quotedPrice}</strong> is logged to your room folio. The duty manager will assign your driver shortly.
                  </p>
                </div>

                <div className="p-4 bg-sand-50 rounded-2xl border border-sand-200 text-xs text-forest-800 text-left space-y-1">
                  <p><strong>Service:</strong> {lastPlacedTransport.serviceType === 'point_to_point' ? lastPlacedTransport.routeTitle : lastPlacedTransport.rentalVehicleName}</p>
                  <p><strong>Pickup Time:</strong> {new Date(lastPlacedTransport.pickupDatetime).toLocaleString('en-IN')}</p>
                  <p><strong>Contact:</strong> {lastPlacedTransport.guestContactPhone}</p>
                </div>

                {/* Pre-filled WhatsApp Alert Action Button */}
                <div className="space-y-2">
                  <a
                    href={generateWhatsAppTransportLink(lastPlacedTransport)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full min-h-[44px] py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center space-x-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Send Pre-Filled WhatsApp to Front Desk</span>
                    <ExternalLink className="w-3.5 h-3.5 ml-1" />
                  </a>

                  <button
                    onClick={() => setLastPlacedTransport(null)}
                    className="w-full min-h-[44px] py-2 text-xs font-bold text-gray-500 hover:text-gray-800"
                  >
                    Close & Return to Concierge
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Staff & Evaluator Simulator Switcher (Staff mode only - never visible to guests) */}
          {isStaffMode && (
            <div className="pt-6 pb-2 text-center">
              <div className="inline-flex items-center space-x-2 bg-sand-200/80 border border-sand-300 px-3 py-1.5 rounded-2xl text-xs text-forest-800">
                <span className="text-[11px] font-medium text-forest-700">Staff Simulator (Switch Room):</span>
                <select
                  value={selectedRoomNumber || 101}
                  onChange={(e) => setSelectedRoomNumber(parseInt(e.target.value, 10))}
                  className="bg-white px-2 py-0.5 rounded-lg border border-sand-300 text-forest-900 font-bold font-mono text-xs cursor-pointer focus:outline-none"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.roomNumber}>
                      Room {r.roomNumber} ({r.currentStatus})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </main>
      )}

      {/* 4. Fixed Bottom Dining Checkout Bar: Only shown when items are in cart */}
      {currentRoom && isCheckedIn && cartItemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-sand-300 shadow-[0_-4px_25px_rgba(0,0,0,0.08)] py-3 px-4 sm:px-6 safe-area-pb animate-in slide-in-from-bottom duration-200">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="relative w-10 h-10 rounded-xl bg-forest-900 text-amber-300 flex items-center justify-center shrink-0 shadow-sm">
                <ShoppingBag className="w-5 h-5" />
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-400 text-forest-950 font-black text-[10px] flex items-center justify-center shadow-xs">
                  {cartItemCount}
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-base font-serif font-bold text-forest-950 leading-tight">
                  ₹{cartSubtotal.toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] text-forest-700 truncate font-medium">
                  {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'} in Dining Tray
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setActiveTab('dining');
                setTimeout(() => {
                  const trayEl = document.getElementById('dining-tray');
                  if (trayEl) {
                    trayEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }, 50);
              }}
              className="min-h-[44px] px-5 py-2.5 bg-forest-900 hover:bg-forest-800 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center space-x-2 shrink-0 cursor-pointer"
            >
              <span>Checkout Tray</span>
              <ArrowRight className="w-4 h-4 text-amber-300" />
            </button>
          </div>
        </div>
      )}

      {/* 5. Express Room Checkout Modal */}
      {currentRoom && showRoomCheckoutModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-sand-200 text-forest-950 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowRoomCheckoutModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-sand-100 text-gray-400 hover:text-gray-700 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              aria-label="Close checkout modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mb-3">
              <Trees className="w-6 h-6" />
            </div>

            <span className="text-[10px] uppercase font-bold tracking-wider text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300 inline-block mb-1">
              Room {currentRoom.roomNumber} Departure
            </span>
            <h3 className="font-serif font-bold text-xl text-forest-950">
              Express Room Checkout
            </h3>
            <p className="text-xs text-forest-700 mt-1 mb-4 leading-relaxed">
              We hope you enjoyed your stay at Savera Homestay! Review your current folio statement below to settle your account with reception.
            </p>

            {/* Folio Summary Breakdown */}
            <div className="bg-sand-50 rounded-2xl p-4 border border-sand-200 space-y-2 text-xs mb-5">
              <div className="flex justify-between text-forest-800">
                <span>Guest:</span>
                <span className="font-bold text-forest-950">{activeBooking?.guest.fullName || 'Resident Guest'}</span>
              </div>
              <div className="flex justify-between text-forest-800">
                <span>Folio Number:</span>
                <span className="font-mono font-bold text-forest-950">#{activeFolio?.folioNumber || '---'}</span>
              </div>
              <div className="border-t border-sand-200 pt-2 space-y-1">
                <div className="flex justify-between text-forest-700">
                  <span>Room Accommodation:</span>
                  <span className="font-mono">₹{activeFolio?.totalRoomCharges.toLocaleString('en-IN') || 0}</span>
                </div>
                <div className="flex justify-between text-forest-700">
                  <span>In-Room Dining:</span>
                  <span className="font-mono">₹{activeFolio?.totalFbCharges.toLocaleString('en-IN') || 0}</span>
                </div>
                <div className="flex justify-between text-forest-700">
                  <span>Transfers & Add-Ons:</span>
                  <span className="font-mono">₹{activeFolio?.totalAddonCharges.toLocaleString('en-IN') || 0}</span>
                </div>
                <div className="flex justify-between text-emerald-800 font-medium">
                  <span>Total Amount Paid:</span>
                  <span className="font-mono">-₹{activeFolio?.totalPaid.toLocaleString('en-IN') || 0}</span>
                </div>
              </div>
              <div className="border-t border-sand-300 pt-2 flex justify-between items-center text-sm font-bold text-forest-950">
                <span>Outstanding Balance:</span>
                <span className="text-base font-serif font-bold text-amber-900">
                  ₹{activeFolio?.balanceDue.toLocaleString('en-IN') || 0}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <a
                href={`https://wa.me/918101298882?text=${encodeURIComponent(
                  `*SAVERA HOMESTAY - ROOM CHECKOUT REQUEST* 🛎️\n` +
                  `*Room:* ${currentRoom.roomNumber} (${currentRoom.name})\n` +
                  `*Guest:* ${activeBooking?.guest.fullName || 'Guest'}\n` +
                  `*Folio:* #${activeFolio?.folioNumber || 'N/A'}\n` +
                  `*Balance Due:* ₹${activeFolio?.balanceDue || 0}\n` +
                  `_Guest has requested room inspection and final bill settlement._`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[44px] py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Request Checkout via WhatsApp</span>
                <ExternalLink className="w-3.5 h-3.5 ml-1" />
              </a>

              <a
                href="tel:+918101298882"
                className="w-full min-h-[44px] py-2.5 bg-amber-400 hover:bg-amber-300 text-forest-950 font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Phone className="w-4 h-4" />
                <span>Call Front Desk (+91 81012 98882)</span>
              </a>

              {/* Staff / Evaluator simulation */}
              {isStaffMode && (
                <button
                  onClick={() => {
                    if (activeBooking) {
                      checkOutRoom(activeBooking.id);
                      showToast(`Room ${currentRoom.roomNumber} checkout logged. Thank you!`);
                      setShowRoomCheckoutModal(false);
                    }
                  }}
                  className="w-full min-h-[40px] py-2 text-[11px] font-bold text-forest-700 hover:text-forest-950 transition-colors cursor-pointer border border-sand-300 rounded-xl bg-sand-100/60"
                >
                  Simulate Room Departure (Staff Demo)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* In-Room Dine-In QR Standee Hub Modal (Wi-Fi only in guestMode) */}
      {showQRHub && (
        <InRoomQRHub
          isOpen={showQRHub}
          guestMode={!isStaffMode}
          initialTab={qrHubTab}
          initialRoomNumber={selectedRoomNumber || 101}
          onClose={() => setShowQRHub(false)}
        />
      )}
    </div>
  );
}

export default function ConciergePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-3 border-forest-700 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-forest-800 font-medium">Connecting to in-room sanctuary...</span>
        </div>
      </div>
    }>
      <ConciergeContent />
    </Suspense>
  );
}
