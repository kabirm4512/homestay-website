'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Room } from '@/types';
import { useCRM } from '@/context/CRMContext';
import { SeasonalDateRange } from '@/types/crm';
import AdminTariffs from './AdminTariffs';
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
  Utensils,
  ArrowRight,
  IndianRupee,
  Upload,
} from 'lucide-react';
import { resolveRoomTariffs, todayInIST, addCalendarDays } from '@/lib/tariff-calculator';
import { adminRequestJson } from '@/lib/admin-api';
import {
  compressImageFile,
  dataUrlBytes,
  isPlaceholderImage,
  normalizeRoomImages,
  ROOM_PLACEHOLDER_IMAGE,
  ROOM_SAVE_MAX_PAYLOAD_BYTES,
} from '@/lib/image-upload';

interface AdminRoomsProps {
  rooms: Room[];
  onUpdateRooms?: (updatedRooms: Room[]) => void;
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
  onUpdateRooms,
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
    calculateDynamicTariff,
    tariffsStatus,
  } = useCRM();

  type SubTab = 'inventory' | 'tariffs';
  const toSubTab = (v: string | null): SubTab | null =>
    v === 'inventory' ? 'inventory' : v === 'tariffs' || v === 'seasons' || v === 'simulator' ? 'tariffs' : null;
  const [activeSubTab, setActiveSubTabState] = useState<SubTab>(() => {
    if (typeof window !== 'undefined') {
      const fromUrl = toSubTab(new URLSearchParams(window.location.search).get('subtab'));
      if (fromUrl) return fromUrl;
      try {
        const saved = toSubTab(localStorage.getItem('wp_admin_rooms_subtab'));
        if (saved) return saved;
      } catch {}
    }
    return 'inventory';
  });

  // True while the tariff matrix has edits that are not saved to the server yet.
  const tariffDirtyRef = useRef(false);
  const confirmDiscardTariffEdits = () =>
    !tariffDirtyRef.current ||
    (typeof window !== 'undefined' &&
      window.confirm('You have unsaved price changes. They are NOT on the website yet. Discard them?'));

  const handleSelectSubTab = (tab: SubTab) => {
    if (tab !== 'tariffs' && !confirmDiscardTariffEdits()) return;
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
    capacity_adults: 2,
    capacity_children: 1,
    bed_type: 'King Bed',
    room_size_sqft: 400,
    amenities: ['Complimentary Breakfast', 'High-Speed Starlink Wi-Fi', 'Private Valley Balcony'],
    images: [],
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
  // 3. TARIFFS & MEAL PLANS (component: AdminTariffs)
  // ==========================================
  const [tariffFocusRoomId, setTariffFocusRoomId] = useState<string | null>(null);
  const handleTariffDirtyChange = useCallback((dirty: boolean) => {
    tariffDirtyRef.current = dirty;
  }, []);

  /** Prices shown on an inventory card: read from Tariffs & Meal Plans through the pricing engine. */
  const cardRates = (roomId: string) => {
    const saved = resolveRoomTariffs(roomId, roomTariffs);
    if (!saved) return null;
    const today = todayInIST();
    const tonight = calculateDynamicTariff(roomId, today, addCalendarDays(today, 1) || today, 'CP', 2, 0);
    const label = tonight?.breakdown[0]?.seasonType === 'season' ? 'Peak' : tonight?.breakdown[0]?.seasonType === 'off_season' ? 'Off-season' : 'Regular';
    return { saved, tonight: tonight?.avgRatePerNight ?? saved.regular.CP, label };
  };

  // Handle opening Add modal
  const handleOpenAdd = () => {
    setEditingRoom(null);
    setFormData({
      name: '',
      slug: '',
      tagline: '',
      description: '',
      room_type: 'Deluxe Suite',
      capacity_adults: 2,
      capacity_children: 1,
      bed_type: 'King Bed',
      room_size_sqft: 400,
      amenities: ['Complimentary Breakfast', 'High-Speed Starlink Wi-Fi', 'Private Valley Balcony'],
      images: [],
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
      amenities: [...(room.amenities || [])],
      // Hide placeholder images in the editor so new uploads are not saved behind them
      images: (room.images || []).filter((url) => !isPlaceholderImage(url)),
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
    if (!formData.name?.trim()) {
      showToast('Room name is required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const targetId = editingRoom?.id || (formData.id || `room-${Date.now()}`);

      // Automatically include any pending image URL entered by the user, drop placeholders
      // (they used to be saved in front of real photos) and fall back to a local placeholder.
      const pendingImages = [...(formData.images || [])];
      if (imageInput.trim() && !pendingImages.includes(imageInput.trim())) {
        pendingImages.push(imageInput.trim());
      }
      const currentImages = normalizeRoomImages(pendingImages);

      // Rooms carry no prices: those are set only in Tariffs & Meal Plans
      const {
        price_per_night: _p,
        weekend_price: _w,
        base_adults: _b,
        extra_adult_charge: _ea,
        extra_child_charge: _ec,
        tariffs: _t,
        ...roomFields
      } = formData;
      void [_p, _w, _b, _ea, _ec, _t];
      const roomPayload: Room = {
        ...roomFields,
        id: targetId,
        slug: formData.slug || formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: formData.name.trim(),
        tagline: formData.tagline?.trim() || '',
        description: formData.description?.trim() || '',
        room_type: formData.room_type || 'Deluxe Suite',
        capacity_adults: Number(formData.capacity_adults) || 2,
        capacity_children: Number(formData.capacity_children) || 0,
        bed_type: formData.bed_type || 'King Bed',
        room_size_sqft: Number(formData.room_size_sqft) || 350,
        total_inventory: Number(formData.total_inventory) || 1,
        available_inventory: Number(formData.available_inventory) !== undefined ? Number(formData.available_inventory) : 1,
        is_active: formData.is_active !== undefined ? formData.is_active : true,
        amenities: formData.amenities || [],
        images: currentImages,
        updated_at: new Date().toISOString(),
      };

      // Guard against requests the server/host will reject as too large (silently, before)
      const payloadBytes = new Blob([JSON.stringify(roomPayload)]).size;
      if (payloadBytes > ROOM_SAVE_MAX_PAYLOAD_BYTES) {
        showToast(
          `Photos are too large to save together (${(payloadBytes / 1024 / 1024).toFixed(1)} MB). Remove a photo or use smaller images.`,
          'error'
        );
        return;
      }

      // 1. Save to the server FIRST; only a confirmed save is shown as saved
      const result = await adminRequestJson<{ success: boolean; data: Room }>('/api/rooms', {
        method: 'POST',
        body: roomPayload,
      });
      if (!result.ok || !result.data?.data) {
        showToast(result.error || 'The room could not be saved. Nothing was changed on the website.', 'error');
        return;
      }
      const savedRoom: Room = result.data.data;

      // 2. Reflect the server's saved copy locally
      const nextRooms = editingRoom
        ? rooms.map((r) => (r.id === editingRoom.id ? savedRoom : r))
        : [savedRoom, ...rooms];


      if (onUpdateRooms) {
        onUpdateRooms(nextRooms);
      }

      const isNew = !editingRoom;
      const hasPrices = Boolean(resolveRoomTariffs(savedRoom.id, roomTariffs));
      handleCloseModal();
      if (isNew && !hasPrices) {
        // New rooms have no prices until they are set in Tariffs & Meal Plans
        showToast('Room added. Now set its prices: guests see “price on request” until you do.', 'info');
        setTariffFocusRoomId(savedRoom.id);
        handleSelectSubTab('tariffs');
        return;
      }
      showToast(editingRoom ? 'Room updated on the website.' : 'New room added to the website.');
    } catch {
      showToast('Error saving room. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (room: Room) => {
    const updatedRoom: Room = { ...room, is_active: !room.is_active };
    const nextRooms = rooms.map((r) => (r.id === room.id ? updatedRoom : r));
    if (onUpdateRooms) onUpdateRooms(nextRooms);

    // Partial update: only the changed field, so photos/details saved elsewhere are never overwritten
    const result = await adminRequestJson('/api/rooms', {
      method: 'POST',
      body: { id: room.id, name: room.name, is_active: updatedRoom.is_active },
    });
    if (result.ok) {
      showToast(`Room marked as ${updatedRoom.is_active ? 'Active' : 'Inactive'}`);
    } else {
      if (onUpdateRooms) onUpdateRooms(rooms); // revert: the website was not changed
      showToast(result.error || 'Could not update the room on the server.', 'error');
    }
  };

  const handleAdjustInventory = async (room: Room, delta: number) => {
    const nextVal = Math.max(0, Math.min(room.total_inventory, (room.available_inventory || 0) + delta));
    if (nextVal === room.available_inventory) return;

    const updatedRoom: Room = { ...room, available_inventory: nextVal };
    const nextRooms = rooms.map((r) => (r.id === room.id ? updatedRoom : r));
    if (onUpdateRooms) onUpdateRooms(nextRooms);

    const result = await adminRequestJson('/api/rooms', {
      method: 'POST',
      body: { id: room.id, name: room.name, available_inventory: nextVal },
    });
    if (result.ok) {
      showToast(`Inventory updated: ${nextVal} available`);
    } else {
      if (onUpdateRooms) onUpdateRooms(rooms);
      showToast(result.error || 'Could not update inventory on the server.', 'error');
    }
  };

  const handleDeleteRoom = async () => {
    if (!deleteConfirmRoom) return;
    const targetId = deleteConfirmRoom.id;
    setSubmitting(true);
    try {
      const result = await adminRequestJson(`/api/rooms?id=${encodeURIComponent(targetId)}`, { method: 'DELETE' });
      if (!result.ok) {
        showToast(result.error || 'Could not delete the room on the server.', 'error');
        return;
      }
      const nextRooms = rooms.filter((r) => r.id !== targetId);
      if (onUpdateRooms) onUpdateRooms(nextRooms);
      showToast('Room deleted successfully');
      setDeleteConfirmRoom(null);
    } catch {
      showToast('Could not delete the room.', 'error');
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
    const current = (formData.images || []).filter((url) => !isPlaceholderImage(url));
    if (!current.includes(imageInput.trim())) {
      setFormData({ ...formData, images: [...current, imageInput.trim()] });
    }
    setImageInput('');
  };

  const handleRemoveImage = (index: number) => {
    const current = formData.images || [];
    setFormData({ ...formData, images: current.filter((_, i) => i !== index) });
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const selected = Array.from(files);
    e.target.value = '';

    // Resize + compress in the browser before adding (full-size phone photos made the save
    // request too large and it failed silently). Files are processed in order.
    (async () => {
      let added = 0;
      for (const file of selected) {
        try {
          const compressed = await compressImageFile(file);
          // Upload straight to photo storage; the room keeps only the URL.
          const uploaded = await adminRequestJson<{ success: boolean; file: { url: string } }>('/api/uploads', {
            method: 'POST',
            body: { kind: 'room_photo', dataUrl: compressed },
          });
          if (!uploaded.ok || !uploaded.data?.file?.url) {
            throw new Error(uploaded.error || 'The photo could not be uploaded.');
          }
          const url = uploaded.data.file.url;
          setFormData((prev) => ({
            ...prev,
            images: [...(prev.images || []).filter((u) => !isPlaceholderImage(u)), url],
          }));
          added += 1;
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Could not read this photo.', 'error');
        }
      }
      if (added > 0) {
        showToast(`${added} photo${added > 1 ? 's' : ''} uploaded. Click Save to publish them on the website.`);
      }
    })();
  };

  // ==========================================
  // SEASONAL DATE RANGES HANDLERS
  // ==========================================
  const handleOpenAddSeason = () => {
    setEditingSeason(null);
    setSeasonForm({
      name: '',
      seasonType: undefined,
      startDate: todayInIST(),
      endDate: addCalendarDays(todayInIST(), 30) || todayInIST(),
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

    if (seasonForm.seasonType !== 'season' && seasonForm.seasonType !== 'off_season') {
      showToast('Choose whether these dates use Peak or Off-season prices', 'error');
      return;
    }

    if (editingSeason) {
      updateSeasonalRange(editingSeason.id, {
        name: seasonForm.name.trim(),
        seasonType: seasonForm.seasonType || 'season',
        startDate: seasonForm.startDate,
        endDate: seasonForm.endDate,
        description: seasonForm.description?.trim() || '',
        minNights: seasonForm.minNights && seasonForm.minNights > 1 ? seasonForm.minNights : undefined,
      });
      // Success / failure toast is shown by the CRM context once the server confirms the save
    } else {
      addSeasonalRange({
        name: seasonForm.name.trim(),
        seasonType: seasonForm.seasonType || 'season',
        startDate: seasonForm.startDate,
        endDate: seasonForm.endDate,
        description: seasonForm.description?.trim() || '',
        minNights: seasonForm.minNights && seasonForm.minNights > 1 ? seasonForm.minNights : undefined,
      });
      // Success / failure toast is shown by the CRM context once the server confirms the save
    }
    setIsSeasonModalOpen(false);
  };

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
            onClick={() => handleSelectSubTab('tariffs')}
            className={`px-3.5 py-2 rounded-lg font-semibold transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
              activeSubTab === 'tariffs'
                ? 'bg-white text-forest-900 shadow-sm'
                : 'text-gray-600 hover:text-forest-900'
            }`}
          >
            <Utensils className="w-4 h-4 text-forest-600" />
            <span>Tariffs & Meal Plans (all room prices)</span>
          </button>
        </div>

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
                  : ROOM_PLACEHOLDER_IMAGE;

              return (
                <div
                  key={room.id}
                  className={`bg-white rounded-2xl border transition-all shadow-sm overflow-hidden flex flex-col ${
                    room.is_active ? 'border-sand-200' : 'border-gray-300 opacity-75'
                  }`}
                >
                  {/* Room Image & Badges */}
                  <div className="relative h-48 bg-sand-200 overflow-hidden group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
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
                      {(() => {
                        const r = cardRates(room.id);
                        if (!r) {
                          return (
                            <div className="text-xs font-semibold text-sand-200">
                              {tariffsStatus === 'ready' ? 'No rates yet: set them in Tariffs & Meal Plans' : 'Loading rates…'}
                            </div>
                          );
                        }
                        return (
                          <>
                            <div className="font-serif text-lg font-bold">
                              ₹{Math.round(r.tonight).toLocaleString('en-IN')}
                              <span className="text-xs font-normal text-sand-200"> / night tonight · CP · {r.label}</span>
                            </div>
                            <div className="text-[11px] text-sand-300">
                              CP: Regular ₹{r.saved.regular.CP.toLocaleString('en-IN')} · Peak ₹{r.saved.season.CP.toLocaleString('en-IN')} · Off ₹
                              {r.saved.offSeason.CP.toLocaleString('en-IN')}
                            </div>
                          </>
                        );
                      })()}
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
      {activeSubTab === 'tariffs' && (
        <AdminTariffs
          rooms={rooms}
          focusRoomId={tariffFocusRoomId}
          onDirtyChange={handleTariffDirtyChange}
          showToast={showToast}
        />
      )}

      {activeSubTab === 'tariffs' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-sand-200 shadow-sm">
            <div>
              <h3 className="font-serif text-lg font-bold text-forest-950">
                When Peak and Off-season prices apply
              </h3>
              <p className="text-xs text-gray-500">
                Nights inside a Peak range use the Peak prices above; nights inside an Off-season range use the Off-season prices.
                All other nights use Regular prices. If ranges overlap, Peak wins. Transfers and bike rentals use these dates too.
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
                  Configure room details, photos, capacity, and amenities
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

              {/* Dynamic Seasonal Tariffs Notice Banner (Replaces static price inputs to prevent tariff clashes) */}
              <div className="p-4 bg-[#FAF8F5] rounded-2xl border border-[#E5DEC9] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-start space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-[#142820] text-[#C5A059] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    <IndianRupee className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-[#142820] flex items-center space-x-2">
                      <span>Prices are not set here</span>
                    </h5>
                    <p className="text-[11px] text-[#5C6D66] mt-0.5 leading-relaxed">
                      All prices for this room (EP/CP/MAP/AP for Regular, Peak and Off-season, weekend surcharge, extra adult and child charges,
                      adults included) are set only in <strong>Tariffs &amp; Meal Plans</strong>.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleCloseModal();
                    handleSelectSubTab('tariffs');
                  }}
                  className="px-3.5 py-2 bg-[#142820] hover:bg-[#1E3A2F] text-[#FAF8F5] rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-colors shadow-xs flex items-center space-x-1.5"
                >
                  <span>Set prices in Tariffs &amp; Meal Plans</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#C5A059]" />
                </button>
              </div>

              {/* Room Capacity & Specifications */}
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
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="thumbnail" className="w-full h-full object-cover" />
                      </div>
                      <span className="text-xs text-gray-700 truncate flex-1 font-mono">
                        {url.startsWith('data:')
                          ? `Uploaded photo (${Math.round(dataUrlBytes(url) / 1024)} KB)`
                          : url}
                      </span>
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

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 flex gap-2">
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
                      className="bg-forest-800 hover:bg-forest-900 text-white text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center space-x-1 whitespace-nowrap"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Add URL</span>
                    </button>
                  </div>

                  <label className="flex items-center justify-center space-x-1 px-3.5 py-2 bg-sand-100 hover:bg-sand-200 border border-sand-300 rounded-xl text-xs font-semibold text-forest-900 cursor-pointer whitespace-nowrap transition-colors">
                    <Upload className="w-3.5 h-3.5 text-forest-700" />
                    <span>Upload File</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageFileUpload}
                      className="hidden"
                    />
                  </label>
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
                  value={seasonForm.seasonType || ''}
                  onChange={(e) =>
                    setSeasonForm({
                      ...seasonForm,
                      seasonType: e.target.value as 'season' | 'off_season',
                    })
                  }
                  className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs font-semibold"
                >
                  <option value="" disabled>Choose which prices these dates use…</option>
                  <option value="season">Peak season prices</option>
                  <option value="off_season">Off-season prices</option>
                </select>
                {seasonForm.seasonType === 'season' && /off|lean|low/i.test(seasonForm.name || '') && (
                  <p className="text-[11px] text-amber-800 mt-1">
                    The name says off-season, but these dates are set to use Peak prices. Check the choice above.
                  </p>
                )}
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
                  Minimum stay (nights)
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={seasonForm.minNights || 1}
                  onChange={(e) => setSeasonForm({ ...seasonForm, minNights: Math.max(1, Math.min(30, Number(e.target.value) || 1)) })}
                  className="w-full px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs font-semibold"
                />
                <span className="text-[10px] text-gray-500 mt-0.5 block">
                  Website bookings that include a night in this range must be at least this long (1 = no limit).
                </span>
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
