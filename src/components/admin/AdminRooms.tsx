'use client';

import { useState, useEffect } from 'react';
import { Room } from '@/types';
import { useCRM } from '@/context/CRMContext';
import { SeasonalDateRange, RoomSeasonalTariffs, MealPlan } from '@/types/crm';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Bed,
  Users,
  Maximize2,
  Check,
  X,
  Image as ImageIcon,
  AlertTriangle,
  Eye,
  EyeOff,
  Calendar,
  Layers,
  Utensils,
  Calculator,
  Sliders,
  CalendarRange,
  ArrowRight,
  Info,
  CheckCircle2,
  Sparkles,
  Percent,
  Save,
  IndianRupee,
} from 'lucide-react';
import { INITIAL_ROOM_SEASONAL_TARIFFS } from '@/lib/crm-data';

interface AdminRoomsProps {
  rooms: Room[];
  onRefresh: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  isAddModalOpen?: boolean;
  onCloseAddModal?: () => void;
}

const COMMON_AMENITIES = [
  'Private Valley Balcony',
  'Artisanal Fireplace',
  'Complimentary Breakfast',
  'High-Speed Starlink Wi-Fi',
  'En-suite Rain Shower',
  'Heated Blankets',
  'Artisanal Tea Station',
  'Private Orchard Garden',
  'Dedicated Work Desk',
  'Outdoor Dining Patio',
  'Wood Stove Heater',
  'Smart TV with Netflix',
  'Pet Friendly',
  'Sunrise Mountain Views',
  'Modern En-Suite Bathroom'
];

