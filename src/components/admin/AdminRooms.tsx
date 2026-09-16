'use client';

import { useState, useEffect } from 'react';
import { Room } from '@/types';
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
  EyeOff
} from 'lucide-react';

interface AdminRoomsProps {
  rooms: Room[];
  onRefresh: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
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
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(isAddModalOpen);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deleteConfirmRoom, setDeleteConfirmRoom] = useState<Room | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [formData, setFormData] = useState<Partial<Room>>({
    name: '',
    slug: '',
    tagline: '',
    description: '',
    room_type: 'Deluxe Suite',
    price_per_night: 4500,
    weekend_price: 5200,
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

  // Handle opening Edit modal
  const handleOpenEdit = (room: Room) => {
    setEditingRoom(room);
    setFormData({
      ...room,
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

  // Save Room via API
  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim() || !formData.price_per_night) {
      showToast('Room name and nightly price are required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        id: editingRoom ? editingRoom.id : undefined,
        slug: formData.slug || formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        price_per_night: Number(formData.price_per_night),
        weekend_price: formData.weekend_price ? Number(formData.weekend_price) : Number(formData.price_per_night),
        capacity_adults: Number(formData.capacity_adults) || 2,
        capacity_children: Number(formData.capacity_children) || 0,
        room_size_sqft: Number(formData.room_size_sqft) || 350,
        total_inventory: Number(formData.total_inventory) || 1,
        available_inventory: Number(formData.available_inventory) !== undefined ? Number(formData.available_inventory) : 1,
      };

      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.success) {
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

  // Quick Toggle Active Status
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

  // Quick Adjust Available Inventory
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

  // Delete Room via API
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

  // Filtered rooms
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

  // Amenity tag toggle
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

  // Image handlers
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header & Search/Filter Controls */}
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

                {/* Quick Toggle Active Button */}
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
                    {room.amenities?.length || 0} amenities listed
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

      {filteredRooms.length === 0 && (
        <div className="bg-white rounded-2xl border border-sand-200 p-12 text-center">
          <Bed className="w-12 h-12 text-sand-300 mx-auto mb-3" />
          <h3 className="font-serif text-base font-bold text-forest-950">No rooms found</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            Try adjusting your search query or status filter, or create a brand new room.
          </p>
          <button
            onClick={handleOpenAdd}
            className="mt-4 inline-flex items-center space-x-2 bg-forest-800 text-white text-xs font-semibold px-4 py-2 rounded-xl"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Room</span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD / EDIT ROOM MODAL */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-sand-200 overflow-hidden my-8 animate-slide-up">
            {/* Modal Header */}
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

            {/* Modal Body Form */}
            <form onSubmit={handleSaveRoom} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Row 1: Name & Slug */}
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

              {/* Tagline */}
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

              {/* Description */}
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

              {/* Rates: Weekday & Weekend */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-sand-50/70 rounded-xl border border-sand-200">
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Nightly Rate (₹ INR) *
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

              {/* Capacity, Bed & Size */}
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

              {/* Inventory Management */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-sand-50/70 rounded-xl border border-sand-200">
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Total Inventory Units
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
                    className="w-full px-3.5 py-2.5 bg-white border border-sand-300 rounded-xl text-xs sm:text-sm font-semibold text-forest-950 focus:ring-2 focus:ring-forest-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Currently Available
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={formData.total_inventory || 1}
                    value={formData.available_inventory ?? 1}
                    onChange={(e) => setFormData({ ...formData, available_inventory: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-white border border-sand-300 rounded-xl text-xs sm:text-sm font-semibold text-forest-950 focus:ring-2 focus:ring-forest-600"
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
                    placeholder="Add custom amenity (e.g. Jacuzzi Bath, Stargazing Telescope)..."
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

              {/* Photos / Images List */}
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
                    placeholder="Paste Unsplash or direct image URL..."
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

              {/* Modal Footer CTA */}
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
