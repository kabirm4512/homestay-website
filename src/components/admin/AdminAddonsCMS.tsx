'use client';

import { useState } from 'react';
import { useCRM } from '@/context/CRMContext';
import { MenuItem, TransferRoute, RouteModifier, RentalVehicle } from '@/types/crm';
import {
  Utensils,
  Car,
  Bike,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Search,
  Clock,
  IndianRupee,
  Navigation,
  ShieldAlert,
  Save,
  CheckCircle2,
  AlertCircle,
  QrCode,
} from 'lucide-react';
import InRoomQRHub from '@/components/qr/InRoomQRHub';

export default function AdminAddonsCMS() {
  const {
    menuItems,
    transferRoutes,
    rentalVehicles,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    toggleMenuItemAvailability,
    addTransferRoute,
    updateTransferRoute,
    deleteTransferRoute,
    addRentalVehicle,
    updateRentalVehicle,
    deleteRentalVehicle,
    showToast,
  } = useCRM();

  const [activeTab, setActiveTab] = useState<'dining' | 'transfers' | 'rentals' | 'qr_cards'>('dining');

  // ==========================================
  // 1. DINING / MENU ITEM STATES
  // ==========================================
  const [diningCategoryFilter, setDiningCategoryFilter] = useState<'all' | 'beverage' | 'snack' | 'main'>('all');
  const [diningSearch, setDiningSearch] = useState('');
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);
  const [menuFormData, setMenuFormData] = useState<Partial<MenuItem>>({
    name: '',
    categoryName: 'Hot Beverages',
    categoryId: 'beverages',
    itemType: 'beverage',
    price: 120,
    prepTimeMinutes: 15,
    description: '',
    isAvailable: true,
    isLateNightEligible: true,
  });

  // ==========================================
  // 2. TRANSFER ROUTES STATES
  // ==========================================
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<TransferRoute | null>(null);
  const [routeFormData, setRouteFormData] = useState<Partial<TransferRoute>>({
    title: '',
    origin: 'Savera Homestay, Darjeeling',
    destination: 'Bagdogra Airport (IXB) / NJP',
    priceWagonR: 2800,
    priceSedan: 3400,
    priceSUV: 4800,
    estimatedDurationHours: 3.5,
    isActive: true,
    modifiers: [
      { id: 'mod-1', routeId: '', name: 'Via Mirik Lake & Tea Gardens', extraCharge: 1200, extraDurationHours: 2.0 },
    ],
  });
  const [newModName, setNewModName] = useState('');
  const [newModCharge, setNewModCharge] = useState(800);
  const [newModHours, setNewModHours] = useState(1.5);

  // ==========================================
  // 3. RENTAL VEHICLES STATES
  // ==========================================
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<RentalVehicle | null>(null);
  const [vehicleFormData, setVehicleFormData] = useState<Partial<RentalVehicle>>({
    vehicleName: '',
    vehicleType: 'scooty',
    ratePerDay: 800,
    depositRequired: 2000,
    isAvailable: true,
  });

  // ==========================================
  // DINING HANDLERS
  // ==========================================
  const handleOpenAddMenuItem = () => {
    setEditingMenuItem(null);
    setMenuFormData({
      name: '',
      categoryName: 'Mains & Thalis',
      categoryId: 'mains',
      itemType: 'main',
      price: 250,
      prepTimeMinutes: 25,
      description: '',
      isAvailable: true,
      isLateNightEligible: false,
    });
    setIsMenuModalOpen(true);
  };

  const handleOpenEditMenuItem = (item: MenuItem) => {
    setEditingMenuItem(item);
    setMenuFormData({ ...item });
    setIsMenuModalOpen(true);
  };

  const handleSaveMenuItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!menuFormData.name?.trim() || !menuFormData.price) {
      showToast('Item name and price are required', 'error');
      return;
    }

    if (editingMenuItem) {
      updateMenuItem(editingMenuItem.id, {
        ...menuFormData,
        name: menuFormData.name.trim(),
        price: Number(menuFormData.price),
        prepTimeMinutes: Number(menuFormData.prepTimeMinutes) || 15,
      });
      showToast(`Updated menu item: ${menuFormData.name}`);
    } else {
      const newItem: MenuItem = {
        id: 'menu-' + Date.now(),
        name: menuFormData.name.trim(),
        categoryName: menuFormData.categoryName || 'Chef Special',
        categoryId: menuFormData.categoryId || 'mains',
        itemType: menuFormData.itemType || 'main',
        price: Number(menuFormData.price),
        prepTimeMinutes: Number(menuFormData.prepTimeMinutes) || 15,
        description: menuFormData.description?.trim() || '',
        isAvailable: menuFormData.isAvailable ?? true,
        isLateNightEligible: menuFormData.isLateNightEligible ?? false,
      };
      addMenuItem(newItem);
      showToast(`Added new menu item: ${newItem.name}`);
    }
    setIsMenuModalOpen(false);
  };

  const filteredMenuItems = menuItems.filter((item) => {
    const matchesCategory =
      diningCategoryFilter === 'all' ? true : item.itemType === diningCategoryFilter;
    const matchesSearch =
      item.name.toLowerCase().includes(diningSearch.toLowerCase()) ||
      item.categoryName.toLowerCase().includes(diningSearch.toLowerCase()) ||
      item.description?.toLowerCase().includes(diningSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // ==========================================
  // TRANSFER ROUTE HANDLERS
  // ==========================================
  const handleOpenAddRoute = () => {
    setEditingRoute(null);
    setRouteFormData({
      title: '',
      origin: 'Savera Homestay, Darjeeling',
      destination: '',
      priceWagonR: 2500,
      priceSedan: 3200,
      priceSUV: 4500,
      estimatedDurationHours: 3,
      isActive: true,
      modifiers: [],
    });
    setIsRouteModalOpen(true);
  };

  const handleOpenEditRoute = (route: TransferRoute) => {
    setEditingRoute(route);
    setRouteFormData({
      ...route,
      modifiers: [...(route.modifiers || [])],
    });
    setIsRouteModalOpen(true);
  };

  const handleAddRouteModifier = () => {
    if (!newModName.trim()) return;
    const currentMods = routeFormData.modifiers || [];
    const createdMod: RouteModifier = {
      id: 'mod-' + Date.now(),
      routeId: editingRoute?.id || '',
      name: newModName.trim(),
      extraCharge: Number(newModCharge) || 500,
      extraDurationHours: Number(newModHours) || 1,
    };
    setRouteFormData({ ...routeFormData, modifiers: [...currentMods, createdMod] });
    setNewModName('');
    setNewModCharge(800);
    setNewModHours(1.5);
  };

  const handleRemoveRouteModifier = (id: string) => {
    const currentMods = routeFormData.modifiers || [];
    setRouteFormData({
      ...routeFormData,
      modifiers: currentMods.filter((m) => m.id !== id),
    });
  };

  const handleSaveRoute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeFormData.title?.trim() || !routeFormData.priceWagonR) {
      showToast('Route title and rates are required', 'error');
      return;
    }

    if (editingRoute) {
      updateTransferRoute(editingRoute.id, {
        ...routeFormData,
        title: routeFormData.title.trim(),
        priceWagonR: Number(routeFormData.priceWagonR),
        priceSedan: Number(routeFormData.priceSedan),
        priceSUV: Number(routeFormData.priceSUV),
        estimatedDurationHours: Number(routeFormData.estimatedDurationHours) || 2,
      });
      showToast(`Updated route: ${routeFormData.title}`);
    } else {
      const newRoute: TransferRoute = {
        id: 'route-' + Date.now(),
        title: routeFormData.title.trim(),
        origin: routeFormData.origin?.trim() || 'Savera Homestay, Darjeeling',
        destination: routeFormData.destination?.trim() || 'Destination',
        priceWagonR: Number(routeFormData.priceWagonR),
        priceSedan: Number(routeFormData.priceSedan),
        priceSUV: Number(routeFormData.priceSUV),
        estimatedDurationHours: Number(routeFormData.estimatedDurationHours) || 2,
        isActive: routeFormData.isActive ?? true,
        modifiers: routeFormData.modifiers || [],
      };
      addTransferRoute(newRoute);
      showToast(`Added transfer route: ${newRoute.title}`);
    }
    setIsRouteModalOpen(false);
  };

  // ==========================================
  // RENTAL VEHICLE HANDLERS
  // ==========================================
  const handleOpenAddVehicle = () => {
    setEditingVehicle(null);
    setVehicleFormData({
      vehicleName: '',
      vehicleType: 'scooty',
      ratePerDay: 800,
      depositRequired: 2000,
      isAvailable: true,
    });
    setIsVehicleModalOpen(true);
  };

  const handleOpenEditVehicle = (veh: RentalVehicle) => {
    setEditingVehicle(veh);
    setVehicleFormData({ ...veh });
    setIsVehicleModalOpen(true);
  };

  const handleSaveVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleFormData.vehicleName?.trim() || !vehicleFormData.ratePerDay) {
      showToast('Vehicle name and daily rate are required', 'error');
      return;
    }

    if (editingVehicle) {
      updateRentalVehicle(editingVehicle.id, {
        ...vehicleFormData,
        vehicleName: vehicleFormData.vehicleName.trim(),
        ratePerDay: Number(vehicleFormData.ratePerDay),
        depositRequired: Number(vehicleFormData.depositRequired) || 0,
      });
      showToast(`Updated vehicle: ${vehicleFormData.vehicleName}`);
    } else {
      const newVeh: RentalVehicle = {
        id: 'rental-' + Date.now(),
        vehicleName: vehicleFormData.vehicleName.trim(),
        vehicleType: vehicleFormData.vehicleType || 'scooty',
        ratePerDay: Number(vehicleFormData.ratePerDay),
        depositRequired: Number(vehicleFormData.depositRequired) || 0,
        isAvailable: vehicleFormData.isAvailable ?? true,
      };
      addRentalVehicle(newVeh);
      showToast(`Added rental vehicle: ${newVeh.vehicleName}`);
    }
    setIsVehicleModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header & Sub-Navigation */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-sand-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl font-bold text-forest-950">
            Dine-in & Travel Add-ons Manager
          </h2>
          <p className="text-xs text-gray-500">
            Manage live In-Room Dining F&B menu, point-to-point transfer routes, vehicle tiers, and bike rentals.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center space-x-1 bg-sand-100 p-1 rounded-xl text-xs sm:text-sm">
          <button
            onClick={() => setActiveTab('dining')}
            className={`px-3.5 py-2 rounded-lg font-semibold transition-colors flex items-center space-x-1.5 ${
              activeTab === 'dining'
                ? 'bg-white text-forest-900 shadow-sm'
                : 'text-gray-600 hover:text-forest-900'
            }`}
          >
            <Utensils className="w-4 h-4 text-forest-600" />
            <span>Room Dine-in ({menuItems.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('transfers')}
            className={`px-3.5 py-2 rounded-lg font-semibold transition-colors flex items-center space-x-1.5 ${
              activeTab === 'transfers'
                ? 'bg-white text-forest-900 shadow-sm'
                : 'text-gray-600 hover:text-forest-900'
            }`}
          >
            <Car className="w-4 h-4 text-forest-600" />
            <span>Transfer Routes ({transferRoutes.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('rentals')}
            className={`px-3.5 py-2 rounded-lg font-semibold transition-colors flex items-center space-x-1.5 ${
              activeTab === 'rentals'
                ? 'bg-white text-forest-900 shadow-sm'
                : 'text-gray-600 hover:text-forest-900'
            }`}
          >
            <Bike className="w-4 h-4 text-forest-600" />
            <span>Scooty & Bikes ({rentalVehicles.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('qr_cards')}
            className={`px-3.5 py-2 rounded-lg font-semibold transition-colors flex items-center space-x-1.5 ${
              activeTab === 'qr_cards'
                ? 'bg-white text-forest-900 shadow-sm'
                : 'text-gray-600 hover:text-forest-900'
            }`}
          >
            <QrCode className="w-4 h-4 text-amber-600" />
            <span>In-Room QR Cards (7)</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. ROOM DINE-IN (F&B MENU) TAB */}
      {/* ========================================================================= */}
      {activeTab === 'dining' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-2xl border border-sand-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex-1 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search dishes, snacks, beverages..."
                  value={diningSearch}
                  onChange={(e) => setDiningSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-sand-50/70 border border-sand-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-forest-600"
                />
              </div>

              <div className="flex items-center space-x-1 bg-sand-100 p-1 rounded-xl text-xs">
                <button
                  onClick={() => setDiningCategoryFilter('all')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    diningCategoryFilter === 'all'
                      ? 'bg-white text-forest-900 shadow-sm'
                      : 'text-gray-600 hover:text-forest-900'
                  }`}
                >
                  All ({menuItems.length})
                </button>
                <button
                  onClick={() => setDiningCategoryFilter('beverage')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    diningCategoryFilter === 'beverage'
                      ? 'bg-white text-forest-900 shadow-sm'
                      : 'text-gray-600 hover:text-forest-900'
                  }`}
                >
                  Beverages
                </button>
                <button
                  onClick={() => setDiningCategoryFilter('snack')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    diningCategoryFilter === 'snack'
                      ? 'bg-white text-forest-900 shadow-sm'
                      : 'text-gray-600 hover:text-forest-900'
                  }`}
                >
                  Snacks
                </button>
                <button
                  onClick={() => setDiningCategoryFilter('main')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    diningCategoryFilter === 'main'
                      ? 'bg-white text-forest-900 shadow-sm'
                      : 'text-gray-600 hover:text-forest-900'
                  }`}
                >
                  Mains
                </button>
              </div>
            </div>

            <button
              onClick={handleOpenAddMenuItem}
              className="flex items-center justify-center space-x-1.5 bg-forest-800 hover:bg-forest-900 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl shadow-sm"
            >
              <Plus className="w-4 h-4 text-sand-300" />
              <span>Add Dish / Item</span>
            </button>
          </div>

          {/* Menu Items Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMenuItems.map((item) => (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border p-4 shadow-sm flex flex-col justify-between space-y-3 transition-all ${
                  item.isAvailable ? 'border-sand-200' : 'border-gray-200 bg-gray-50/60 opacity-75'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            item.itemType === 'beverage'
                              ? 'bg-amber-500'
                              : item.itemType === 'snack'
                              ? 'bg-orange-500'
                              : 'bg-emerald-600'
                          }`}
                        />
                        <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                          {item.categoryName || item.itemType}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-forest-950 mt-0.5">{item.name}</h3>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-base text-forest-950">₹{item.price}</div>
                      <div className="text-[10px] text-gray-400 flex items-center justify-end space-x-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{item.prepTimeMinutes}m</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 mt-2 line-clamp-2">
                    {item.description || 'Prepared fresh by the homestay in-house kitchen.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-sand-100 flex items-center justify-between">
                  {/* Stock Availability Pill */}
                  <button
                    type="button"
                    onClick={() => toggleMenuItemAvailability(item.id)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center space-x-1.5 transition-colors ${
                      item.isAvailable
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                        : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        item.isAvailable ? 'bg-emerald-600 animate-pulse' : 'bg-rose-600'
                      }`}
                    />
                    <span>{item.isAvailable ? 'In Stock' : 'Out of Stock'}</span>
                  </button>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleOpenEditMenuItem(item)}
                      className="p-1.5 rounded-lg bg-sand-100 hover:bg-sand-200 text-forest-900"
                      title="Edit dish"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteMenuItem(item.id)}
                      className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600"
                      title="Delete dish"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TRAVEL & TRANSFER ROUTES TAB */}
      {/* ========================================================================= */}
      {activeTab === 'transfers' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-sand-200 shadow-sm flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-forest-950">
                Point-to-Point Transfer Routes & Vehicle Tiers
              </h3>
              <p className="text-xs text-gray-500">
                Configure standard fixed taxi fares for WagonR, Sedan, and SUV tiers, plus via stop modifiers.
              </p>
            </div>
            <button
              onClick={handleOpenAddRoute}
              className="flex items-center space-x-1.5 bg-forest-800 hover:bg-forest-900 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl shadow-sm"
            >
              <Plus className="w-4 h-4 text-sand-300" />
              <span>Add New Route</span>
            </button>
          </div>

          <div className="space-y-4">
            {transferRoutes.map((route) => (
              <div
                key={route.id}
                className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 bg-forest-100 text-forest-800 text-[10px] font-bold rounded-md">
                        {route.estimatedDurationHours} hrs travel
                      </span>
                      <h3 className="font-bold text-base text-forest-950">{route.title}</h3>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Pickup: <strong className="text-forest-900">{route.origin}</strong> → Drop: <strong className="text-forest-900">{route.destination}</strong>
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleOpenEditRoute(route)}
                      className="flex items-center space-x-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-sand-100 hover:bg-sand-200 text-forest-900"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit Rates</span>
                    </button>
                    <button
                      onClick={() => deleteTransferRoute(route.id)}
                      className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600"
                      title="Delete route"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Rates Tier Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-sand-50 rounded-xl border border-sand-200 text-center">
                    <span className="text-[11px] font-bold text-gray-500 block uppercase">
                      Hatchback / WagonR
                    </span>
                    <div className="text-base font-bold text-forest-950 mt-1">
                      ₹{route.priceWagonR.toLocaleString('en-IN')}
                    </div>
                    <span className="text-[10px] text-gray-400">Up to 4 Passengers</span>
                  </div>

                  <div className="p-3 bg-sand-50 rounded-xl border border-sand-200 text-center">
                    <span className="text-[11px] font-bold text-gray-500 block uppercase">
                      Executive Sedan (Dzire / Etios)
                    </span>
                    <div className="text-base font-bold text-forest-950 mt-1">
                      ₹{route.priceSedan.toLocaleString('en-IN')}
                    </div>
                    <span className="text-[10px] text-gray-400">AC Sedan + Luggage Boot</span>
                  </div>

                  <div className="p-3 bg-sand-50 rounded-xl border border-sand-200 text-center">
                    <span className="text-[11px] font-bold text-gray-500 block uppercase">
                      Prime SUV (Innova / Scorpio)
                    </span>
                    <div className="text-base font-bold text-forest-950 mt-1">
                      ₹{route.priceSUV.toLocaleString('en-IN')}
                    </div>
                    <span className="text-[10px] text-gray-400">Up to 6-7 Passengers</span>
                  </div>
                </div>

                {/* Modifiers List */}
                {route.modifiers && route.modifiers.length > 0 && (
                  <div className="pt-2 border-t border-sand-100">
                    <span className="text-[11px] font-bold text-forest-900 block mb-1.5">
                      Available Via Stops & Sightseeing Add-ons:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {route.modifiers.map((mod) => (
                        <span
                          key={mod.id}
                          className="inline-flex items-center text-xs bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-lg"
                        >
                          <span>{mod.name} (+₹{mod.extraCharge}, +{mod.extraDurationHours}h)</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SCOOTY & BIKE RENTALS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'rentals' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-sand-200 shadow-sm flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-forest-950">
                Self-Drive Scooty & Motorcycle Fleet
              </h3>
              <p className="text-xs text-gray-500">
                Manage daily rental tariffs, security deposits, and live inventory availability.
              </p>
            </div>
            <button
              onClick={handleOpenAddVehicle}
              className="flex items-center space-x-1.5 bg-forest-800 hover:bg-forest-900 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl shadow-sm"
            >
              <Plus className="w-4 h-4 text-sand-300" />
              <span>Add Rental Vehicle</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rentalVehicles.map((veh) => (
              <div
                key={veh.id}
                className={`bg-white rounded-2xl border p-5 shadow-sm space-y-3 flex flex-col justify-between transition-all ${
                  veh.isAvailable ? 'border-sand-200' : 'border-gray-200 bg-gray-50 opacity-75'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      {veh.vehicleType.toUpperCase()}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        veh.isAvailable
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {veh.isAvailable ? 'Available to Rent' : 'Reserved / Maintenance'}
                    </span>
                  </div>

                  <h3 className="font-serif text-base font-bold text-forest-950 mt-2">
                    {veh.vehicleName}
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-2 p-3 bg-sand-50 rounded-xl border border-sand-200 text-center">
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase block font-medium">
                      Daily Tariff
                    </span>
                    <div className="text-base font-bold text-forest-950">
                      ₹{veh.ratePerDay}
                      <span className="text-[10px] font-normal text-gray-500"> /day</span>
                    </div>
                  </div>
                  <div className="border-l border-sand-200">
                    <span className="text-[10px] text-gray-500 uppercase block font-medium">
                      Deposit
                    </span>
                    <div className="text-base font-bold text-forest-950">
                      ₹{veh.depositRequired}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-sand-100 flex items-center justify-between">
                  <span className="text-[11px] text-gray-500">2 Helmets Included</span>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleOpenEditVehicle(veh)}
                      className="p-1.5 rounded-lg bg-sand-100 hover:bg-sand-200 text-forest-900"
                      title="Edit vehicle"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteRentalVehicle(veh.id)}
                      className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600"
                      title="Delete vehicle"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. IN-ROOM DINE-IN QR CARDS HUB (ALL 7 ROOMS) */}
      {/* ========================================================================= */}
      {activeTab === 'qr_cards' && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-sand-200 shadow-sm">
          <InRoomQRHub standalone={true} />
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT DINING MENU ITEM */}
      {/* ========================================================================= */}
      {isMenuModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-sand-200 animate-slide-up space-y-4">
            <div className="flex items-center justify-between border-b border-sand-200 pb-3">
              <h3 className="font-serif text-lg font-bold text-forest-950">
                {editingMenuItem ? 'Edit Menu Dish' : 'Add New Menu Dish'}
              </h3>
              <button
                onClick={() => setIsMenuModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMenuItem} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-forest-900 mb-1">
                  Dish / Beverage Name *
                </label>
                <input
                  type="text"
                  required
                  value={menuFormData.name || ''}
                  onChange={(e) => setMenuFormData({ ...menuFormData, name: e.target.value })}
                  placeholder="e.g. Pahadi Rajma Chawal with Ghee"
                  className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs sm:text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Category Group
                  </label>
                  <select
                    value={menuFormData.itemType || 'main'}
                    onChange={(e) =>
                      setMenuFormData({
                        ...menuFormData,
                        itemType: e.target.value as 'beverage' | 'snack' | 'main',
                      })
                    }
                    className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs"
                  >
                    <option value="beverage">Beverage / Chai</option>
                    <option value="snack">Snack / Starter</option>
                    <option value="main">Main Course / Thali</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Display Section Title
                  </label>
                  <input
                    type="text"
                    value={menuFormData.categoryName || ''}
                    onChange={(e) => setMenuFormData({ ...menuFormData, categoryName: e.target.value })}
                    placeholder="e.g. Traditional Pahadi Mains"
                    className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Price (₹ INR) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={menuFormData.price || ''}
                    onChange={(e) => setMenuFormData({ ...menuFormData, price: Number(e.target.value) })}
                    placeholder="280"
                    className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs font-bold text-forest-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Preparation Time (Mins)
                  </label>
                  <input
                    type="number"
                    min={5}
                    value={menuFormData.prepTimeMinutes || 15}
                    onChange={(e) =>
                      setMenuFormData({ ...menuFormData, prepTimeMinutes: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest-900 mb-1">
                  Description / Ingredients
                </label>
                <textarea
                  rows={2}
                  value={menuFormData.description || ''}
                  onChange={(e) => setMenuFormData({ ...menuFormData, description: e.target.value })}
                  placeholder="Fresh local kidney beans slow-cooked with Himalayan herbs and desi ghee..."
                  className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs resize-none"
                />
              </div>

              <div className="flex items-center space-x-6 pt-1">
                <label className="flex items-center space-x-2 cursor-pointer text-xs font-medium text-forest-900">
                  <input
                    type="checkbox"
                    checked={menuFormData.isAvailable ?? true}
                    onChange={(e) => setMenuFormData({ ...menuFormData, isAvailable: e.target.checked })}
                    className="w-4 h-4 rounded text-forest-800"
                  />
                  <span>In Stock / Available</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer text-xs font-medium text-forest-900">
                  <input
                    type="checkbox"
                    checked={menuFormData.isLateNightEligible ?? false}
                    onChange={(e) =>
                      setMenuFormData({ ...menuFormData, isLateNightEligible: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-forest-800"
                  />
                  <span>Late Night Orderable (&gt;10 PM)</span>
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-sand-200">
                <button
                  type="button"
                  onClick={() => setIsMenuModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-sand-300 text-xs font-semibold text-gray-600 hover:bg-sand-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-forest-800 hover:bg-forest-900 text-white text-xs font-semibold shadow-sm"
                >
                  {editingMenuItem ? 'Save Changes' : 'Add Dish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT TRANSFER ROUTE */}
      {/* ========================================================================= */}
      {isRouteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-sand-200 animate-slide-up space-y-4">
            <div className="flex items-center justify-between border-b border-sand-200 pb-3">
              <h3 className="font-serif text-lg font-bold text-forest-950">
                {editingRoute ? 'Edit Transfer Route & Fares' : 'Add New Transfer Route'}
              </h3>
              <button
                onClick={() => setIsRouteModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRoute} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-forest-900 mb-1">
                  Route Title *
                </label>
                <input
                  type="text"
                  required
                  value={routeFormData.title || ''}
                  onChange={(e) => setRouteFormData({ ...routeFormData, title: e.target.value })}
                  placeholder="e.g. Darjeeling to Bagdogra Airport (IXB) / NJP Station"
                  className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs sm:text-sm font-semibold"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Pickup Location
                  </label>
                  <input
                    type="text"
                    value={routeFormData.origin || ''}
                    onChange={(e) => setRouteFormData({ ...routeFormData, origin: e.target.value })}
                    placeholder="Savera Homestay, Darjeeling"
                    className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Drop Location
                  </label>
                  <input
                    type="text"
                    value={routeFormData.destination || ''}
                    onChange={(e) => setRouteFormData({ ...routeFormData, destination: e.target.value })}
                    placeholder="Bagdogra Airport"
                    className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Est. Duration (Hrs)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={routeFormData.estimatedDurationHours || 3}
                    onChange={(e) =>
                      setRouteFormData({
                        ...routeFormData,
                        estimatedDurationHours: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs"
                  />
                </div>
              </div>

              {/* Vehicle Tier Rates */}
              <div className="p-3.5 bg-sand-50/80 rounded-xl border border-sand-200 space-y-2">
                <span className="text-xs font-bold text-forest-900 block uppercase">
                  Vehicle Tier Standard Rates (₹ INR)
                </span>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-700 mb-0.5">
                      WagonR / Hatchback
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={routeFormData.priceWagonR || ''}
                      onChange={(e) =>
                        setRouteFormData({ ...routeFormData, priceWagonR: Number(e.target.value) })
                      }
                      className="w-full px-2.5 py-1.5 bg-white border border-sand-300 rounded-lg text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-700 mb-0.5">
                      Sedan (Dzire/Etios)
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={routeFormData.priceSedan || ''}
                      onChange={(e) =>
                        setRouteFormData({ ...routeFormData, priceSedan: Number(e.target.value) })
                      }
                      className="w-full px-2.5 py-1.5 bg-white border border-sand-300 rounded-lg text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-700 mb-0.5">
                      Prime SUV (Innova)
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={routeFormData.priceSUV || ''}
                      onChange={(e) =>
                        setRouteFormData({ ...routeFormData, priceSUV: Number(e.target.value) })
                      }
                      className="w-full px-2.5 py-1.5 bg-white border border-sand-300 rounded-lg text-xs font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Modifiers List & Add Form */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-forest-900 block">
                  Route Modifiers / Via Stops
                </span>
                <div className="space-y-1.5 max-h-28 overflow-y-auto">
                  {(routeFormData.modifiers || []).map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between text-xs p-2 bg-sand-50 rounded-lg border border-sand-200"
                    >
                      <span className="font-semibold">{m.name}</span>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-forest-900">+₹{m.extraCharge}</span>
                        <span className="text-gray-400">+{m.extraDurationHours}h</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveRouteModifier(m.id)}
                          className="text-red-600 hover:text-red-800 ml-1"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Modifier name (e.g. Via Mirik Lake)"
                    value={newModName}
                    onChange={(e) => setNewModName(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 bg-sand-50 border border-sand-300 rounded-lg text-xs"
                  />
                  <input
                    type="number"
                    placeholder="Extra ₹"
                    value={newModCharge}
                    onChange={(e) => setNewModCharge(Number(e.target.value))}
                    className="w-20 px-2 py-1.5 bg-sand-50 border border-sand-300 rounded-lg text-xs font-bold"
                  />
                  <button
                    type="button"
                    onClick={handleAddRouteModifier}
                    className="px-3 py-1.5 bg-sand-200 hover:bg-sand-300 text-forest-900 text-xs font-bold rounded-lg"
                  >
                    Add Via
                  </button>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-sand-200">
                <button
                  type="button"
                  onClick={() => setIsRouteModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-sand-300 text-xs font-semibold text-gray-600 hover:bg-sand-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-forest-800 hover:bg-forest-900 text-white text-xs font-semibold shadow-sm"
                >
                  {editingRoute ? 'Save Route Fares' : 'Create Route'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT RENTAL VEHICLE */}
      {/* ========================================================================= */}
      {isVehicleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-sand-200 animate-slide-up space-y-4">
            <div className="flex items-center justify-between border-b border-sand-200 pb-3">
              <h3 className="font-serif text-lg font-bold text-forest-950">
                {editingVehicle ? 'Edit Rental Vehicle' : 'Add Rental Vehicle'}
              </h3>
              <button
                onClick={() => setIsVehicleModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVehicle} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-forest-900 mb-1">
                  Vehicle Model / Name *
                </label>
                <input
                  type="text"
                  required
                  value={vehicleFormData.vehicleName || ''}
                  onChange={(e) =>
                    setVehicleFormData({ ...vehicleFormData, vehicleName: e.target.value })
                  }
                  placeholder="e.g. Royal Enfield Himalayan 450"
                  className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs sm:text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest-900 mb-1">
                  Vehicle Type
                </label>
                <select
                  value={vehicleFormData.vehicleType || 'scooty'}
                  onChange={(e) =>
                    setVehicleFormData({
                      ...vehicleFormData,
                      vehicleType: e.target.value as 'scooty' | 'bike' | 'car',
                    })
                  }
                  className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs"
                >
                  <option value="scooty">Scooty / Automatic Scooter (110-125cc)</option>
                  <option value="bike">Motorcycle / Cruiser (350-450cc)</option>
                  <option value="car">Self-Drive Hatchback / 4x4 Gypsy</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Tariff (₹ / day) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={vehicleFormData.ratePerDay || ''}
                    onChange={(e) =>
                      setVehicleFormData({ ...vehicleFormData, ratePerDay: Number(e.target.value) })
                    }
                    placeholder="900"
                    className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs font-bold text-forest-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Security Deposit (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={vehicleFormData.depositRequired || 0}
                    onChange={(e) =>
                      setVehicleFormData({
                        ...vehicleFormData,
                        depositRequired: Number(e.target.value),
                      })
                    }
                    placeholder="2000"
                    className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center space-x-2 cursor-pointer text-xs font-medium text-forest-900">
                  <input
                    type="checkbox"
                    checked={vehicleFormData.isAvailable ?? true}
                    onChange={(e) =>
                      setVehicleFormData({ ...vehicleFormData, isAvailable: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-forest-800"
                  />
                  <span>Currently Available to Rent</span>
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-sand-200">
                <button
                  type="button"
                  onClick={() => setIsVehicleModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-sand-300 text-xs font-semibold text-gray-600 hover:bg-sand-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-forest-800 hover:bg-forest-900 text-white text-xs font-semibold shadow-sm"
                >
                  {editingVehicle ? 'Update Vehicle' : 'Add Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
