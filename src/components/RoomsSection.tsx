'use client';

import { useState } from 'react';
import { Room } from '@/types';
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
    <section id="rooms" className="py-20 sm:py-28 bg-sand-50 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-forest-600 bg-forest-100 px-3 py-1 rounded-full inline-block mb-3">
            Handcrafted Accommodations
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-forest-950 tracking-tight leading-tight mb-4">
            Rooms & Rates
          </h2>
          <p className="text-gray-600 text-base sm:text-lg">
            Choose from our private cedar suites and balcony rooms. All rooms feature breathtaking Himalayan views, heated comforts, and flexible meal plan options.
          </p>
          <div className="w-16 h-1 bg-sand-400 mx-auto rounded-full mt-6" />
        </div>

        {/* Room Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {rooms.map((room) => {
            const images = room.images && room.images.length > 0
              ? room.images
              : ['/images/hero/deluxe-bedroom-suite.jpg'];
            const currentImgIndex = activeImageIndices[room.id] || 0;

            // Compute exact meal plan rates
            const planRates: Record<'EP' | 'CP' | 'MAP' | 'AP', number> = {
              EP: room.tariffs?.regular?.EP || room.price_per_night,
              CP: room.tariffs?.regular?.CP || (room.tariffs?.regular?.EP ? room.tariffs.regular.EP + 700 : room.price_per_night + 700),
              MAP: room.tariffs?.regular?.MAP || (room.tariffs?.regular?.EP ? room.tariffs.regular.EP + 1700 : room.price_per_night + 1700),
              AP: room.tariffs?.regular?.AP || (room.tariffs?.regular?.EP ? room.tariffs.regular.EP + 2700 : room.price_per_night + 2700),
            };

            const activePlan = selectedPlans[room.id] || 'CP';
            const currentRate = planRates[activePlan];
            const isTariffOpen = !!expandedTariffs[room.id];

            return (
              <div
                key={room.id}
                className="bg-white rounded-3xl overflow-hidden border border-sand-200 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group"
              >
                {/* Image Gallery with Controls */}
                <div className="relative h-64 sm:h-72 w-full overflow-hidden bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={images[currentImgIndex]}
                    alt={room.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />

                  {/* Room Type & Active Meal Plan Badge */}
                  <div className="absolute top-4 left-4 z-10 flex flex-col items-start gap-1.5">
                    <span className="bg-forest-900/85 backdrop-blur-md text-sand-200 text-xs font-semibold px-3 py-1.5 rounded-full border border-forest-700/50 flex items-center space-x-1 shadow-sm">
                      <Sparkles className="w-3 h-3 text-sand-300" />
                      <span>{room.room_type || 'Boutique Room'}</span>
                    </span>
                    {activePlan === 'CP' && (
                      <span className="bg-emerald-900/90 backdrop-blur-md text-emerald-100 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-400/30 flex items-center space-x-1.5 shadow-sm">
                        <Coffee className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Breakfast included</span>
                      </span>
                    )}
                    {activePlan === 'MAP' && (
                      <span className="bg-amber-950/90 backdrop-blur-md text-amber-100 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-400/30 flex items-center space-x-1.5 shadow-sm">
                        <Utensils className="w-3.5 h-3.5 text-amber-300" />
                        <span>Breakfast + Dinner included</span>
                      </span>
                    )}
                    {activePlan === 'AP' && (
                      <span className="bg-purple-950/90 backdrop-blur-md text-purple-100 text-xs font-bold px-2.5 py-1 rounded-full border border-purple-400/30 flex items-center space-x-1.5 shadow-sm">
                        <Utensils className="w-3.5 h-3.5 text-purple-300" />
                        <span>All Meals Included (Full Board)</span>
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
                    <span className="bg-black/60 backdrop-blur-md text-amber-300 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-400/30">
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
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => nextImage(room.id, images.length, e)}
                        aria-label="Next photo"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
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
                    <h3 className="font-serif text-xl sm:text-2xl font-bold text-forest-950 mb-1">
                      {room.name}
                    </h3>
                    {room.tagline && (
                      <p className="text-xs sm:text-sm text-forest-600 font-medium mb-4">
                        {room.tagline}
                      </p>
                    )}

                    {/* Room Attributes */}
                    <div className="grid grid-cols-3 gap-2 py-3 mb-4 border-y border-sand-200 text-xs text-gray-600">
                      <div className="flex items-center space-x-1.5">
                        <Users className="w-4 h-4 text-forest-700 flex-shrink-0" />
                        <span>{room.capacity_adults} Adults {room.capacity_children > 0 && `+ ${room.capacity_children}`}</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <Bed className="w-4 h-4 text-forest-700 flex-shrink-0" />
                        <span className="truncate">{room.bed_type}</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <Maximize2 className="w-4 h-4 text-forest-700 flex-shrink-0" />
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
                          className="inline-flex items-center space-x-1 text-xs bg-forest-50 text-forest-800 px-2.5 py-1 rounded-md font-medium"
                        >
                          <Check className="w-3 h-3 text-forest-600" />
                          <span>{amenity}</span>
                        </span>
                      ))}
                      {room.amenities.length > 4 && (
                        <span className="text-xs text-forest-600 bg-sand-100 px-2 py-1 rounded-md font-medium">
                          +{room.amenities.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Pricing, Tariffs & Action Buttons */}
                  <div className="pt-4 border-t border-sand-200">
                    {/* Interactive Meal Plan Selector Tabs */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-forest-900">
                          Select Meal Plan
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedTariffs((prev) => ({ ...prev, [room.id]: !prev[room.id] }))}
                          className="text-[11px] font-semibold text-forest-700 hover:text-forest-900 underline cursor-pointer"
                        >
                          {isTariffOpen ? 'Hide all plans' : 'Compare plans'}
                        </button>
                      </div>

                      {/* 4 Plan Chips */}
                      <div className="grid grid-cols-4 gap-1.5 p-1 bg-sand-100 rounded-xl border border-sand-200">
                        {(['EP', 'CP', 'MAP', 'AP'] as const).map((plan) => {
                          const isSelected = activePlan === plan;
                          return (
                            <button
                              key={plan}
                              type="button"
                              onClick={() => setSelectedPlans((prev) => ({ ...prev, [room.id]: plan }))}
                              className={`py-1.5 px-1 rounded-lg text-center transition-all ${
                                isSelected
                                  ? 'bg-forest-900 text-white shadow-sm font-bold'
                                  : 'text-forest-800 hover:bg-sand-200 font-medium'
                              }`}
                            >
                              <div className="text-xs leading-tight">{plan}</div>
                              <div className={`text-[10px] leading-tight mt-0.5 ${isSelected ? 'text-sand-300' : 'text-gray-500'}`}>
                                ₹{planRates[plan].toLocaleString()}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Active Plan Detail Line */}
                      <div className="mt-2 text-xs text-forest-800 flex items-center justify-between bg-sand-50 px-2.5 py-1.5 rounded-lg border border-sand-200">
                        <span className="font-medium">
                          {activePlan === 'EP' && 'EP: Room Only (Meals extra à la carte)'}
                          {activePlan === 'CP' && 'CP: Includes Farmhouse Breakfast (Popular)'}
                          {activePlan === 'MAP' && 'MAP: Includes Breakfast & Authentic Dinner'}
                          {activePlan === 'AP' && 'AP: All Meals (Breakfast, Lunch & Dinner)'}
                        </span>
                        <span className="text-[11px] text-gray-500 font-medium">Free cancellation</span>
                      </div>

                      {/* Collapsible Tariff Comparison Table */}
                      {isTariffOpen && (
                        <div className="mt-2 p-2.5 bg-white border border-sand-300 rounded-xl text-xs space-y-1.5 animate-fade-in shadow-inner">
                          <div className="text-[11px] font-bold text-forest-950 uppercase tracking-wider border-b border-sand-200 pb-1">
                            Regular Season Tariff Breakdown
                          </div>
                          <div className="flex justify-between items-center text-gray-700">
                            <span>EP (Room Only):</span>
                            <span className="font-semibold text-forest-900">₹{planRates.EP.toLocaleString()} / night</span>
                          </div>
                          <div className="flex justify-between items-center text-gray-700">
                            <span>CP (Breakfast Included):</span>
                            <span className="font-semibold text-forest-900">₹{planRates.CP.toLocaleString()} / night</span>
                          </div>
                          <div className="flex justify-between items-center text-gray-700">
                            <span>MAP (Breakfast + Dinner):</span>
                            <span className="font-semibold text-forest-900">₹{planRates.MAP.toLocaleString()} / night</span>
                          </div>
                          <div className="flex justify-between items-center text-gray-700">
                            <span>AP (All 3 Meals Included):</span>
                            <span className="font-semibold text-forest-900">₹{planRates.AP.toLocaleString()} / night</span>
                          </div>
                          {room.tariffs?.season && (
                            <div className="pt-1.5 border-t border-sand-200 text-[11px] text-gray-500">
                              Peak Season (Apr-Jun, Oct-Dec): EP ₹{room.tariffs.season.EP} • CP ₹{room.tariffs.season.CP}
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
                          <span className="text-2xl font-bold font-serif text-forest-950">
                            ₹{currentRate.toLocaleString()}
                          </span>
                          <span className="text-xs text-gray-500">/ night</span>
                        </div>
                        <span className="text-[11px] text-forest-700 block mt-0.5 font-medium">
                          Base {room.base_adults || 2} Adults {room.extra_adult_charge ? `· Extra Adult: +₹${room.extra_adult_charge}` : ''} {room.extra_child_charge ? `· Child: +₹${room.extra_child_charge}` : ''}
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
                        className="w-full bg-forest-800 hover:bg-forest-900 text-white text-sm font-semibold py-3 px-3 rounded-xl shadow-md transition-transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <span>Book ({activePlan})</span>
                        <ArrowRight className="w-4 h-4 text-sand-300" />
                      </button>
                      <button
                        onClick={() => onEnquireRoom(room)}
                        className="w-full bg-sand-200 hover:bg-sand-300 text-forest-950 text-sm font-semibold py-3 px-3 rounded-xl transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <MessageSquare className="w-4 h-4 text-forest-700" />
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

