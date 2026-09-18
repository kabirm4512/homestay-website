'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Trees,
  LayoutDashboard,
  CalendarDays,
  Truck,
  ChefHat,
  Receipt,
  BedDouble,
  CalendarCheck,
  MessageSquareText,
  Sliders,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Users,
  UtensilsCrossed,
} from 'lucide-react';

import AdminOverview from '@/components/admin/AdminOverview';
import AdminRooms from '@/components/admin/AdminRooms';
import AdminBookings from '@/components/admin/AdminBookings';
import AdminInquiries from '@/components/admin/AdminInquiries';
import AdminCMS from '@/components/admin/AdminCMS';
import AdminAddonsCMS from '@/components/admin/AdminAddonsCMS';
import AdminStaffManagement from '@/components/admin/AdminStaffManagement';

// New Boutique CRM Modules
import TapeChart from '@/components/crm/TapeChart';
import OperationsHub from '@/components/crm/OperationsHub';
import KitchenPortal from '@/components/crm/KitchenPortal';
import FinancialLedger from '@/components/crm/FinancialLedger';
import RoleSwitcher from '@/components/crm/RoleSwitcher';
import PWAInstaller from '@/components/pwa/PWAInstaller';
import BottomNav from '@/components/pwa/BottomNav';
import InRoomQRHub from '@/components/qr/InRoomQRHub';
import { useCRM } from '@/context/CRMContext';

import { Room, Inquiry, Booking, HeroSlide, AboutSectionData, SiteInfo, Review } from '@/types';
import {
  INITIAL_ROOMS,
  INITIAL_HERO_SLIDES,
  INITIAL_ABOUT_DATA,
  INITIAL_SITE_INFO,
  INITIAL_INQUIRIES,
  INITIAL_BOOKINGS,
  INITIAL_REVIEWS,
} from '@/lib/mock-data';

