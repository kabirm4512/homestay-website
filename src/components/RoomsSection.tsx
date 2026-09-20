'use client';

import { useState } from 'react';
import { Room } from '@/types';
import { Users, Bed, Maximize2, Check, ArrowRight, MessageSquare, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';

interface RoomsSectionProps {
  rooms: Room[];
  onBookRoom: (room: Room) => void;
  onEnquireRoom: (room: Room) => void;
}

export default function RoomsSection({ rooms, onBookRoom, onEnquireRoom }: RoomsSectionProps) {
  // Store current image index per room
  const [activeImageIndices, setActiveImageIndices] = useState<Record<string, number>>({});

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
            Choose from our private cedar suites and stone cottages. Every room is designed for
            uncompromised privacy, warmth, and panoramic mountain views.
          </p>
          <div className="w-16 h-1 bg-sand-400 mx-auto rounded-full mt-6" />
        </div>

        {/* Room Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {rooms.map((room) => {
            const images = room.images && room.images.length > 0
              ? room.images
              : ['https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80'];
            const currentImgIndex = activeImageIndices[room.id] || 0;

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

                  {/* Room Type Badge */}
                  <div className="absolute top-4 left-4 z-10">
                    <span className="bg-forest-900/80 backdrop-blur-md text-sand-200 text-xs font-semibold px-3 py-1.5 rounded-full border border-forest-700/50 flex items-center space-x-1">
                      <Sparkles className="w-3 h-3 text-sand-300" />
                      <span>{room.room_type || 'Boutique Room'}</span>
                    </span>
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
                    <div className="flex flex-wrap gap-1.5 mb-6">
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

                  {/* Price & Action Buttons */}
                  <div className="pt-4 border-t border-sand-200">
                    <div className="flex items-baseline justify-between mb-4">
                      <div>
                        <span className="text-xs uppercase tracking-wider text-gray-500 block">Nightly Rate</span>
                        <div className="flex items-baseline space-x-1">
                          <span className="text-2xl font-bold font-serif text-forest-950">
                            ₹{room.price_per_night.toLocaleString()}
                          </span>
                          <span className="text-xs text-gray-500">/ night</span>
                        </div>
                        <span className="text-[11px] text-forest-700 block mt-0.5 font-medium">
                          Base 2 Adults {room.extra_adult_charge ? `· Extra Adult: +₹${room.extra_adult_charge}` : ''} {room.extra_child_charge ? `· Child: +₹${room.extra_child_charge}` : ''}
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
                        onClick={() => onBookRoom(room)}
                        className="w-full bg-forest-800 hover:bg-forest-900 text-white text-sm font-semibold py-3 px-3 rounded-xl shadow-md transition-transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center space-x-1.5"
                      >
                        <span>Book</span>
                        <ArrowRight className="w-4 h-4 text-sand-300" />
                      </button>
                      <button
                        onClick={() => onEnquireRoom(room)}
                        className="w-full bg-sand-200 hover:bg-sand-300 text-forest-950 text-sm font-semibold py-3 px-3 rounded-xl transition-colors flex items-center justify-center space-x-1.5"
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
