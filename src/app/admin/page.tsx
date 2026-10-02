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
import LegacyDataMigration from '@/components/admin/LegacyDataMigration';
import AdminTaxSettings from '@/components/admin/AdminTaxSettings';
import { useCRM } from '@/context/CRMContext';

import { Room, Inquiry, Booking, HeroSlide, AboutSectionData, SiteInfo, Review } from '@/types';
import { INITIAL_HERO_SLIDES, INITIAL_ABOUT_DATA, INITIAL_SITE_INFO, INITIAL_REVIEWS } from '@/lib/mock-data';

type PrimaryWorkspace = 'front_desk' | 'orders_concierge' | 'operations' | 'ledger' | 'settings';

export default function AdminPage() {
  const { role, currentUser, dispatchRequests, foodOrders, authStatus, signOut } = useCRM();

  // Authentication comes from the server session (httpOnly cookie); nothing in localStorage grants access.
  const isAuthenticated = authStatus === 'signed_in' && Boolean(currentUser) && !currentUser?.mustChangePassword;
  const authChecking = authStatus === 'checking';
  const adminUser = {
    name: currentUser?.fullName || 'Staff User',
    role: currentUser?.role || role,
  };

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
          if (['settings', 'rooms', 'addons', 'cms', 'inquiries', 'webbookings', 'overview'].includes(tabParam)) return 'settings';
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
        // Website Settings sections write their own name into ?tab= and their inner tab into
        // ?subtab= (e.g. ?tab=rooms&subtab=tariffs), so a reload must read the section from ?tab=.
        const tabParam = urlParams.get('tab');
        if (tabParam && ['rooms', 'addons', 'cms', 'inquiries', 'webbookings', 'overview'].includes(tabParam)) return tabParam;
        const sub = urlParams.get('subtab') || tabParam || localStorage.getItem('wp_admin_subtab');
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

  // Website data: loaded from the server after sign-in (never from a browser copy).
  const [rooms, setRooms] = useState<Room[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>(INITIAL_HERO_SLIDES);
  const [aboutData, setAboutData] = useState<AboutSectionData>(INITIAL_ABOUT_DATA);
  const [siteInfo, setSiteInfo] = useState<SiteInfo>(INITIAL_SITE_INFO);
  const [reviews, setReviews] = useState<Review[]>(INITIAL_REVIEWS);

  // Optimistic updates after a successful save (the editors save to the server themselves)
  const handleUpdateRooms = useCallback((updatedRooms: Room[]) => {
    setRooms(updatedRooms);
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
        fetch('/api/rooms?all=1', { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
        fetch('/api/inquiries', { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
        fetch('/api/bookings', { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
        fetch('/api/cms', { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
      ]);

      if (roomsRes?.success && Array.isArray(roomsRes.data)) setRooms(roomsRes.data);
      if (inqRes?.success && Array.isArray(inqRes.data)) setInquiries(inqRes.data);
      if (bkRes?.success && Array.isArray(bkRes.data)) setBookings(bkRes.data);
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

  const handleLogout = async () => {
    await signOut();
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
    return <AdminAuth />;
  }

  const pendingDispatchCount = dispatchRequests.filter((d) => d.dispatchStatus === 'pending_confirmation').length;
  const pendingKitchenCount = foodOrders.filter((o) => o.status === 'pending').length;
  const totalOrdersBadge = pendingKitchenCount + pendingDispatchCount;

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#142820] flex flex-col font-sans pb-16 md:pb-6">
      {/* ================= 1. GLOBAL ADMIN TOP NAVBAR ================= */}
      <header className="sticky top-0 z-40 bg-[#142820] text-white border-b border-[#1E3A2F] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-3 shrink-0">
            <Link href="/" className="flex items-center space-x-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-[#1E3A2F] border border-[#C5A059]/40 flex items-center justify-center group-hover:bg-[#2A4E40] transition-colors shadow-sm">
                <Trees className="w-5 h-5 text-[#C5A059]" />
              </div>
              <div>
                <span
                  className="font-bold text-base block leading-tight tracking-tight text-white"
                  style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                >
                  Savera Homestay
                </span>
                <span className="text-[10px] uppercase tracking-widest text-[#C5A059] font-bold flex items-center space-x-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>Alpine Sanctuary OS • Concierge</span>
                </span>
              </div>
            </Link>
          </div>

          {/* Header Quick Actions (+ Manual Check-In, + Quick Expense) & Staff Tools */}
          <div className="flex items-center space-x-2 sm:space-x-2.5 overflow-x-auto no-scrollbar py-1">
            {/* Quick Action 1: + Manual Check-In */}
            <button
              onClick={() => setIsManualCheckInOpen(true)}
              className="min-h-[38px] flex items-center space-x-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 active:scale-95 px-3 py-1.5 rounded-xl border border-emerald-500/40 transition-all shadow-sm cursor-pointer shrink-0"
              title="Initiate manual check-in, assign room & generate guest portal link"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-200 stroke-[3]" />
              <span>Manual Check-In</span>
            </button>

            {/* Quick Action 2: + Quick Expense in Warm Terracotta */}
            <button
              onClick={() => setIsQuickExpenseOpen(true)}
              className="min-h-[38px] flex items-center space-x-1.5 text-xs font-bold text-white bg-[#C85A32] hover:bg-[#B34D28] active:scale-95 px-3 py-1.5 rounded-xl shadow-[0_2px_8px_rgba(200,90,50,0.35)] transition-all cursor-pointer shrink-0"
              title="1-tap fast manager expense logger"
            >
              <Receipt className="w-3.5 h-3.5 text-white" />
              <span>Quick Expense</span>
            </button>

            {/* Dine-In QR Standees Generator */}
            <button
              onClick={() => setShowQRHubModal(true)}
              className="min-h-[38px] hidden md:flex items-center space-x-1.5 text-xs font-semibold text-gray-200 hover:text-white bg-[#1E3A2F] hover:bg-[#2A4E40] px-2.5 py-1.5 rounded-xl border border-[#C5A059]/30 transition-colors shrink-0 cursor-pointer"
              title="In-Room Dine-In QR Standees"
            >
              <QrCode className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>QRs</span>
            </button>

            {/* Fast Role Switcher */}
            <RoleSwitcher />

            {/* PWA Install Button */}
            <PWAInstaller variant="button" />

            {/* Logged-in Staff Badge */}
            <div className="hidden lg:flex items-center space-x-2 bg-[#1E3A2F] px-2.5 py-1 rounded-xl border border-[#C5A059]/30 shrink-0">
              <div className="w-6 h-6 rounded-lg bg-[#C85A32] text-white font-bold text-[10px] flex items-center justify-center uppercase shadow-2xs">
                {(currentUser?.fullName || adminUser.name).charAt(0)}
              </div>
              <div className="text-left">
                <span className="text-[11px] font-bold text-white block leading-none truncate max-w-[110px]">
                  {currentUser?.fullName || adminUser.name}
                </span>
                <span className="text-[9px] text-[#C5A059] uppercase tracking-wider font-semibold capitalize">
                  {(currentUser?.role || role).replace('_', ' ')}
                </span>
              </div>
            </div>

            <div className="h-5 w-px bg-white/20 hidden sm:block shrink-0" />

            {/* Refresh Data */}
            <button
              onClick={handleRefresh}
              className="min-h-[38px] p-2 text-gray-300 hover:text-white rounded-xl hover:bg-[#1E3A2F] transition-colors flex items-center justify-center cursor-pointer shrink-0"
              title="Refresh Homestay Live Data"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            {/* View Live Website */}
            <Link
              href="/"
              target="_blank"
              className="min-h-[38px] px-2.5 py-1.5 text-xs font-semibold text-gray-200 hover:text-white rounded-xl hover:bg-[#1E3A2F] transition-colors hidden sm:flex items-center space-x-1.5 shrink-0"
              title="View Public Website"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#C5A059]" />
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
        <div className="bg-[#0F1E18] border-t border-[#1E3A2F] px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto py-2 no-scrollbar">
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* Workspace 1: Front Desk (Tape Chart) */}
              <button
                onClick={() => handleSelectWorkspace('front_desk', 'tape_chart')}
                className={`min-h-[40px] flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  workspace === 'front_desk'
                    ? 'bg-[#C85A32] text-white shadow-md'
                    : 'text-[#C4D1C9] hover:text-white hover:bg-[#1E3A2F]'
                }`}
              >
                <CalendarDays className="w-4 h-4 text-[#C5A059]" />
                <span>Front Desk (7 Rooms)</span>
              </button>

              {/* Workspace 2: Orders & Concierge */}
              <button
                onClick={() => handleSelectWorkspace('orders_concierge', 'kitchen')}
                className={`min-h-[40px] flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  workspace === 'orders_concierge'
                    ? 'bg-[#C85A32] text-white shadow-md'
                    : 'text-[#C4D1C9] hover:text-white hover:bg-[#1E3A2F]'
                }`}
              >
                <UtensilsCrossed className="w-4 h-4 text-[#C5A059]" />
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
                    ? 'bg-[#C85A32] text-white shadow-md'
                    : 'text-[#C4D1C9] hover:text-white hover:bg-[#1E3A2F]'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 text-[#C5A059]" />
                <span>Ops &amp; Expenses</span>
              </button>

              {/* Workspace 4: Financial Ledger & Staff */}
              <button
                onClick={() => handleSelectWorkspace('ledger', 'ledger')}
                className={`min-h-[40px] flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  workspace === 'ledger'
                    ? 'bg-[#C85A32] text-white shadow-md'
                    : 'text-[#C4D1C9] hover:text-white hover:bg-[#1E3A2F]'
                }`}
              >
                <Receipt className="w-4 h-4 text-[#C5A059]" />
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
                    ? 'bg-[#C85A32] text-white shadow-md'
                    : 'text-[#C4D1C9] hover:text-white hover:bg-[#1E3A2F]'
                }`}
              >
                <Settings className="w-4 h-4 text-[#C5A059]" />
                <span>Website Settings</span>
              </button>
            </div>
          </div>
        </div>

        {/* Secondary Subtab Bar for Active Workspace */}
        {workspace === 'front_desk' && (
          <div className="bg-[#142820] border-t border-[#1E3A2F] px-4 sm:px-6 lg:px-8 py-2">
            <div className="max-w-7xl mx-auto flex items-center space-x-2 text-xs font-bold">
              <span className="text-[#8C9B90] text-[11px] uppercase tracking-wider mr-2 hidden sm:inline">View:</span>
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
                  activeSubtab !== 'bookings_list' ? 'bg-[#1E3A2F] text-white font-bold border border-[#C5A059]/40 shadow-xs' : 'text-[#A3B899] hover:bg-[#1E3A2F]/60 hover:text-white'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5 text-[#C5A059]" />
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
                  activeSubtab === 'bookings_list' ? 'bg-[#1E3A2F] text-white font-bold border border-[#C5A059]/40 shadow-xs' : 'text-[#A3B899] hover:bg-[#1E3A2F]/60 hover:text-white'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>Master Bookings &amp; Folios List</span>
              </button>
            </div>
          </div>
        )}

        {workspace === 'orders_concierge' && (
          <div className="bg-[#142820] border-t border-[#1E3A2F] px-4 sm:px-6 lg:px-8 py-2">
            <div className="max-w-7xl mx-auto flex items-center space-x-2 text-xs font-bold">
              <span className="text-[#8C9B90] text-[11px] uppercase tracking-wider mr-2 hidden sm:inline">Module:</span>
              <button
                onClick={() => setActiveSubtab('kitchen')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeSubtab === 'kitchen' ? 'bg-[#1E3A2F] text-white font-bold border border-[#C5A059]/40 shadow-xs' : 'text-[#A3B899] hover:bg-[#1E3A2F]/60 hover:text-white'
                }`}
              >
                <ChefHat className="w-3.5 h-3.5 text-[#C5A059]" />
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
                  activeSubtab === 'dispatch' ? 'bg-[#1E3A2F] text-white font-bold border border-[#C5A059]/40 shadow-xs' : 'text-[#A3B899] hover:bg-[#1E3A2F]/60 hover:text-white'
                }`}
              >
                <Truck className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>Transfers &amp; Rentals Dispatch</span>
                {pendingDispatchCount > 0 && (
                  <span className="bg-[#C85A32] text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold">
                    {pendingDispatchCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveSubtab('orders')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeSubtab === 'orders' ? 'bg-[#1E3A2F] text-white font-bold border border-[#C5A059]/40 shadow-xs' : 'text-[#A3B899] hover:bg-[#1E3A2F]/60 hover:text-white'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>Orders Log</span>
              </button>
            </div>
          </div>
        )}

        {workspace === 'operations' && (
          <div className="bg-[#142820] border-t border-[#1E3A2F] px-4 sm:px-6 lg:px-8 py-2">
            <div className="max-w-7xl mx-auto flex items-center space-x-2 text-xs font-bold">
              <span className="text-[#8C9B90] text-[11px] uppercase tracking-wider mr-2 hidden sm:inline">Module:</span>
              <button
                onClick={() => setActiveSubtab('tasks')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeSubtab === 'tasks' ? 'bg-[#1E3A2F] text-white font-bold border border-[#C5A059]/40 shadow-xs' : 'text-[#A3B899] hover:bg-[#1E3A2F]/60 hover:text-white'
                }`}
              >
                <Wrench className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>Daily Housekeeping &amp; Property Tasks</span>
              </button>
              <button
                onClick={() => setActiveSubtab('expenses')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeSubtab === 'expenses' ? 'bg-[#1E3A2F] text-white font-bold border border-[#C5A059]/40 shadow-xs' : 'text-[#A3B899] hover:bg-[#1E3A2F]/60 hover:text-white'
                }`}
              >
                <Receipt className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>Manager Expense Records</span>
              </button>
            </div>
          </div>
        )}

        {workspace === 'ledger' && (
          <div className="bg-[#142820] border-t border-[#1E3A2F] px-4 sm:px-6 lg:px-8 py-2">
            <div className="max-w-7xl mx-auto flex items-center space-x-2 text-xs font-bold">
              <span className="text-[#8C9B90] text-[11px] uppercase tracking-wider mr-2 hidden sm:inline">Module:</span>
              <button
                onClick={() => setActiveSubtab('ledger')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeSubtab === 'ledger' ? 'bg-[#1E3A2F] text-white font-bold border border-[#C5A059]/40 shadow-xs' : 'text-[#A3B899] hover:bg-[#1E3A2F]/60 hover:text-white'
                }`}
              >
                <Receipt className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>Financial Ledger &amp; P&amp;L</span>
              </button>
              <button
                onClick={() => setActiveSubtab('staff')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeSubtab === 'staff' ? 'bg-[#1E3A2F] text-white font-bold border border-[#C5A059]/40 shadow-xs' : 'text-[#A3B899] hover:bg-[#1E3A2F]/60 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>Staff Accounts &amp; Permissions</span>
              </button>
            </div>
          </div>
        )}

        {workspace === 'settings' && (
          <div className="bg-[#142820] border-t border-[#1E3A2F] px-4 sm:px-6 lg:px-8 py-2 overflow-x-auto no-scrollbar">
            <div className="max-w-7xl mx-auto flex items-center space-x-2 text-xs font-bold">
              <span className="text-[#8C9B90] text-[11px] uppercase tracking-wider mr-2 hidden sm:inline">Settings:</span>
              <button
                onClick={() => setActiveSubtab('rooms')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeSubtab === 'rooms' ? 'bg-[#1E3A2F] text-white font-bold border border-[#C5A059]/40 shadow-xs' : 'text-[#A3B899] hover:bg-[#1E3A2F]/60 hover:text-white'
                }`}
              >
                <BedDouble className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>Site Rooms &amp; Tariffs</span>
              </button>
              <button
                onClick={() => setActiveSubtab('addons')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeSubtab === 'addons' ? 'bg-[#1E3A2F] text-white font-bold border border-[#C5A059]/40 shadow-xs' : 'text-[#A3B899] hover:bg-[#1E3A2F]/60 hover:text-white'
                }`}
              >
                <UtensilsCrossed className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>Dine-In Menu &amp; Add-ons</span>
              </button>
              <button
                onClick={() => setActiveSubtab('cms')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeSubtab === 'cms' ? 'bg-[#1E3A2F] text-white font-bold border border-[#C5A059]/40 shadow-xs' : 'text-[#A3B899] hover:bg-[#1E3A2F]/60 hover:text-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>CMS &amp; Reviews</span>
              </button>
              <button
                onClick={() => setActiveSubtab('inquiries')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeSubtab === 'inquiries' ? 'bg-[#1E3A2F] text-white font-bold border border-[#C5A059]/40 shadow-xs' : 'text-[#A3B899] hover:bg-[#1E3A2F]/60 hover:text-white'
                }`}
              >
                <MessageSquareText className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>Web Inquiries</span>
              </button>
              <button
                onClick={() => setActiveSubtab('webbookings')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeSubtab === 'webbookings' ? 'bg-[#1E3A2F] text-white font-bold border border-[#C5A059]/40 shadow-xs' : 'text-[#A3B899] hover:bg-[#1E3A2F]/60 hover:text-white'
                }`}
              >
                <MessageSquareText className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>
                  Web Bookings
                  {bookings.filter((b) => b.status === 'pending').length > 0 ? ` (${bookings.filter((b) => b.status === 'pending').length})` : ''}
                </span>
              </button>
              <button
                onClick={() => setActiveSubtab('overview')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeSubtab === 'overview' ? 'bg-[#1E3A2F] text-white font-bold border border-[#C5A059]/40 shadow-xs' : 'text-[#A3B899] hover:bg-[#1E3A2F]/60 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>Overview Analytics</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ================= 3. MAIN WORKSPACE VIEW ================= */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <LegacyDataMigration isAdmin={currentUser?.role === 'admin'} showToast={(m, t) => showToast(m, t)} />
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
            {activeSubtab === 'addons' && (
              <>
                <AdminTaxSettings />
                <AdminAddonsCMS />
              </>
            )}
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
            {activeSubtab === 'webbookings' && (
              <AdminBookings bookings={bookings} onRefresh={fetchData} showToast={showToast} />
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
                  if (['rooms', 'addons', 'cms', 'inquiries', 'webbookings'].includes(tab)) {
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
