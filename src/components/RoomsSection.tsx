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
    <section id="rooms" className="py-20 sm:py-28 bg-[#FAF8F5] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-[#142820] bg-[#142820]/5 border border-[#142820]/10 px-4 py-1.5 rounded-full inline-flex items-center gap-1.5 mb-3 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-[#C85A32]" />
            <span>Handcrafted Accommodations</span>
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#142820] font-serif tracking-tight leading-tight mb-4">
            Suites & Mountain Residencies
          </h2>
          <p className="text-[#5C6D66] text-base sm:text-lg font-normal leading-relaxed">
            Each private sanctuary is crafted with Himalayan cedar, sweeping valley balconies, and warm bespoke comforts. Reserve with our signature farmhouse breakfast.
          </p>
          <div className="w-16 h-0.5 bg-[#C85A32] mx-auto rounded-full mt-6" />
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
                className="bg-white rounded-3xl overflow-hidden border border-[#EBE5DA] shadow-[0_8px_30px_rgba(20,40,32,0.06)] hover:shadow-[0_22px_45px_rgba(20,40,32,0.12)] hover:-translate-y-1 transition-all duration-300 flex flex-col group"
              >
                {/* Image Gallery with Controls */}
                <div className="relative h-64 sm:h-72 w-full overflow-hidden bg-[#ECE7DC]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={images[currentImgIndex]}
                    alt={room.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 filter brightness-[0.98] contrast-[1.02]"
                  />

                  {/* Room Type & Active Meal Plan Badge */}
                  <div className="absolute top-4 left-4 z-10 flex flex-col items-start gap-1.5">
                    <span className="bg-[#142820]/85 backdrop-blur-md text-white text-xs font-semibold px-3 py-1.5 rounded-full border border-white/20 flex items-center space-x-1 shadow-sm">
                      <Sparkles className="w-3 h-3 text-[#C5A059]" />
                      <span>{room.room_type || 'Boutique Suite'}</span>
                    </span>
                    {activePlan === 'CP' && (
                      <span className="bg-[#142820]/90 backdrop-blur-md text-[#E8DCC4] text-xs font-medium px-2.5 py-1 rounded-full border border-[#C5A059]/40 flex items-center space-x-1.5 shadow-sm">
                        <Coffee className="w-3.5 h-3.5 text-[#C5A059]" />
                        <span>Farmhouse Breakfast Included</span>
                      </span>
                    )}
                    {activePlan === 'MAP' && (
                      <span className="bg-[#C85A32]/95 backdrop-blur-md text-white text-xs font-medium px-2.5 py-1 rounded-full border border-white/30 flex items-center space-x-1.5 shadow-sm">
                        <Utensils className="w-3.5 h-3.5 text-white" />
                        <span>Breakfast + Mountain Dinner</span>
                      </span>
                    )}
                    {activePlan === 'AP' && (
                      <span className="bg-[#142820]/95 backdrop-blur-md text-white text-xs font-medium px-2.5 py-1 rounded-full border border-white/30 flex items-center space-x-1.5 shadow-sm">
                        <Utensils className="w-3.5 h-3.5 text-[#C5A059]" />
                        <span>All Meals Included (Full Board)</span>
                      </span>
                    )}
                    {activePlan === 'EP' && (
                      <span className="bg-black/70 backdrop-blur-md text-gray-200 text-xs font-medium px-2.5 py-1 rounded-full border border-white/20 flex items-center space-x-1.5 shadow-sm">
                        <Bed className="w-3.5 h-3.5 text-gray-300" />
                        <span>Room Only (EP)</span>
                      </span>
                    )}
                  </div>

                  {/* Room Inventory & Numbers Badge */}
                  <div className="absolute top-4 right-4 z-10">
                    <span className="bg-black/60 backdrop-blur-md text-[#E8DCC4] text-xs font-medium px-3 py-1 rounded-full border border-white/15">
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
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#142820]/60 hover:bg-[#142820]/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => nextImage(room.id, images.length, e)}
                        aria-label="Next photo"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#142820]/60 hover:bg-[#142820]/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm cursor-pointer"
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
                    <h3 className="text-xl sm:text-2xl font-bold text-[#142820] font-serif mb-1 group-hover:text-[#C85A32] transition-colors">
                      {room.name}
                    </h3>
                    {room.tagline && (
                      <p className="text-xs sm:text-sm text-[#5C6D66] font-medium mb-4">
                        {room.tagline}
                      </p>
                    )}

                    {/* Room Attributes */}
                    <div className="grid grid-cols-3 gap-2 py-3 mb-4 border-y border-[#EBE5DA] text-xs text-[#5C6D66]">
                      <div className="flex items-center space-x-1.5">
                        <Users className="w-4 h-4 text-[#142820] flex-shrink-0" />
                        <span>{room.capacity_adults} Adults {room.capacity_children > 0 && `+ ${room.capacity_children}`}</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <Bed className="w-4 h-4 text-[#142820] flex-shrink-0" />
                        <span className="truncate">{room.bed_type}</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <Maximize2 className="w-4 h-4 text-[#142820] flex-shrink-0" />
                        <span>{room.room_size_sqft} sq ft</span>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-[#4A5752] text-sm leading-relaxed mb-4 line-clamp-3">
                      {room.description}
                    </p>

                    {/* Amenities tags */}
                    <div className="flex flex-wrap gap-1.5 mb-5">
                      {room.amenities.slice(0, 4).map((amenity, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center space-x-1 text-xs bg-[#FAF8F5] text-[#142820] border border-[#E5DEC9] px-2.5 py-1 rounded-full font-medium"
                        >
                          <Check className="w-3 h-3 text-[#C85A32]" />
                          <span>{amenity}</span>
                        </span>
                      ))}
                      {room.amenities.length > 4 && (
                        <span className="text-xs text-[#5C6D66] bg-[#F2ECE0] px-2 py-1 rounded-full font-medium">
                          +{room.amenities.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Pricing, Tariffs & Action Buttons */}
                  <div className="pt-4 border-t border-[#EBE5DA]">
                    {/* Interactive Meal Plan Selector Tabs */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#142820]">
                          Select Meal Plan
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedTariffs((prev) => ({ ...prev, [room.id]: !prev[room.id] }))}
                          className="text-[11px] font-semibold text-[#C85A32] hover:text-[#B34D28] underline cursor-pointer"
                        >
                          {isTariffOpen ? 'Hide plan comparison' : 'Compare all plans'}
                        </button>
                      </div>

                      {/* 4 Plan Chips */}
                      <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#FAF8F5] rounded-2xl border border-[#E8E2D5]">
                        {(['EP', 'CP', 'MAP', 'AP'] as const).map((plan) => {
                          const isSelected = activePlan === plan;
                          return (
                            <button
                              key={plan}
                              type="button"
                              onClick={() => setSelectedPlans((prev) => ({ ...prev, [room.id]: plan }))}
                              className={`py-2 px-1 rounded-xl text-center transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-[#142820] text-white shadow-sm font-bold'
                                  : 'text-[#4B5E54] hover:bg-[#F2ECE0] font-medium'
                              }`}
                            >
                              <div className="text-xs leading-tight font-semibold">{plan}</div>
                              <div className={`text-[10px] leading-tight mt-0.5 ${isSelected ? 'text-[#C5A059]' : 'text-[#7B8B84]'}`}>
                                ₹{planRates[plan].toLocaleString()}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Active Plan Detail Line */}
                      <div className="mt-2 text-xs text-[#142820] flex items-center justify-between bg-[#F5EFE6] px-3 py-1.5 rounded-xl border border-[#DFD7C7]">
                        <span className="font-medium">
                          {activePlan === 'EP' && 'EP: Room Only (Meals à la carte)'}
                          {activePlan === 'CP' && 'CP: Farmhouse Breakfast included'}
                          {activePlan === 'MAP' && 'MAP: Farmhouse Breakfast & Dinner included'}
                          {activePlan === 'AP' && 'AP: All Farm Meals included (Full Board)'}
                        </span>
                        <span className="text-[11px] text-[#2C6B4F] font-semibold">Direct Host Rate</span>
                      </div>

                      {/* Collapsible Tariff Comparison Table */}
                      {isTariffOpen && (
                        <div className="mt-2 p-3 bg-white border border-[#E8E2D5] rounded-2xl text-xs space-y-1.5 animate-fade-in shadow-xs">
                          <div className="text-[11px] font-bold text-[#142820] uppercase tracking-wider border-b border-[#EBE5DA] pb-1">
                            Season Tariff Breakdown
                          </div>
                          <div className="flex justify-between items-center text-[#5C6D66]">
                            <span>EP (Room Only):</span>
                            <span className="font-semibold text-[#142820]">₹{planRates.EP.toLocaleString()} / night</span>
                          </div>
                          <div className="flex justify-between items-center text-[#5C6D66]">
                            <span>CP (Breakfast Included):</span>
                            <span className="font-semibold text-[#C85A32]">₹{planRates.CP.toLocaleString()} / night</span>
                          </div>
                          <div className="flex justify-between items-center text-[#5C6D66]">
                            <span>MAP (Breakfast + Dinner):</span>
                            <span className="font-semibold text-[#142820]">₹{planRates.MAP.toLocaleString()} / night</span>
                          </div>
                          <div className="flex justify-between items-center text-[#5C6D66]">
                            <span>AP (All 3 Meals Included):</span>
                            <span className="font-semibold text-[#142820]">₹{planRates.AP.toLocaleString()} / night</span>
                          </div>
                          {room.tariffs?.season && (
                            <div className="pt-1.5 border-t border-[#EBE5DA] text-[11px] text-[#7B8B84]">
                              Peak Holiday Season: EP ₹{room.tariffs.season.EP} • CP ₹{room.tariffs.season.CP}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Prominent Price & Weekend Display */}
                    <div className="flex items-baseline justify-between mb-4">
                      <div>
                        <span className="text-xs uppercase tracking-wider text-[#7B8B84] block font-medium">
                          {activePlan} Nightly Rate
                        </span>
                        <div className="flex items-baseline space-x-1">
                          <span className="text-3xl font-bold text-[#142820] font-serif">
                            ₹{currentRate.toLocaleString()}
                          </span>
                          <span className="text-xs text-[#7B8B84]">/ night</span>
                        </div>
                        <span className="text-[11px] text-[#5C6D66] block mt-0.5 font-medium">
                          Base {room.base_adults || 2} Adults {room.extra_adult_charge ? `· Extra Adult: +₹${room.extra_adult_charge}` : ''}
                        </span>
                      </div>
                      {room.weekend_price && (
                        <div className="text-right">
                          <span className="text-xs text-[#7B8B84] block font-medium">Weekend</span>
                          <span className="text-xs font-semibold text-[#142820]">
                            ₹{room.weekend_price.toLocaleString()} / night
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Dual Action Buttons: Book and Enquire */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => onBookRoom(room, undefined, activePlan)}
                        className="w-full bg-[#C85A32] hover:bg-[#B34D28] text-white text-sm font-semibold py-3 px-3 rounded-2xl shadow-[0_4px_14px_rgba(200,90,50,0.25)] transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <span>Reserve Suite</span>
                        <ArrowRight className="w-4 h-4 text-white" />
                      </button>
                      <button
                        onClick={() => onEnquireRoom(room)}
                        className="w-full bg-[#FAF8F5] hover:bg-[#F2ECE0] text-[#142820] border border-[#D5CDBD] text-sm font-semibold py-3 px-3 rounded-2xl transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <MessageSquare className="w-4 h-4 text-[#142820]" />
                        <span>Quick Inquiry</span>
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

