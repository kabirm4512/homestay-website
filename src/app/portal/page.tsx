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
  MessageSquare,
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
} from 'lucide-react';
import { CRMBooking, GuestFolio, FolioCharge, MenuItem } from '@/types/crm';
import { INITIAL_MENU_ITEMS } from '@/lib/crm-data';

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
    title: 'Celebration Cake',
    price: 1000,
    icon: Cake,
    badge: 'Popular for Birthdays & Anniversaries',
    description: 'Freshly baked mountain artisan celebration cake (500g) with customized wording, celebration candles, and elegant table setup.',
    details: ['Flavors: Rich Truffle Chocolate, Black Forest, or Fresh Pineapple', 'Custom message on cake', 'Candles & celebration knife included'],
  },
  {
    id: 'candlelight-dinner',
    title: 'Candlelight Dinner with Romantic Decorations',
    price: 2000,
    icon: Heart,
    badge: 'Honeymoon & Romantic Getaway',
    description: 'Private candlelit dinner arrangement on your private balcony or panoramic garden deck, adorned with fresh pine florals, aromatic candles, and ambient fairy lights.',
    details: ['Private candlelit dining table arrangement', 'Fresh flower centerpiece & scented candles', 'Soft ambient lighting & personalized hospitality'],
  },
  {
    id: 'flower-bed-decoration',
    title: 'Room Flower Bed Decoration',
    price: 1000,
    icon: Flower2,
    badge: 'Anniversary & Romantic Welcome',
    description: 'Intricately arranged fresh Himalayan wild blooms, marigolds, and aromatic red rose petals on your king bed for a romantic mountain homecoming.',
    details: ['Artisan heart or geometric petal motif', 'Fresh hill blossoms & crimson rose petals', 'Complimentary fragrant mountain incense burner'],
  },
];

