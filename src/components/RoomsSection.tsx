'use client';

import { useState, useEffect } from 'react';
import { Room } from '@/types';
import { RoomSeasonalTariffs } from '@/types/crm';
import { INITIAL_ROOM_SEASONAL_TARIFFS } from '@/lib/crm-data';
import { normalizeCategoryId } from '@/lib/tariff-calculator';
import { Users, Bed, Maximize2, Check, ArrowRight, MessageSquare, Sparkles, ChevronLeft, ChevronRight, Coffee, Utensils } from 'lucide-react';

interface RoomsSectionProps {
  rooms: Room[];
  onBookRoom: (room: Room, dates?: { checkIn: string; checkOut: string }, mealPlan?: 'EP' | 'CP' | 'MAP' | 'AP') => void;
  onEnquireRoom: (room: Room) => void;
}

export default function RoomsSection({ rooms, onBookRoom, onEnquireRoom }: RoomsSectionProps) {
  // Store current image index per room
  const [activeImageIndices, setActiveImageIndices] = useState<Record<string, number>>({});
  // Store selected meal plan per room ('CP' by default)
  const [selectedPlans, setSelectedPlans] = useState<Record<string, 'EP' | 'CP' | 'MAP' | 'AP'>>({});
  // Store state for expanding detailed tariff view per room
  const [expandedTariffs, setExpandedTariffs] = useState<Record<string, boolean>>({});
  // Live tariffs from backend PMS
  const [liveTariffs, setLiveTariffs] = useState<Record<string, RoomSeasonalTariffs>>(INITIAL_ROOM_SEASONAL_TARIFFS);

  useEffect(() => {
    async function loadTariffs() {
      try {
        const res = await fetch('/api/tariffs');
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data?.tariffs) {
            setLiveTariffs((prev) => ({ ...prev, ...json.data.tariffs }));
          }
        }
      } catch {}
    }
    loadTariffs();
  }, []);

  const nextImage = (roomId: string, total: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveImageIndices((prev) => ({
      ...prev,
      [roomId]: ((prev[roomId] || 0) + 1) % total,
    }));
  };

  const prevImage = (roomId: string, total: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveImageIndices((prev) => ({
      ...prev,
      [roomId]: ((prev[roomId] || 0) - 1 + total) % total,
    }));
  };

  return (
    <section id="rooms" className="py-20 sm:py-28 bg-gradient-to-b from-[#F3F7FF] via-[#E9EDFA]/50 to-[#F3F7FF] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-primary-700 bg-primary-100 px-3.5 py-1 rounded-full inline-block mb-3 shadow-xs">
            Handcrafted Accommodations
          </span>
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0B1733] tracking-tight leading-tight mb-4"
            style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
          >
            Rooms & Suite Tariffs
          </h2>
          <p className="text-gray-600 text-base sm:text-lg font-normal">
            Choose from our private cedar suites and balcony rooms. All rooms feature breathtaking Himalayan views, heated comforts, and customizable meal plans.
          </p>
          <div className="w-16 h-1 bg-[#FE6E00] mx-auto rounded-full mt-6" />
        </div>

        {/* Room Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {rooms.map((room) => {
            const images = room.images && room.images.length > 0
              ? room.images
              : ['/images/hero/deluxe-bedroom-suite.jpg'];
            const currentImgIndex = activeImageIndices[room.id] || 0;

            // Compute exact meal plan rates matching backend PMS
            const catKey = normalizeCategoryId(room.id);
            const tariffsObj =
              liveTariffs[room.id] ||
              liveTariffs[catKey] ||
              room.tariffs ||
              INITIAL_ROOM_SEASONAL_TARIFFS[room.id] ||
              INITIAL_ROOM_SEASONAL_TARIFFS[catKey];

            const canonicalRegular = tariffsObj?.regular || {
              EP: 4500,
              CP: 5200,
              MAP: 6200,
              AP: 7200,
            };

            const planRates: Record<'EP' | 'CP' | 'MAP' | 'AP', number> = {
              EP: canonicalRegular.EP,
              CP: canonicalRegular.CP,
              MAP: canonicalRegular.MAP,
              AP: canonicalRegular.AP,
            };

            const activePlan = selectedPlans[room.id] || 'CP';
            const currentRate = planRates[activePlan];
            const isTariffOpen = !!expandedTariffs[room.id];

            return (
              <div
                key={room.id}
                className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgba(37,71,158,0.12)] transition-all duration-300 flex flex-col group"
              >
                {/* Image Gallery with Controls */}
                <div className="relative h-64 sm:h-72 w-full overflow-hidden bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={images[currentImgIndex]}
                    alt={room.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 filter contrast-[1.05] saturate-[1.08]"
                  />

                  {/* Room Type & Active Meal Plan Badge */}
                  <div className="absolute top-4 left-4 z-10 flex flex-col items-start gap-1.5">
                    <span className="bg-[#0B1733]/85 backdrop-blur-md text-white text-xs font-semibold px-3 py-1.5 rounded-full border border-white/20 flex items-center space-x-1 shadow-sm">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>{room.room_type || 'Boutique Room'}</span>
                    </span>
                    {activePlan === 'CP' && (
                      <span className="bg-emerald-800/90 backdrop-blur-md text-white text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-400/30 flex items-center space-x-1.5 shadow-sm">
                        <Coffee className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Breakfast included</span>
                      </span>
                    )}
                    {activePlan === 'MAP' && (
                      <span className="bg-[#FE6E00]/90 backdrop-blur-md text-white text-xs font-bold px-2.5 py-1 rounded-full border border-white/30 flex items-center space-x-1.5 shadow-sm">
                        <Utensils className="w-3.5 h-3.5 text-white" />
                        <span>Breakfast + Dinner</span>
                      </span>
                    )}
                    {activePlan === 'AP' && (
                      <span className="bg-primary-900/90 backdrop-blur-md text-white text-xs font-bold px-2.5 py-1 rounded-full border border-primary-400/30 flex items-center space-x-1.5 shadow-sm">
                        <Utensils className="w-3.5 h-3.5 text-amber-300" />
                        <span>All Meals Included</span>
                      </span>
                    )}
                    {activePlan === 'EP' && (
                      <span className="bg-gray-900/80 backdrop-blur-md text-gray-200 text-xs font-semibold px-2.5 py-1 rounded-full border border-gray-600/30 flex items-center space-x-1.5 shadow-sm">
                        <Bed className="w-3.5 h-3.5 text-gray-300" />
                        <span>Room Only (EP)</span>
                      </span>
                    )}
                  </div>

                  {/* Room Inventory & Numbers Badge */}
                  <div className="absolute top-4 right-4 z-10">
                    <span className="bg-black/60 backdrop-blur-md text-amber-300 text-xs font-bold px-3 py-1 rounded-full border border-amber-400/30">
                      {room.id === 'room-cat-1' || room.name.includes('Mountain View with Balcony')
                        ? 'Rooms 101, 102, 103'
                        : room.id === 'room-cat-2' || room.name.includes('Forest View')
                        ? 'Room 104'
                        : 'Suites 201, 202, 203'}
                    </span>
                  </div>

                  {/* Image Navigation Arrows */}
                  {images.length > 1 && (
                    <>
                      <button
                        onClick={(e) => prevImage(room.id, images.length, e)}
                        aria-label="Previous photo"
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => nextImage(room.id, images.length, e)}
                        aria-label="Next photo"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>

                      {/* Photo Dots */}
                      <div className="absolute bottom-3 left-0 right-0 flex justify-center space-x-1.5 z-10">
                        {images.map((_, i) => (
                          <span
                            key={i}
                            className={`w-2 h-2 rounded-full transition-all ${
                              i === currentImgIndex ? 'bg-white scale-125' : 'bg-white/50'
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Content Container */}
                <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Title & Tagline */}
                    <h3
                      className="text-xl sm:text-2xl font-bold text-[#0B1733] mb-1"
                      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                    >
                      {room.name}
                    </h3>
                    {room.tagline && (
                      <p className="text-xs sm:text-sm text-primary-700 font-medium mb-4">
                        {room.tagline}
                      </p>
                    )}

                    {/* Room Attributes */}
                    <div className="grid grid-cols-3 gap-2 py-3 mb-4 border-y border-gray-100 text-xs text-gray-600">
                      <div className="flex items-center space-x-1.5">
                        <Users className="w-4 h-4 text-primary-600 flex-shrink-0" />
                        <span>{room.capacity_adults} Adults {room.capacity_children > 0 && `+ ${room.capacity_children}`}</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <Bed className="w-4 h-4 text-primary-600 flex-shrink-0" />
                        <span className="truncate">{room.bed_type}</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <Maximize2 className="w-4 h-4 text-primary-600 flex-shrink-0" />
                        <span>{room.room_size_sqft} sq ft</span>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-gray-600 text-sm leading-relaxed mb-4 line-clamp-3">
                      {room.description}
                    </p>

                    {/* Amenities tags */}
                    <div className="flex flex-wrap gap-1.5 mb-5">
                      {room.amenities.slice(0, 4).map((amenity, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center space-x-1 text-xs bg-primary-50 text-primary-800 border border-primary-100 px-2.5 py-1 rounded-full font-medium"
                        >
                          <Check className="w-3 h-3 text-primary-600" />
                          <span>{amenity}</span>
                        </span>
                      ))}
                      {room.amenities.length > 4 && (
                        <span className="text-xs text-primary-700 bg-gray-100 px-2 py-1 rounded-full font-medium">
                          +{room.amenities.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Pricing, Tariffs & Action Buttons */}
                  <div className="pt-4 border-t border-gray-100">
                    {/* Interactive Meal Plan Selector Tabs */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#0B1733]">
                          Select Meal Plan
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedTariffs((prev) => ({ ...prev, [room.id]: !prev[room.id] }))}
                          className="text-[11px] font-semibold text-primary-700 hover:text-primary-900 underline cursor-pointer"
                        >
                          {isTariffOpen ? 'Hide all plans' : 'Compare plans'}
                        </button>
                      </div>

                      {/* 4 Plan Chips */}
                      <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#F3F7FF] rounded-2xl border border-[#C7D4F5]">
                        {(['EP', 'CP', 'MAP', 'AP'] as const).map((plan) => {
                          const isSelected = activePlan === plan;
                          return (
                            <button
                              key={plan}
                              type="button"
                              onClick={() => setSelectedPlans((prev) => ({ ...prev, [room.id]: plan }))}
                              className={`py-1.5 px-1 rounded-xl text-center transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-primary-600 text-white shadow-sm font-bold'
                                  : 'text-gray-700 hover:bg-[#E9EDFA] font-medium'
                              }`}
                            >
                              <div className="text-xs leading-tight">{plan}</div>
                              <div className={`text-[10px] leading-tight mt-0.5 ${isSelected ? 'text-amber-300' : 'text-gray-500'}`}>
                                ₹{planRates[plan].toLocaleString()}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Active Plan Detail Line */}
                      <div className="mt-2 text-xs text-primary-900 flex items-center justify-between bg-primary-50/70 px-3 py-1.5 rounded-xl border border-primary-100">
                        <span className="font-medium">
                          {activePlan === 'EP' && 'EP: Room Only (Meals extra à la carte)'}
                          {activePlan === 'CP' && 'CP: Farmhouse Breakfast included'}
                          {activePlan === 'MAP' && 'MAP: Breakfast & Dinner included'}
                          {activePlan === 'AP' && 'AP: All Meals included (Full Board)'}
                        </span>
                        <span className="text-[11px] text-emerald-700 font-semibold">Instant Confirmation</span>
                      </div>

                      {/* Collapsible Tariff Comparison Table */}
                      {isTariffOpen && (
                        <div className="mt-2 p-3 bg-white border border-gray-200 rounded-2xl text-xs space-y-1.5 animate-fade-in shadow-xs">
                          <div className="text-[11px] font-bold text-[#0B1733] uppercase tracking-wider border-b border-gray-100 pb-1">
                            Regular Season Tariff Breakdown
                          </div>
                          <div className="flex justify-between items-center text-gray-700">
                            <span>EP (Room Only):</span>
                            <span className="font-semibold text-[#0B1733]">₹{planRates.EP.toLocaleString()} / night</span>
                          </div>
                          <div className="flex justify-between items-center text-gray-700">
                            <span>CP (Breakfast Included):</span>
                            <span className="font-semibold text-primary-700">₹{planRates.CP.toLocaleString()} / night</span>
                          </div>
                          <div className="flex justify-between items-center text-gray-700">
                            <span>MAP (Breakfast + Dinner):</span>
                            <span className="font-semibold text-primary-700">₹{planRates.MAP.toLocaleString()} / night</span>
                          </div>
                          <div className="flex justify-between items-center text-gray-700">
                            <span>AP (All 3 Meals Included):</span>
                            <span className="font-semibold text-primary-700">₹{planRates.AP.toLocaleString()} / night</span>
                          </div>
                          {room.tariffs?.season && (
                            <div className="pt-1.5 border-t border-gray-100 text-[11px] text-gray-500">
                              Peak Season: EP ₹{room.tariffs.season.EP} • CP ₹{room.tariffs.season.CP}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Prominent Price & Weekend Display */}
                    <div className="flex items-baseline justify-between mb-4">
                      <div>
                        <span className="text-xs uppercase tracking-wider text-gray-500 block">
                          {activePlan} Nightly Rate
                        </span>
                        <div className="flex items-baseline space-x-1">
                          <span
                            className="text-3xl font-bold text-[#0B1733]"
                            style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                          >
                            ₹{currentRate.toLocaleString()}
                          </span>
                          <span className="text-xs text-gray-500">/ night</span>
                        </div>
                        <span className="text-[11px] text-gray-500 block mt-0.5 font-medium">
                          Base {room.base_adults || 2} Adults {room.extra_adult_charge ? `· Extra Adult: +₹${room.extra_adult_charge}` : ''}
                        </span>
                      </div>
                      {room.weekend_price && (
                        <div className="text-right">
                          <span className="text-xs text-gray-400 block">Weekend</span>
                          <span className="text-xs font-semibold text-gray-600">
                            ₹{room.weekend_price.toLocaleString()} / night
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Dual Action Buttons: Book and Enquire */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => onBookRoom(room, undefined, activePlan)}
                        className="w-full bg-gradient-to-r from-[#FE6E00] to-[#EA580C] hover:from-[#EA580C] hover:to-[#C2410C] text-white text-sm font-bold py-3 px-3 rounded-2xl shadow-[0_4px_14px_rgba(254,110,0,0.35)] transition-transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <span>Book ({activePlan})</span>
                        <ArrowRight className="w-4 h-4 text-white" />
                      </button>
                      <button
                        onClick={() => onEnquireRoom(room)}
                        className="w-full bg-[#F3F7FF] hover:bg-[#E9EDFA] text-primary-700 border border-[#C7D4F5] text-sm font-semibold py-3 px-3 rounded-2xl transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <MessageSquare className="w-4 h-4 text-primary-600" />
                        <span>Enquire</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

