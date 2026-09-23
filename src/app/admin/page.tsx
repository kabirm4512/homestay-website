'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Trees,
  LayoutDashboard,
  CalendarDays,
  Truck,
  ChefHat,
  Receipt,
  BedDouble,
  MessageSquareText,
  Sliders,
  ExternalLink,
  LogOut,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Users,
  UtensilsCrossed,
  Plus,
  Sparkles,
  ClipboardList,
  Wrench,
  Settings,
} from 'lucide-react';

import AdminAuth from '@/components/admin/AdminAuth';
import AdminOverview from '@/components/admin/AdminOverview';
import AdminRooms from '@/components/admin/AdminRooms';
import AdminBookings from '@/components/admin/AdminBookings';
import AdminInquiries from '@/components/admin/AdminInquiries';
import AdminCMS from '@/components/admin/AdminCMS';
import AdminAddonsCMS from '@/components/admin/AdminAddonsCMS';
import AdminStaffManagement from '@/components/admin/AdminStaffManagement';

// Boutique CRM & Concierge Modules
import TapeChart from '@/components/crm/TapeChart';
import MasterBookingsList from '@/components/crm/MasterBookingsList';
import OperationsHub from '@/components/crm/OperationsHub';
import KitchenPortal from '@/components/crm/KitchenPortal';
import FinancialLedger from '@/components/crm/FinancialLedger';
import RoleSwitcher from '@/components/crm/RoleSwitcher';
import PWAInstaller from '@/components/pwa/PWAInstaller';
import BottomNav from '@/components/pwa/BottomNav';
import InRoomQRHub from '@/components/qr/InRoomQRHub';
import ManualBookingModal from '@/components/crm/ManualBookingModal';
import QuickExpenseModal from '@/components/crm/QuickExpenseModal';
import StaffOrderFlash from '@/components/crm/StaffOrderFlash';
import { useCRM } from '@/context/CRMContext';

import { Room, Inquiry, Booking, HeroSlide, AboutSectionData, SiteInfo, Review } from '@/types';
import {
  INITIAL_ROOMS,
  INITIAL_HERO_SLIDES,
  INITIAL_ABOUT_DATA,
  INITIAL_SITE_INFO,
  INITIAL_REVIEWS,
  INITIAL_INQUIRIES,
  INITIAL_BOOKINGS,
} from '@/lib/mock-data';

type PrimaryWorkspace = 'front_desk' | 'orders_concierge' | 'operations' | 'ledger' | 'settings';