export default function AdminRooms({
  rooms,
  onRefresh,
  showToast,
  isAddModalOpen = false,
  onCloseAddModal,
}: AdminRoomsProps) {
  const {
    seasonalDateRanges,
    roomTariffs,
    addSeasonalRange,
    updateSeasonalRange,
    deleteSeasonalRange,
    updateRoomTariffs,
    calculateDynamicTariff,
  } = useCRM();

  const [activeSubTab, setActiveSubTabState] = useState<'inventory' | 'seasons' | 'tariffs' | 'simulator'>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const sub = urlParams.get('subtab');
      if (sub && ['inventory', 'seasons', 'tariffs', 'simulator'].includes(sub)) {
        return sub as any;
      }
      const saved = localStorage.getItem('wp_admin_rooms_subtab');
      if (saved && ['inventory', 'seasons', 'tariffs', 'simulator'].includes(saved)) {
        return saved as any;
      }
    }
    return 'inventory';
  });

  const handleSelectSubTab = (tab: 'inventory' | 'seasons' | 'tariffs' | 'simulator') => {
    setActiveSubTabState(tab);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('wp_admin_rooms_subtab', tab);
        const url = new URL(window.location.href);
        url.searchParams.set('tab', 'rooms');
        url.searchParams.set('subtab', tab);
        window.history.replaceState({}, '', url.toString());
      } catch {}
    }
  };

  // ==========================================
  // 1. ROOM INVENTORY & DETAILS STATES
  // ==========================================
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isModalOpen, setIsModalOpen] = useState(isAddModalOpen);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deleteConfirmRoom, setDeleteConfirmRoom] = useState<Room | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<Partial<Room>>({
    name: '',
    slug: '',
    tagline: '',
    description: '',
    room_type: 'Deluxe Suite',
    price_per_night: 4500,
    weekend_price: 5200,
    base_adults: 2,
    extra_adult_charge: 1200,
    extra_child_charge: 600,
    capacity_adults: 2,
    capacity_children: 1,
    bed_type: 'King Bed',
    room_size_sqft: 400,
    amenities: ['Complimentary Breakfast', 'High-Speed Starlink Wi-Fi', 'Private Valley Balcony'],
    images: ['https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80'],
    total_inventory: 1,
    available_inventory: 1,
    is_active: true,
  });
  const [imageInput, setImageInput] = useState('');
  const [customAmenityInput, setCustomAmenityInput] = useState('');

  // ==========================================
  // 2. SEASONAL DATE RANGES STATES
  // ==========================================
  const [isSeasonModalOpen, setIsSeasonModalOpen] = useState(false);
  const [editingSeason, setEditingSeason] = useState<SeasonalDateRange | null>(null);
  const [seasonForm, setSeasonForm] = useState<Partial<SeasonalDateRange>>({
    name: '',
    seasonType: 'season',
    startDate: '',
    endDate: '',
    description: '',
  });

  // ==========================================
  // 3. TARIFFS & MEAL PLANS STATES
  // ==========================================
  const [selectedTariffRoomId, setSelectedTariffRoomIdState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('wp_admin_rooms_tariff_room');
      if (saved && rooms.some((r) => r.id === saved)) return saved;
    }
    return rooms.length > 0 ? rooms[0].id : 'room-cat-1';
  });

  const handleSelectTariffRoom = (roomId: string) => {
    setSelectedTariffRoomIdState(roomId);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('wp_admin_rooms_tariff_room', roomId);
      } catch {}
    }
  };

  useEffect(() => {
    if (rooms.length > 0 && !rooms.some((r) => r.id === selectedTariffRoomId)) {
      handleSelectTariffRoom(rooms[0].id);
    }
  }, [rooms, selectedTariffRoomId]);

  const [currentTariffs, setCurrentTariffs] = useState<RoomSeasonalTariffs>(() => {
    const foundRoom = rooms.find((r) => r.id === selectedTariffRoomId);
    return (
      foundRoom?.tariffs ||
      roomTariffs[selectedTariffRoomId] ||
      INITIAL_ROOM_SEASONAL_TARIFFS[selectedTariffRoomId] || {
        regular: { EP: 4000, CP: 4500, MAP: 5500, AP: 6500 },
        season: { EP: 5800, CP: 6500, MAP: 7800, AP: 9000 },
        offSeason: { EP: 3200, CP: 3600, MAP: 4400, AP: 5200 },
        weekendSurchargePercent: 10,
        extraAdultRate: 1200,
        extraChildRate: 600,
      }
    );
  });

  useEffect(() => {
    if (selectedTariffRoomId) {
      const foundRoom = rooms.find((r) => r.id === selectedTariffRoomId);
      const found =
        foundRoom?.tariffs ||
        roomTariffs[selectedTariffRoomId] ||
        INITIAL_ROOM_SEASONAL_TARIFFS[selectedTariffRoomId] || {
          regular: { EP: 4000, CP: 4500, MAP: 5500, AP: 6500 },
          season: { EP: 5800, CP: 6500, MAP: 7800, AP: 9000 },
          offSeason: { EP: 3200, CP: 3600, MAP: 4400, AP: 5200 },
          weekendSurchargePercent: 10,
          extraAdultRate: 1200,
          extraChildRate: 600,
        };
      setCurrentTariffs(found);
    }
  }, [selectedTariffRoomId, roomTariffs, rooms]);

  // ==========================================
  // 4. RATE SIMULATOR STATES
  // ==========================================
  const [simRoomId, setSimRoomId] = useState<string>(rooms.length > 0 ? rooms[0].id : 'room-1');
  const [simCheckIn, setSimCheckIn] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [simCheckOut, setSimCheckOut] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [simMealPlan, setSimMealPlan] = useState<MealPlan>('CP');
  const [simAdults, setSimAdults] = useState<number>(2);
  const [simChildren, setSimChildren] = useState<number>(0);

  // Handle opening Add modal
  const handleOpenAdd = () => {
    setEditingRoom(null);
    setFormData({
      name: '',
      slug: '',
      tagline: '',
      description: '',
      room_type: 'Deluxe Suite',
      price_per_night: 4500,
      weekend_price: 5200,
      base_adults: 2,
      extra_adult_charge: 1200,
      extra_child_charge: 600,
      capacity_adults: 2,
      capacity_children: 1,
      bed_type: 'King Bed',
      room_size_sqft: 400,
      amenities: ['Complimentary Breakfast', 'High-Speed Starlink Wi-Fi', 'Private Valley Balcony'],
      images: ['https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80'],
      total_inventory: 1,
      available_inventory: 1,
      is_active: true,
    });
    setImageInput('');
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (isAddModalOpen) {
      handleOpenAdd();
    }
  }, [isAddModalOpen]);

  const handleOpenEdit = (room: Room) => {
    setEditingRoom(room);
    setFormData({
      ...room,
      base_adults: room.base_adults || 2,
      extra_adult_charge: room.extra_adult_charge ?? room.tariffs?.extraAdultRate ?? 1200,
      extra_child_charge: room.extra_child_charge ?? room.tariffs?.extraChildRate ?? 600,
      amenities: [...(room.amenities || [])],
      images: [...(room.images || [])],
    });
    setImageInput('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRoom(null);
    if (onCloseAddModal) onCloseAddModal();
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim() || !formData.price_per_night) {
      showToast('Room name and nightly price are required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const baseRate = Number(formData.price_per_night);
      const weekendRate = formData.weekend_price ? Number(formData.weekend_price) : baseRate;
      const extraAdult = Number(formData.extra_adult_charge) || 1200;
      const extraChild = Number(formData.extra_child_charge) || 600;

      // Keep tariffs in sync
      const targetId = editingRoom?.id || '';
      const existingTariffs = editingRoom?.tariffs || roomTariffs[targetId] || {
        regular: { EP: baseRate, CP: Math.round(baseRate * 1.15), MAP: Math.round(baseRate * 1.35), AP: Math.round(baseRate * 1.55) },
        season: { EP: Math.round(baseRate * 1.3), CP: Math.round(baseRate * 1.45), MAP: Math.round(baseRate * 1.7), AP: Math.round(baseRate * 1.95) },
        offSeason: { EP: Math.round(baseRate * 0.85), CP: Math.round(baseRate * 0.95), MAP: Math.round(baseRate * 1.15), AP: Math.round(baseRate * 1.3) },
        weekendSurchargePercent: 10,
        extraAdultRate: extraAdult,
        extraChildRate: extraChild,
      };

      const updatedTariffs: RoomSeasonalTariffs = {
        ...existingTariffs,
        regular: {
          ...existingTariffs.regular,
          EP: baseRate,
        },
        extraAdultRate: extraAdult,
        extraChildRate: extraChild,
      };

      const payload = {
        ...formData,
        id: editingRoom ? editingRoom.id : undefined,
        slug: formData.slug || formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        price_per_night: baseRate,
        weekend_price: weekendRate,
        base_adults: Number(formData.base_adults) || 2,
        extra_adult_charge: extraAdult,
        extra_child_charge: extraChild,
        capacity_adults: Number(formData.capacity_adults) || 2,
        capacity_children: Number(formData.capacity_children) || 0,
        room_size_sqft: Number(formData.room_size_sqft) || 350,
        total_inventory: Number(formData.total_inventory) || 1,
        available_inventory: Number(formData.available_inventory) !== undefined ? Number(formData.available_inventory) : 1,
        tariffs: updatedTariffs,
      };

      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        const savedId = json.data?.id || (editingRoom ? editingRoom.id : '');
        if (savedId) {
          updateRoomTariffs(savedId, updatedTariffs);
        }
        showToast(editingRoom ? 'Room updated successfully!' : 'New room added successfully!');
        handleCloseModal();
        onRefresh();
      } else {
        showToast(json.error || 'Failed to save room', 'error');
      }
    } catch {
      showToast('Error saving room. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (room: Room) => {
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...room,
          is_active: !room.is_active,
        }),
      });
      if (res.ok) {
        showToast(`Room marked as ${!room.is_active ? 'Active' : 'Inactive'}`);
        onRefresh();
      }
    } catch {
      showToast('Failed to update status', 'error');
    }
  };

  const handleAdjustInventory = async (room: Room, delta: number) => {
    const nextVal = Math.max(0, Math.min(room.total_inventory, (room.available_inventory || 0) + delta));
    if (nextVal === room.available_inventory) return;

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...room,
          available_inventory: nextVal,
        }),
      });
      if (res.ok) {
        showToast(`Inventory updated: ${nextVal} available`);
        onRefresh();
      }
    } catch {
      showToast('Failed to update inventory', 'error');
    }
  };

  const handleDeleteRoom = async () => {
    if (!deleteConfirmRoom) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/rooms?id=${encodeURIComponent(deleteConfirmRoom.id)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('Room deleted successfully');
        setDeleteConfirmRoom(null);
        onRefresh();
      } else {
        showToast(json.error || 'Failed to delete room', 'error');
      }
    } catch {
      showToast('Error deleting room', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRooms = rooms.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.room_type?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'active'
        ? r.is_active
        : !r.is_active;
    return matchesSearch && matchesStatus;
  });

  const toggleAmenity = (amenity: string) => {
    const current = formData.amenities || [];
    if (current.includes(amenity)) {
      setFormData({ ...formData, amenities: current.filter((a) => a !== amenity) });
    } else {
      setFormData({ ...formData, amenities: [...current, amenity] });
    }
  };

  const handleAddCustomAmenity = () => {
    if (!customAmenityInput.trim()) return;
    const current = formData.amenities || [];
    if (!current.includes(customAmenityInput.trim())) {
      setFormData({ ...formData, amenities: [...current, customAmenityInput.trim()] });
    }
    setCustomAmenityInput('');
  };

  const handleAddImage = () => {
    if (!imageInput.trim()) return;
    const current = formData.images || [];
    setFormData({ ...formData, images: [...current, imageInput.trim()] });
    setImageInput('');
  };

  const handleRemoveImage = (index: number) => {
    const current = formData.images || [];
    setFormData({ ...formData, images: current.filter((_, i) => i !== index) });
  };

  // ==========================================
  // SEASONAL DATE RANGES HANDLERS
  // ==========================================
  const handleOpenAddSeason = () => {
    setEditingSeason(null);
    setSeasonForm({
      name: '',
      seasonType: 'season',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      description: '',
    });
    setIsSeasonModalOpen(true);
  };

  const handleOpenEditSeason = (range: SeasonalDateRange) => {
    setEditingSeason(range);
    setSeasonForm({ ...range });
    setIsSeasonModalOpen(true);
  };

  const handleSaveSeasonRange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!seasonForm.name?.trim() || !seasonForm.startDate || !seasonForm.endDate) {
      showToast('Name, start date, and end date are required', 'error');
      return;
    }

    if (seasonForm.startDate > seasonForm.endDate) {
      showToast('Start date cannot be after end date', 'error');
      return;
    }

    if (editingSeason) {
      updateSeasonalRange(editingSeason.id, {
        name: seasonForm.name.trim(),
        seasonType: seasonForm.seasonType || 'season',
        startDate: seasonForm.startDate,
        endDate: seasonForm.endDate,
        description: seasonForm.description?.trim() || '',
      });
      showToast(`Updated season period: ${seasonForm.name}`);
    } else {
      addSeasonalRange({
        name: seasonForm.name.trim(),
        seasonType: seasonForm.seasonType || 'season',
        startDate: seasonForm.startDate,
        endDate: seasonForm.endDate,
        description: seasonForm.description?.trim() || '',
      });
      showToast(`Added seasonal date range: ${seasonForm.name}`);
    }
    setIsSeasonModalOpen(false);
  };

  // ==========================================
  // TARIFF MATRIX SAVE HANDLER
  // ==========================================
  const handleSaveTariffMatrix = async () => {
    if (!selectedTariffRoomId) return;

    // 1. Update in CRM Context (which syncs physical rooms and calls /api/tariffs)
    updateRoomTariffs(selectedTariffRoomId, currentTariffs);

    // 2. Synchronize and update the room in rooms API
    const targetRoom = rooms.find((r) => r.id === selectedTariffRoomId);
    if (targetRoom) {
      const baseRate = currentTariffs.regular.EP || currentTariffs.regular.CP || targetRoom.price_per_night;
      const weekendRate = currentTariffs.weekendSurchargePercent
        ? Math.round(baseRate * (1 + currentTariffs.weekendSurchargePercent / 100))
        : targetRoom.weekend_price;

      const updatedRoom: Room = {
        ...targetRoom,
        price_per_night: baseRate,
        weekend_price: weekendRate,
        extra_adult_charge: currentTariffs.extraAdultRate ?? targetRoom.extra_adult_charge,
        extra_child_charge: currentTariffs.extraChildRate ?? targetRoom.extra_child_charge,
        tariffs: currentTariffs,
      };

      try {
        const res = await fetch('/api/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedRoom),
        });
        const json = await res.json();
        if (res.ok && json.success) {
          showToast('Room seasonal tariffs and nightly rates saved successfully!');
          onRefresh();
        } else {
          showToast(json.error || 'Failed to sync tariffs to server', 'error');
        }
      } catch {
        showToast('Saved room tariffs locally', 'info');
      }
    } else {
      showToast('Updated seasonal and meal plan tariffs for this room!');
    }
  };

  const handleTariffRateChange = (
    tier: 'regular' | 'season' | 'offSeason',
    plan: 'EP' | 'CP' | 'MAP' | 'AP',
    value: number
  ) => {
    setCurrentTariffs((prev) => ({
      ...prev,
      [tier]: {
        ...prev[tier],
        [plan]: Number(value) || 0,
      },
    }));
  };

  // Live simulation calculation
  const simResult = calculateDynamicTariff(simRoomId, simCheckIn, simCheckOut, simMealPlan, simAdults, simChildren);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Sub-tab Navigation */}
      <div className="bg-white p-4 rounded-2xl border border-sand-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-1 sm:space-x-2 bg-sand-100 p-1 rounded-xl text-xs sm:text-sm overflow-x-auto no-scrollbar">
          <button
            onClick={() => handleSelectSubTab('inventory')}
            className={`px-3.5 py-2 rounded-lg font-semibold transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
              activeSubTab === 'inventory'
                ? 'bg-white text-forest-900 shadow-sm'
                : 'text-gray-600 hover:text-forest-900'
            }`}
          >
            <Bed className="w-4 h-4 text-forest-600" />
            <span>Room Inventory ({rooms.length})</span>
          </button>
          <button
            onClick={() => handleSelectSubTab('seasons')}
            className={`px-3.5 py-2 rounded-lg font-semibold transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
              activeSubTab === 'seasons'
                ? 'bg-white text-forest-900 shadow-sm'
                : 'text-gray-600 hover:text-forest-900'
            }`}
          >
            <CalendarRange className="w-4 h-4 text-amber-500" />
            <span>Seasonal Date Ranges ({seasonalDateRanges.length})</span>
          </button>
          <button
            onClick={() => handleSelectSubTab('tariffs')}
            className={`px-3.5 py-2 rounded-lg font-semibold transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
              activeSubTab === 'tariffs'
                ? 'bg-white text-forest-900 shadow-sm'
                : 'text-gray-600 hover:text-forest-900'
            }`}
          >
            <Utensils className="w-4 h-4 text-forest-600" />
            <span>Tariffs & Meal Plans (EP/CP/MAP/AP)</span>
          </button>
          <button
            onClick={() => handleSelectSubTab('simulator')}
            className={`px-3.5 py-2 rounded-lg font-semibold transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
              activeSubTab === 'simulator'
                ? 'bg-white text-forest-900 shadow-sm'
                : 'text-gray-600 hover:text-forest-900'
            }`}
          >
            <Calculator className="w-4 h-4 text-emerald-600" />
            <span>Rate Simulator</span>
          </button>
        </div>

        {activeSubTab === 'tariffs' && (
          <button
            onClick={handleSaveTariffMatrix}
            className="flex items-center space-x-1.5 bg-forest-800 hover:bg-forest-900 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl shadow-sm"
          >
            <Save className="w-4 h-4 text-sand-300" />
            <span>Save Tariffs Matrix</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. ROOM INVENTORY & DETAILS SUB-TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'inventory' && (
        <div className="space-y-6">
          {/* Search/Filter Controls */}
          <div className="bg-white p-5 rounded-2xl border border-sand-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex-1 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search rooms by name or type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-sand-50/60 border border-sand-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-forest-600 focus:bg-white text-forest-950"
                />
              </div>

              <div className="flex items-center space-x-1.5 bg-sand-100 p-1 rounded-xl text-xs">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    statusFilter === 'all'
                      ? 'bg-white text-forest-900 shadow-sm'
                      : 'text-gray-600 hover:text-forest-900'
                  }`}
                >
                  All ({rooms.length})
                </button>
                <button
                  onClick={() => setStatusFilter('active')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    statusFilter === 'active'
                      ? 'bg-white text-forest-900 shadow-sm'
                      : 'text-gray-600 hover:text-forest-900'
                  }`}
                >
                  Active ({rooms.filter((r) => r.is_active).length})
                </button>
                <button
                  onClick={() => setStatusFilter('inactive')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    statusFilter === 'inactive'
                      ? 'bg-white text-forest-900 shadow-sm'
                      : 'text-gray-600 hover:text-forest-900'
                  }`}
                >
                  Inactive ({rooms.filter((r) => !r.is_active).length})
                </button>
              </div>
            </div>

            <button
              onClick={handleOpenAdd}
              className="flex items-center justify-center space-x-2 bg-forest-800 hover:bg-forest-900 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-transform hover:-translate-y-0.5 active:translate-y-0 shrink-0"
            >
              <Plus className="w-4 h-4 text-sand-300" />
              <span>Add New Room</span>
            </button>
          </div>

          {/* Rooms Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRooms.map((room) => {
              const primaryImage =
                room.images && room.images.length > 0
                  ? room.images[0]
                  : 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80';

              return (
                <div
                  key={room.id}
                  className={`bg-white rounded-2xl border transition-all shadow-sm overflow-hidden flex flex-col ${
                    room.is_active ? 'border-sand-200' : 'border-gray-300 opacity-75'
                  }`}
                >
                  {/* Room Image & Badges */}
                  <div className="relative h-48 bg-sand-200 overflow-hidden group">
                    <img
                      src={primaryImage}
                      alt={room.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                    {/* Status Badge */}
                    <div className="absolute top-3 left-3 flex items-center space-x-1.5">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm flex items-center space-x-1 ${
                          room.is_active
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-700 text-gray-200'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        <span>{room.is_active ? 'Active' : 'Inactive'}</span>
                      </span>
                      <span className="text-[11px] font-medium bg-black/50 backdrop-blur-sm text-white px-2.5 py-1 rounded-full">
                        {room.room_type}
                      </span>
                    </div>

                    {/* Price Pill */}
                    <div className="absolute bottom-3 left-3 text-white">
                      <div className="font-serif text-lg font-bold">
                        ₹{Number(room.price_per_night).toLocaleString('en-IN')}
                        <span className="text-xs font-normal text-sand-200"> / night</span>
                      </div>
                      {room.weekend_price && (
                        <div className="text-[11px] text-sand-300">
                          Weekend: ₹{Number(room.weekend_price).toLocaleString('en-IN')}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleToggleActive(room)}
                      title={room.is_active ? 'Deactivate room' : 'Activate room'}
                      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-sm text-white flex items-center justify-center transition-colors"
                    >
                      {room.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-gray-300" />}
                    </button>
                  </div>

                  {/* Room Body Details */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <h3 className="font-serif text-base font-bold text-forest-950">
                        {room.name}
                      </h3>
                      {room.tagline && (
                        <p className="text-xs text-forest-700 italic mt-0.5">{room.tagline}</p>
                      )}
                      <p className="text-xs text-gray-600 line-clamp-2 mt-2">
                        {room.description}
                      </p>
                    </div>

                    {/* Specifications strip */}
                    <div className="grid grid-cols-3 gap-2 py-2.5 px-3 bg-sand-50 rounded-xl text-center text-xs text-forest-900 border border-sand-200/70">
                      <div className="flex flex-col items-center">
                        <Users className="w-3.5 h-3.5 text-forest-600 mb-0.5" />
                        <span className="text-[11px] font-semibold">{room.capacity_adults} Adults</span>
                      </div>
                      <div className="flex flex-col items-center border-x border-sand-200">
                        <Bed className="w-3.5 h-3.5 text-forest-600 mb-0.5" />
                        <span className="text-[11px] font-semibold truncate max-w-[80px]">{room.bed_type}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <Maximize2 className="w-3.5 h-3.5 text-forest-600 mb-0.5" />
                        <span className="text-[11px] font-semibold">{room.room_size_sqft} sq.ft</span>
                      </div>
                    </div>

                    {/* Inventory Manager Strip */}
                    <div className="flex items-center justify-between p-2.5 bg-forest-50/70 rounded-xl border border-forest-100 text-xs">
                      <div>
                        <span className="text-[11px] font-semibold text-forest-900 block">
                          Available Inventory
                        </span>
                        <span className="text-xs text-forest-700">
                          {room.available_inventory} of {room.total_inventory} available
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleAdjustInventory(room, -1)}
                          disabled={room.available_inventory <= 0}
                          className="w-7 h-7 rounded-lg bg-white border border-forest-200 font-bold text-forest-800 hover:bg-forest-100 disabled:opacity-40 flex items-center justify-center text-sm shadow-sm"
                        >
                          -
                        </button>
                        <span className="w-7 text-center font-bold text-forest-950">
                          {room.available_inventory}
                        </span>
                        <button
                          onClick={() => handleAdjustInventory(room, 1)}
                          disabled={room.available_inventory >= room.total_inventory}
                          className="w-7 h-7 rounded-lg bg-white border border-forest-200 font-bold text-forest-800 hover:bg-forest-100 disabled:opacity-40 flex items-center justify-center text-sm shadow-sm"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Card Action Buttons */}
                    <div className="pt-2 border-t border-sand-200 flex items-center justify-between">
                      <span className="text-[11px] text-gray-500">
                        {room.amenities?.length || 0} amenities
                      </span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleOpenEdit(room)}
                          className="flex items-center space-x-1 text-xs font-semibold text-forest-800 bg-sand-100 hover:bg-sand-200 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => setDeleteConfirmRoom(room)}
                          className="flex items-center space-x-1 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SEASONAL DATE RANGES SUB-TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'seasons' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-sand-200 shadow-sm">
            <div>
              <h3 className="font-serif text-lg font-bold text-forest-950">
                Seasonal Calendar & Tariff Date Ranges
              </h3>
              <p className="text-xs text-gray-500">
                Configure multiple date ranges for Peak Season and Off-Season discount periods.
                Stays crossing these dates automatically apply their respective meal plan tariffs.
              </p>
            </div>
            <button
              onClick={handleOpenAddSeason}
              className="flex items-center space-x-1.5 bg-amber-500 hover:bg-amber-600 text-forest-950 text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Seasonal Period</span>
            </button>
          </div>

          {/* Seasonal Date Ranges Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {seasonalDateRanges.map((range) => {
              const isPeak = range.seasonType === 'season';
              const startDateFormatted = new Date(range.startDate).toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });
              const endDateFormatted = new Date(range.endDate).toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });

              return (
                <div
                  key={range.id}
                  className={`bg-white rounded-2xl border p-5 shadow-sm space-y-4 flex flex-col justify-between transition-all ${
                    isPeak ? 'border-amber-200' : 'border-emerald-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center space-x-1 ${
                          isPeak
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${isPeak ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        />
                        <span>{isPeak ? 'PEAK SEASON TARIFF' : 'OFF-SEASON LEAN TARIFF'}</span>
                      </span>
                    </div>

                    <h4 className="font-serif text-base font-bold text-forest-950 mt-3">
                      {range.name}
                    </h4>

                    {range.description && (
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                        {range.description}
                      </p>
                    )}
                  </div>

                  <div className="p-3 bg-sand-50 rounded-xl border border-sand-200 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-gray-500 font-medium text-[11px]">
                      <span>Period Duration:</span>
                      <Calendar className="w-3.5 h-3.5 text-forest-700" />
                    </div>
                    <div className="font-bold text-forest-950 text-xs">
                      {startDateFormatted} <span className="text-gray-400 font-normal">to</span> {endDateFormatted}
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono">
                      {range.startDate} → {range.endDate}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-sand-100 flex items-center justify-end space-x-2">
                    <button
                      onClick={() => handleOpenEditSeason(range)}
                      className="flex items-center space-x-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-sand-100 hover:bg-sand-200 text-forest-900"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit Dates</span>
                    </button>
                    <button
                      onClick={() => deleteSeasonalRange(range.id)}
                      className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600"
                      title="Delete seasonal range"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. TARIFFS & MEAL PLANS MATRIX SUB-TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'tariffs' && (
        <div className="space-y-6">
          {/* Room Selector Strip */}
          <div className="bg-white p-5 rounded-2xl border border-sand-200 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-serif text-lg font-bold text-forest-950">
                  Select Room for Tariff Matrix
                </h3>
                <p className="text-xs text-gray-500">
                  Configure EP, CP, MAP, and AP tariffs across Regular, Season, and Off-Season periods.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-forest-900">Room:</span>
                <select
                  value={selectedTariffRoomId}
                  onChange={(e) => handleSelectTariffRoom(e.target.value)}
                  className="px-3.5 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs sm:text-sm font-semibold text-forest-950"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.room_type})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Meal Plan Descriptions Explainer */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-sand-200 text-xs">
              <div className="p-2.5 bg-sand-50 rounded-xl">
                <strong className="text-forest-950 block">EP (European Plan)</strong>
                <span className="text-[11px] text-gray-500">Room Only (No Meals)</span>
              </div>
              <div className="p-2.5 bg-sand-50 rounded-xl">
                <strong className="text-forest-950 block">CP (Continental Plan)</strong>
                <span className="text-[11px] text-gray-500">Room + Gourmet Breakfast</span>
              </div>
              <div className="p-2.5 bg-sand-50 rounded-xl">
                <strong className="text-forest-950 block">MAP (Modified American)</strong>
                <span className="text-[11px] text-gray-500">Breakfast + Pahadi Dinner</span>
              </div>
              <div className="p-2.5 bg-sand-50 rounded-xl">
                <strong className="text-forest-950 block">AP (American Plan)</strong>
                <span className="text-[11px] text-gray-500">All Meals (Breakfast, Lunch, Dinner)</span>
              </div>
            </div>
          </div>

          {/* Matrix Card */}
          <div className="bg-white p-6 rounded-2xl border border-sand-200 shadow-sm space-y-6">
            {/* 1. Regular Rates */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-sand-200 pb-2">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-forest-700" />
                  <h4 className="font-serif text-base font-bold text-forest-950">
                    1. Regular Standard Tariffs (₹ / night)
                  </h4>
                </div>
                <span className="text-xs text-gray-500 font-medium">Applies on non-seasonal dates</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    EP (Room Only)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={currentTariffs.regular.EP}
                    onChange={(e) => handleTariffRateChange('regular', 'EP', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs font-bold text-forest-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    CP (Breakfast Included)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={currentTariffs.regular.CP}
                    onChange={(e) => handleTariffRateChange('regular', 'CP', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs font-bold text-forest-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    MAP (Breakfast + Dinner)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={currentTariffs.regular.MAP}
                    onChange={(e) => handleTariffRateChange('regular', 'MAP', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs font-bold text-forest-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    AP (Full Board - All Meals)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={currentTariffs.regular.AP}
                    onChange={(e) => handleTariffRateChange('regular', 'AP', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs font-bold text-forest-950"
                  />
                </div>
              </div>
            </div>

            {/* 2. Peak Season Rates */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-sand-200 pb-2">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  <h4 className="font-serif text-base font-bold text-amber-950">
                    2. Peak Season Tariffs (₹ / night)
                  </h4>
                </div>
                <span className="text-xs text-amber-800 font-medium">Applies during marked Peak Season ranges</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    EP (Room Only)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={currentTariffs.season.EP}
                    onChange={(e) => handleTariffRateChange('season', 'EP', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-amber-50/50 border border-amber-300 rounded-xl text-xs font-bold text-amber-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    CP (Breakfast Included)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={currentTariffs.season.CP}
                    onChange={(e) => handleTariffRateChange('season', 'CP', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-amber-50/50 border border-amber-300 rounded-xl text-xs font-bold text-amber-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    MAP (Breakfast + Dinner)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={currentTariffs.season.MAP}
                    onChange={(e) => handleTariffRateChange('season', 'MAP', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-amber-50/50 border border-amber-300 rounded-xl text-xs font-bold text-amber-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    AP (Full Board - All Meals)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={currentTariffs.season.AP}
                    onChange={(e) => handleTariffRateChange('season', 'AP', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-amber-50/50 border border-amber-300 rounded-xl text-xs font-bold text-amber-950"
                  />
                </div>
              </div>
            </div>

            {/* 3. Off-Season Rates */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-sand-200 pb-2">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-600" />
                  <h4 className="font-serif text-base font-bold text-emerald-950">
                    3. Off-Season / Lean Discount Tariffs (₹ / night)
                  </h4>
                </div>
                <span className="text-xs text-emerald-800 font-medium">Applies during marked Off-Season ranges</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    EP (Room Only)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={currentTariffs.offSeason.EP}
                    onChange={(e) => handleTariffRateChange('offSeason', 'EP', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-emerald-50/50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    CP (Breakfast Included)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={currentTariffs.offSeason.CP}
                    onChange={(e) => handleTariffRateChange('offSeason', 'CP', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-emerald-50/50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    MAP (Breakfast + Dinner)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={currentTariffs.offSeason.MAP}
                    onChange={(e) => handleTariffRateChange('offSeason', 'MAP', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-emerald-50/50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    AP (Full Board - All Meals)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={currentTariffs.offSeason.AP}
                    onChange={(e) => handleTariffRateChange('offSeason', 'AP', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-emerald-50/50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-950"
                  />
                </div>
              </div>
            </div>

            {/* 4. Weekend Surcharge */}
            <div className="p-4 bg-sand-50 rounded-xl border border-sand-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-1.5 font-bold text-xs text-forest-950">
                  <Percent className="w-3.5 h-3.5 text-forest-700" />
                  <span>Weekend Surcharge Percentage</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Applied automatically to Friday & Saturday night stays during Regular periods.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={currentTariffs.weekendSurchargePercent || 0}
                  onChange={(e) =>
                    setCurrentTariffs({
                      ...currentTariffs,
                      weekendSurchargePercent: Number(e.target.value) || 0,
                    })
                  }
                  className="w-24 px-3 py-1.5 bg-white border border-sand-300 rounded-xl text-xs font-bold text-center"
                />
                <span className="text-xs font-bold text-forest-900">% Surcharge</span>
              </div>
            </div>

            {/* 5. Extra Guest Charges */}
            <div className="p-4 bg-sand-50 rounded-xl border border-sand-200 space-y-3">
              <div className="flex items-center justify-between border-b border-sand-200/70 pb-2">
                <div className="flex items-center space-x-1.5 font-bold text-xs text-forest-950">
                  <Users className="w-3.5 h-3.5 text-amber-700" />
                  <span>5. Extra Guest Surcharges (₹ / night)</span>
                </div>
                <span className="text-[11px] text-gray-500">Base room rate includes 2 Adults</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Extra Adult Rate (₹ / night)
                  </label>
                  <div className="relative">
                    <IndianRupee className="w-3.5 h-3.5 text-forest-600 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={currentTariffs.extraAdultRate ?? 1200}
                      onChange={(e) =>
                        setCurrentTariffs({
                          ...currentTariffs,
                          extraAdultRate: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full pl-8 pr-3 py-2 bg-white border border-sand-300 rounded-xl text-xs font-bold text-forest-950"
                    />
                  </div>
                  <span className="text-[10px] text-gray-500 mt-0.5 block">
                    Applies for 3rd adult onward (beyond 2 base adults).
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Extra Child Rate (₹ / night)
                  </label>
                  <div className="relative">
                    <IndianRupee className="w-3.5 h-3.5 text-forest-600 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={currentTariffs.extraChildRate ?? 600}
                      onChange={(e) =>
                        setCurrentTariffs({
                          ...currentTariffs,
                          extraChildRate: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full pl-8 pr-3 py-2 bg-white border border-sand-300 rounded-xl text-xs font-bold text-forest-950"
                    />
                  </div>
                  <span className="text-[10px] text-gray-500 mt-0.5 block">
                    Applies per child per night.
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={handleSaveTariffMatrix}
                className="flex items-center space-x-2 bg-forest-800 hover:bg-forest-900 text-white text-xs sm:text-sm font-semibold px-6 py-2.5 rounded-xl shadow-md transition-transform hover:-translate-y-0.5"
              >
                <Save className="w-4 h-4 text-sand-300" />
                <span>Save All Tariffs for this Room</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. DYNAMIC RATE SIMULATOR SUB-TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'simulator' && (
        <div className="space-y-6">
          {/* Simulator Inputs Card */}
          <div className="bg-white p-6 rounded-2xl border border-sand-200 shadow-sm space-y-4">
            <div>
              <h3 className="font-serif text-lg font-bold text-forest-950">
                Dynamic Night-by-Night Rate Simulator
              </h3>
              <p className="text-xs text-gray-500">
                Test any check-in/out date range and meal plan to evaluate exact seasonal transitions, weekend surcharges, and total quotation.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-forest-900 mb-1">
                  Select Room
                </label>
                <select
                  value={simRoomId}
                  onChange={(e) => setSimRoomId(e.target.value)}
                  className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs font-semibold"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest-900 mb-1">
                  Check-in Date
                </label>
                <input
                  type="date"
                  value={simCheckIn}
                  onChange={(e) => setSimCheckIn(e.target.value)}
                  className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest-900 mb-1">
                  Check-out Date
                </label>
                <input
                  type="date"
                  value={simCheckOut}
                  onChange={(e) => setSimCheckOut(e.target.value)}
                  className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest-900 mb-1">
                  Meal Plan
                </label>
                <select
                  value={simMealPlan}
                  onChange={(e) => setSimMealPlan(e.target.value as MealPlan)}
                  className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs font-semibold"
                >
                  <option value="EP">EP (Room Only)</option>
                  <option value="CP">CP (Gourmet Breakfast)</option>
                  <option value="MAP">MAP (Breakfast + Dinner)</option>
                  <option value="AP">AP (All Meals Included)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest-900 mb-1">
                  Occupancy
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <select
                    value={simAdults}
                    onChange={(e) => setSimAdults(Number(e.target.value))}
                    className="w-full px-2 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs font-semibold"
                    title="Adults"
                  >
                    <option value={1}>1 Ad</option>
                    <option value={2}>2 Ad</option>
                    <option value={3}>3 Ad</option>
                    <option value={4}>4 Ad</option>
                  </select>
                  <select
                    value={simChildren}
                    onChange={(e) => setSimChildren(Number(e.target.value))}
                    className="w-full px-2 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs font-semibold"
                    title="Children"
                  >
                    <option value={0}>0 Ch</option>
                    <option value={1}>1 Ch</option>
                    <option value={2}>2 Ch</option>
                    <option value={3}>3 Ch</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Simulation Output Card */}
          <div className="bg-white p-6 rounded-2xl border border-sand-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sand-200 pb-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Dynamic Calculation Verified
                </span>
                <h4 className="font-serif text-2xl font-bold text-forest-950 mt-1">
                  ₹{simResult.totalAmount.toLocaleString('en-IN')}{' '}
                  <span className="text-xs font-normal text-gray-500">
                    total for {simResult.nights} {simResult.nights === 1 ? 'night' : 'nights'}
                  </span>
                </h4>
                {(simResult.extraAdultsCharge > 0 || simResult.extraChildrenCharge > 0) && (
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-xs px-2 py-0.5 bg-sand-100 text-forest-800 rounded-md font-semibold">
                      Base Room: ₹{simResult.baseAmount.toLocaleString('en-IN')}
                    </span>
                    {simResult.extraAdultsCharge > 0 && (
                      <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md font-bold">
                        +{simResult.extraAdultsCount} Extra Adult(s): ₹{simResult.extraAdultsCharge.toLocaleString('en-IN')}
                      </span>
                    )}
                    {simResult.extraChildrenCharge > 0 && (
                      <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-md font-bold">
                        +{simResult.extraChildrenCount} Extra Child(ren): ₹{simResult.extraChildrenCharge.toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="text-left sm:text-right">
                <span className="text-xs text-gray-500 block">Average Rate:</span>
                <span className="font-bold text-base text-forest-900">
                  ₹{simResult.avgRatePerNight.toLocaleString('en-IN')} / night
                </span>
              </div>
            </div>

            {/* Breakdown Table */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-forest-900 block">
                Night-by-Night Seasonal Breakdown:
              </span>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-sand-50 text-gray-500 font-semibold border-b border-sand-200">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Season / Tariff Applied</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3 text-right">Night Tariff</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sand-100 font-medium">
                    {simResult.breakdown.map((b, idx) => (
                      <tr key={idx} className="hover:bg-sand-50/50">
                        <td className="py-2 px-3 font-mono text-gray-700">{b.date}</td>
                        <td className="py-2 px-3 text-forest-950 font-semibold">{b.rateName}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              b.seasonType === 'season'
                                ? 'bg-amber-100 text-amber-900'
                                : b.seasonType === 'off_season'
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {b.seasonType.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-forest-950">
                          ₹{b.amount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT ROOM */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-sand-200 overflow-hidden my-8 animate-slide-up">
            <div className="bg-forest-800 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-serif text-lg font-bold">
                  {editingRoom ? `Edit: ${editingRoom.name}` : 'Add New Room'}
                </h3>
                <p className="text-xs text-forest-200">
                  Configure room rates, photos, capacity, and amenities
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-1.5 text-sand-300 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRoom} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Room Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. The Cedar Forest Suite"
                    className="w-full px-3.5 py-2.5 bg-sand-50 border border-sand-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-forest-600 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Room Type
                  </label>
                  <input
                    type="text"
                    value={formData.room_type || ''}
                    onChange={(e) => setFormData({ ...formData, room_type: e.target.value })}
                    placeholder="e.g. Master Suite, Cottage, Deluxe"
                    className="w-full px-3.5 py-2.5 bg-sand-50 border border-sand-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-forest-600 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest-900 mb-1">
                  Tagline / Highlights
                </label>
                <input
                  type="text"
                  value={formData.tagline || ''}
                  onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                  placeholder="e.g. Panoramic Pine Forest & Valley Views"
                  className="w-full px-3.5 py-2.5 bg-sand-50 border border-sand-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-forest-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest-900 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detailed description of room furnishings, ambiance, view, and architecture..."
                  className="w-full px-3.5 py-2.5 bg-sand-50 border border-sand-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-forest-600 focus:bg-white resize-none"
                />
              </div>

              <div className="p-4 bg-sand-50/70 rounded-xl border border-sand-200 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-forest-900 mb-1">
                      Nightly Base Rate (₹ INR) *
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={formData.price_per_night || ''}
                      onChange={(e) => setFormData({ ...formData, price_per_night: Number(e.target.value) })}
                      placeholder="5000"
                      className="w-full px-3.5 py-2.5 bg-white border border-sand-300 rounded-xl text-xs sm:text-sm font-semibold text-forest-950 focus:ring-2 focus:ring-forest-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-forest-900 mb-1">
                      Weekend Rate (₹ INR)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formData.weekend_price || ''}
                      onChange={(e) => setFormData({ ...formData, weekend_price: Number(e.target.value) })}
                      placeholder="5800"
                      className="w-full px-3.5 py-2.5 bg-white border border-sand-300 rounded-xl text-xs sm:text-sm font-semibold text-forest-950 focus:ring-2 focus:ring-forest-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-sand-200/70">
                  <div>
                    <label className="block text-xs font-semibold text-forest-900 mb-1">
                      Base Adults Included
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={4}
                      value={formData.base_adults ?? 2}
                      onChange={(e) => setFormData({ ...formData, base_adults: Number(e.target.value) })}
                      className="w-full px-3.5 py-2 bg-white border border-sand-300 rounded-xl text-xs font-bold text-forest-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-forest-900 mb-1">
                      Extra Adult Surcharge (₹ / night)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={formData.extra_adult_charge ?? 1200}
                      onChange={(e) => setFormData({ ...formData, extra_adult_charge: Number(e.target.value) })}
                      className="w-full px-3.5 py-2 bg-white border border-sand-300 rounded-xl text-xs font-bold text-forest-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-forest-900 mb-1">
                      Extra Child Surcharge (₹ / night)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={formData.extra_child_charge ?? 600}
                      onChange={(e) => setFormData({ ...formData, extra_child_charge: Number(e.target.value) })}
                      className="w-full px-3.5 py-2 bg-white border border-sand-300 rounded-xl text-xs font-bold text-forest-950"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-forest-900 mb-1">
                    Adults Max
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.capacity_adults || 2}
                    onChange={(e) => setFormData({ ...formData, capacity_adults: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs focus:ring-2 focus:ring-forest-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-forest-900 mb-1">
                    Children Max
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.capacity_children ?? 1}
                    onChange={(e) => setFormData({ ...formData, capacity_children: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs focus:ring-2 focus:ring-forest-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-forest-900 mb-1">
                    Bed Arrangement
                  </label>
                  <input
                    type="text"
                    value={formData.bed_type || 'King Bed'}
                    onChange={(e) => setFormData({ ...formData, bed_type: e.target.value })}
                    className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs focus:ring-2 focus:ring-forest-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-forest-900 mb-1">
                    Size (Sq. Ft.)
                  </label>
                  <input
                    type="number"
                    min={50}
                    value={formData.room_size_sqft || 350}
                    onChange={(e) => setFormData({ ...formData, room_size_sqft: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs focus:ring-2 focus:ring-forest-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-sand-50/70 rounded-xl border border-sand-200">
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Total Units
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.total_inventory || 1}
                    onChange={(e) => {
                      const tot = Number(e.target.value);
                      setFormData({
                        ...formData,
                        total_inventory: tot,
                        available_inventory: Math.min(formData.available_inventory || 1, tot),
                      });
                    }}
                    className="w-full px-3.5 py-2.5 bg-white border border-sand-300 rounded-xl text-xs font-bold text-forest-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Available Units
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={formData.total_inventory || 1}
                    value={formData.available_inventory ?? 1}
                    onChange={(e) => setFormData({ ...formData, available_inventory: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-white border border-sand-300 rounded-xl text-xs font-bold text-forest-950"
                  />
                </div>
                <div className="flex flex-col justify-center">
                  <label className="block text-xs font-semibold text-forest-900 mb-2">
                    Online Status
                  </label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active ?? true}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-forest-700"></div>
                    <span className="ml-2.5 text-xs font-medium text-forest-900">
                      {formData.is_active ? 'Active on site' : 'Hidden / Maintenance'}
                    </span>
                  </label>
                </div>
              </div>

              {/* Amenities Section */}
              <div>
                <label className="block text-xs font-semibold text-forest-900 mb-2">
                  Room Amenities
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {COMMON_AMENITIES.map((amenity) => {
                    const selected = formData.amenities?.includes(amenity);
                    return (
                      <button
                        key={amenity}
                        type="button"
                        onClick={() => toggleAmenity(amenity)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors flex items-center space-x-1 ${
                          selected
                            ? 'bg-forest-800 border-forest-800 text-white'
                            : 'bg-sand-50 border-sand-300 text-forest-900 hover:bg-sand-100'
                        }`}
                      >
                        {selected && <Check className="w-3 h-3" />}
                        <span>{amenity}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customAmenityInput}
                    onChange={(e) => setCustomAmenityInput(e.target.value)}
                    placeholder="Add custom amenity..."
                    className="flex-1 px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs focus:ring-2 focus:ring-forest-600"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomAmenity}
                    className="bg-sand-200 hover:bg-sand-300 text-forest-900 text-xs font-semibold px-3 py-2 rounded-xl"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Photos List */}
              <div>
                <label className="block text-xs font-semibold text-forest-900 mb-2">
                  Room Images (URLs)
                </label>
                <div className="space-y-2 mb-3">
                  {formData.images?.map((url, idx) => (
                    <div
                      key={idx}
                      className="flex items-center space-x-2 bg-sand-50 p-2 rounded-xl border border-sand-200"
                    >
                      <div className="w-12 h-9 rounded-lg bg-sand-200 overflow-hidden shrink-0">
                        <img src={url} alt="thumbnail" className="w-full h-full object-cover" />
                      </div>
                      <span className="text-xs text-gray-700 truncate flex-1 font-mono">{url}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Remove image"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="url"
                    value={imageInput}
                    onChange={(e) => setImageInput(e.target.value)}
                    placeholder="Paste image URL..."
                    className="flex-1 px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs focus:ring-2 focus:ring-forest-600"
                  />
                  <button
                    type="button"
                    onClick={handleAddImage}
                    className="bg-forest-800 hover:bg-forest-900 text-white text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center space-x-1"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Add Photo</span>
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-sand-200 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2.5 rounded-xl border border-sand-300 text-forest-900 text-xs font-semibold hover:bg-sand-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-forest-800 hover:bg-forest-900 text-white text-xs font-semibold shadow-md flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {submitting ? (
                    <span>Saving Room...</span>
                  ) : (
                    <span>{editingRoom ? 'Update Room' : 'Save New Room'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT SEASONAL DATE RANGE */}
      {/* ========================================================================= */}
      {isSeasonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-sand-200 animate-slide-up space-y-4">
            <div className="flex items-center justify-between border-b border-sand-200 pb-3">
              <h3 className="font-serif text-lg font-bold text-forest-950">
                {editingSeason ? 'Edit Seasonal Date Range' : 'Add Seasonal Date Range'}
              </h3>
              <button
                onClick={() => setIsSeasonModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSeasonRange} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-forest-900 mb-1">
                  Season Period Name *
                </label>
                <input
                  type="text"
                  required
                  value={seasonForm.name || ''}
                  onChange={(e) => setSeasonForm({ ...seasonForm, name: e.target.value })}
                  placeholder="e.g. Summer Vacation Peak 2026"
                  className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs sm:text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest-900 mb-1">
                  Season Type *
                </label>
                <select
                  value={seasonForm.seasonType || 'season'}
                  onChange={(e) =>
                    setSeasonForm({
                      ...seasonForm,
                      seasonType: e.target.value as 'season' | 'off_season',
                    })
                  }
                  className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs font-semibold"
                >
                  <option value="season">Peak Season (Higher Tariffs)</option>
                  <option value="off_season">Off-Season / Lean (Discount Tariffs)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Start Date (Check-in) *
                  </label>
                  <input
                    type="date"
                    required
                    value={seasonForm.startDate || ''}
                    onChange={(e) => setSeasonForm({ ...seasonForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    End Date (Check-out) *
                  </label>
                  <input
                    type="date"
                    required
                    value={seasonForm.endDate || ''}
                    onChange={(e) => setSeasonForm({ ...seasonForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest-900 mb-1">
                  Description / Festival Note
                </label>
                <textarea
                  rows={2}
                  value={seasonForm.description || ''}
                  onChange={(e) => setSeasonForm({ ...seasonForm, description: e.target.value })}
                  placeholder="e.g. Major tourist rush during school summer holidays..."
                  className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs resize-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-sand-200">
                <button
                  type="button"
                  onClick={() => setIsSeasonModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-sand-300 text-xs font-semibold text-gray-600 hover:bg-sand-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-forest-800 hover:bg-forest-900 text-white text-xs font-semibold shadow-sm"
                >
                  {editingSeason ? 'Update Period' : 'Save Date Range'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {deleteConfirmRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-sand-200 text-center animate-slide-up">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h4 className="font-serif text-lg font-bold text-forest-950">Delete Room?</h4>
            <p className="text-xs text-gray-600 mt-2 mb-6">
              Are you sure you want to delete <strong className="text-forest-900">{deleteConfirmRoom.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-center space-x-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmRoom(null)}
                className="px-4 py-2 rounded-xl border border-sand-300 text-xs font-semibold text-forest-900 hover:bg-sand-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleDeleteRoom}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-sm"
              >
                {submitting ? 'Deleting...' : 'Yes, Delete Room'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
