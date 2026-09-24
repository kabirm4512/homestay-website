'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  CheckCircle2,
  Calendar,
  BedDouble,
  User,
  Phone,
  PhoneCall,
  Mail,
  MapPin,
  IndianRupee,
  Utensils,
  AlertCircle,
  Clock,
  Sparkles,
  Wifi,
  FileText,
  Printer,
  Upload,
  Camera,
  Cake,
  Heart,
  Flower2,
  Plus,
  Minus,
  ShoppingCart,
  Send,
  LogOut,
  ExternalLink,
  ChevronRight,
  Check,
  Copy,
  Info,
  Trees,
  Car,
  Truck,
  ArrowRight,
  X,
} from 'lucide-react';
import { CRMBooking, GuestFolio, MenuItem } from '@/types/crm';
import { INITIAL_MENU_ITEMS, INITIAL_TRANSFER_ROUTES, INITIAL_RENTAL_VEHICLES } from '@/lib/crm-data';
import { INDIAN_STATES, getTimeBasedGreeting } from '@/lib/booking-id';

interface SpecialCelebrationOption {
  id: string;
  title: string;
  price: number;
  icon: typeof Cake;
  badge: string;
  description: string;
  details: string[];
}

const CELEBRATION_OPTIONS: SpecialCelebrationOption[] = [
  {
    id: 'celebration-cake',
    title: 'Himalayan Celebration Cake',
    price: 1000,
    icon: Cake,
    badge: 'Popular for Birthdays & Anniversaries',
    description: 'Freshly baked mountain artisan celebration cake (500g) with customized wording, celebration candles, and elegant table setup.',
    details: ['Flavors: Rich Truffle Chocolate, Black Forest, or Fresh Pineapple', 'Custom message on cake', 'Candles & celebration knife included'],
  },
  {
    id: 'candlelight-dinner',
    title: 'Candlelight Balcony Dinner & Decor',
    price: 2000,
    icon: Heart,
    badge: 'Honeymoon & Romantic Getaway',
    description: 'Private candlelit dinner arrangement on your private mountain balcony, adorned with fresh pine florals, aromatic candles, and ambient fairy lights.',
    details: ['Private candlelit dining table arrangement', 'Fresh flower centerpiece & scented candles', 'Soft ambient lighting & personalized hospitality'],
  },
  {
    id: 'flower-bed-decoration',
    title: 'Romantic Bed Flower Decoration',
    price: 1000,
    icon: Flower2,
    badge: 'Anniversary & Romantic Homecoming',
    description: 'Intricately arranged fresh Himalayan wild blooms, marigolds, and aromatic red rose petals on your king bed for a romantic mountain homecoming.',
    details: ['Artisan heart or geometric petal motif', 'Fresh hill blossoms & crimson rose petals', 'Complimentary fragrant mountain incense burner'],
  },
];

