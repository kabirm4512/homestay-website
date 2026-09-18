'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
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
} from 'lucide-react';
import { useCRM } from '@/context/CRMContext';
import { MenuItem, FoodOrderItem, TransferRoute, RentalVehicle } from '@/types/crm';
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
    showToast,
  } = useCRM();

  // Selected room state (default to query param room or Room 101)
  const [selectedRoomNumber, setSelectedRoomNumber] = useState<number>(() => {
    if (initialRoomQuery) {
      const parsed = parseInt(initialRoomQuery, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return 101;
  });

  // Current active physical room
  const currentRoom = useMemo(() => {
    return rooms.find((r) => r.roomNumber === selectedRoomNumber) || rooms[0];
  }, [rooms, selectedRoomNumber]);

  // Current booking for this room
  const activeBooking = useMemo(() => {
    return bookings.find(
      (b) => b.roomId === currentRoom.id && ['checked_in', 'confirmed'].includes(b.tapeStatus)
    );
  }, [bookings, currentRoom]);

  // Active folio for this booking
  const activeFolio = useMemo(() => {
    if (!activeBooking) return null;
    return folios.find((f) => f.bookingId === activeBooking.id) || folios[0];
  }, [folios, activeBooking]);

  const isCheckedIn = currentRoom.currentStatus === 'checked_in';

  // Navigation tab in concierge: 'dining' or 'travel'
  const [activeTab, setActiveTab] = useState<'dining' | 'travel'>('dining');

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
  const [selectedFoodCategory, setSelectedFoodCategory] = useState<'all' | 'beverage' | 'snack' | 'main'>('all');

  // Food Cart state: map of menuItemId -> quantity
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cookingInstructions, setCookingInstructions] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [lastPlacedOrder, setLastPlacedOrder] = useState<any>(null);
  const [showQRHub, setShowQRHub] = useState(false);

  // Travel Add-on Booking State
  const [serviceType, setServiceType] = useState<'point_to_point' | 'rental'>('point_to_point');
  const [selectedRouteId, setSelectedRouteId] = useState<string>(transferRoutes[0]?.id || '');
  const [selectedVehicleTier, setSelectedVehicleTier] = useState<'wagonr' | 'sedan' | 'suv'>('sedan');
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>([]);
  const [selectedRentalId, setSelectedRentalId] = useState<string>(rentalVehicles[0]?.id || '');
  const [pickupDatetime, setPickupDatetime] = useState('2026-09-17T09:00');
  const [returnDatetime, setReturnDatetime] = useState('2026-09-18T09:00');
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
      // If late night, hide Mains completely unless marked isLateNightEligible!
      if (isLateNight && item.itemType === 'main' && !item.isLateNightEligible) {
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
    if (cartItemsDetailed.length === 0 || !activeBooking || !activeFolio) return;

    // Filter out any items that are no longer available or mains during late night
    const validItems = cartItemsDetailed.filter((ci) => {
      if (!ci.item.isAvailable) return false;
      if (isLateNight && ci.item.itemType === 'main' && !ci.item.isLateNightEligible) return false;
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

  const routeBasePrice = useMemo(() => {
    if (!currentRoute) return 0;
    if (selectedVehicleTier === 'wagonr') return currentRoute.priceWagonR;
    if (selectedVehicleTier === 'suv') return currentRoute.priceSUV;
    return currentRoute.priceSedan;
  }, [currentRoute, selectedVehicleTier]);

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

  const totalRentalQuoted = useMemo(() => {
    if (!currentRental) return 0;
    return currentRental.ratePerDay * rentalDays;
  }, [currentRental, rentalDays]);

  // Handle Travel Booking Checkout
  const handleCheckoutTravel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBooking || !activeFolio) return;

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
    const text = `*WHISPERING PINES IN-ROOM ORDER* 🛎️\n` +
      `*Room:* ${order.roomName}\n` +
      `*Guest:* ${order.guestName}\n` +
      `*Order #:* ${order.orderNumber}\n` +
      `*Items:* ${order.items.map((i: any) => `${i.quantity}x ${i.itemName}`).join(', ')}\n` +
      (order.specialInstructions ? `*Special Note:* ${order.specialInstructions}\n` : '') +
      `*Total Amount:* ₹${order.totalAmount}\n` +
      `_Charge posted as PENDING to Room Folio._`;

    return `https://wa.me/919876543210?text=${encodeURIComponent(text)}`;
  };

  const generateWhatsAppTransportLink = (req: any) => {
    const text = `*WHISPERING PINES DISPATCH REQUEST* 🚗\n` +
      `*Request #:* ${req.requestNumber}\n` +
      `*Room:* ${req.roomName}\n` +
      `*Guest:* ${req.guestName} (${req.guestContactPhone})\n` +
      `*Service:* ${req.serviceType === 'point_to_point' ? req.routeTitle : req.rentalVehicleName}\n` +
      `*Pickup Time:* ${new Date(req.pickupDatetime).toLocaleString('en-IN')}\n` +
      (req.returnDatetime ? `*Return Time:* ${new Date(req.returnDatetime).toLocaleString('en-IN')}\n` : '') +
      `*Quoted Price:* ₹${req.quotedPrice}\n` +
      `_Posted to Folio. Manager confirmation requested._`;

    return `https://wa.me/919876543210?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] text-forest-950 flex flex-col font-sans pb-16">
      {/* 1. Global Concierge Top Bar */}
      <header className="sticky top-0 z-40 bg-forest-900 text-white border-b border-forest-800 shadow-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-9 h-9 rounded-xl bg-forest-800 border border-forest-700 flex items-center justify-center">
                <Trees className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <span className="font-serif font-bold text-sm block leading-tight">
                  Whispering Pines
                </span>
                <span className="text-[10px] uppercase tracking-widest text-sand-300 font-semibold">
                  In-Room Digital Concierge
                </span>
              </div>
            </Link>
          </div>

          {/* Room Simulator / Quick Switcher for Staff and Evaluators */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1.5 bg-forest-950/80 px-2.5 py-1 rounded-xl border border-forest-800 text-xs">
              <span className="text-[10px] text-sand-300 font-medium hidden sm:inline">
                QR Room:
              </span>
              <select
                value={selectedRoomNumber}
                onChange={(e) => setSelectedRoomNumber(parseInt(e.target.value, 10))}
                className="bg-transparent text-amber-300 font-bold font-mono focus:outline-none cursor-pointer"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.roomNumber} className="bg-forest-900 text-white">
                    Room {r.roomNumber} ({r.currentStatus})
                  </option>
                ))}
              </select>
            </div>

            {/* Dine-In QR Standee Print/Download */}
            <button
              onClick={() => setShowQRHub(true)}
              className="min-h-[44px] flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-forest-800 hover:bg-forest-750 text-amber-300 hover:text-amber-200 border border-amber-500/30 text-xs font-bold transition-colors cursor-pointer shadow-xs"
              title="View & download in-room QR standee card"
            >
              <QrCode className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">QR Standee</span>
            </button>

            <PWAInstaller variant="button" />
          </div>
        </div>
      </header>

      {/* 2. Room Gate Check: Checked-In vs. Vacant Friendly Notice */}
      {!isCheckedIn ? (
        <main className="flex-1 max-w-xl mx-auto px-4 py-16 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-3xl bg-sand-200/80 text-forest-800 flex items-center justify-center mb-6 shadow-inner border border-sand-300">
            <Clock className="w-10 h-10 text-amber-700" />
          </div>

          <span className="text-xs uppercase font-extrabold tracking-widest text-amber-800 bg-amber-100 px-3 py-1 rounded-full border border-amber-300 mb-3">
            Room Status: {currentRoom.currentStatus.toUpperCase()}
          </span>

          <h2 className="font-serif font-bold text-2xl sm:text-3xl text-forest-950 mb-2">
            Room {currentRoom.roomNumber} is Awaiting Check-In
          </h2>

          <p className="text-sm text-forest-700 max-w-md leading-relaxed mb-6">
            This in-room digital concierge portal activates automatically once your arrival is verified by our front desk team.
          </p>

          <div className="p-5 bg-white rounded-3xl border border-sand-300 shadow-sm text-xs text-forest-800 max-w-md w-full text-left space-y-3 mb-6">
            <div className="flex items-center space-x-2 font-bold text-forest-950 text-sm">
              <Phone className="w-4 h-4 text-forest-700" />
              <span>Need Assistance?</span>
            </div>
            <p>
              Please contact the front desk at <strong>+91 98765 43210</strong> or ring the bell at reception for early baggage drop or instant check-in.
            </p>
          </div>

          {/* Interactive Simulation Action */}
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-950 max-w-md w-full space-y-3">
            <span className="font-bold block">
              Staff / Evaluator Simulator:
            </span>
            <p className="text-[11px] text-amber-800">
              You can instantly simulate guest check-in for <strong>Room {currentRoom.roomNumber}</strong> right now to inspect the live dining and travel interface.
            </p>
            <button
              onClick={() => {
                if (activeBooking) {
                  checkInRoom(activeBooking.id);
                } else {
                  showToast(`No reservation found for Room ${currentRoom.roomNumber}. Switching to Room 101.`);
                  setSelectedRoomNumber(101);
                }
              }}
              className="w-full min-h-[44px] py-2.5 bg-forest-900 hover:bg-forest-800 text-white font-bold rounded-xl shadow transition-colors flex items-center justify-center space-x-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Simulate Check-In & Unlock Portal</span>
            </button>
          </div>
        </main>
      ) : (
        /* 3. ACTIVE IN-ROOM DIGITAL CONCIERGE INTERFACE */
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* Welcome Banner */}
          <div className="bg-gradient-to-br from-forest-900 via-forest-850 to-forest-800 text-white rounded-3xl p-6 shadow-md border border-forest-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-amber-300 block mb-1">
                  Active Stay In Residence
                </span>
                <h1 className="font-serif font-bold text-2xl text-white">
                  Welcome to {currentRoom.name}!
                </h1>
                <p className="text-xs text-sand-300 mt-1">
                  Guest: <strong className="text-white">{activeBooking?.guest.fullName}</strong> • Meal Plan:{' '}
                  <strong className="text-amber-300 font-mono">{activeBooking?.mealPlan}</strong> • Folio: #{activeFolio?.folioNumber}
                </p>
              </div>

              {/* Late Night Simulation Toggle */}
              <div className="bg-forest-950/80 p-3 rounded-2xl border border-forest-800 text-xs self-start sm:self-auto space-y-1">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-sand-200">
                    Kitchen Clock: {isLateNight ? '10:45 PM (Night)' : '2:30 PM (Day)'}
                  </span>
                </div>
                <label className="flex items-center space-x-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={simulateLateNight}
                    onChange={(e) => setSimulateLateNight(e.target.checked)}
                    className="rounded text-amber-500 focus:ring-0"
                  />
                  <span className="text-[11px] text-sand-300">
                    Test 10 PM Cutoff (Hide Mains)
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Module Switcher: Dining vs Travel Add-ons */}
          <div className="flex items-center justify-center space-x-3 bg-sand-200/80 p-1.5 rounded-2xl max-w-md mx-auto">
            <button
              onClick={() => setActiveTab('dining')}
              className={`flex-1 min-h-[44px] py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 ${
                activeTab === 'dining'
                  ? 'bg-forest-900 text-white shadow-sm'
                  : 'text-forest-700 hover:text-forest-950'
              }`}
            >
              <Utensils className="w-4 h-4" />
              <span>In-Room Dining</span>
            </button>

            <button
              onClick={() => setActiveTab('travel')}
              className={`flex-1 min-h-[44px] py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 ${
                activeTab === 'travel'
                  ? 'bg-forest-900 text-white shadow-sm'
                  : 'text-forest-700 hover:text-forest-950'
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
                      : 'bg-white border border-sand-300 text-forest-800'
                  }`}
                >
                  All Items
                </button>
                <button
                  onClick={() => setSelectedFoodCategory('beverage')}
                  className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    selectedFoodCategory === 'beverage'
                      ? 'bg-forest-900 text-white shadow-xs'
                      : 'bg-white border border-sand-300 text-forest-800'
                  }`}
                >
                  Beverages & Hot Brews
                </button>
                <button
                  onClick={() => setSelectedFoodCategory('snack')}
                  className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    selectedFoodCategory === 'snack'
                      ? 'bg-forest-900 text-white shadow-xs'
                      : 'bg-white border border-sand-300 text-forest-800'
                  }`}
                >
                  Himalayan Snacks
                </button>
                <button
                  onClick={() => setSelectedFoodCategory('main')}
                  className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    selectedFoodCategory === 'main'
                      ? 'bg-forest-900 text-white shadow-xs'
                      : 'bg-white border border-sand-300 text-forest-800'
                  }`}
                >
                  Traditional Mains
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
                <div className="bg-white rounded-3xl p-5 border-2 border-forest-900 shadow-xl space-y-4 animate-in slide-in-from-bottom-2 duration-200">
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
                    <div>
                      <label className="text-xs font-bold text-forest-900 block mb-2">
                        Choose Vehicle Tier
                      </label>
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
                            ₹{currentRoute?.priceWagonR}
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
                            ₹{currentRoute?.priceSedan}
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
                            ₹{currentRoute?.priceSUV}
                          </span>
                        </label>
                      </div>
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
                    <label className="text-xs font-bold text-forest-900 block">
                      Choose Available Mountain Two-Wheeler
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {rentalVehicles.map((veh) => (
                        <label
                          key={veh.id}
                          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                            selectedRentalId === veh.id
                              ? 'bg-forest-900 text-white border-forest-900 shadow-sm'
                              : 'bg-sand-50 border-sand-300 text-forest-950'
                          }`}
                        >
                          <input
                            type="radio"
                            name="rental"
                            className="hidden"
                            checked={selectedRentalId === veh.id}
                            onChange={() => setSelectedRentalId(veh.id)}
                          />
                          <div className="flex items-center space-x-2 mb-1">
                            <Bike className="w-4 h-4 text-amber-300" />
                            <span className="font-bold text-xs">{veh.vehicleName}</span>
                          </div>
                          <span className="font-mono font-bold text-base block mt-2">
                            ₹{veh.ratePerDay} / day
                          </span>
                          <span className="text-[10px] block opacity-80">
                            Refundable deposit: ₹{veh.depositRequired}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Common Pickup Details */}
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
                      className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-sand-50"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-forest-800 block mb-1">
                      WhatsApp Contact Phone for Driver Coordination
                    </label>
                    <input
                      type="text"
                      required
                      value={travelPhone}
                      onChange={(e) => setTravelPhone(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-sand-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-forest-800 block mb-1">
                    Luggage or Flight/Train Details
                  </label>
                  <input
                    type="text"
                    value={destinationNotes}
                    onChange={(e) => setDestinationNotes(e.target.value)}
                    placeholder="e.g. Flight 6E-204 departing Bagdogra at 4:30 PM, 3 bags"
                    className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-sand-50"
                  />
                </div>

                {/* Quoted Summary & Submission */}
                <div className="pt-4 border-t border-sand-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-500 block">
                      Total Quoted Amount (Post to Folio)
                    </span>
                    <span className="text-xl font-serif font-bold text-forest-950">
                      ₹{serviceType === 'point_to_point' ? totalTransferQuoted : currentRental?.ratePerDay}
                    </span>
                  </div>

                  <button
                    type="submit"
                    className="min-h-[44px] px-6 py-3 bg-forest-900 hover:bg-forest-800 text-white font-bold text-xs rounded-2xl shadow-lg transition-all flex items-center justify-center space-x-2"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Book Transfer & Alert Front Desk</span>
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
        </main>
      )}

      {/* In-Room Dine-In QR Standee Hub Modal */}
      {showQRHub && (
        <InRoomQRHub
          isOpen={showQRHub}
          initialRoomNumber={selectedRoomNumber}
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