export default function AdminPage() {
  const { role, currentUser, setCurrentUser, dispatchRequests, foodOrders } = useCRM();

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [adminUser, setAdminUser] = useState<{ name: string; role: string }>({
    name: 'Estate Manager',
    role: 'admin',
  });

  // Check auth session on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('savera_admin_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
          localStorage.removeItem('savera_admin_session');
          setIsAuthenticated(false);
        } else {
          setAdminUser({
            name: parsed.fullName || parsed.name || 'Staff User',
            role: parsed.role || 'admin',
          });
          setCurrentUser(parsed);
          setIsAuthenticated(true);
        }
      } else {
        // Fallback: check wp_crm_current_user or homestay_admin_user
        const fallbackRaw = localStorage.getItem('wp_crm_current_user') || localStorage.getItem('homestay_admin_user');
        if (fallbackRaw) {
          const parsed = JSON.parse(fallbackRaw);
          if (parsed && (parsed.fullName || parsed.name) && parsed.id !== 'staff-2' && parsed.id !== 'staff-3') {
            setAdminUser({
              name: parsed.fullName || parsed.name || 'Staff User',
              role: parsed.role || 'admin',
            });
            setCurrentUser(parsed);
            setIsAuthenticated(true);
            const sessionData = {
              ...parsed,
              expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
            };
            localStorage.setItem('savera_admin_session', JSON.stringify(sessionData));
            return;
          }
        }
        setIsAuthenticated(false);
      }
    } catch {
      setIsAuthenticated(false);
    } finally {
      setAuthChecking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Primary Workspace state with persistence
  const [workspace, setWorkspace] = useState<PrimaryWorkspace>(() => {
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const tabParam = urlParams.get('tab') || localStorage.getItem('wp_admin_workspace');
        if (tabParam) {
          if (['front_desk', 'tape_chart'].includes(tabParam)) return 'front_desk';
          if (['orders_concierge', 'kitchen', 'dispatch'].includes(tabParam)) return 'orders_concierge';
          if (['operations', 'dashboard', 'tasks'].includes(tabParam)) return 'operations';
          if (['ledger', 'staff'].includes(tabParam)) return 'ledger';
          if (['settings', 'rooms', 'addons', 'cms', 'inquiries', 'overview'].includes(tabParam)) return 'settings';
        }
      } catch {}
    }
    return 'front_desk';
  });

  // Active Subtab inside workspace
  const [activeSubtab, setActiveSubtab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const sub = urlParams.get('subtab') || urlParams.get('tab') || localStorage.getItem('wp_admin_subtab');
        if (sub) return sub;
      } catch {}
    }
    return 'default';
  });

  // Switch Workspace & update URL/storage
  const handleSelectWorkspace = useCallback((ws: PrimaryWorkspace, sub?: string) => {
    setWorkspace(ws);
    const defaultSub = sub || (
      ws === 'front_desk' ? 'tape_chart' :
      ws === 'orders_concierge' ? 'kitchen' :
      ws === 'operations' ? 'tasks' :
      ws === 'ledger' ? 'ledger' :
      'rooms'
    );
    setActiveSubtab(defaultSub);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('wp_admin_workspace', ws);
        localStorage.setItem('wp_admin_subtab', defaultSub);
        const url = new URL(window.location.href);
        url.searchParams.set('tab', ws);
        url.searchParams.set('subtab', defaultSub);
        window.history.replaceState({}, '', url.toString());
      } catch {}
    }
  }, []);

  // Quick Action Modal states
  const [isManualCheckInOpen, setIsManualCheckInOpen] = useState<boolean>(false);
  const [isQuickExpenseOpen, setIsQuickExpenseOpen] = useState<boolean>(false);
  const [showQRHubModal, setShowQRHubModal] = useState<boolean>(false);
  const [isAddRoomOpen, setIsAddRoomOpen] = useState<boolean>(false);

  // Website CMS states with Local-First persistence
  const [rooms, setRooms] = useState<Room[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('wp_site_rooms');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return INITIAL_ROOMS;
  });

  const [inquiries, setInquiries] = useState<Inquiry[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('homestay_inquiries');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}
    }
    return INITIAL_INQUIRIES;
  });

  const [bookings, setBookings] = useState<Booking[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('homestay_bookings');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}
    }
    return INITIAL_BOOKINGS;
  });

  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('wp_site_cms');
        if (saved) {
          const parsed = JSON.parse(saved);
          const hasStaleUnsplash = Array.isArray(parsed.heroSlides) && parsed.heroSlides.some((s: HeroSlide) => s.image?.includes('images.unsplash.com'));
          if (Array.isArray(parsed.heroSlides) && parsed.heroSlides.length > 0 && !hasStaleUnsplash) return parsed.heroSlides;
        }
      } catch {}
    }
    return INITIAL_HERO_SLIDES;
  });

  const [aboutData, setAboutData] = useState<AboutSectionData>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('wp_site_cms');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.aboutData?.headline) return parsed.aboutData;
        }
      } catch {}
    }
    return INITIAL_ABOUT_DATA;
  });

  const [siteInfo, setSiteInfo] = useState<SiteInfo>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('wp_site_cms');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.siteInfo?.name) return parsed.siteInfo;
        }
      } catch {}
    }
    return INITIAL_SITE_INFO;
  });

  const [reviews, setReviews] = useState<Review[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('wp_site_cms');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed.reviews) && parsed.reviews.length > 0) return parsed.reviews;
        }
      } catch {}
    }
    return INITIAL_REVIEWS;
  });

  // Synchronous optimistic updates
  const handleUpdateRooms = useCallback((updatedRooms: Room[]) => {
    setRooms(updatedRooms);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('wp_site_rooms', JSON.stringify(updatedRooms));
      } catch {}
    }
  }, []);

  const handleUpdateCMS = useCallback((data: {
    heroSlides?: HeroSlide[];
    aboutData?: AboutSectionData;
    siteInfo?: SiteInfo;
    reviews?: Review[];
  }) => {
    if (data.heroSlides) setHeroSlides(data.heroSlides);
    if (data.aboutData) setAboutData(data.aboutData);
    if (data.siteInfo) setSiteInfo(data.siteInfo);
    if (data.reviews) setReviews(data.reviews);

    if (typeof window !== 'undefined') {
      try {
        const existingRaw = localStorage.getItem('wp_site_cms');
        const existing = existingRaw ? JSON.parse(existingRaw) : {};
        const merged = {
          heroSlides: data.heroSlides || existing.heroSlides || INITIAL_HERO_SLIDES,
          aboutData: data.aboutData || existing.aboutData || INITIAL_ABOUT_DATA,
          siteInfo: data.siteInfo || existing.siteInfo || INITIAL_SITE_INFO,
          reviews: data.reviews || existing.reviews || INITIAL_REVIEWS,
        };
        localStorage.setItem('wp_site_cms', JSON.stringify(merged));
      } catch {}
    }
  }, []);

  // Toast feedback
  const [localToast, setLocalToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setLocalToast({ message, type });
    setTimeout(() => setLocalToast(null), 4000);
  }, []);

  // Auto-switch for kitchen role
  useEffect(() => {
    if (role === 'kitchen_staff') {
      handleSelectWorkspace('orders_concierge', 'kitchen');
    }
  }, [role, handleSelectWorkspace]);

  // Fetch live homestay data
  const fetchData = useCallback(async () => {
    try {
      const [roomsRes, inqRes, bkRes, cmsRes] = await Promise.all([
        fetch('/api/rooms').then((r) => r.json()).catch(() => null),
        fetch('/api/inquiries').then((r) => r.json()).catch(() => null),
        fetch('/api/bookings').then((r) => r.json()).catch(() => null),
        fetch('/api/cms').then((r) => r.json()).catch(() => null),
      ]);

      if (roomsRes?.success && Array.isArray(roomsRes.data) && roomsRes.data.length > 0) {
        setRooms(roomsRes.data);
        localStorage.setItem('wp_site_rooms', JSON.stringify(roomsRes.data));
      }
      if (inqRes?.success && Array.isArray(inqRes.data)) {
        setInquiries(inqRes.data);
        localStorage.setItem('homestay_inquiries', JSON.stringify(inqRes.data));
      }
      if (bkRes?.success && Array.isArray(bkRes.data)) {
        setBookings(bkRes.data);
        localStorage.setItem('homestay_bookings', JSON.stringify(bkRes.data));
      }
      if (cmsRes?.success && cmsRes.data) {
        const { heroSlides: hs, aboutData: ab, siteInfo: si, reviews: rev } = cmsRes.data;
        if (Array.isArray(hs) && hs.length > 0) setHeroSlides(hs);
        if (ab?.headline) setAboutData(ab);
        if (si?.name) setSiteInfo(si);
        if (Array.isArray(rev) && rev.length > 0) setReviews(rev);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated, fetchData]);

  const handleAuthenticated = (token: string, user: { name: string; role: string; [key: string]: any }) => {
    const sessionData = {
      ...user,
      token,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };
    try {
      localStorage.setItem('savera_admin_session', JSON.stringify(sessionData));
      localStorage.setItem('homestay_admin_token', token);
      localStorage.setItem('homestay_admin_user', JSON.stringify(user));
      localStorage.setItem('wp_crm_current_user', JSON.stringify(user));
      localStorage.setItem('wp_crm_role', user.role || 'admin');
    } catch {}
    setAdminUser(user);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('savera_admin_session');
      localStorage.removeItem('homestay_admin_token');
      localStorage.removeItem('homestay_admin_user');
      localStorage.removeItem('wp_crm_current_user');
      localStorage.removeItem('wp_crm_role');
      sessionStorage.removeItem('homestay_admin_token');
    } catch {}
    setCurrentUser(null);
    setIsAuthenticated(false);
    showToast('Signed out of staff portal.');
  };

  const handleRefresh = () => {
    fetchData();
    showToast('Homestay data reloaded.');
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-sand-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-3 border-forest-700 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-forest-800 font-medium">Verifying credentials...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminAuth onAuthenticated={handleAuthenticated} />;
  }

  const pendingDispatchCount = dispatchRequests.filter((d) => d.dispatchStatus === 'pending_confirmation').length;
  const pendingKitchenCount = foodOrders.filter((o) => o.status === 'pending').length;
  const totalOrdersBadge = pendingKitchenCount + pendingDispatchCount;

  return (
    <div className="min-h-screen bg-[#F3F7FF] text-[#0B1733] flex flex-col font-sans pb-16 md:pb-6">
      {/* ================= 1. GLOBAL ADMIN TOP NAVBAR ================= */}
      <header className="sticky top-0 z-40 bg-[#0B1733] text-white border-b border-[#1E2D4A] shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-3 shrink-0">
            <Link href="/" className="flex items-center space-x-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-[#25479E] border border-[#3B62C7] flex items-center justify-center group-hover:bg-[#1A3478] transition-colors shadow-sm">
                <Trees className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <span
                  className="font-bold text-base block leading-tight tracking-tight text-white"
                  style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                >
                  Savera Homestay
                </span>
                <span className="text-[10px] uppercase tracking-widest text-primary-200 font-semibold flex items-center space-x-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>Boutique CRM &amp; Concierge</span>
                </span>
              </div>
            </Link>
          </div>

          {/* Header Quick Actions (+ Manual Check-In, + Quick Expense) & Staff Tools */}
          <div className="flex items-center space-x-2 sm:space-x-2.5 overflow-x-auto no-scrollbar py-1">
            {/* Quick Action 1: + Manual Check-In */}
            <button
              onClick={() => setIsManualCheckInOpen(true)}
              className="min-h-[38px] flex items-center space-x-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-95 px-3 py-1.5 rounded-xl border border-emerald-400/40 transition-all shadow-sm cursor-pointer shrink-0"
              title="Initiate manual check-in, assign room & generate guest portal link"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-200 stroke-[3]" />
              <span>Manual Check-In</span>
            </button>

            {/* Quick Action 2: + Quick Expense in Wizz Orange */}
            <button
              onClick={() => setIsQuickExpenseOpen(true)}
              className="min-h-[38px] flex items-center space-x-1.5 text-xs font-bold text-white bg-gradient-to-r from-[#FE6E00] to-[#EA580C] hover:from-[#EA580C] hover:to-[#C2410C] active:scale-95 px-3 py-1.5 rounded-xl shadow-[0_2px_8px_rgba(254,110,0,0.3)] transition-all cursor-pointer shrink-0"
              title="1-tap fast manager expense logger"
            >
              <Receipt className="w-3.5 h-3.5 text-white" />
              <span>Quick Expense</span>
            </button>

            {/* Dine-In QR Standees Generator */}
            <button
              onClick={() => setShowQRHubModal(true)}
              className="min-h-[38px] hidden md:flex items-center space-x-1.5 text-xs font-semibold text-gray-200 hover:text-white bg-[#182C58] hover:bg-[#25479E] px-2.5 py-1.5 rounded-xl border border-[#25479E]/40 transition-colors shrink-0 cursor-pointer"
              title="In-Room Dine-In QR Standees"
            >
              <QrCode className="w-3.5 h-3.5 text-amber-400" />
              <span>QRs</span>
            </button>

            {/* Fast Role Switcher */}
            <RoleSwitcher />

            {/* PWA Install Button */}
            <PWAInstaller variant="button" />

            {/* Logged-in Staff Badge */}
            <div className="hidden lg:flex items-center space-x-2 bg-[#182C58] px-2.5 py-1 rounded-xl border border-[#25479E]/40 shrink-0">
              <div className="w-6 h-6 rounded-lg bg-[#FE6E00] text-white font-bold text-[10px] flex items-center justify-center uppercase">
                {(currentUser?.fullName || adminUser.name).charAt(0)}
              </div>
              <div className="text-left">
                <span className="text-[11px] font-bold text-white block leading-none truncate max-w-[110px]">
                  {currentUser?.fullName || adminUser.name}
                </span>
                <span className="text-[9px] text-amber-300 uppercase tracking-wider font-semibold capitalize">
                  {(currentUser?.role || role).replace('_', ' ')}
                </span>
              </div>
            </div>

            <div className="h-5 w-px bg-white/20 hidden sm:block shrink-0" />

            {/* Refresh Data */}
            <button
              onClick={handleRefresh}
              className="min-h-[38px] p-2 text-gray-300 hover:text-white rounded-xl hover:bg-[#182C58] transition-colors flex items-center justify-center cursor-pointer shrink-0"
              title="Refresh Homestay Live Data"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            {/* View Live Website */}
            <Link
              href="/"
              target="_blank"
              className="min-h-[38px] px-2.5 py-1.5 text-xs font-semibold text-gray-200 hover:text-white rounded-xl hover:bg-[#182C58] transition-colors hidden sm:flex items-center space-x-1.5 shrink-0"
              title="View Public Website"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#FE6E00]" />
              <span>Site</span>
            </Link>

            {/* Sign Out */}
            <button
              onClick={handleLogout}
              className="min-h-[38px] px-2.5 py-1.5 text-xs font-semibold text-rose-300 hover:text-white rounded-xl hover:bg-rose-950/50 border border-rose-800/60 transition-colors flex items-center space-x-1 cursor-pointer shrink-0"
              title="Sign out of staff portal"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
            </button>
          </div>
        </div>

        {/* ================= 2. REDESIGNED 5 LUXURY WORKSPACES BAR ================= */}
        <div className="bg-[#070F22] border-t border-[#1E2D4A] px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto py-2 no-scrollbar">
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* Workspace 1: Front Desk (Tape Chart) */}
              <button
                onClick={() => handleSelectWorkspace('front_desk', 'tape_chart')}
                className={`min-h-[40px] flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  workspace === 'front_desk'
                    ? 'bg-gradient-to-r from-[#FE6E00] to-[#EA580C] text-white shadow-md'
                    : 'text-gray-300 hover:text-white hover:bg-[#182C58]'
                }`}
              >
                <CalendarDays className="w-4 h-4" />
                <span>Front Desk (7 Rooms)</span>
              </button>

              {/* Workspace 2: Orders & Concierge */}
              <button
                onClick={() => handleSelectWorkspace('orders_concierge', 'kitchen')}
                className={`min-h-[40px] flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  workspace === 'orders_concierge'
                    ? 'bg-gradient-to-r from-[#FE6E00] to-[#EA580C] text-white shadow-md'
                    : 'text-gray-300 hover:text-white hover:bg-[#182C58]'
                }`}
              >
                <UtensilsCrossed className="w-4 h-4" />
                <span>Orders &amp; Concierge</span>
                {totalOrdersBadge > 0 && (
                  <span className="text-[10px] bg-rose-600 text-white font-bold px-1.5 py-0.2 rounded-full">
                    {totalOrdersBadge}
                  </span>
                )}
              </button>

              {/* Workspace 3: Ops & Expenses */}
              <button
                onClick={() => handleSelectWorkspace('operations', 'tasks')}
                className={`min-h-[40px] flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  workspace === 'operations'
                    ? 'bg-gradient-to-r from-[#FE6E00] to-[#EA580C] text-white shadow-md'
                    : 'text-gray-300 hover:text-white hover:bg-[#182C58]'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Ops &amp; Expenses</span>
              </button>

              {/* Workspace 4: Financial Ledger & Staff */}
              <button
                onClick={() => handleSelectWorkspace('ledger', 'ledger')}
                className={`min-h-[40px] flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  workspace === 'ledger'
                    ? 'bg-gradient-to-r from-[#FE6E00] to-[#EA580C] text-white shadow-md'
                    : 'text-gray-300 hover:text-white hover:bg-[#182C58]'
                }`}
              >
                <Receipt className="w-4 h-4" />
                <span>Ledger &amp; Staff</span>
                {role !== 'admin' && (
                  <span className="text-[9px] bg-rose-900/60 text-rose-300 font-mono px-1 rounded">
                    Admin
                  </span>
                )}
              </button>

              {/* Workspace 5: Website Settings & CMS */}
              <button
                onClick={() => handleSelectWorkspace('settings', 'rooms')}
                className={`min-h-[40px] flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  workspace === 'settings'
                    ? 'bg-gradient-to-r from-[#FE6E00] to-[#EA580C] text-white shadow-md'
                    : 'text-gray-300 hover:text-white hover:bg-[#182C58]'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Website Settings</span>
              </button>
            </div>
          </div>
        </div>

        {/* Secondary Subtab Bar for Active Workspace */}
        {workspace === 'front_desk' && (
          <div className="bg-[#0B1733] border-t border-[#1E2D4A] px-4 sm:px-6 lg:px-8 py-2">
            <div className="max-w-7xl mx-auto flex items-center space-x-2 text-xs font-bold">
              <span className="text-gray-400 text-[11px] uppercase tracking-wider mr-2 hidden sm:inline">View:</span>
              <button
                onClick={() => {
                  setActiveSubtab('tape_chart');
                  if (typeof window !== 'undefined') {
                    try {
                      localStorage.setItem('wp_admin_subtab', 'tape_chart');
                    } catch {}
                  }
                }}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeSubtab !== 'bookings_list' ? 'bg-[#25479E] text-white font-bold shadow-xs' : 'text-gray-300 hover:bg-[#182C58] hover:text-white'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Tape Chart (Grid View)</span>
              </button>
              <button
                onClick={() => {
                  setActiveSubtab('bookings_list');
                  if (typeof window !== 'undefined') {
                    try {
                      localStorage.setItem('wp_admin_subtab', 'bookings_list');
                    } catch {}
                  }
                }}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeSubtab === 'bookings_list' ? 'bg-[#25479E] text-white font-bold shadow-xs' : 'text-gray-300 hover:bg-[#182C58] hover:text-white'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5 text-amber-300" />
                <span>Master Bookings &amp; Folios List</span>
              </button>
            </div>
          </div>
        )}

        {workspace === 'orders_concierge' && (
          <div className="bg-[#0B1733] border-t border-[#1E2D4A] px-4 sm:px-6 lg:px-8 py-2">
            <div className="max-w-7xl mx-auto flex items-center space-x-2 text-xs font-bold">
              <span className="text-gray-400 text-[11px] uppercase tracking-wider mr-2 hidden sm:inline">Module:</span>
              <button
                onClick={() => setActiveSubtab('kitchen')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeSubtab === 'kitchen' ? 'bg-[#25479E] text-white font-bold shadow-xs' : 'text-gray-300 hover:bg-[#182C58] hover:text-white'
                }`}
              >
                <ChefHat className="w-3.5 h-3.5" />
                <span>Kitchen KDS &amp; Mandates</span>
                {pendingKitchenCount > 0 && (
                  <span className="bg-rose-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                    {pendingKitchenCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveSubtab('dispatch')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeSubtab === 'dispatch' ? 'bg-[#25479E] text-white font-bold shadow-xs' : 'text-gray-300 hover:bg-[#182C58] hover:text-white'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Transfers &amp; Rentals Dispatch</span>
                {pendingDispatchCount > 0 && (
                  <span className="bg-[#FE6E00] text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold">
                    {pendingDispatchCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveSubtab('orders')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeSubtab === 'orders' ? 'bg-[#25479E] text-white font-bold shadow-xs' : 'text-gray-300 hover:bg-[#182C58] hover:text-white'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Orders Log</span>
              </button>
            </div>
          </div>
        )}

        {workspace === 'operations' && (
          <div className="bg-[#0B1733] border-t border-[#1E2D4A] px-4 sm:px-6 lg:px-8 py-2">
            <div className="max-w-7xl mx-auto flex items-center space-x-2 text-xs font-bold">
              <span className="text-gray-400 text-[11px] uppercase tracking-wider mr-2 hidden sm:inline">Module:</span>
              <button
                onClick={() => setActiveSubtab('tasks')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeSubtab === 'tasks' ? 'bg-[#25479E] text-white font-bold shadow-xs' : 'text-gray-300 hover:bg-[#182C58] hover:text-white'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Daily Housekeeping &amp; Property Tasks</span>
              </button>
              <button
                onClick={() => setActiveSubtab('expenses')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeSubtab === 'expenses' ? 'bg-[#25479E] text-white font-bold shadow-xs' : 'text-gray-300 hover:bg-[#182C58] hover:text-white'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Manager Expense Records</span>
              </button>
            </div>
          </div>
        )}

        {workspace === 'ledger' && (
          <div className="bg-[#0B1733] border-t border-[#1E2D4A] px-4 sm:px-6 lg:px-8 py-2">
            <div className="max-w-7xl mx-auto flex items-center space-x-2 text-xs font-bold">
              <span className="text-gray-400 text-[11px] uppercase tracking-wider mr-2 hidden sm:inline">Module:</span>
              <button
                onClick={() => setActiveSubtab('ledger')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeSubtab === 'ledger' ? 'bg-[#25479E] text-white font-bold shadow-xs' : 'text-gray-300 hover:bg-[#182C58] hover:text-white'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Financial Ledger &amp; P&amp;L</span>
              </button>
              <button
                onClick={() => setActiveSubtab('staff')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeSubtab === 'staff' ? 'bg-[#25479E] text-white font-bold shadow-xs' : 'text-gray-300 hover:bg-[#182C58] hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Staff Accounts &amp; Permissions</span>
              </button>
            </div>
          </div>
        )}

        {workspace === 'settings' && (
          <div className="bg-[#0B1733] border-t border-[#1E2D4A] px-4 sm:px-6 lg:px-8 py-2 overflow-x-auto no-scrollbar">
            <div className="max-w-7xl mx-auto flex items-center space-x-2 text-xs font-bold">
              <span className="text-gray-400 text-[11px] uppercase tracking-wider mr-2 hidden sm:inline">Settings:</span>
              <button
                onClick={() => setActiveSubtab('rooms')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeSubtab === 'rooms' ? 'bg-[#25479E] text-white font-bold shadow-xs' : 'text-gray-300 hover:bg-[#182C58] hover:text-white'
                }`}
              >
                <BedDouble className="w-3.5 h-3.5" />
                <span>Site Rooms &amp; Tariffs</span>
              </button>
              <button
                onClick={() => setActiveSubtab('addons')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeSubtab === 'addons' ? 'bg-[#25479E] text-white font-bold shadow-xs' : 'text-gray-300 hover:bg-[#182C58] hover:text-white'
                }`}
              >
                <UtensilsCrossed className="w-3.5 h-3.5" />
                <span>Dine-In Menu &amp; Add-ons</span>
              </button>
              <button
                onClick={() => setActiveSubtab('cms')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeSubtab === 'cms' ? 'bg-[#25479E] text-white font-bold shadow-xs' : 'text-gray-300 hover:bg-[#182C58] hover:text-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>CMS &amp; Reviews</span>
              </button>
              <button
                onClick={() => setActiveSubtab('inquiries')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeSubtab === 'inquiries' ? 'bg-[#25479E] text-white font-bold shadow-xs' : 'text-gray-300 hover:bg-[#182C58] hover:text-white'
                }`}
              >
                <MessageSquareText className="w-3.5 h-3.5" />
                <span>Web Inquiries</span>
              </button>
              <button
                onClick={() => setActiveSubtab('overview')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeSubtab === 'overview' ? 'bg-[#25479E] text-white font-bold shadow-xs' : 'text-gray-300 hover:bg-[#182C58] hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Overview Analytics</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ================= 3. MAIN WORKSPACE VIEW ================= */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Workspace 1: Front Desk (Tape Chart or Master Bookings List) */}
        {workspace === 'front_desk' && (
          <>
            {activeSubtab === 'bookings_list' ? (
              <MasterBookingsList onOpenManualBooking={() => setIsManualCheckInOpen(true)} />
            ) : (
              <TapeChart />
            )}
          </>
        )}

        {/* Workspace 2: Orders & Concierge */}
        {workspace === 'orders_concierge' && (
          <>
            {activeSubtab === 'kitchen' && <KitchenPortal initialTab="orders" />}
            {activeSubtab === 'dispatch' && <OperationsHub />}
            {activeSubtab === 'orders' && <KitchenPortal initialTab="orders" />}
          </>
        )}

        {/* Workspace 3: Ops & Expenses */}
        {workspace === 'operations' && (
          <>
            {activeSubtab === 'tasks' && <OperationsHub />}
            {activeSubtab === 'expenses' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-sand-200">
                  <div>
                    <h3 className="font-serif font-bold text-lg text-forest-950">Manager Expenses</h3>
                    <p className="text-xs text-forest-600">Quickly record daily homestay expenses or review financial ledger.</p>
                  </div>
                  <button
                    onClick={() => setIsQuickExpenseOpen(true)}
                    className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-forest-950 font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Log New Expense</span>
                  </button>
                </div>
                <FinancialLedger />
              </div>
            )}
          </>
        )}

        {/* Workspace 4: Ledger & Staff (RBAC Guarded) */}
        {workspace === 'ledger' && (
          role === 'admin' ? (
            <>
              {activeSubtab === 'ledger' && <FinancialLedger />}
              {activeSubtab === 'staff' && <AdminStaffManagement />}
            </>
          ) : (
            <div className="bg-white rounded-3xl p-8 border border-sand-200 text-center max-w-md mx-auto my-12 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-800 flex items-center justify-center mx-auto mb-3">
                <Receipt className="w-6 h-6" />
              </div>
              <h3 className="font-serif font-bold text-lg text-forest-950 mb-1">Financial Ledger Restricted</h3>
              <p className="text-xs text-forest-700/80 mb-4">
                Financial Ledger, P&amp;L reports, expense records, and revenue analytics are strictly confidential and restricted to Administrator accounts.
              </p>
              <button
                onClick={() => handleSelectWorkspace('front_desk')}
                className="px-4 py-2 bg-forest-900 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-forest-800 transition-colors cursor-pointer"
              >
                Return to Front Desk
              </button>
            </div>
          )
        )}

        {/* Workspace 5: Website Settings & CMS */}
        {workspace === 'settings' && (
          <>
            {activeSubtab === 'rooms' && (
              <AdminRooms
                rooms={rooms}
                onUpdateRooms={handleUpdateRooms}
                onRefresh={fetchData}
                showToast={showToast}
                isAddModalOpen={isAddRoomOpen}
                onCloseAddModal={() => setIsAddRoomOpen(false)}
              />
            )}
            {activeSubtab === 'addons' && <AdminAddonsCMS />}
            {activeSubtab === 'cms' && (
              <AdminCMS
                heroSlides={heroSlides}
                aboutData={aboutData}
                siteInfo={siteInfo}
                reviews={reviews}
                onUpdateCMS={handleUpdateCMS}
                onRefresh={fetchData}
                showToast={showToast}
              />
            )}
            {activeSubtab === 'inquiries' && (
              <AdminInquiries
                inquiries={inquiries}
                onRefresh={fetchData}
                showToast={showToast}
              />
            )}
            {activeSubtab === 'overview' && (
              <AdminOverview
                rooms={rooms}
                inquiries={inquiries}
                bookings={bookings}
                onNavigateTab={(tab) => {
                  if (['rooms', 'addons', 'cms', 'inquiries'].includes(tab)) {
                    setActiveSubtab(tab);
                  } else {
                    handleSelectWorkspace(tab as PrimaryWorkspace);
                  }
                }}
                onOpenAddRoom={() => {
                  setActiveSubtab('rooms');
                  setIsAddRoomOpen(true);
                }}
              />
            )}
          </>
        )}
      </main>

      {/* ================= 4. REAL-TIME STAFF ORDER FLASH CARD ================= */}
      <StaffOrderFlash
        onViewOrders={() => {
          handleSelectWorkspace('orders_concierge', 'kitchen');
        }}
      />

      {/* ================= 5. QUICK ACTION MODALS ================= */}
      {/* Manual Check-In Modal */}
      {isManualCheckInOpen && (
        <ManualBookingModal
          isOpen={isManualCheckInOpen}
          onClose={() => setIsManualCheckInOpen(false)}
          onBookingCreated={() => {
            fetchData();
            showToast('New reservation created & assigned successfully!');
          }}
        />
      )}

      {/* Quick Manager Expense Logger Modal */}
      {isQuickExpenseOpen && (
        <QuickExpenseModal
          isOpen={isQuickExpenseOpen}
          onClose={() => setIsQuickExpenseOpen(false)}
          defaultManagerName={currentUser?.fullName || adminUser.name}
        />
      )}

      {/* In-Room Dine-In QR Standee Hub Modal */}
      {showQRHubModal && (
        <InRoomQRHub isOpen={showQRHubModal} onClose={() => setShowQRHubModal(false)} />
      )}

      {/* Mobile Fixed Bottom Navigation */}
      <BottomNav
        activeTab={
          workspace === 'front_desk' ? 'tape_chart' :
          workspace === 'orders_concierge' ? (activeSubtab === 'kitchen' ? 'kitchen' : 'dispatch') :
          workspace === 'operations' ? 'dashboard' :
          workspace === 'ledger' ? 'ledger' :
          'dashboard'
        }
        onSelectTab={(tab) => {
          if (tab === 'tape_chart') handleSelectWorkspace('front_desk', 'tape_chart');
          else if (tab === 'dashboard') handleSelectWorkspace('operations', 'tasks');
          else if (tab === 'dispatch') handleSelectWorkspace('orders_concierge', 'dispatch');
          else if (tab === 'kitchen') handleSelectWorkspace('orders_concierge', 'kitchen');
          else if (tab === 'ledger') handleSelectWorkspace('ledger', 'ledger');
        }}
        role={role}
        pendingDispatchCount={pendingDispatchCount}
        pendingKitchenOrdersCount={pendingKitchenCount}
      />
    </div>
  );
}