function normalizePhone(val: string): string {
  const digits = (val || '').replace(/[^0-9]/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function GuestPortalContent() {
  const searchParams = useSearchParams();
  const urlBooking = searchParams.get('booking') || searchParams.get('query') || '';
  const urlPhone = searchParams.get('phone') || '';
  const urlName = searchParams.get('name') || '';

  // Auth / Session State
  const [activeBooking, setActiveBooking] = useState<CRMBooking | null>(null);
  const [activeFolio, setActiveFolio] = useState<GuestFolio | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Login Form Inputs
  const [inputBookingId, setInputBookingId] = useState<string>(urlBooking);
  const [inputPhone, setInputPhone] = useState<string>(urlPhone);
  const [loginError, setLoginError] = useState<string>('');
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'billing' | 'dining' | 'celebrations' | 'transfers' | 'documents'>('billing');

  // Check-In Completion Form State (if missing info)
  const [ciFullName, setCiFullName] = useState<string>('');
  const [ciPhone, setCiPhone] = useState<string>('');
  const [ciEmail, setCiEmail] = useState<string>('');
  const [ciState, setCiState] = useState<string>('West Bengal');
  const [ciCity, setCiCity] = useState<string>('');
  const [ciAddress, setCiAddress] = useState<string>('');
  const [ciIdType, setCiIdType] = useState<string>('Aadhaar Card');
  const [ciIdNumber, setCiIdNumber] = useState<string>('');
  const [ciIdFrontUrl, setCiIdFrontUrl] = useState<string>('');
  const [ciIdBackUrl, setCiIdBackUrl] = useState<string>('');
  const [ciDietary, setCiDietary] = useState<string>('');
  const [ciSpecialRequests, setCiSpecialRequests] = useState<string>('');
  const [isSubmittingCheckin, setIsSubmittingCheckin] = useState<boolean>(false);
  const [checkinJustCompleted, setCheckinJustCompleted] = useState<boolean>(false);

  // Dining Cart State
  const [diningCart, setDiningCart] = useState<Record<string, number>>({});
  const [cartNotes, setCartNotes] = useState<string>('');
  const [isPlacingOrder, setIsPlacingOrder] = useState<boolean>(false);
  const [orderSuccessMsg, setOrderSuccessMsg] = useState<string>('');
  const [myOrders, setMyOrders] = useState<any[]>([]);

  // Special Celebration Order State
  const [selectedCelebration, setSelectedCelebration] = useState<SpecialCelebrationOption | null>(null);
  const [celebrationNotes, setCelebrationNotes] = useState<string>('');
  const [isOrderingCelebration, setIsOrderingCelebration] = useState<boolean>(false);
  const [celebrationSuccess, setCelebrationSuccess] = useState<string>('');

  // Transfer / Rental Request State
  const [transferSuccess, setTransferSuccess] = useState<string>('');

  // UI Utilities State
  const [wifiCopied, setWifiCopied] = useState<boolean>(false);
  const [showInvoicePrint, setShowInvoicePrint] = useState<boolean>(false);

  // Fetch Folio
  const fetchFolio = useCallback(async (bookingId: string, roomNumber?: number) => {
    try {
      const res = await fetch(`/api/orders?folio=true&booking=${encodeURIComponent(bookingId)}&room=${roomNumber || ''}`);
      const json = await res.json();
      if (json?.success && json.folio) {
        setActiveFolio(json.folio);
      }
    } catch (err) {
      console.warn('Folio fetch error:', err);
    }
  }, []);

  // Fetch Orders for this booking
  const fetchOrders = useCallback(async (bookingId: string, roomNumber?: number) => {
    try {
      const res = await fetch(`/api/orders?orders=true`);
      const json = await res.json();
      if (json?.success && Array.isArray(json.orders)) {
        const filtered = json.orders.filter(
          (o: any) => o.bookingId === bookingId || (roomNumber && o.roomNumber === roomNumber)
        );
        setMyOrders(filtered);
      }
    } catch {}
  }, []);

  // Check if digital check-in is complete
  const isCheckinComplete = useMemo(() => {
    if (checkinJustCompleted) return true;
    if (!activeBooking) return false;
    const g = activeBooking.guest;
    if (!g) return false;

    const hasName = Boolean(g.fullName && g.fullName.trim().length >= 3);
    const hasPhone = Boolean(g.phone && g.phone.replace(/[^0-9]/g, '').length >= 10);
    const hasEmail = Boolean(g.email && g.email.includes('@'));
    const hasCity = Boolean(g.city && g.city.trim().length > 0);
    const hasAddress = Boolean(g.address && g.address.trim().length >= 5);
    const hasIdNumber = Boolean(g.idNumber && g.idNumber.trim().length > 0);
    const hasFrontDoc = Boolean(g.idDocumentUrl);
    const hasBackDoc = g.idType !== 'Aadhaar Card' || Boolean(g.idDocumentBackUrl);
    const isSubmitted = activeBooking.documentStatus === 'submitted' || activeBooking.documentStatus === 'verified';

    return hasName && hasPhone && hasEmail && hasCity && hasAddress && hasIdNumber && hasFrontDoc && hasBackDoc && isSubmitted;
  }, [activeBooking, checkinJustCompleted]);

  // Login handler
  const loginGuest = useCallback((booking: CRMBooking) => {
    setActiveBooking(booking);
    try {
      localStorage.setItem('savera_guest_portal_session', JSON.stringify(booking));
    } catch {}

    // Populate missing checkin form fields from existing guest data
    if (booking.guest) {
      setCiFullName(booking.guest.fullName || urlName || '');
      setCiPhone(booking.guest.phone || urlPhone || '');
      setCiEmail(booking.guest.email || '');
      setCiState(booking.guest.state || 'West Bengal');
      setCiCity(booking.guest.city || '');
      setCiAddress(booking.guest.address || '');
      setCiIdType(booking.guest.idType || 'Aadhaar Card');
      setCiIdNumber(booking.guest.idNumber || '');
      setCiIdFrontUrl(booking.guest.idDocumentUrl || '');
      setCiIdBackUrl(booking.guest.idDocumentBackUrl || '');
      setCiDietary(booking.guest.dietaryPreferences || '');
      setCiSpecialRequests(booking.specialRequests || '');
    }

    fetchFolio(booking.id, booking.roomNumber);
    fetchOrders(booking.id, booking.roomNumber);
  }, [fetchFolio, fetchOrders, urlName, urlPhone]);

  // Session restore & URL authentication on mount
  useEffect(() => {
    const initSession = async () => {
      setIsLoading(true);
      try {
        // 1. Direct authentication via URL parameters if present
        if (urlBooking || urlPhone) {
          const query = urlBooking || urlPhone;
          const phoneParam = urlPhone ? `&phone=${encodeURIComponent(urlPhone)}` : '';
          const res = await fetch(`/api/checkin?query=${encodeURIComponent(query)}${phoneParam}`);
          const json = await res.json();
          if (json?.success && json.booking) {
            // Verify phone if both booking & phone were provided
            if (urlPhone && json.booking.guest?.phone) {
              const bPhone = normalizePhone(json.booking.guest.phone);
              const qPhone = normalizePhone(urlPhone);
              if (bPhone === qPhone || !qPhone || !bPhone) {
                loginGuest(json.booking);
                setIsLoading(false);
                return;
              }
            } else {
              loginGuest(json.booking);
              setIsLoading(false);
              return;
            }
          }
        }

        // 2. LocalStorage saved session
        const savedRaw = localStorage.getItem('savera_guest_portal_session');
        if (savedRaw) {
          const parsed: CRMBooking = JSON.parse(savedRaw);
          if (parsed && (parsed.id || parsed.bookingReference)) {
            const query = parsed.bookingReference || parsed.guest?.phone || parsed.id;
            const res = await fetch(`/api/checkin?query=${encodeURIComponent(query)}`);
            const json = await res.json();
            if (json?.success && json.booking) {
              loginGuest(json.booking);
            } else {
              loginGuest(parsed);
            }
            setIsLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Session init error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initSession();
  }, [urlBooking, urlPhone, loginGuest]);

  // Manual 2-Field Login Submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const cleanBk = inputBookingId.trim();
    const cleanPh = normalizePhone(inputPhone);

    if (!cleanBk) {
      setLoginError('Please enter your Booking ID.');
      return;
    }

    if (!cleanPh || cleanPh.length < 10) {
      setLoginError('Please enter your registered 10-digit mobile phone number.');
      return;
    }

    setIsAuthenticating(true);

    try {
      // Lookup booking by Booking ID AND Phone
      const res = await fetch(`/api/checkin?query=${encodeURIComponent(cleanBk)}&phone=${encodeURIComponent(cleanPh)}`);
      const json = await res.json();

      if (!json?.success || !json.booking) {
        // Fallback: try searching by phone number
        const resByPhone = await fetch(`/api/checkin?query=${encodeURIComponent(cleanPh)}`);
        const jsonByPhone = await resByPhone.json();

        if (jsonByPhone?.success && jsonByPhone.booking) {
          loginGuest(jsonByPhone.booking);
          return;
        }

        setLoginError(
          `No active reservation found for Booking ID "${cleanBk}". Please verify your booking reference or tap the call button above for receptionist assistance.`
        );
        return;
      }

      const booking: CRMBooking = json.booking;
      const bookingGuestPhone = normalizePhone(booking.guest?.phone || '');

      // Check phone match
      if (!bookingGuestPhone || bookingGuestPhone === cleanPh) {
        if (!bookingGuestPhone && booking.guest) {
          booking.guest.phone = cleanPh;
        }
        loginGuest(booking);
        return;
      }

      // If phone on file doesn't match, check if cleanBk was an exact match on booking reference
      const bRefClean = (booking.bookingReference || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const inputRefClean = cleanBk.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (bRefClean === inputRefClean) {
        if (booking.guest) {
          booking.guest.phone = cleanPh;
        }
        loginGuest(booking);
        return;
      }

      setLoginError(
        `The mobile number entered does not match the reservation on file for ${cleanBk}. Please verify your 10-digit mobile number.`
      );
    } catch {
      setLoginError('Unable to connect to reception server. Please check your connection or call front desk.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Sign out / Switch guest
  const handleLogout = () => {
    try {
      localStorage.removeItem('savera_guest_portal_session');
    } catch {}
    setActiveBooking(null);
    setActiveFolio(null);
    setCheckinJustCompleted(false);
    setInputBookingId('');
    setInputPhone('');
    setLoginError('');
  };

  // Handle Photo Upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 6 * 1024 * 1024) {
      alert('Photo is too large. Please select an image under 6MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setter(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Digital Check-In Submission
  const handleCheckinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBooking) return;

    if (!ciFullName.trim() || ciFullName.trim().length < 3) {
      alert('Please enter your full legal name (minimum 3 characters as per ID).');
      return;
    }

    const cleanNum = normalizePhone(ciPhone);
    if (!cleanNum || cleanNum.length < 10) {
      alert('Please enter a valid 10-digit mobile phone number.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!ciEmail.trim() || !emailRegex.test(ciEmail.trim())) {
      alert('Please enter a valid email address for stay invoice delivery.');
      return;
    }

    if (!ciState) {
      alert('Please select your State / Province.');
      return;
    }

    if (!ciCity.trim()) {
      alert('Please enter your City / Town.');
      return;
    }

    if (!ciAddress.trim() || ciAddress.trim().length < 5) {
      alert('Please enter your residential address as printed in your Government ID.');
      return;
    }

    if (!ciIdNumber.trim()) {
      alert('Please enter your Government ID document number.');
      return;
    }

    if (!ciIdFrontUrl) {
      alert('Please upload or capture a photo of the FRONT side of your Government ID.');
      return;
    }

    if (ciIdType === 'Aadhaar Card' && !ciIdBackUrl) {
      alert('Please upload or capture the BACK side of your Aadhaar Card (containing your residential address).');
      return;
    }

    setIsSubmittingCheckin(true);

    const guestUpdates = {
      fullName: ciFullName.trim(),
      phone: ciPhone.trim(),
      email: ciEmail.trim(),
      state: ciState,
      city: ciCity.trim(),
      address: ciAddress.trim(),
      nationality: 'Indian',
      idType: ciIdType,
      idNumber: ciIdNumber.trim(),
      idDocumentUrl: ciIdFrontUrl,
      idDocumentBackUrl: ciIdBackUrl || undefined,
      dietaryPreferences: ciDietary.trim() || undefined,
      hospitalityPreferences: ciSpecialRequests.trim() || undefined,
      documentStatus: 'submitted' as const,
    };

    const payload = {
      bookingId: activeBooking.id,
      bookingReference: activeBooking.bookingReference,
      guest: guestUpdates,
      roomId: activeBooking.roomId,
      roomName: activeBooking.roomName,
      roomNumber: activeBooking.roomNumber,
      checkInDate: activeBooking.checkInDate,
      checkOutDate: activeBooking.checkOutDate,
      mealPlan: activeBooking.mealPlan,
      specialRequests: ciSpecialRequests.trim() || undefined,
    };

    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();

      if (!res.ok) {
        alert(resData.error || 'Check-in submission failed. Please verify required fields.');
        setIsSubmittingCheckin(false);
        return;
      }

      const updatedBk: CRMBooking = resData.booking || {
        ...activeBooking,
        documentStatus: 'submitted',
        specialRequests: ciSpecialRequests.trim() || undefined,
        guest: {
          ...activeBooking.guest,
          ...guestUpdates,
        },
      };

      setActiveBooking(updatedBk);
      setCheckinJustCompleted(true);
      try {
        localStorage.setItem('savera_guest_portal_session', JSON.stringify(updatedBk));
      } catch {}

      // Refresh folio
      fetchFolio(updatedBk.id, updatedBk.roomNumber);
    } catch {
      alert('Check-in saved locally. Reception has been alerted.');
      setCheckinJustCompleted(true);
    } finally {
      setIsSubmittingCheckin(false);
    }
  };

  // Dine-In Cart Functions
  const cartItemCount = useMemo(() => {
    return Object.values(diningCart).reduce((sum, count) => sum + count, 0);
  }, [diningCart]);

  const cartTotalAmount = useMemo(() => {
    return Object.entries(diningCart).reduce((sum, [itemId, qty]) => {
      const item = INITIAL_MENU_ITEMS.find((m) => m.id === itemId);
      return sum + (item ? item.price * qty : 0);
    }, 0);
  }, [diningCart]);

  const updateCartQty = (itemId: string, delta: number) => {
    setDiningCart((prev) => {
      const current = prev[itemId] || 0;
      const next = current + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return { ...prev, [itemId]: next };
    });
  };

  // Place In-Room Dine-In Order
  const handlePlaceDineInOrder = async () => {
    if (!activeBooking || cartItemCount === 0) return;

    setIsPlacingOrder(true);
    setOrderSuccessMsg('');

    const items = Object.entries(diningCart).map(([itemId, qty]) => {
      const item = INITIAL_MENU_ITEMS.find((m) => m.id === itemId);
      return {
        menuItemId: itemId,
        name: item?.name || 'In-Room Dining Dish',
        itemName: item?.name || 'In-Room Dining Dish',
        price: item?.price || 0,
        unitPrice: item?.price || 0,
        quantity: qty,
        lineTotal: (item?.price || 0) * qty,
      };
    });

    const payload = {
      type: 'food_order',
      bookingId: activeBooking.id,
      roomNumber: activeBooking.roomNumber,
      guestName: activeBooking.guest?.fullName || 'Guest',
      items,
      totalAmount: cartTotalAmount,
      notes: cartNotes.trim() || undefined,
      orderSource: 'guest_portal',
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json?.success) {
        setDiningCart({});
        setCartNotes('');
        setOrderSuccessMsg(
          `Order #${json.order?.orderNumber || 'KITCHEN'} placed! Our manager is checking kitchen stock and will release your order for fresh preparation shortly.`
        );
        fetchFolio(activeBooking.id, activeBooking.roomNumber);
        fetchOrders(activeBooking.id, activeBooking.roomNumber);
      } else {
        alert(json.error || 'Failed to place dine-in order. Please try again or call reception.');
      }
    } catch {
      alert('Network error. Reception has been notified.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // Place Special Celebration Request
  const handleOrderCelebration = async () => {
    if (!activeBooking || !selectedCelebration) return;

    setIsOrderingCelebration(true);
    setCelebrationSuccess('');

    const payload = {
      type: 'special_request',
      bookingId: activeBooking.id,
      roomNumber: activeBooking.roomNumber,
      guestName: activeBooking.guest?.fullName || 'Guest',
      items: [
        {
          name: `🎉 ${selectedCelebration.title}`,
          itemName: `🎉 ${selectedCelebration.title}`,
          price: selectedCelebration.price,
          unitPrice: selectedCelebration.price,
          quantity: 1,
          lineTotal: selectedCelebration.price,
        },
      ],
      totalAmount: selectedCelebration.price,
      notes: celebrationNotes.trim() || undefined,
      orderSource: 'guest_portal',
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json?.success) {
        setSelectedCelebration(null);
        setCelebrationNotes('');
        setCelebrationSuccess(
          `Celebration request booked! Our concierge team will arrange the setup and coordinate with you.`
        );
        fetchFolio(activeBooking.id, activeBooking.roomNumber);
        fetchOrders(activeBooking.id, activeBooking.roomNumber);
      }
    } catch {
      alert('Unable to submit celebration request. Please try again.');
    } finally {
      setIsOrderingCelebration(false);
    }
  };

  // Copy Wi-Fi password
  const handleCopyWifi = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText('saverahomestay');
      setWifiCopied(true);
      setTimeout(() => setWifiCopied(false), 3000);
    }
  };

  // ==============================================================
  // VIEW 1: LOADING STATE
  // ==============================================================
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F3F7FF] flex items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-3 bg-white p-8 rounded-3xl shadow-sm border border-sand-200">
          <div className="w-10 h-10 border-3 border-[#25479E] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-[#0B1733] font-bold">Connecting to Savera Guest Portal...</span>
        </div>
      </div>
    );
  }

  // ==============================================================
  // VIEW 2: UNHEALTHY / NOT LOGGED IN SCREEN
  // ==============================================================
  if (!activeBooking) {
    return (
      <div className="min-h-screen bg-[#F3F7FF] flex flex-col font-sans">
        {/* Clean Header: Logo, Tagline & Need Help Call Button */}
        <header className="bg-[#0B1733] text-white border-b border-[#1E2D4A] shadow-md sticky top-0 z-40">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
            {/* Logo & Tagline */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-[#25479E] border border-[#3B62C7] flex items-center justify-center shadow-sm">
                <Trees className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <span
                  className="font-bold text-lg block leading-tight text-white tracking-tight"
                  style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                >
                  Savera Homestay
                </span>
                <span className="text-[11px] text-primary-200 font-medium hidden sm:block">
                  Boutique Mountain Retreat &amp; Luxury Homestay, Darjeeling
                </span>
              </div>
            </div>

            {/* Need Help? Call Button */}
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-300 font-medium hidden md:inline">Need help?</span>
              <a
                href="tel:+919832022233"
                className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#FE6E00] to-[#EA580C] hover:from-[#EA580C] hover:to-[#C2410C] text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                title="Call Savera Homestay Reception directly"
              >
                <PhoneCall className="w-4 h-4 text-white animate-pulse" />
                <span>Call Front Desk</span>
              </a>
            </div>
          </div>
        </header>

        {/* Center Screen: 2-Field Login Card */}
        <main className="flex-1 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-sand-300 overflow-hidden">
            {/* Top Accent Strip */}
            <div className="h-2 bg-gradient-to-r from-[#25479E] via-[#FE6E00] to-[#25479E]" />

            <div className="p-6 sm:p-8 space-y-6 text-center">
              <div>
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#25479E]/10 border border-[#25479E]/20 text-[#25479E] flex items-center justify-center mb-3">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <h1
                  className="text-xl sm:text-2xl font-bold text-[#0B1733] tracking-tight"
                  style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                >
                  Guest Stay Pass &amp; Portal
                </h1>
                <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                  Enter your Booking ID and registered mobile number to access your room pass, digital check-in, and bills.
                </p>
              </div>

              {loginError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-left text-xs text-rose-800 flex items-start space-x-2.5 animate-fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">{loginError}</p>
                  </div>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleLoginSubmit} className="space-y-4 text-left">
                {/* Field 1: Booking ID */}
                <div>
                  <label className="text-xs font-bold text-[#0B1733] block mb-1.5">
                    Booking ID *
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={inputBookingId}
                      onChange={(e) => setInputBookingId(e.target.value)}
                      placeholder="e.g. SH-2K2609001 or WP-2026-823"
                      className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-gray-300 bg-sand-50/50 text-[#0B1733] font-mono font-bold text-sm focus:bg-white focus:ring-2 focus:ring-[#25479E] focus:outline-none transition-all uppercase placeholder:normal-case placeholder:font-sans placeholder:font-normal"
                    />
                  </div>
                </div>

                {/* Field 2: Phone Number */}
                <div>
                  <label className="text-xs font-bold text-[#0B1733] block mb-1.5">
                    Phone Number *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required
                      value={inputPhone}
                      onChange={(e) => setInputPhone(e.target.value)}
                      placeholder="e.g. 98765 43210"
                      className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-gray-300 bg-sand-50/50 text-[#0B1733] font-mono font-bold text-sm focus:bg-white focus:ring-2 focus:ring-[#25479E] focus:outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Login Button */}
                <button
                  type="submit"
                  disabled={isAuthenticating}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-[#FE6E00] to-[#EA580C] hover:from-[#EA580C] hover:to-[#C2410C] active:scale-98 text-white rounded-xl font-bold text-sm shadow-[0_4px_14px_rgba(254,110,0,0.35)] transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-60"
                >
                  {isAuthenticating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Verifying Reservation...</span>
                    </>
                  ) : (
                    <>
                      <span>Login</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ==============================================================
  // VIEW 3: MANDATORY DIGITAL CHECK-IN GATE (IF MISSING INFO)
  // ==============================================================
  if (!isCheckinComplete) {
    return (
      <div className="min-h-screen bg-[#F3F7FF] flex flex-col font-sans">
        {/* Header */}
        <header className="bg-[#0B1733] text-white border-b border-[#1E2D4A] shadow-md sticky top-0 z-40">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-[#25479E] border border-[#3B62C7] flex items-center justify-center shadow-sm">
                <Trees className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <span
                  className="font-bold text-lg block leading-tight text-white"
                  style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                >
                  Savera Homestay
                </span>
                <span className="text-[11px] text-primary-200 font-medium">
                  Mandatory Digital Check-In • Room {activeBooking.roomNumber}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <a
                href="tel:+919832022233"
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#182C58] hover:bg-[#25479E] text-white text-xs font-semibold border border-[#25479E]/50 transition-colors"
              >
                <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
                <span>Call Front Desk</span>
              </a>
              <button
                onClick={handleLogout}
                className="p-2 text-rose-300 hover:text-white rounded-xl hover:bg-rose-950/40 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Form Container */}
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8">
          <div className="space-y-6">
            {/* Mandatory Banner */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-amber-900 flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-sm text-[#0B1733]">
                  Digital Check-In Required for Room Access
                </p>
                <p className="mt-0.5 text-gray-700">
                  As per West Bengal tourism and police regulations, all arriving guests must register their residential address and upload valid government ID proof before entering the property.
                </p>
              </div>
            </div>

            {/* Quick Reservation Card */}
            <div className="bg-[#0B1733] text-white p-5 rounded-2xl border border-[#1E2D4A] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-300 block">
                  Confirmed Mountain Reservation
                </span>
                <h3 className="font-bold text-base text-white mt-0.5">
                  {activeBooking.roomName}
                </h3>
                <p className="text-gray-300 mt-0.5">
                  Booking ID: <strong className="text-amber-200 font-mono">#{activeBooking.bookingReference}</strong>
                </p>
              </div>
              <div className="flex items-center space-x-3 text-right">
                <div className="bg-[#182C58] px-3 py-1.5 rounded-xl border border-[#25479E]/40 text-left sm:text-right">
                  <span className="text-[10px] text-gray-400 block">Stay Dates</span>
                  <span className="font-bold text-white">
                    {activeBooking.checkInDate} &rarr; {activeBooking.checkOutDate}
                  </span>
                </div>
              </div>
            </div>

            {/* Check-In Submission Form */}
            <form onSubmit={handleCheckinSubmit} className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-sand-300 space-y-8">
              {/* Section 1: Guest Personal & Residential Details */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2 border-b border-sand-200 pb-3">
                  <User className="w-5 h-5 text-[#25479E]" />
                  <h2 className="font-bold text-base text-[#0B1733]">
                    1. Guest Contact &amp; Residential Details
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="font-bold text-[#0B1733] block mb-1">
                      Full Legal Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={ciFullName}
                      onChange={(e) => setCiFullName(e.target.value)}
                      placeholder="As printed on government ID"
                      className="w-full p-3 rounded-xl border border-sand-300 bg-sand-50/50 text-[#0B1733] font-medium focus:bg-white focus:ring-2 focus:ring-[#25479E] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[#0B1733] block mb-1">
                      Mobile / WhatsApp Number *
                    </label>
                    <input
                      type="tel"
                      required
                      value={ciPhone}
                      onChange={(e) => setCiPhone(e.target.value)}
                      placeholder="10-digit mobile number"
                      className="w-full p-3 rounded-xl border border-sand-300 bg-sand-50/50 text-[#0B1733] font-mono font-medium focus:bg-white focus:ring-2 focus:ring-[#25479E] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[#0B1733] block mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={ciEmail}
                      onChange={(e) => setCiEmail(e.target.value)}
                      placeholder="For stay confirmation &amp; GST tax invoice"
                      className="w-full p-3 rounded-xl border border-sand-300 bg-sand-50/50 text-[#0B1733] font-medium focus:bg-white focus:ring-2 focus:ring-[#25479E] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[#0B1733] block mb-1">
                      State / UT (As in ID) *
                    </label>
                    <select
                      required
                      value={ciState}
                      onChange={(e) => setCiState(e.target.value)}
                      className="w-full p-3 rounded-xl border border-sand-300 bg-sand-50/50 text-[#0B1733] font-semibold focus:bg-white focus:ring-2 focus:ring-[#25479E] focus:outline-none cursor-pointer"
                    >
                      <option value="">-- Select State --</option>
                      {INDIAN_STATES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-[#0B1733] block mb-1">
                      City / Town *
                    </label>
                    <input
                      type="text"
                      required
                      value={ciCity}
                      onChange={(e) => setCiCity(e.target.value)}
                      placeholder="e.g. Siliguri, Kolkata, New Delhi"
                      className="w-full p-3 rounded-xl border border-sand-300 bg-sand-50/50 text-[#0B1733] font-medium focus:bg-white focus:ring-2 focus:ring-[#25479E] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[#0B1733] block mb-1">
                      Residential Address (as in Document) *
                    </label>
                    <input
                      type="text"
                      required
                      value={ciAddress}
                      onChange={(e) => setCiAddress(e.target.value)}
                      placeholder="House/Flat No., Street, Locality, Pincode"
                      className="w-full p-3 rounded-xl border border-sand-300 bg-sand-50/50 text-[#0B1733] font-medium focus:bg-white focus:ring-2 focus:ring-[#25479E] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Government ID & Document Photos */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2 border-b border-sand-200 pb-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <h2 className="font-bold text-base text-[#0B1733]">
                    2. Government ID Proof &amp; Document Photos *
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="font-bold text-[#0B1733] block mb-1">
                      ID Document Type *
                    </label>
                    <select
                      value={ciIdType}
                      onChange={(e) => setCiIdType(e.target.value)}
                      className="w-full p-3 rounded-xl border border-sand-300 bg-sand-50/50 text-[#0B1733] font-semibold focus:bg-white focus:ring-2 focus:ring-[#25479E] focus:outline-none"
                    >
                      <option value="Aadhaar Card">Aadhaar Card (UIDAI)</option>
                      <option value="Passport & ILP">Passport &amp; Inner Line Permit (ILP)</option>
                      <option value="Driver License">Driving License</option>
                      <option value="Voter ID Card">Voter ID (Election Card)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-[#0B1733] block mb-1">
                      Document / ID Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={ciIdNumber}
                      onChange={(e) => setCiIdNumber(e.target.value)}
                      placeholder="e.g. 5432-8765-1098"
                      className="w-full p-3 rounded-xl border border-sand-300 bg-sand-50/50 text-[#0B1733] font-mono font-bold focus:bg-white focus:ring-2 focus:ring-[#25479E] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Photo Upload Drops */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {/* Front Photo */}
                  <div className="border-2 border-dashed border-sand-300 hover:border-[#25479E] rounded-3xl p-5 text-center bg-sand-50/60 transition-colors">
                    <span className="text-xs font-bold text-[#0B1733] block mb-1">
                      ID Photo (Front Page) *
                    </span>
                    <span className="text-[11px] text-gray-500 block mb-3">
                      Capture photo or upload JPG/PNG/PDF
                    </span>

                    {ciIdFrontUrl ? (
                      <div className="space-y-2">
                        <div className="w-full h-32 rounded-2xl overflow-hidden bg-white border border-sand-300 shadow-inner">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={ciIdFrontUrl} alt="Front ID" className="w-full h-full object-contain" />
                        </div>
                        <button
                          type="button"
                          onClick={() => setCiIdFrontUrl('')}
                          className="text-xs text-rose-600 font-bold hover:underline cursor-pointer"
                        >
                          Change / Remove Photo
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-sand-200 shadow-xs cursor-pointer hover:bg-sand-50 transition-all">
                        <Camera className="w-6 h-6 text-[#25479E] mb-2" />
                        <span className="text-xs font-bold text-[#0B1733]">Take Photo / Choose File</span>
                        <span className="text-[10px] text-gray-400 mt-0.5">Front side with photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handlePhotoUpload(e, setCiIdFrontUrl)}
                        />
                      </label>
                    )}
                  </div>

                  {/* Back Photo */}
                  <div className="border-2 border-dashed border-sand-300 hover:border-[#25479E] rounded-3xl p-5 text-center bg-sand-50/60 transition-colors">
                    <span className="text-xs font-bold text-[#0B1733] block mb-1">
                      ID Photo (Back / Address) {ciIdType === 'Aadhaar Card' ? '*' : '(Optional)'}
                    </span>
                    <span className="text-[11px] text-gray-500 block mb-3">
                      {ciIdType === 'Aadhaar Card' ? 'Mandatory for Aadhaar address proof' : 'Recommended for address verification'}
                    </span>

                    {ciIdBackUrl ? (
                      <div className="space-y-2">
                        <div className="w-full h-32 rounded-2xl overflow-hidden bg-white border border-sand-300 shadow-inner">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={ciIdBackUrl} alt="Back ID" className="w-full h-full object-contain" />
                        </div>
                        <button
                          type="button"
                          onClick={() => setCiIdBackUrl('')}
                          className="text-xs text-rose-600 font-bold hover:underline cursor-pointer"
                        >
                          Change / Remove Photo
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-sand-200 shadow-xs cursor-pointer hover:bg-sand-50 transition-all">
                        <Upload className="w-6 h-6 text-gray-500 mb-2" />
                        <span className="text-xs font-bold text-[#0B1733]">Upload Back Side</span>
                        <span className="text-[10px] text-gray-400 mt-0.5">Address page</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handlePhotoUpload(e, setCiIdBackUrl)}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit Action */}
              <div className="pt-4 border-t border-sand-200">
                <button
                  type="submit"
                  disabled={isSubmittingCheckin}
                  className="w-full py-4 px-6 bg-gradient-to-r from-[#FE6E00] to-[#EA580C] hover:from-[#EA580C] hover:to-[#C2410C] active:scale-98 text-white rounded-2xl font-bold text-sm sm:text-base shadow-[0_4px_16px_rgba(254,110,0,0.35)] transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-60"
                >
                  {isSubmittingCheckin ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Registering Documents &amp; Activating Stay Pass...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>Complete Digital Check-In &amp; Enter Portal →</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    );
  }

  // ==============================================================
  // VIEW 4: ACTIVE GUEST PORTAL (WELCOME GREETING + HOME + TABS)
  // ==============================================================
  const guestFirstName = (activeBooking.guest?.fullName || '').split(' ')[0] || 'Guest';
  const timeGreeting = getTimeBasedGreeting();

  // Balance Due calculation
  const totalRoomBill = activeFolio ? activeFolio.totalRoomCharges : activeBooking.totalRoomAmount;
  const totalFbBill = activeFolio ? activeFolio.totalFbCharges : 0;
  const totalAddonBill = activeFolio ? activeFolio.totalAddonCharges : 0;
  const netPayable = activeFolio ? activeFolio.netPayable : activeBooking.totalRoomAmount;
  const totalPaid = activeFolio ? activeFolio.totalPaid : (activeBooking.advancePaid || 0);
  const balanceDue = activeFolio ? activeFolio.balanceDue : Math.max(0, netPayable - totalPaid);

  return (
    <div className="min-h-screen bg-[#F3F7FF] text-[#0B1733] flex flex-col font-sans pb-16">
      {/* 1. Header with Logo, Tagline & Need Help Call Button */}
      <header className="bg-[#0B1733] text-white border-b border-[#1E2D4A] shadow-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2.5 group">
              <div className="w-10 h-10 rounded-2xl bg-[#25479E] border border-[#3B62C7] flex items-center justify-center shadow-sm">
                <Trees className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <span
                  className="font-bold text-lg block leading-tight text-white tracking-tight"
                  style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                >
                  Savera Homestay
                </span>
                <span className="text-[11px] text-primary-200 font-medium hidden sm:block">
                  Boutique Mountain Retreat &amp; Luxury Homestay, Darjeeling
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Call Front Desk Button */}
            <a
              href="tel:+919832022233"
              className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#FE6E00] to-[#EA580C] hover:from-[#EA580C] hover:to-[#C2410C] text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
              title="Call Front Desk directly"
            >
              <PhoneCall className="w-4 h-4 text-white animate-pulse" />
              <span className="hidden sm:inline">Call Front Desk</span>
              <span className="sm:hidden">Call</span>
            </a>

            {/* Logout / Switch */}
            <button
              onClick={handleLogout}
              className="px-2.5 py-2 rounded-xl bg-[#182C58] hover:bg-rose-950/60 text-gray-300 hover:text-rose-300 text-xs font-semibold border border-[#25479E]/40 transition-colors flex items-center space-x-1 cursor-pointer"
              title="Sign out of Guest Portal"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* 2. Welcome Greeting Screen (Local-Time Greeting with Customer Name) */}
        <div className="bg-gradient-to-br from-[#0B1733] via-[#102450] to-[#0B1733] text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-[#1E2D4A] relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-amber-500/10 via-transparent to-transparent pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="inline-flex items-center space-x-2 bg-amber-400/20 border border-amber-400/30 px-3 py-1 rounded-full text-[11px] font-bold text-amber-300 uppercase tracking-wider mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Guest Stay Sanctuary</span>
              </div>
              <h1
                className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight"
                style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
              >
                {timeGreeting}, {guestFirstName}!
              </h1>
              <p className="text-xs sm:text-sm text-gray-300 max-w-xl leading-relaxed">
                Welcome to your mountain homecoming. Your digital stay pass is active with verified registration.
              </p>
            </div>

            {/* Wi-Fi & Quick Access Pill */}
            <div className="bg-[#182C58]/80 backdrop-blur-sm border border-[#25479E]/60 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-amber-400/20 flex items-center justify-center text-amber-300">
                  <Wifi className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Homestay High-Speed Wi-Fi</span>
                  <span className="text-xs font-mono font-bold text-white">saverahomestay</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyWifi}
                className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-[#0B1733] font-bold text-xs flex items-center justify-center space-x-1 transition-all cursor-pointer shrink-0"
              >
                {wifiCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Wi-Fi</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 3. Small but Elegant Card Showing Room Category, Room Number, Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Room & Category */}
          <div className="bg-white p-4 rounded-2xl border border-sand-300 shadow-sm flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-[#25479E]/10 border border-[#25479E]/20 text-[#25479E] flex items-center justify-center shrink-0">
              <BedDouble className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-gray-500 block">Accommodated Room</span>
              <h2 className="font-bold text-sm text-[#0B1733] truncate">Room {activeBooking.roomNumber}</h2>
              <span className="text-[11px] text-[#25479E] font-semibold truncate block">
                {activeBooking.roomName.split(' - ')[1] || activeBooking.roomName}
              </span>
            </div>
          </div>

          {/* Card 2: Stay Dates */}
          <div className="bg-white p-4 rounded-2xl border border-sand-300 shadow-sm flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[#FE6E00] flex items-center justify-center shrink-0">
              <Calendar className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-gray-500 block">Stay Duration</span>
              <span className="font-bold text-sm text-[#0B1733] block">
                {activeBooking.checkInDate} &rarr; {activeBooking.checkOutDate}
              </span>
              <span className="text-[11px] text-gray-600 font-medium">
                {activeBooking.totalNights} {activeBooking.totalNights === 1 ? 'Night' : 'Nights'} • {activeBooking.mealPlan} Plan
              </span>
            </div>
          </div>

          {/* Card 3: Universal Booking ID */}
          <div className="bg-white p-4 rounded-2xl border border-sand-300 shadow-sm flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-gray-500 block">Universal Booking ID</span>
              <span className="font-mono font-bold text-sm text-[#0B1733] block">
                {activeBooking.bookingReference}
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                Digital Pass Active ✓
              </span>
            </div>
          </div>

          {/* Card 4: Balance Due / Stay Folio Status */}
          <div className="bg-white p-4 rounded-2xl border border-sand-300 shadow-sm flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 flex items-center justify-center shrink-0">
              <IndianRupee className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-gray-500 block">Stay Balance Due</span>
              <span className={`font-mono font-bold text-base block ${balanceDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                ₹{balanceDue.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-gray-500">
                {balanceDue > 0 ? 'Payable upon checkout' : 'All dues cleared'}
              </span>
            </div>
          </div>
        </div>

        {/* 4. Portal Navigation Tabs */}
        <div className="bg-white rounded-2xl p-2 border border-sand-300 shadow-xs flex items-center space-x-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('billing')}
            className={`min-h-[42px] px-4 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'billing'
                ? 'bg-gradient-to-r from-[#FE6E00] to-[#EA580C] text-white shadow-xs'
                : 'text-gray-700 hover:text-[#0B1733] hover:bg-sand-100'
            }`}
          >
            <IndianRupee className="w-4 h-4" />
            <span>Stay Billing &amp; Folio</span>
            {balanceDue > 0 && (
              <span className="ml-1 text-[10px] bg-rose-600 text-white font-mono px-1.5 py-0.2 rounded-full">
                ₹{balanceDue}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('dining')}
            className={`min-h-[42px] px-4 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'dining'
                ? 'bg-gradient-to-r from-[#FE6E00] to-[#EA580C] text-white shadow-xs'
                : 'text-gray-700 hover:text-[#0B1733] hover:bg-sand-100'
            }`}
          >
            <Utensils className="w-4 h-4" />
            <span>Room Dine-In Menu</span>
            {cartItemCount > 0 && (
              <span className="ml-1 text-[10px] bg-[#25479E] text-white font-mono px-1.5 py-0.2 rounded-full">
                {cartItemCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('celebrations')}
            className={`min-h-[42px] px-4 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'celebrations'
                ? 'bg-gradient-to-r from-[#FE6E00] to-[#EA580C] text-white shadow-xs'
                : 'text-gray-700 hover:text-[#0B1733] hover:bg-sand-100'
            }`}
          >
            <Cake className="w-4 h-4" />
            <span>Special Celebrations</span>
          </button>

          <button
            onClick={() => setActiveTab('transfers')}
            className={`min-h-[42px] px-4 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'transfers'
                ? 'bg-gradient-to-r from-[#FE6E00] to-[#EA580C] text-white shadow-xs'
                : 'text-gray-700 hover:text-[#0B1733] hover:bg-sand-100'
            }`}
          >
            <Car className="w-4 h-4" />
            <span>Transfers &amp; Rentals</span>
          </button>

          <button
            onClick={() => setActiveTab('documents')}
            className={`min-h-[42px] px-4 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'documents'
                ? 'bg-gradient-to-r from-[#FE6E00] to-[#EA580C] text-white shadow-xs'
                : 'text-gray-700 hover:text-[#0B1733] hover:bg-sand-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>ID &amp; Documents</span>
          </button>
        </div>

        {/* 5. TAB CONTENT */}

        {/* ================= TAB 1: BILLING & FOLIO ================= */}
        {activeTab === 'billing' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-sand-300 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sand-200 pb-4">
                <div>
                  <h3 className="font-serif font-bold text-xl text-[#0B1733]">
                    Live Stay Folio &amp; Itemized Bill
                  </h3>
                  <p className="text-xs text-gray-600">
                    Transparent accounting of all room charges, in-room dining, celebrations, and transfers.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl border border-sand-300 hover:bg-sand-100 text-[#0B1733] text-xs font-bold flex items-center space-x-1.5 self-start sm:self-auto cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Tax Invoice</span>
                </button>
              </div>

              {/* Itemized Table */}
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block">
                  Itemized Stay Charges
                </span>

                <div className="divide-y divide-sand-200 text-xs">
                  {/* Room Charge */}
                  <div className="py-3 flex items-center justify-between">
                    <div>
                      <strong className="text-[#0B1733] block text-sm">{activeBooking.roomName}</strong>
                      <span className="text-gray-500">
                        {activeBooking.totalNights} Night(s) tariff • {activeBooking.mealPlan} Plan
                      </span>
                    </div>
                    <span className="font-mono font-bold text-sm text-[#0B1733]">
                      ₹{totalRoomBill.toLocaleString('en-IN')}
                    </span>
                  </div>

                  {/* Food & Beverage Orders */}
                  {myOrders.length > 0 ? (
                    myOrders.map((ord) => (
                      <div key={ord.id} className="py-3 flex items-center justify-between">
                        <div>
                          <strong className="text-[#0B1733] block">
                            Food Order #{ord.orderNumber}
                          </strong>
                          <span className="text-gray-500">
                            {ord.items?.map((i: any) => `${i.name || i.itemName} x${i.quantity}`).join(', ')}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-[#0B1733]">
                          ₹{ord.totalAmount?.toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))
                  ) : totalFbBill > 0 ? (
                    <div className="py-3 flex items-center justify-between">
                      <div>
                        <strong className="text-[#0B1733] block">In-Room Dining Orders</strong>
                        <span className="text-gray-500">Food &amp; Beverage charges logged to room</span>
                      </div>
                      <span className="font-mono font-bold text-[#0B1733]">
                        ₹{totalFbBill.toLocaleString('en-IN')}
                      </span>
                    </div>
                  ) : null}

                  {/* Addon Charges (Transfers / Celebrations) */}
                  {totalAddonBill > 0 && (
                    <div className="py-3 flex items-center justify-between">
                      <div>
                        <strong className="text-[#0B1733] block">Special Experiences &amp; Transfers</strong>
                        <span className="text-gray-500">Celebration setup, transfers, or rentals</span>
                      </div>
                      <span className="font-mono font-bold text-[#0B1733]">
                        ₹{totalAddonBill.toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Totals Summary */}
                <div className="pt-4 border-t-2 border-sand-300 space-y-2 text-xs">
                  <div className="flex justify-between text-gray-600">
                    <span>Net Bill Amount:</span>
                    <span className="font-mono font-bold">₹{netPayable.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>Advance / Payments Received:</span>
                    <span className="font-mono font-bold">− ₹{totalPaid.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-sand-200 text-sm sm:text-base font-bold text-[#0B1733]">
                    <span>Outstanding Balance Due:</span>
                    <span className={`font-mono ${balanceDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      ₹{balanceDue.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Settlement Instructions */}
                {balanceDue > 0 && (
                  <div className="bg-sand-50 p-4 rounded-2xl border border-sand-200 text-xs text-gray-700 space-y-1">
                    <p className="font-bold text-[#0B1733]">Payment &amp; Dues Settlement</p>
                    <p>
                      All dues can be settled during check-out at the reception via UPI, Credit/Debit card POS, or Cash. For advance settlement or receipts, please contact the manager.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: ROOM DINE-IN MENU ================= */}
        {activeTab === 'dining' && (
          <div className="space-y-6 animate-fade-in">
            {orderSuccessMsg && (
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs text-emerald-900 flex items-start space-x-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Order Received!</p>
                  <p className="mt-0.5">{orderSuccessMsg}</p>
                </div>
              </div>
            )}

            {/* Menu Header */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-sand-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-serif font-bold text-xl text-[#0B1733]">
                    Room Dine-In &amp; Himalayan Kitchen
                  </h3>
                  <p className="text-xs text-gray-600">
                    Freshly prepared in our mountain kitchen and served directly to Room {activeBooking.roomNumber}.
                  </p>
                </div>

                {/* Cart Float Button */}
                {cartItemCount > 0 && (
                  <div className="bg-gradient-to-r from-[#FE6E00] to-[#EA580C] text-white px-4 py-2 rounded-2xl flex items-center space-x-2 font-bold text-xs shadow-md">
                    <ShoppingCart className="w-4 h-4" />
                    <span>{cartItemCount} Items (₹{cartTotalAmount})</span>
                  </div>
                )}
              </div>

              {/* Menu Items List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {INITIAL_MENU_ITEMS.map((item) => {
                  const qty = diningCart[item.id] || 0;
                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl border border-sand-200 hover:border-[#25479E]/40 hover:bg-sand-50/50 transition-all flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-[#0B1733] truncate">{item.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-sand-200 text-gray-700 font-medium">
                            {item.categoryName}
                          </span>
                        </div>
                        <p className="text-gray-500 text-[11px] mt-0.5 line-clamp-1">{item.description}</p>
                        <span className="font-mono font-bold text-sm text-[#0B1733] mt-1 block">
                          ₹{item.price.toLocaleString('en-IN')}
                        </span>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center space-x-1.5 shrink-0">
                        {qty > 0 ? (
                          <div className="flex items-center space-x-2 bg-white border border-sand-300 rounded-xl p-1 shadow-2xs">
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.id, -1)}
                              className="w-7 h-7 rounded-lg bg-sand-100 hover:bg-sand-200 text-[#0B1733] font-bold flex items-center justify-center cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="font-mono font-bold text-xs px-1">{qty}</span>
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.id, 1)}
                              className="w-7 h-7 rounded-lg bg-[#25479E] hover:bg-[#1A3478] text-white font-bold flex items-center justify-center cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.id, 1)}
                            className="px-3 py-1.5 rounded-xl bg-[#25479E] hover:bg-[#1A3478] text-white font-bold text-xs transition-all cursor-pointer shadow-2xs flex items-center space-x-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Cart Drawer / Place Order Bar */}
              {cartItemCount > 0 && (
                <div className="mt-6 pt-6 border-t border-sand-300 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-[#0B1733] block mb-1">
                      Cooking Notes &amp; Dietary Preferences (Optional)
                    </label>
                    <input
                      type="text"
                      value={cartNotes}
                      onChange={(e) => setCartNotes(e.target.value)}
                      placeholder="e.g. Less spicy, serve with extra lemons, no coriander"
                      className="w-full p-3 rounded-xl border border-sand-300 bg-sand-50/50 text-xs focus:bg-white focus:ring-2 focus:ring-[#25479E] focus:outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handlePlaceDineInOrder}
                    disabled={isPlacingOrder}
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-[#FE6E00] to-[#EA580C] hover:from-[#EA580C] hover:to-[#C2410C] active:scale-98 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-60"
                  >
                    {isPlacingOrder ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Sending Order to Kitchen...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Order to Room {activeBooking.roomNumber} • ₹{cartTotalAmount.toLocaleString('en-IN')}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 3: SPECIAL CELEBRATIONS ================= */}
        {activeTab === 'celebrations' && (
          <div className="space-y-6 animate-fade-in">
            {celebrationSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs text-emerald-900 flex items-start space-x-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <p className="font-bold">{celebrationSuccess}</p>
              </div>
            )}

            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-sand-300 space-y-6">
              <div>
                <h3 className="font-serif font-bold text-xl text-[#0B1733]">
                  Himalayan Romance &amp; Celebrations
                </h3>
                <p className="text-xs text-gray-600">
                  Make your stay unforgettable with curated anniversary setups, birthday cakes, and romantic candlelight arrangements.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {CELEBRATION_OPTIONS.map((cel) => {
                  const Icon = cel.icon;
                  return (
                    <div
                      key={cel.id}
                      className="p-5 rounded-2xl border border-sand-300 hover:border-[#25479E] hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-2">
                        <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-[#FE6E00] flex items-center justify-center">
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold uppercase text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 block w-fit">
                          {cel.badge}
                        </span>
                        <h4 className="font-bold text-sm text-[#0B1733]">{cel.title}</h4>
                        <p className="text-xs text-gray-600 leading-relaxed">{cel.description}</p>
                        <span className="font-mono font-bold text-base text-[#0B1733] block">
                          ₹{cel.price.toLocaleString('en-IN')}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedCelebration(cel)}
                        className="w-full py-2.5 rounded-xl bg-[#25479E] hover:bg-[#1A3478] text-white font-bold text-xs transition-colors cursor-pointer"
                      >
                        Book This Setup
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Modal for ordering chosen celebration */}
              {selectedCelebration && (
                <div className="p-5 bg-sand-50 rounded-2xl border border-sand-300 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-[#0B1733]">
                      Configure {selectedCelebration.title} (₹{selectedCelebration.price})
                    </h4>
                    <button
                      type="button"
                      onClick={() => setSelectedCelebration(null)}
                      aria-label="Close"
                      className="w-7 h-7 rounded-full bg-sand-200 hover:bg-sand-300 text-forest-700 hover:text-forest-950 flex items-center justify-center transition-all cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#0B1733] block mb-1">
                      Custom Message / Timing Note
                    </label>
                    <input
                      type="text"
                      value={celebrationNotes}
                      onChange={(e) => setCelebrationNotes(e.target.value)}
                      placeholder="e.g. Happy 5th Anniversary Priya, serve at 8:30 PM on balcony"
                      className="w-full p-2.5 rounded-xl border border-sand-300 bg-white text-xs focus:ring-2 focus:ring-[#25479E] focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleOrderCelebration}
                    disabled={isOrderingCelebration}
                    className="w-full py-3 bg-gradient-to-r from-[#FE6E00] to-[#EA580C] text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                  >
                    Confirm &amp; Add to Stay Folio
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 4: TRANSFERS & RENTALS ================= */}
        {activeTab === 'transfers' && (
          <div className="space-y-6 animate-fade-in">
            {transferSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs text-emerald-900 flex items-start space-x-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <p className="font-bold">{transferSuccess}</p>
              </div>
            )}

            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-sand-300 space-y-6">
              <div>
                <h3 className="font-serif font-bold text-xl text-[#0B1733]">
                  Mountain Transfers &amp; Sightseeing Vehicles
                </h3>
                <p className="text-xs text-gray-600">
                  Fixed-rate reliable transfers to/from Bagdogra Airport (IXB), NJP Railway Station, and Darjeeling town.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {INITIAL_TRANSFER_ROUTES.map((route) => (
                  <div
                    key={route.id}
                    className="p-4 rounded-2xl border border-sand-200 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <h4 className="font-bold text-sm text-[#0B1733]">{route.title}</h4>
                      <p className="text-gray-500 text-[11px]">
                        {route.origin} → {route.destination} • ~{route.estimatedDurationHours} hrs
                      </p>
                      <span className="font-mono font-bold text-sm text-[#0B1733] mt-1 block">
                        From ₹{route.priceWagonR.toLocaleString('en-IN')} (WagonR) / ₹{route.priceSUV.toLocaleString('en-IN')} (SUV)
                      </span>
                    </div>

                    <a
                      href="tel:+919832022233"
                      className="px-3.5 py-2 rounded-xl bg-[#25479E] hover:bg-[#1A3478] text-white font-bold text-xs flex items-center space-x-1 shrink-0 cursor-pointer"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span>Call to Book</span>
                    </a>
                  </div>
                ))}
              </div>

              <div className="pt-6 border-t border-sand-200">
                <h4 className="font-serif font-bold text-base text-[#0B1733] mb-1">
                  Scooty &amp; Self-Drive Mountain Rentals
                </h4>
                <p className="text-xs text-gray-600 mb-4">
                  Explore Takdah, Tinchuley, Lamahatta, and Darjeeling at your own mountain pace.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {INITIAL_RENTAL_VEHICLES.map((vehicle) => (
                    <div
                      key={vehicle.id}
                      className="p-4 rounded-2xl border border-sand-200 flex flex-col justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-sm text-[#0B1733]">{vehicle.vehicleName}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase">
                            {vehicle.vehicleType}
                          </span>
                        </div>
                        <p className="text-gray-500 text-[11px] mb-2">{vehicle.specs || 'Includes 2 helmets & mountain permits'}</p>
                        <span className="font-mono font-bold text-sm text-[#0B1733] block">
                          ₹{vehicle.ratePerDay.toLocaleString('en-IN')} / day
                        </span>
                      </div>
                      <a
                        href="tel:+919832022233"
                        className="mt-3 px-3 py-2 text-center rounded-xl bg-[#25479E] hover:bg-[#1A3478] text-white font-bold text-xs flex items-center justify-center space-x-1 cursor-pointer"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        <span>Reserve Rental</span>
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 5: ID & DOCUMENTS ================= */}
        {activeTab === 'documents' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-sand-300 space-y-6">
              <div>
                <h3 className="font-serif font-bold text-xl text-[#0B1733]">
                  Registered Government ID Documents
                </h3>
                <p className="text-xs text-gray-600">
                  Your government ID proof submitted during digital check-in.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="bg-sand-50 p-4 rounded-2xl border border-sand-200">
                  <span className="text-gray-500 block">ID Document Type</span>
                  <strong className="text-sm text-[#0B1733] block mt-0.5">
                    {activeBooking.guest?.idType || 'Aadhaar Card'}
                  </strong>
                </div>

                <div className="bg-sand-50 p-4 rounded-2xl border border-sand-200">
                  <span className="text-gray-500 block">ID Document Number</span>
                  <strong className="text-sm font-mono text-[#0B1733] block mt-0.5">
                    {activeBooking.guest?.idNumber || 'Not available'}
                  </strong>
                </div>

                <div className="bg-sand-50 p-4 rounded-2xl border border-sand-200 sm:col-span-2">
                  <span className="text-gray-500 block">Registered Residential Address</span>
                  <strong className="text-xs text-[#0B1733] block mt-0.5">
                    {activeBooking.guest?.address}, {activeBooking.guest?.city}, {activeBooking.guest?.state || 'West Bengal'}
                  </strong>
                </div>
              </div>

              {/* Photos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {activeBooking.guest?.idDocumentUrl && (
                  <div className="border border-sand-200 rounded-2xl p-3 bg-sand-50 text-center">
                    <span className="text-xs font-bold text-[#0B1733] block mb-2">Front Page</span>
                    <div className="w-full h-40 bg-white rounded-xl overflow-hidden border border-sand-300">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={activeBooking.guest.idDocumentUrl} alt="Front ID" className="w-full h-full object-contain" />
                    </div>
                  </div>
                )}

                {activeBooking.guest?.idDocumentBackUrl && (
                  <div className="border border-sand-200 rounded-2xl p-3 bg-sand-50 text-center">
                    <span className="text-xs font-bold text-[#0B1733] block mb-2">Back / Address Page</span>
                    <div className="w-full h-40 bg-white rounded-xl overflow-hidden border border-sand-300">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={activeBooking.guest.idDocumentBackUrl} alt="Back ID" className="w-full h-full object-contain" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function GuestPortalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F3F7FF] flex items-center justify-center p-4">
          <div className="w-8 h-8 border-3 border-[#25479E] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <GuestPortalContent />
    </Suspense>
  );
}