function PortalContent() {
  const searchParams = useSearchParams();
  const urlPhone = searchParams.get('phone') || '';
  const urlName = searchParams.get('name') || '';
  const urlBooking = searchParams.get('booking') || '';

  // Session state
  const [activeBooking, setActiveBooking] = useState<CRMBooking | null>(null);
  const [activeFolio, setActiveFolio] = useState<GuestFolio | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'checkin' | 'billing' | 'celebrations' | 'dining'>('overview');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Unauthenticated lookup form inputs
  const [inputFirstName, setInputFirstName] = useState<string>('');
  const [inputPhone, setInputPhone] = useState<string>('');
  const [lookupError, setLookupError] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Digital ID upload state inside portal
  const [idType, setIdType] = useState<string>('Aadhaar Card');
  const [idNumber, setIdNumber] = useState<string>('');
  const [idFrontUrl, setIdFrontUrl] = useState<string>('');
  const [idBackUrl, setIdBackUrl] = useState<string>('');
  const [isSubmittingDoc, setIsSubmittingDoc] = useState<boolean>(false);
  const [docSuccessMsg, setDocSuccessMsg] = useState<string>('');

  // Special request modal / drawer state
  const [selectedCelebration, setSelectedCelebration] = useState<SpecialCelebrationOption | null>(null);
  const [celebrationNotes, setCelebrationNotes] = useState<string>('');
  const [isOrderingCelebration, setIsOrderingCelebration] = useState<boolean>(false);
  const [celebrationSuccess, setCelebrationSuccess] = useState<string>('');

  // Dining cart state
  const [diningCart, setDiningCart] = useState<Record<string, number>>({});
  const [cartSpecialNotes, setCartSpecialNotes] = useState<string>('');
  const [isPlacingOrder, setIsPlacingOrder] = useState<boolean>(false);
  const [orderSuccessMsg, setOrderSuccessMsg] = useState<string>('');

  // Wi-Fi copy status
  const [wifiCopied, setWifiCopied] = useState<boolean>(false);

  // Print Invoice Modal state
  const [showInvoicePrint, setShowInvoicePrint] = useState<boolean>(false);

  // Helper to normalize phone to last 10 digits
  const normalize = (val: string) => val.replace(/[^0-9]/g, '').slice(-10);

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

  const loginGuest = useCallback((booking: CRMBooking) => {
    setActiveBooking(booking);
    localStorage.setItem('savera_guest_portal_session', JSON.stringify(booking));

    // Pre-populate document fields if existing
    if (booking.guest) {
      setIdType(booking.guest.idType || 'Aadhaar Card');
      setIdNumber(booking.guest.idNumber || '');
      setIdFrontUrl(booking.guest.idDocumentUrl || '');
      setIdBackUrl(booking.guest.idDocumentBackUrl || '');
    }

    // Fetch Folio
    fetchFolio(booking.id, booking.roomNumber);
  }, [fetchFolio]);

  // Load session or perform URL lookup on mount
  useEffect(() => {
    const initSession = async () => {
      setIsLoading(true);
      try {
        // 1. Check if URL parameters provide direct access
        if (urlPhone || urlBooking) {
          const query = urlPhone || urlBooking;
          const res = await fetch(`/api/checkin?query=${encodeURIComponent(query)}`);
          const json = await res.json();
          if (json?.success && json.booking) {
            loginGuest(json.booking);
            setIsLoading(false);
            return;
          }
        }

        // 2. Check saved session in localStorage
        const savedSession = localStorage.getItem('savera_guest_portal_session');
        if (savedSession) {
          const parsed = JSON.parse(savedSession);
          if (parsed && parsed.id) {
            // Re-fetch latest booking data to ensure real-time status
            const query = parsed.guest?.phone || parsed.bookingReference || parsed.id;
            const res = await fetch(`/api/checkin?query=${encodeURIComponent(query)}`);
            const json = await res.json();
            if (json?.success && json.booking) {
              loginGuest(json.booking);
              setIsLoading(false);
              return;
            } else {
              loginGuest(parsed);
              setIsLoading(false);
              return;
            }
          }
        }
      } catch (err) {
        console.warn('Session init err:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initSession();
  }, [urlPhone, urlBooking, loginGuest]);

  const handleManualLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError('');
    const cleanNum = normalize(inputPhone);
    const cleanName = inputFirstName.trim().toLowerCase();

    if (!cleanNum || cleanNum.length < 10) {
      setLookupError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!cleanName) {
      setLookupError('Please enter your first name.');
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/checkin?query=${encodeURIComponent(cleanNum)}`);
      const json = await res.json();

      if (!json?.success || !json.booking) {
        setLookupError(`No active reservation found for mobile number ending with ${cleanNum.slice(-4)}. Please verify or contact reception.`);
        setIsSearching(false);
        return;
      }

      const booking: CRMBooking = json.booking;
      const guestFullName = (booking.guest?.fullName || '').toLowerCase();

      // Check if first name matches or is contained in full name
      if (!guestFullName.includes(cleanName) && !cleanName.includes(guestFullName.split(' ')[0])) {
        setLookupError(`Name does not match the reservation on record. (Expected first name for ${cleanNum.slice(-4)})`);
        setIsSearching(false);
        return;
      }

      loginGuest(booking);
    } catch (err: any) {
      setLookupError('Network error connecting to homestay server. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('savera_guest_portal_session');
    setActiveBooking(null);
    setActiveFolio(null);
    setInputPhone('');
    setInputFirstName('');
    setLookupError('');
    setActiveTab('overview');
  };

  // Document photo upload helper
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setter(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Submit Digital ID Documents
  const handleSubmitIdDocuments = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBooking) return;

    if (!idNumber.trim() && !idFrontUrl) {
      setDocSuccessMsg('Please provide your ID document number or photo.');
      return;
    }

    setIsSubmittingDoc(true);
    setDocSuccessMsg('');
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: activeBooking.id,
          bookingReference: activeBooking.bookingReference,
          roomId: activeBooking.roomId,
          roomName: activeBooking.roomName,
          roomNumber: activeBooking.roomNumber,
          guest: {
            ...activeBooking.guest,
            idType,
            idNumber: idNumber.trim(),
            idDocumentUrl: idFrontUrl,
            idDocumentBackUrl: idBackUrl,
            documentStatus: 'submitted',
          },
        }),
      });

      const json = await res.json();
      if (json?.success && json.booking) {
        setActiveBooking(json.booking);
        localStorage.setItem('savera_guest_portal_session', JSON.stringify(json.booking));
        setDocSuccessMsg('ID documents submitted successfully! Reception will review shortly.');
      }
    } catch (err) {
      setDocSuccessMsg('Error submitting document. Please show physical ID at reception.');
    } finally {
      setIsSubmittingDoc(false);
    }
  };

  // Order Special Celebration Request
  const handleConfirmCelebrationOrder = async () => {
    if (!selectedCelebration || !activeBooking) return;

    setIsOrderingCelebration(true);
    setCelebrationSuccess('');

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'special_request',
          bookingId: activeBooking.id,
          bookingReference: activeBooking.bookingReference,
          roomNumber: activeBooking.roomNumber,
          guestName: activeBooking.guest?.fullName || 'Guest',
          guestPhone: activeBooking.guest?.phone,
          items: [{ name: selectedCelebration.title, price: selectedCelebration.price, quantity: 1 }],
          totalAmount: selectedCelebration.price,
          notes: celebrationNotes.trim(),
          chargeCategory: 'miscellaneous',
        }),
      });

      const json = await res.json();
      if (json?.success) {
        // Dispatch local event for real-time admin chime in case admin tab is open
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('wp_new_order_alert', JSON.stringify({
            id: json.alert?.id || Date.now(),
            roomNumber: activeBooking.roomNumber,
            guestName: activeBooking.guest?.fullName,
            details: selectedCelebration.title,
            amount: selectedCelebration.price,
            time: Date.now(),
          }));
        }

        // Update folio
        if (json.folio) {
          setActiveFolio(json.folio);
        } else {
          fetchFolio(activeBooking.id, activeBooking.roomNumber);
        }

        setCelebrationSuccess(`₹${selectedCelebration.price.toLocaleString('en-IN')} added to Room ${activeBooking.roomNumber} folio! Opening WhatsApp to reception...`);

        // Open WhatsApp to Homestay Reception (+91 98320 22233)
        const waText = `Hi Savera Homestay! 🌿
I have requested a celebration add-on from the Guest Portal for Room ${activeBooking.roomNumber} (${activeBooking.guest?.fullName}):

🎉 *${selectedCelebration.title}* (₹${selectedCelebration.price.toLocaleString('en-IN')})
Notes / Timing: ${celebrationNotes.trim() || 'Please arrange as standard'}

Please confirm the arrangement. Thank you!`;

        setTimeout(() => {
          window.open(`https://wa.me/919832022233?text=${encodeURIComponent(waText)}`, '_blank');
          setSelectedCelebration(null);
          setCelebrationNotes('');
        }, 1200);
      }
    } catch (err) {
      alert('Failed to register celebration request. Please message reception directly.');
    } finally {
      setIsOrderingCelebration(false);
    }
  };

  // In-Room Dining Order
  const menuList = useMemo(() => INITIAL_MENU_ITEMS, []);

  const totalCartAmount = useMemo(() => {
    return Object.entries(diningCart).reduce((sum, [itemId, qty]) => {
      const item = menuList.find(m => m.id === itemId);
      return sum + (item ? item.price * qty : 0);
    }, 0);
  }, [diningCart, menuList]);

  const handlePlaceDiningOrder = async () => {
    if (!activeBooking || totalCartAmount <= 0) return;

    setIsPlacingOrder(true);
    setOrderSuccessMsg('');

    const orderedItems = Object.entries(diningCart)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, qty]) => {
        const item = menuList.find(m => m.id === itemId);
        return {
          name: item?.name || 'Dish',
          price: item?.price || 0,
          quantity: qty,
        };
      });

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'food_order',
          bookingId: activeBooking.id,
          bookingReference: activeBooking.bookingReference,
          roomNumber: activeBooking.roomNumber,
          guestName: activeBooking.guest?.fullName || 'Guest',
          guestPhone: activeBooking.guest?.phone,
          items: orderedItems,
          totalAmount: totalCartAmount,
          notes: cartSpecialNotes.trim(),
          chargeCategory: 'food_beverage',
        }),
      });

      const json = await res.json();
      if (json?.success) {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('wp_new_order_alert', JSON.stringify({
            id: json.alert?.id || Date.now(),
            roomNumber: activeBooking.roomNumber,
            guestName: activeBooking.guest?.fullName,
            details: orderedItems.map(i => `${i.quantity}x ${i.name}`).join(', '),
            amount: totalCartAmount,
            time: Date.now(),
          }));
        }

        if (json.folio) {
          setActiveFolio(json.folio);
        } else {
          fetchFolio(activeBooking.id, activeBooking.roomNumber);
        }

        setDiningCart({});
        setCartSpecialNotes('');
        setOrderSuccessMsg(`Order placed successfully! ₹${totalCartAmount.toLocaleString('en-IN')} added to your room folio. The kitchen is preparing your meal.`);
      }
    } catch (err) {
      alert('Failed to place food order. Please call front desk / kitchen directly.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const copyWifi = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText('saverahomestay');
      setWifiCopied(true);
      setTimeout(() => setWifiCopied(false), 2500);
    }
  };

  // Billing numbers fallback calculation if activeFolio is loading
  const effectiveSubtotal = useMemo(() => {
    if (activeFolio) {
      return activeFolio.totalRoomCharges + activeFolio.totalFbCharges + activeFolio.totalAddonCharges - (activeFolio.discountAmount || 0);
    }
    return activeBooking?.totalRoomAmount || 4500;
  }, [activeFolio, activeBooking]);

  const effectiveTax = useMemo(() => {
    if (activeFolio) return activeFolio.totalTax;
    return Math.round(effectiveSubtotal * 0.05 * 10) / 10;
  }, [activeFolio, effectiveSubtotal]);

  const effectiveNetPayable = useMemo(() => {
    if (activeFolio) return activeFolio.netPayable;
    return effectiveSubtotal + effectiveTax;
  }, [activeFolio, effectiveSubtotal, effectiveTax]);

  const effectiveAdvancePaid = useMemo(() => {
    if (activeFolio) return activeFolio.totalPaid;
    return activeBooking?.advancePaid || 0;
  }, [activeFolio, activeBooking]);

  const effectiveBalanceDue = useMemo(() => {
    if (activeFolio) return activeFolio.balanceDue;
    return Math.max(0, effectiveNetPayable - effectiveAdvancePaid);
  }, [activeFolio, effectiveNetPayable, effectiveAdvancePaid]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-3 border-forest-800 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-forest-800">Connecting to Savera Guest Portal...</span>
        </div>
      </div>
    );
  }

  // ================= VIEW 1: UN-AUTHENTICATED LOOKUP FORM =================
  if (!activeBooking) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0B1733] via-[#12244F] to-[#0B1733] text-white flex flex-col justify-between p-4 sm:p-6 font-sans">
        <header className="max-w-md mx-auto w-full pt-8 text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#25479E]/30 border border-[#25479E]/50 text-[#FE6E00] mb-2 shadow-inner">
            <Trees className="w-7 h-7" />
          </div>
          <h1
            className="text-2xl sm:text-3xl font-bold tracking-tight text-white"
            style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
          >
            Savera Homestay
          </h1>
          <p className="text-xs sm:text-sm text-primary-200 uppercase tracking-widest font-semibold">
            Guest Self-Service Portal
          </p>
        </header>

        <main className="max-w-md mx-auto w-full my-8 bg-white text-[#0B1733] rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#C7D4F5]">
          <div className="mb-6 text-center space-y-1">
            <h2
              className="font-bold text-lg text-[#0B1733]"
              style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
            >
              Access Your Stay Details
            </h2>
            <p className="text-xs text-gray-600">
              Enter the First Name and Mobile Number provided during check-in to access your room information, bills &amp; dining.
            </p>
          </div>

          {lookupError && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{lookupError}</span>
            </div>
          )}

          <form onSubmit={handleManualLookup} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-800 block mb-1">
                First Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={inputFirstName}
                  onChange={(e) => setInputFirstName(e.target.value)}
                  placeholder="e.g. Aditi"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm font-medium rounded-xl border border-gray-300 bg-[#F3F7FF]/50 focus:bg-white focus:ring-2 focus:ring-[#25479E] focus:border-[#25479E]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-800 block mb-1">
                Mobile Number (10 Digits) *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  value={inputPhone}
                  onChange={(e) => setInputPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm font-medium rounded-xl border border-gray-300 bg-[#F3F7FF]/50 focus:bg-white focus:ring-2 focus:ring-[#25479E] focus:border-[#25479E] font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSearching}
              className="w-full min-h-[48px] mt-2 bg-gradient-to-r from-[#FE6E00] to-[#EA580C] hover:from-[#EA580C] hover:to-[#C2410C] disabled:opacity-60 text-white rounded-xl font-bold text-sm shadow-[0_4px_14px_rgba(254,110,0,0.35)] transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              {isSearching ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Locating Stay Details...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-white" />
                  <span>Open Guest Portal</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-200 text-center space-y-2">
            <p className="text-[11px] text-gray-600">
              Need immediate check-in assistance or having trouble accessing?
            </p>
            <a
              href="https://wa.me/919832022233?text=Hi%20Savera%20Homestay!%20I%20am%20at%20the%20property%20and%20need%20help%20with%20check-in."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Message Reception on WhatsApp (+91 98320 22233)</span>
            </a>
          </div>
        </main>

        <footer className="text-center text-xs text-primary-200 pb-4">
          Savera Homestay • Boutique Mountain Retreat &amp; Organic Orchards
        </footer>
      </div>
    );
  }

  // ================= VIEW 2: AUTHENTICATED GUEST INFORMATION HUB =================
  const isDocSubmittedOrVerified =
    activeBooking.documentStatus === 'submitted' ||
    activeBooking.documentStatus === 'verified' ||
    activeBooking.guest?.documentStatus === 'submitted' ||
    activeBooking.guest?.documentStatus === 'verified';

  return (
    <div className="min-h-screen bg-[#F3F7FF] text-[#0B1733] flex flex-col font-sans">
      {/* 1. Portal Header */}
      <header className="sticky top-0 z-30 bg-[#0B1733] text-white border-b border-[#1E2D4A] shadow-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#25479E] border border-[#3B62C7] flex items-center justify-center text-amber-300">
              <Trees className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span
                  className="font-bold text-sm sm:text-base leading-none tracking-tight text-white"
                  style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                >
                  Savera Homestay
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FE6E00] text-white">
                  Room {activeBooking.roomNumber}
                </span>
              </div>
              <span className="text-[11px] text-gray-300">
                Welcome, {activeBooking.guest?.fullName}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowInvoicePrint(true)}
              className="min-h-[38px] px-3 py-1.5 bg-[#182C58] hover:bg-[#25479E] text-gray-200 hover:text-white rounded-xl text-xs font-semibold border border-[#25479E]/40 transition-colors flex items-center space-x-1.5 cursor-pointer"
              title="View & Download Official GST Invoice"
            >
              <Printer className="w-3.5 h-3.5 text-[#FE6E00]" />
              <span className="hidden sm:inline">Invoice</span>
            </button>

            <button
              onClick={handleLogout}
              className="min-h-[38px] p-2 text-gray-300 hover:text-rose-300 rounded-xl hover:bg-[#182C58] transition-colors flex items-center space-x-1 cursor-pointer"
              title="Sign Out / Switch Booking"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="bg-[#070F22] border-t border-[#1E2D4A] px-4 sm:px-6">
          <div className="max-w-4xl mx-auto flex items-center space-x-1 sm:space-x-2 overflow-x-auto py-2 no-scrollbar text-xs font-bold">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-gradient-to-r from-[#FE6E00] to-[#EA580C] text-white shadow-xs'
                  : 'text-gray-300 hover:text-white hover:bg-[#182C58]'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>Stay &amp; Wi-Fi</span>
            </button>

            <button
              onClick={() => setActiveTab('checkin')}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'checkin'
                  ? 'bg-gradient-to-r from-[#FE6E00] to-[#EA580C] text-white shadow-xs'
                  : 'text-gray-300 hover:text-white hover:bg-[#182C58]'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Digital ID {isDocSubmittedOrVerified ? '✓' : '!'}</span>
            </button>

            <button
              onClick={() => setActiveTab('billing')}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'billing'
                  ? 'bg-gradient-to-r from-[#FE6E00] to-[#EA580C] text-white shadow-xs'
                  : 'text-gray-300 hover:text-white hover:bg-[#182C58]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Folio &amp; Bill</span>
            </button>

            <button
              onClick={() => setActiveTab('celebrations')}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'celebrations'
                  ? 'bg-gradient-to-r from-[#FE6E00] to-[#EA580C] text-white shadow-xs'
                  : 'text-gray-300 hover:text-white hover:bg-[#182C58]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Special Celebrations</span>
            </button>

            <button
              onClick={() => setActiveTab('dining')}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'dining'
                  ? 'bg-gradient-to-r from-[#FE6E00] to-[#EA580C] text-white shadow-xs'
                  : 'text-gray-300 hover:text-white hover:bg-[#182C58]'
              }`}
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>Room Dining</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Content Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Urgent Alert if ID is pending */}
        {!isDocSubmittedOrVerified && activeTab !== 'checkin' && (
          <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-forest-950 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-amber-950">
                  Digital Check-In &amp; ID Proof Pending
                </h4>
                <p className="text-xs text-amber-900">
                  Please take 30 seconds to upload your ID document to complete your homestay check-in formalities.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('checkin')}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-forest-950 rounded-xl font-bold text-xs shadow-xs transition-colors shrink-0"
            >
              Complete Check-In Now →
            </button>
          </div>
        )}

        {/* ================= TAB 1: STAY OVERVIEW & WI-FI ================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            {/* Stay Card */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-sand-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sand-100 pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-forest-600">
                    Your Reserved Accommodation
                  </span>
                  <h3 className="font-serif font-bold text-xl text-forest-950">
                    Room {activeBooking.roomNumber} — {activeBooking.roomName.split(' - ')[1] || activeBooking.roomName}
                  </h3>
                  <span className="text-xs text-forest-600">
                    Booking Reference: <strong className="font-mono">{activeBooking.bookingReference}</strong>
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold capitalize">
                    {activeBooking.tapeStatus === 'checked_in' ? 'Checked-In • In-House' : activeBooking.tapeStatus}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-sand-50 p-3 rounded-2xl border border-sand-200/60">
                  <span className="text-forest-600 block text-[11px]">Check-In</span>
                  <span className="font-bold text-forest-950 font-mono text-sm">
                    {activeBooking.checkInDate}
                  </span>
                  <span className="text-[10px] text-forest-500 block">From 12:00 PM</span>
                </div>

                <div className="bg-sand-50 p-3 rounded-2xl border border-sand-200/60">
                  <span className="text-forest-600 block text-[11px]">Check-Out</span>
                  <span className="font-bold text-forest-950 font-mono text-sm">
                    {activeBooking.checkOutDate}
                  </span>
                  <span className="text-[10px] text-forest-500 block">By 11:00 AM</span>
                </div>

                <div className="bg-sand-50 p-3 rounded-2xl border border-sand-200/60">
                  <span className="text-forest-600 block text-[11px]">Duration</span>
                  <span className="font-bold text-forest-950 text-sm">
                    {activeBooking.totalNights} {activeBooking.totalNights === 1 ? 'Night' : 'Nights'}
                  </span>
                  <span className="text-[10px] text-forest-500 block">Mountain Retreat</span>
                </div>

                <div className="bg-sand-50 p-3 rounded-2xl border border-sand-200/60">
                  <span className="text-forest-600 block text-[11px]">Meal Plan</span>
                  <span className="font-bold text-forest-950 text-sm">
                    {activeBooking.mealPlan}
                  </span>
                  <span className="text-[10px] text-forest-500 block">
                    {activeBooking.mealPlan === 'CP' ? 'Bed & Breakfast' : activeBooking.mealPlan === 'MAP' ? 'Half Board' : activeBooking.mealPlan === 'AP' ? 'All Meals' : 'Room Only'}
                  </span>
                </div>
              </div>
            </div>

            {/* High-Speed Wi-Fi Card */}
            <div className="bg-gradient-to-r from-forest-900 to-forest-950 text-white rounded-3xl p-5 sm:p-6 border border-forest-800 shadow-md">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-400/20 text-amber-300 flex items-center justify-center">
                    <Wifi className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-serif font-bold text-base text-white">
                      Complimentary High-Speed Starlink Wi-Fi
                    </h4>
                    <p className="text-xs text-sand-300">
                      Seamless fiber-backed internet across all balconies &amp; orchard lounges.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white/10 p-3.5 rounded-2xl border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-sand-300 uppercase tracking-wider block">Network SSID</span>
                    <span className="font-bold font-mono text-sm text-white">Savera_Guest_HighSpeed</span>
                  </div>
                </div>

                <div className="bg-white/10 p-3.5 rounded-2xl border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-sand-300 uppercase tracking-wider block">Password</span>
                    <span className="font-bold font-mono text-sm text-amber-300">saverahomestay</span>
                  </div>
                  <button
                    onClick={copyWifi}
                    className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-forest-950 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer"
                  >
                    {wifiCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{wifiCopied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Homestay Guidelines & Reception Desk */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-sand-200 space-y-3">
                <div className="flex items-center space-x-2 text-forest-900">
                  <Clock className="w-4 h-4 text-forest-700" />
                  <h4 className="font-bold text-sm">Meal &amp; Property Timings</h4>
                </div>
                <ul className="text-xs space-y-2 text-forest-700">
                  <li className="flex items-center justify-between border-b border-sand-100 pb-1.5">
                    <span>Farmhouse Breakfast:</span>
                    <strong className="font-mono text-forest-900">8:00 AM – 10:30 AM</strong>
                  </li>
                  <li className="flex items-center justify-between border-b border-sand-100 pb-1.5">
                    <span>In-Room Tea &amp; Coffee:</span>
                    <strong className="font-mono text-forest-900">Available 24 Hours</strong>
                  </li>
                  <li className="flex items-center justify-between border-b border-sand-100 pb-1.5">
                    <span>Homestyle Dinner:</span>
                    <strong className="font-mono text-forest-900">8:00 PM – 10:00 PM</strong>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Quiet Mountain Hours:</span>
                    <strong className="font-mono text-forest-900">10:00 PM Onwards</strong>
                  </li>
                </ul>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-sand-200 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-2 text-forest-900 mb-1">
                    <Phone className="w-4 h-4 text-forest-700" />
                    <h4 className="font-bold text-sm">Host &amp; Front Desk Contact</h4>
                  </div>
                  <p className="text-xs text-forest-600">
                    Have any questions, request room amenities, or need travel assistance? Our team is on-site 24/7.
                  </p>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-2">
                  <a
                    href="tel:+919832022233"
                    className="flex-1 px-3 py-2 bg-sand-100 hover:bg-sand-200 text-forest-900 font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call +91 98320 22233</span>
                  </a>
                  <a
                    href="https://wa.me/919832022233"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 px-3 py-2 bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp Host</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: DIGITAL ID VERIFICATION ================= */}
        {activeTab === 'checkin' && (
          <div className="bg-white rounded-3xl p-5 sm:p-7 border border-sand-200 shadow-sm space-y-6 animate-fade-in">
            <div className="flex items-center justify-between border-b border-sand-100 pb-4">
              <div>
                <h3 className="font-serif font-bold text-xl text-forest-950">
                  Digital Check-In &amp; Government ID Upload
                </h3>
                <p className="text-xs text-forest-600 mt-0.5">
                  Mandatory state tourism security compliance. Upload your ID photo or enter your document number.
                </p>
              </div>
              {isDocSubmittedOrVerified && (
                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>ID Registered</span>
                </span>
              )}
            </div>

            {docSuccessMsg && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{docSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmitIdDocuments} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-forest-800 block mb-1">
                    ID Document Type *
                  </label>
                  <select
                    value={idType}
                    onChange={(e) => setIdType(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-sand-50/50 font-medium text-forest-900"
                  >
                    <option value="Aadhaar Card">Aadhaar Card (UIDAI)</option>
                    <option value="Passport & ILP">Passport &amp; Inner Line Permit (ILP)</option>
                    <option value="Driver License">Driver License</option>
                    <option value="Voter ID Card">Voter ID (Election Card)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-forest-800 block mb-1">
                    Document Number
                  </label>
                  <input
                    type="text"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    placeholder="e.g. 5432-8765-1098"
                    className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white font-mono text-forest-950 font-semibold"
                  />
                </div>
              </div>

              {/* Photo Uploads */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Front Side */}
                <div className="border-2 border-dashed border-sand-300 rounded-2xl p-4 text-center bg-sand-50/40">
                  <span className="text-xs font-bold text-forest-900 block mb-2">
                    Front Side Photo / Identity Page
                  </span>
                  {idFrontUrl ? (
                    <div className="space-y-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={idFrontUrl}
                        alt="Front ID Document"
                        className="w-full h-32 object-contain rounded-xl bg-white border border-sand-200"
                      />
                      <button
                        type="button"
                        onClick={() => setIdFrontUrl('')}
                        className="text-[11px] text-rose-600 font-bold hover:underline"
                      >
                        Change Photo
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-4 cursor-pointer hover:bg-sand-100/60 rounded-xl transition-colors">
                      <Camera className="w-7 h-7 text-forest-500 mb-1" />
                      <span className="text-xs font-bold text-forest-900">Take Photo or Upload</span>
                      <span className="text-[10px] text-forest-600">JPG or PNG under 5MB</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, setIdFrontUrl)}
                      />
                    </label>
                  )}
                </div>

                {/* Back Side */}
                <div className="border-2 border-dashed border-sand-300 rounded-2xl p-4 text-center bg-sand-50/40">
                  <span className="text-xs font-bold text-forest-900 block mb-2">
                    Back Side / Address Page (Optional)
                  </span>
                  {idBackUrl ? (
                    <div className="space-y-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={idBackUrl}
                        alt="Back ID Document"
                        className="w-full h-32 object-contain rounded-xl bg-white border border-sand-200"
                      />
                      <button
                        type="button"
                        onClick={() => setIdBackUrl('')}
                        className="text-[11px] text-rose-600 font-bold hover:underline"
                      >
                        Change Photo
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-4 cursor-pointer hover:bg-sand-100/60 rounded-xl transition-colors">
                      <Upload className="w-7 h-7 text-forest-500 mb-1" />
                      <span className="text-xs font-bold text-forest-900">Upload Back Side</span>
                      <span className="text-[10px] text-forest-600">JPG or PNG under 5MB</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, setIdBackUrl)}
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={isSubmittingDoc}
                  className="px-6 py-2.5 bg-forest-900 hover:bg-forest-800 disabled:bg-forest-700 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>{isSubmittingDoc ? 'Submitting...' : 'Save & Register ID Verification'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ================= TAB 3: FOLIO BREAKDOWN & INVOICE ================= */}
        {activeTab === 'billing' && (
          <div className="bg-white rounded-3xl p-5 sm:p-7 border border-sand-200 shadow-sm space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sand-100 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-forest-600">
                  Guest Folio #{activeFolio?.folioNumber || 'FOL-2026-LIVE'}
                </span>
                <h3 className="font-serif font-bold text-xl text-forest-950">
                  Room Billing &amp; Itemized Folio
                </h3>
              </div>
              <button
                onClick={() => setShowInvoicePrint(true)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-forest-950 font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 self-start cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / Download Tax Invoice</span>
              </button>
            </div>

            {/* Charges Table */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-forest-800 uppercase tracking-wider block mb-2">
                Itemized Charges
              </span>

              {activeFolio && activeFolio.charges.length > 0 ? (
                <div className="divide-y divide-sand-100 border border-sand-200 rounded-2xl overflow-hidden">
                  {activeFolio.charges.map((chg) => (
                    <div key={chg.id} className="p-3.5 flex items-center justify-between text-xs hover:bg-sand-50/50">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-forest-900">{chg.title}</span>
                          <span className="text-[9px] px-2 py-0.2 rounded-full uppercase font-mono bg-sand-200 text-forest-700">
                            {chg.category.replace('_', ' ')}
                          </span>
                        </div>
                        {chg.notes && (
                          <p className="text-[11px] text-forest-600 mt-0.5">{chg.notes}</p>
                        )}
                        <span className="text-[10px] text-forest-400 block mt-0.5">
                          Posted: {new Date(chg.postedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      </div>
                      <span className="font-bold font-mono text-sm text-forest-950 ml-4">
                        ₹{chg.amount.toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-sand-50 rounded-2xl border border-sand-200 text-xs text-forest-700 flex items-center justify-between">
                  <div>
                    <span className="font-bold block">Room Stay Tariff: {activeBooking.roomName}</span>
                    <span className="text-[11px] text-forest-500">{activeBooking.totalNights} night(s) @ ₹{activeBooking.roomRatePerNight.toLocaleString('en-IN')}/night</span>
                  </div>
                  <span className="font-bold font-mono text-sm">₹{(activeBooking.totalRoomAmount || 4500).toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>

            {/* Summary Breakdown */}
            <div className="bg-sand-50 p-5 rounded-2xl border border-sand-200 space-y-2 text-xs">
              <div className="flex items-center justify-between text-forest-700">
                <span>Total Subtotal:</span>
                <span className="font-mono font-semibold">₹{effectiveSubtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center justify-between text-forest-700">
                <span>GST (5% Goods &amp; Services Tax):</span>
                <span className="font-mono font-semibold">₹{effectiveTax.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center justify-between text-forest-950 font-bold text-sm pt-2 border-t border-sand-200">
                <span>Net Total Payable:</span>
                <span className="font-mono text-base">₹{effectiveNetPayable.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center justify-between text-emerald-800 font-semibold pt-1">
                <span>Advance Deposit Paid:</span>
                <span className="font-mono">- ₹{effectiveAdvancePaid.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center justify-between text-forest-950 font-bold text-base pt-2 border-t border-forest-800/20">
                <span>Balance Due at Check-Out:</span>
                <span className="font-mono text-amber-700">₹{effectiveBalanceDue.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 4: SPECIAL CELEBRATIONS & EXPERIENCES ================= */}
        {activeTab === 'celebrations' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-gradient-to-r from-forest-900 to-forest-950 text-white p-6 rounded-3xl border border-forest-800 shadow-md">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-amber-400/20 text-amber-300 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-white">
                    Special Mountain Celebrations &amp; Decor
                  </h3>
                  <p className="text-xs text-sand-300">
                    Make your stay unforgettable! Request fresh cakes, romantic dinners, or floral room setups. Billed directly to your room folio.
                  </p>
                </div>
              </div>
            </div>

            {celebrationSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-start space-x-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{celebrationSuccess}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {CELEBRATION_OPTIONS.map((option) => {
                const IconComponent = option.icon;
                return (
                  <div
                    key={option.id}
                    className="bg-white rounded-3xl p-5 border border-sand-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <span className="font-mono font-bold text-lg text-forest-950">
                          ₹{option.price.toLocaleString('en-IN')}
                        </span>
                      </div>

                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full inline-block">
                        {option.badge}
                      </span>

                      <h4 className="font-serif font-bold text-base text-forest-950 leading-tight">
                        {option.title}
                      </h4>

                      <p className="text-xs text-forest-600 leading-relaxed">
                        {option.description}
                      </p>

                      <ul className="text-[11px] text-forest-700 space-y-1 pt-2 border-t border-sand-100">
                        {option.details.map((d, idx) => (
                          <li key={idx} className="flex items-start space-x-1.5">
                            <span className="text-amber-600 font-bold">•</span>
                            <span>{d}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-5 mt-3 border-t border-sand-100">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCelebration(option);
                          setCelebrationNotes('');
                        }}
                        className="w-full min-h-[42px] px-4 py-2 bg-forest-900 hover:bg-forest-800 text-white rounded-xl font-bold text-xs shadow-xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>Book Experience (₹{option.price})</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal / Confirmation Drawer for Celebration Ordering */}
            {selectedCelebration && (
              <div className="fixed inset-0 z-50 bg-forest-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-sand-300 space-y-4">
                  <div className="flex items-center justify-between border-b border-sand-100 pb-3">
                    <div className="flex items-center space-x-2.5">
                      <Sparkles className="w-5 h-5 text-amber-600" />
                      <h4 className="font-serif font-bold text-base text-forest-950">
                        Confirm {selectedCelebration.title}
                      </h4>
                    </div>
                    <button
                      onClick={() => setSelectedCelebration(null)}
                      className="text-forest-400 hover:text-forest-700 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <p className="text-xs text-forest-600">
                    This charge of <strong>₹{selectedCelebration.price.toLocaleString('en-IN')}</strong> will be logged directly to <strong>Room {activeBooking.roomNumber} folio</strong> and reception will be notified via WhatsApp.
                  </p>

                  <div>
                    <label className="text-xs font-bold text-forest-800 block mb-1">
                      Custom Notes / Timing / Message on Cake
                    </label>
                    <textarea
                      rows={3}
                      value={celebrationNotes}
                      onChange={(e) => setCelebrationNotes(e.target.value)}
                      placeholder="e.g. Cake message: Happy 5th Anniversary Priya & Rahul! Preferred timing: 8:30 PM on balcony."
                      className="w-full text-xs p-3 rounded-xl border border-sand-300 bg-sand-50/50 focus:bg-white"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCelebration(null)}
                      className="px-4 py-2 text-xs font-bold text-forest-600 hover:bg-sand-100 rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isOrderingCelebration}
                      onClick={handleConfirmCelebrationOrder}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isOrderingCelebration ? 'Adding to Bill...' : `Confirm & Add ₹${selectedCelebration.price}`}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 5: IN-ROOM DINING (MENU) ================= */}
        {activeTab === 'dining' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white rounded-3xl p-5 border border-sand-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-serif font-bold text-lg text-forest-950">
                  In-Room Mountain Dining
                </h3>
                <p className="text-xs text-forest-600">
                  Organic farm ingredients, Darjeeling first-flush teas, and comfort dishes delivered hot to Room {activeBooking.roomNumber}.
                </p>
              </div>

              {totalCartAmount > 0 && (
                <div className="flex items-center space-x-3 bg-forest-900 text-white px-4 py-2 rounded-2xl shadow-xs">
                  <ShoppingCart className="w-4 h-4 text-amber-300" />
                  <span className="text-xs font-bold">
                    {Object.values(diningCart).reduce((a, b) => a + b, 0)} Items = ₹{totalCartAmount.toLocaleString('en-IN')}
                  </span>
                </div>
              )}
            </div>

            {orderSuccessMsg && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-start space-x-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{orderSuccessMsg}</span>
              </div>
            )}

            {/* Menu Items Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {menuList.slice(0, 18).map((item) => {
                const qty = diningCart[item.id] || 0;
                return (
                  <div
                    key={item.id}
                    className="p-3.5 bg-white rounded-2xl border border-sand-200 shadow-2xs flex flex-col justify-between hover:border-forest-300 transition-colors"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <h4 className="font-bold text-xs text-forest-900 leading-snug">
                          {item.name}
                        </h4>
                        <span className="font-mono font-bold text-xs text-forest-950 shrink-0">
                          ₹{item.price}
                        </span>
                      </div>
                      <span className="text-[10px] text-forest-500 capitalize block">
                        {item.categoryName}
                      </span>
                    </div>

                    <div className="mt-3 pt-2 border-t border-sand-100 flex items-center justify-between">
                      {qty > 0 ? (
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => setDiningCart((prev) => ({ ...prev, [item.id]: Math.max(0, qty - 1) }))}
                            className="w-6 h-6 rounded-lg bg-sand-100 hover:bg-sand-200 text-forest-900 flex items-center justify-center font-bold"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-bold font-mono text-xs text-forest-950">
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => setDiningCart((prev) => ({ ...prev, [item.id]: qty + 1 }))}
                            className="w-6 h-6 rounded-lg bg-sand-100 hover:bg-sand-200 text-forest-900 flex items-center justify-center font-bold"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDiningCart((prev) => ({ ...prev, [item.id]: 1 }))}
                          className="px-3 py-1 bg-sand-100 hover:bg-forest-900 hover:text-white text-forest-900 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Cart Sticky Drawer / Confirmation */}
            {totalCartAmount > 0 && (
              <div className="p-5 bg-white rounded-3xl border border-forest-700 shadow-xl space-y-3">
                <div className="flex items-center justify-between border-b border-sand-100 pb-2">
                  <h4 className="font-serif font-bold text-sm text-forest-950">
                    Your Room Order (Room {activeBooking.roomNumber})
                  </h4>
                  <span className="font-mono font-bold text-base text-forest-950">
                    Total: ₹{totalCartAmount.toLocaleString('en-IN')}
                  </span>
                </div>

                <input
                  type="text"
                  value={cartSpecialNotes}
                  onChange={(e) => setCartSpecialNotes(e.target.value)}
                  placeholder="Special instructions (e.g. Extra spicy, serve at 8:15 PM, sugar on side)"
                  className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-sand-50"
                />

                <div className="flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setDiningCart({})}
                    className="px-3 py-2 text-xs font-bold text-forest-600 hover:bg-sand-100 rounded-xl cursor-pointer"
                  >
                    Clear Cart
                  </button>
                  <button
                    type="button"
                    disabled={isPlacingOrder}
                    onClick={handlePlaceDiningOrder}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isPlacingOrder ? 'Submitting to Kitchen...' : `Place Order (₹${totalCartAmount.toLocaleString('en-IN')})`}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 3. Printable / Downloadable Tax Invoice Modal */}
      {showInvoicePrint && (
        <div className="fixed inset-0 z-50 bg-forest-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white text-forest-950 rounded-3xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 my-6 border border-sand-300">
            {/* Action Bar */}
            <div className="flex items-center justify-between border-b border-sand-200 pb-3 no-print">
              <span className="text-xs font-bold text-forest-600 uppercase tracking-widest">
                Official GST Tax Invoice Preview
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-forest-900 text-white rounded-xl font-bold text-xs flex items-center space-x-1.5 hover:bg-forest-800"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Invoice</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowInvoicePrint(false)}
                  className="w-8 h-8 rounded-xl bg-sand-100 hover:bg-sand-200 text-forest-800 flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Printable Invoice Sheet */}
            <div className="space-y-6">
              <div className="flex items-start justify-between border-b border-sand-200 pb-4">
                <div>
                  <h2 className="font-serif font-bold text-2xl text-forest-950">Savera Homestay</h2>
                  <p className="text-xs text-forest-600 mt-0.5">
                    Upper Echhay Gaon, Kalimpong District, West Bengal - 734301
                  </p>
                  <p className="text-xs text-forest-600">
                    GSTIN: <strong>19AABCS1429E1Z8</strong> • State Code: 19 (WB)
                  </p>
                  <p className="text-xs text-forest-600">
                    Email: reservations@saverahomestay.com • Phone: +91 98320 22233
                  </p>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded-full bg-sand-200 font-mono text-[10px] uppercase font-bold text-forest-800">
                    Tax Invoice
                  </span>
                  <p className="font-mono font-bold text-sm text-forest-950 mt-1">
                    {activeFolio?.folioNumber || `SAV-2026-${activeBooking.roomNumber}01`}
                  </p>
                  <p className="text-xs text-forest-600">
                    Date: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>

              {/* Guest & Room Details */}
              <div className="grid grid-cols-2 gap-4 bg-sand-50 p-4 rounded-2xl text-xs">
                <div>
                  <span className="text-[10px] text-forest-500 uppercase tracking-wider block">Billed To (Guest)</span>
                  <span className="font-bold text-forest-900 text-sm block">{activeBooking.guest?.fullName}</span>
                  <span className="text-forest-600 font-mono">{activeBooking.guest?.phone}</span>
                  {activeBooking.guest?.city && <span className="block text-forest-600">{activeBooking.guest.city}</span>}
                </div>
                <div>
                  <span className="text-[10px] text-forest-500 uppercase tracking-wider block">Stay Particulars</span>
                  <span className="font-bold text-forest-900 block">Room {activeBooking.roomNumber} ({activeBooking.roomName})</span>
                  <span className="text-forest-600 font-mono">
                    {activeBooking.checkInDate} to {activeBooking.checkOutDate} ({activeBooking.totalNights} Nights)
                  </span>
                  <span className="block text-forest-600 font-medium">Meal Plan: {activeBooking.mealPlan}</span>
                </div>
              </div>

              {/* Line Items */}
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-sand-300 text-forest-700 text-left">
                    <th className="py-2">Description</th>
                    <th className="py-2 text-right">SAC/HSN</th>
                    <th className="py-2 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-100">
                  {activeFolio && activeFolio.charges.length > 0 ? (
                    activeFolio.charges.map((c) => (
                      <tr key={c.id}>
                        <td className="py-2.5 pr-2">
                          <span className="font-semibold block text-forest-900">{c.title}</span>
                          {c.notes && <span className="text-[10px] text-forest-500">{c.notes}</span>}
                        </td>
                        <td className="py-2.5 text-right font-mono text-forest-600">
                          {c.category === 'room_tariff' ? '996311' : c.category === 'food_beverage' ? '996331' : '999799'}
                        </td>
                        <td className="py-2.5 text-right font-mono font-bold text-forest-950">
                          {c.amount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="py-2.5">Room Stay Tariff ({activeBooking.totalNights} nights)</td>
                      <td className="py-2.5 text-right font-mono">996311</td>
                      <td className="py-2.5 text-right font-mono font-bold">{(activeBooking.totalRoomAmount || 4500).toLocaleString('en-IN')}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Total Calculation */}
              <div className="border-t border-sand-300 pt-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-forest-700">
                  <span>Subtotal Amount:</span>
                  <span className="font-mono font-bold">₹{effectiveSubtotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-forest-700">
                  <span>CGST (2.5%):</span>
                  <span className="font-mono">₹{(effectiveTax / 2).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-forest-700">
                  <span>SGST (2.5%):</span>
                  <span className="font-mono">₹{(effectiveTax / 2).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-forest-950 pt-2 border-t border-sand-200">
                  <span>Total Invoice Amount:</span>
                  <span className="font-mono text-base">₹{effectiveNetPayable.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-emerald-800 font-semibold">
                  <span>Less Advance Paid:</span>
                  <span className="font-mono">- ₹{effectiveAdvancePaid.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-forest-950 pt-1 border-t border-sand-300">
                  <span>Net Balance Due:</span>
                  <span className="font-mono text-amber-800">₹{effectiveBalanceDue.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-sand-200 text-center text-[10px] text-forest-500 space-y-1">
                <p>This is a computer-generated tax invoice for hospitality services provided by Savera Homestay.</p>
                <p>Thank you for choosing to stay amidst the serene Himalayas with us!</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GuestPortalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-forest-800 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <PortalContent />
    </Suspense>
  );
}