export default function AdminPage() {
  const {
    role,
    toast: crmToast,
    showToast: showCrmToast,
    dispatchRequests,
    foodOrders,
    currentUser,
    setCurrentUser,
  } = useCRM();

  const [isAuthenticated] = useState<boolean>(true); // Direct open access for all roles
  const [adminUser, setAdminUser] = useState<{ name: string; role: string }>({
    name: 'Administrator',
    role: 'admin',
  });

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<string>('tape_chart');

  // Website CMS states
  const [rooms, setRooms] = useState<Room[]>(INITIAL_ROOMS);
  const [inquiries, setInquiries] = useState<Inquiry[]>(INITIAL_INQUIRIES);
  const [bookings, setBookings] = useState<Booking[]>(INITIAL_BOOKINGS);
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>(INITIAL_HERO_SLIDES);
  const [aboutData, setAboutData] = useState<AboutSectionData>(INITIAL_ABOUT_DATA);
  const [siteInfo, setSiteInfo] = useState<SiteInfo>(INITIAL_SITE_INFO);
  const [reviews, setReviews] = useState<Review[]>(INITIAL_REVIEWS);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [isAddRoomOpen, setIsAddRoomOpen] = useState(false);
  const [showQRHubModal, setShowQRHubModal] = useState(false);

  // Local toast fallback
  const [localToast, setLocalToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setLocalToast({ message, type });
    setTimeout(() => {
      setLocalToast(null);
    }, 4000);
  }, []);

  // Sync role changes to default tabs
  useEffect(() => {
    if (role === 'kitchen_staff') {
      setActiveTab('kitchen');
    }
  }, [role]);

  // Fetch live homestay data
  const fetchData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [roomsRes, inqRes, bkRes, cmsRes] = await Promise.all([
        fetch('/api/rooms').then((r) => r.json()).catch(() => null),
        fetch('/api/inquiries').then((r) => r.json()).catch(() => null),
        fetch('/api/bookings').then((r) => r.json()).catch(() => null),
        fetch('/api/cms').then((r) => r.json()).catch(() => null),
      ]);

      if (roomsRes?.success && roomsRes.data?.length > 0) {
        setRooms(roomsRes.data);
      }
      if (inqRes?.success && inqRes.data) {
        setInquiries(inqRes.data);
      }
      if (bkRes?.success && bkRes.data) {
        setBookings(bkRes.data);
      }
      if (cmsRes?.success && cmsRes.data) {
        if (cmsRes.data.heroSlides?.length > 0) setHeroSlides(cmsRes.data.heroSlides);
        if (cmsRes.data.aboutData?.headline) setAboutData(cmsRes.data.aboutData);
        if (cmsRes.data.siteInfo?.name) setSiteInfo(cmsRes.data.siteInfo);
        if (cmsRes.data.reviews?.length > 0) setReviews(cmsRes.data.reviews);
      }
    } catch {
      // fallback
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    fetchData();
    showToast('Homestay data reloaded.');
  };

  const pendingDispatchCount = dispatchRequests.filter((d) => d.dispatchStatus === 'pending_confirmation').length;
  const pendingKitchenCount = foodOrders.filter((o) => o.status === 'pending').length;

  return (
    <div className="min-h-screen bg-[#faf8f5] text-forest-950 flex flex-col font-sans pb-16 md:pb-6">
      {/* 1. Global Admin Top Navbar */}
      <header className="sticky top-0 z-40 bg-forest-900 text-white border-b border-forest-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-forest-800 border border-forest-700 flex items-center justify-center group-hover:bg-forest-700 transition-colors">
                <Trees className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <span className="font-serif font-bold text-base block leading-tight">
                  Savera Homestay
                </span>
                <span className="text-[10px] uppercase tracking-widest text-sand-300 font-semibold flex items-center space-x-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>Boutique CRM & Concierge</span>
                </span>
              </div>
            </Link>
          </div>

          {/* Right Header Controls: Role Switcher, PWA Install, Live Concierge Link, User */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Fast Role Switcher */}
            <RoleSwitcher />

            {/* PWA Install Button */}
            <PWAInstaller variant="button" />

            {/* Dine-In QR Standees Generator */}
            <button
              onClick={() => setShowQRHubModal(true)}
              className="min-h-[44px] flex items-center space-x-1.5 text-xs font-bold text-amber-300 hover:text-amber-200 bg-forest-800/90 hover:bg-forest-800 px-3 py-1.5 rounded-xl border border-amber-500/40 transition-colors shadow-xs cursor-pointer"
              title="Preview, print and download In-Room Dine-In QR Cards"
            >
              <QrCode className="w-4 h-4 text-amber-400" />
              <span>Dine-In QRs</span>
            </button>

            {/* Active Role Open Access Badge */}
            <div className="hidden md:flex items-center space-x-2 bg-forest-800/80 px-2.5 py-1 rounded-xl border border-forest-700/60">
              <div className="w-6 h-6 rounded-lg bg-amber-400 text-forest-950 font-bold text-[10px] flex items-center justify-center uppercase">
                {role.charAt(0)}
              </div>
              <div className="text-left">
                <span className="text-[11px] font-bold text-white block leading-none capitalize">
                  {role.replace('_', ' ')} Mode
                </span>
                <span className="text-[9px] text-emerald-300 uppercase tracking-wider font-semibold">
                  All Roles Unlocked
                </span>
              </div>
            </div>

            <div className="h-5 w-px bg-forest-700 hidden sm:block" />

            {/* Refresh Data Action */}
            <button
              onClick={handleRefresh}
              className="min-h-[44px] min-w-[44px] p-2 text-forest-300 hover:text-white rounded-xl hover:bg-forest-800 transition-colors flex items-center justify-center cursor-pointer"
              title="Refresh Homestay Live Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* View Live Website */}
            <Link
              href="/"
              target="_blank"
              className="min-h-[44px] px-2.5 py-1.5 text-xs font-semibold text-sand-200 hover:text-white rounded-xl hover:bg-forest-800 transition-colors flex items-center space-x-1.5"
              title="View Public Website"
            >
              <ExternalLink className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden sm:inline">Website</span>
            </Link>
          </div>
        </div>

        {/* Desktop Navigation Tabs Bar */}
        <div className="bg-forest-950/70 border-t border-forest-800/80 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex items-center space-x-1 sm:space-x-2 overflow-x-auto py-2 no-scrollbar">
            {/* Module A: Tape Chart */}
            <button
              onClick={() => setActiveTab('tape_chart')}
              className={`min-h-[40px] flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === 'tape_chart'
                  ? 'bg-amber-500 text-forest-950 shadow-sm'
                  : 'text-sand-200 hover:text-white hover:bg-forest-900/50'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Tape Chart (7 Rooms)</span>
            </button>

            {/* Module B: Operations Hub */}
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`min-h-[40px] flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-amber-500 text-forest-950 shadow-sm'
                  : 'text-sand-200 hover:text-white hover:bg-forest-900/50'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Daily Operations Hub</span>
            </button>

            {/* Module B/C: Dispatch Hub */}
            <button
              onClick={() => setActiveTab('dispatch')}
              className={`min-h-[40px] flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === 'dispatch'
                  ? 'bg-amber-500 text-forest-950 shadow-sm'
                  : 'text-sand-200 hover:text-white hover:bg-forest-900/50'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Orders / Dispatch</span>
              {pendingDispatchCount > 0 && (
                <span className="ml-1 text-[10px] bg-amber-400 text-forest-950 font-bold px-1.5 py-0.2 rounded-full">
                  {pendingDispatchCount}
                </span>
              )}
            </button>

            {/* Dedicated Kitchen View */}
            <button
              onClick={() => setActiveTab('kitchen')}
              className={`min-h-[40px] flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === 'kitchen'
                  ? 'bg-amber-500 text-forest-950 shadow-sm'
                  : 'text-sand-200 hover:text-white hover:bg-forest-900/50'
              }`}
            >
              <ChefHat className="w-3.5 h-3.5" />
              <span>Kitchen & Mandate</span>
              {pendingKitchenCount > 0 && (
                <span className="ml-1 text-[10px] bg-rose-600 text-white font-bold px-1.5 py-0.2 rounded-full">
                  {pendingKitchenCount}
                </span>
              )}
            </button>

            {/* Module D: Financial Ledger (Admin Only) */}
            <button
              onClick={() => setActiveTab('ledger')}
              className={`min-h-[40px] flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === 'ledger'
                  ? 'bg-amber-500 text-forest-950 shadow-sm'
                  : 'text-sand-200 hover:text-white hover:bg-forest-900/50'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Financial Ledger & PNL</span>
              {role !== 'admin' && (
                <span className="text-[10px] bg-rose-900/70 text-rose-300 font-mono px-1.5 py-0.2 rounded">
                  Admin Only
                </span>
              )}
            </button>

            {/* Staff & User Management (Admin Only) */}
            <button
              onClick={() => setActiveTab('staff')}
              className={`min-h-[40px] flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === 'staff'
                  ? 'bg-amber-500 text-forest-950 shadow-sm'
                  : 'text-sand-200 hover:text-white hover:bg-forest-900/50'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Staff & Logins</span>
              {role !== 'admin' && (
                <span className="text-[10px] bg-rose-900/70 text-rose-300 font-mono px-1.5 py-0.2 rounded">
                  Admin Only
                </span>
              )}
            </button>

            <div className="h-4 w-px bg-forest-800 mx-1 hidden lg:block" />

            {/* Website CMS Tabs */}
            <button
              onClick={() => setActiveTab('overview')}
              className={`min-h-[40px] flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === 'overview'
                  ? 'bg-forest-800 text-white'
                  : 'text-forest-400 hover:text-forest-200'
              }`}
            >
              <span>Site Overview</span>
            </button>

            <button
              onClick={() => setActiveTab('rooms')}
              className={`min-h-[40px] flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === 'rooms'
                  ? 'bg-forest-800 text-white'
                  : 'text-forest-400 hover:text-forest-200'
              }`}
            >
              <BedDouble className="w-3.5 h-3.5" />
              <span>Site Rooms & Tariffs</span>
            </button>

            <button
              onClick={() => setActiveTab('addons')}
              className={`min-h-[40px] flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === 'addons'
                  ? 'bg-forest-800 text-white'
                  : 'text-forest-400 hover:text-forest-200'
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>Dine-in & Travel Add-ons</span>
            </button>

            <button
              onClick={() => setActiveTab('inquiries')}
              className={`min-h-[40px] flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === 'inquiries'
                  ? 'bg-forest-800 text-white'
                  : 'text-forest-400 hover:text-forest-200'
              }`}
            >
              <MessageSquareText className="w-3.5 h-3.5" />
              <span>Web Inquiries</span>
            </button>

            <button
              onClick={() => setActiveTab('cms')}
              className={`min-h-[40px] flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === 'cms'
                  ? 'bg-forest-800 text-white'
                  : 'text-forest-400 hover:text-forest-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>CMS & Reviews</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Module View */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Module A: Tape Chart */}
        {activeTab === 'tape_chart' && <TapeChart />}

        {/* Module B: Operations Hub */}
        {activeTab === 'dashboard' && <OperationsHub />}

        {/* Orders / Dispatch Hub */}
        {activeTab === 'dispatch' && <OperationsHub />}

        {/* Dedicated Kitchen View */}
        {activeTab === 'kitchen' && <KitchenPortal />}

        {/* Module D: Financial Ledger (Admin Only, RBAC Guarded) */}
        {activeTab === 'ledger' && <FinancialLedger />}

        {/* Staff & User Access Management (Admin Only, RBAC Guarded) */}
        {activeTab === 'staff' && (
          role === 'admin' ? (
            <AdminStaffManagement />
          ) : (
            <div className="bg-white rounded-3xl p-8 border border-sand-200 text-center max-w-md mx-auto my-12 shadow-sm animate-in fade-in">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-serif font-bold text-lg text-forest-950 mb-1">Admin Access Required</h3>
              <p className="text-xs text-forest-700/80 mb-4">
                Only Estate Administrators have authority to create and manage individual employee accounts, access levels, and credentials.
              </p>
              <button
                onClick={() => setActiveTab('tape_chart')}
                className="px-4 py-2 bg-forest-900 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-forest-800 transition-colors"
              >
                Return to Tape Chart
              </button>
            </div>
          )
        )}

        {/* Website CMS Tabs */}
        {activeTab === 'overview' && (
          <AdminOverview
            rooms={rooms}
            inquiries={inquiries}
            bookings={bookings}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onOpenAddRoom={() => {
              setActiveTab('rooms');
              setIsAddRoomOpen(true);
            }}
          />
        )}

        {activeTab === 'rooms' && (
          <AdminRooms
            rooms={rooms}
            onRefresh={fetchData}
            showToast={showToast}
            isAddModalOpen={isAddRoomOpen}
            onCloseAddModal={() => setIsAddRoomOpen(false)}
          />
        )}

        {activeTab === 'bookings' && (
          <AdminBookings
            bookings={bookings}
            onRefresh={fetchData}
            showToast={showToast}
          />
        )}

        {activeTab === 'inquiries' && (
          <AdminInquiries
            inquiries={inquiries}
            onRefresh={fetchData}
            showToast={showToast}
          />
        )}

        {activeTab === 'addons' && <AdminAddonsCMS />}

        {activeTab === 'cms' && (
          <AdminCMS
            heroSlides={heroSlides}
            aboutData={aboutData}
            siteInfo={siteInfo}
            reviews={reviews}
            onRefresh={fetchData}
            showToast={showToast}
          />
        )}
      </main>

      {/* 3. Mobile Fixed Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        role={role}
        pendingDispatchCount={pendingDispatchCount}
        pendingKitchenOrdersCount={pendingKitchenCount}
      />

      {/* In-Room Dine-In QR Standee Hub Modal */}
      {showQRHubModal && (
        <InRoomQRHub isOpen={showQRHubModal} onClose={() => setShowQRHubModal(false)} />
      )}

      {/* 4. Global Toast Notifications */}
      {(crmToast || localToast) && (
        <div className="fixed bottom-18 md:bottom-6 right-4 sm:right-6 z-50 animate-in slide-in-from-bottom-2 duration-200">
          <div
            className={`flex items-center space-x-2.5 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-bold ${
              (crmToast?.type || localToast?.type) === 'error'
                ? 'bg-rose-900 border-rose-800 text-white'
                : 'bg-forest-900 border-forest-800 text-white'
            }`}
          >
            {(crmToast?.type || localToast?.type) === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{crmToast?.message || localToast?.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
