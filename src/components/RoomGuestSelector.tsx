'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Users, Plus, Minus, X, Check, Bed, Info, ChevronDown } from 'lucide-react';

export interface RoomConfig {
  roomNumber: number;
  adults: number; // default 2, min 1, max 4
  children: number; // default 0, min 0, max 2
  childAges: number[]; // age 0 to 12
  roomId?: string;
  roomName?: string;
}

export const DEFAULT_ROOM_CONFIG: RoomConfig[] = [
  {
    roomNumber: 1,
    adults: 2,
    children: 0,
    childAges: [],
  },
];

interface RoomGuestSelectorProps {
  roomsConfig: RoomConfig[];
  onChange: (config: RoomConfig[]) => void;
  maxRooms?: number;
  variant?: 'hero' | 'modal' | 'inline';
  popoverPlacement?: 'top' | 'bottom';
  className?: string;
}

export default function RoomGuestSelector({
  roomsConfig = DEFAULT_ROOM_CONFIG,
  onChange,
  maxRooms = 7,
  variant = 'hero',
  popoverPlacement = 'top',
  className = '',
}: RoomGuestSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Aggregate stats
  const totalRooms = roomsConfig.length;
  const totalAdults = useMemo(
    () => roomsConfig.reduce((acc, r) => acc + (r.adults || 0), 0),
    [roomsConfig]
  );
  const totalChildren = useMemo(
    () => roomsConfig.reduce((acc, r) => acc + (r.children || 0), 0),
    [roomsConfig]
  );
  const totalGuests = totalAdults + totalChildren;

  // Actions
  const handleAddRoom = () => {
    if (roomsConfig.length >= maxRooms) return;
    const nextRoomNum = roomsConfig.length + 1;
    const updated = [
      ...roomsConfig,
      {
        roomNumber: nextRoomNum,
        adults: 2,
        children: 0,
        childAges: [],
      },
    ];
    onChange(updated);
  };

  const handleRemoveRoom = (indexToRemove: number) => {
    if (roomsConfig.length <= 1) return;
    const filtered = roomsConfig
      .filter((_, idx) => idx !== indexToRemove)
      .map((r, newIdx) => ({
        ...r,
        roomNumber: newIdx + 1,
      }));
    onChange(filtered);
  };

  const handleUpdateAdults = (index: number, delta: number) => {
    const updated = [...roomsConfig];
    const current = updated[index].adults || 1;
    const next = Math.min(4, Math.max(1, current + delta));
    updated[index] = { ...updated[index], adults: next };
    onChange(updated);
  };

  const handleUpdateChildren = (index: number, delta: number) => {
    const updated = [...roomsConfig];
    const current = updated[index].children || 0;
    const next = Math.min(2, Math.max(0, current + delta));

    let ages = [...(updated[index].childAges || [])];
    if (next > current) {
      // Added a child, default age 5
      for (let i = current; i < next; i++) {
        ages.push(5);
      }
    } else if (next < current) {
      // Removed a child
      ages = ages.slice(0, next);
    }

    updated[index] = {
      ...updated[index],
      children: next,
      childAges: ages,
    };
    onChange(updated);
  };

  const handleUpdateChildAge = (
    roomIndex: number,
    childIndex: number,
    age: number
  ) => {
    const updated = [...roomsConfig];
    const ages = [...(updated[roomIndex].childAges || [])];
    ages[childIndex] = age;
    updated[roomIndex] = {
      ...updated[roomIndex],
      childAges: ages,
    };
    onChange(updated);
  };

  // Summary labels
  const guestLabel = `${totalGuests} ${totalGuests === 1 ? 'Guest' : 'Guests'}`;
  const roomLabel = `${totalRooms} ${totalRooms === 1 ? 'Room' : 'Rooms'}`;
  const breakdownLabel = `${totalAdults} Adults${
    totalChildren > 0
      ? `, ${totalChildren} Child${totalChildren > 1 ? 'ren' : ''}`
      : ''
  }`;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* ========================================================================= */}
      {/* TRIGGER BUTTON (Matches Hero & Form styling) */}
      {/* ========================================================================= */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Select Rooms and Guests"
        aria-expanded={isOpen}
        className={`w-full text-left transition-all cursor-pointer focus:outline-none ${
          variant === 'hero'
            ? 'bg-[#F3F7FF] hover:bg-[#E9EDFA] border border-[#C7D4F5] focus:border-primary-600 focus:ring-2 focus:ring-primary-600/20 rounded-2xl px-2.5 py-1.5 sm:px-3.5 sm:py-2 flex flex-col justify-center'
            : 'bg-white hover:bg-gray-50/80 border border-gray-200 focus:border-primary-600 focus:ring-2 focus:ring-primary-600/20 rounded-xl px-3.5 py-2.5 shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between">
          <label className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-primary-800 flex items-center space-x-1 sm:space-x-1.5 mb-0.5 select-none pointer-events-none">
            <Bed className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-primary-600 shrink-0" />
            <span className="truncate">Rooms & Guests</span>
          </label>
          <ChevronDown
            className={`w-3.5 h-3.5 text-primary-700 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>

        <div className="flex items-baseline space-x-1.5">
          <span className="font-bold text-xs sm:text-sm text-[#0B1733] truncate">
            {roomLabel}, {guestLabel}
          </span>
        </div>

        <div className="text-[10px] sm:text-[11px] text-gray-500 font-medium truncate">
          {breakdownLabel}
        </div>
      </button>

      {/* ========================================================================= */}
      {/* GOIBIBO-STYLE CONFIGURATION POPOVER / MODAL */}
      {/* ========================================================================= */}
      {isOpen && (
        <>
          {/* Backdrop overlay on mobile screens */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 sm:hidden"
            onClick={() => setIsOpen(false)}
          />

          <div
            className={`fixed sm:absolute z-50 left-2 right-2 sm:left-auto sm:right-0 ${
              popoverPlacement === 'top'
                ? 'bottom-4 sm:bottom-full sm:mb-2'
                : 'top-20 sm:top-full sm:mt-2'
            } sm:w-[410px] bg-white rounded-3xl shadow-[0_20px_50px_rgba(11,23,51,0.25)] border border-gray-200/90 overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[520px] animate-in fade-in zoom-in-95 duration-150`}
          >
            {/* Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-[#0B1733] to-[#1E3A8A] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/15">
                  <Users className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <h3
                    className="font-bold text-sm sm:text-base leading-tight"
                    style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                  >
                    Rooms & Guests
                  </h3>
                  <p className="text-[11px] text-white/75 font-normal">
                    {totalRooms} {totalRooms === 1 ? 'Room' : 'Rooms'} · {totalGuests} {totalGuests === 1 ? 'Guest' : 'Guests'} (Estate max 7 rooms)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white/90 hover:text-white transition-all cursor-pointer border border-white/15"
                aria-label="Close guests picker"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Room Configuration Cards */}
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3.5">
              {roomsConfig.map((room, roomIdx) => (
                <div
                  key={room.roomNumber || roomIdx}
                  className="bg-[#F8FAFC] border border-gray-200/90 rounded-2xl p-3.5 sm:p-4 transition-all hover:border-primary-200"
                >
                  {/* Room Card Title Bar */}
                  <div className="flex items-center justify-between pb-3 border-b border-gray-200/70 mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="w-6 h-6 rounded-lg bg-primary-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                        {roomIdx + 1}
                      </span>
                      <span className="font-bold text-xs sm:text-sm text-[#0B1733]">
                        Room {roomIdx + 1}
                      </span>
                    </div>

                    {roomsConfig.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRoom(roomIdx)}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg transition-colors flex items-center space-x-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>

                  {/* Occupant Controls */}
                  <div className="space-y-3">
                    {/* Adults Stepper */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-xs sm:text-sm text-gray-900">
                          Adults
                        </div>
                        <div className="text-[11px] text-gray-500">
                          12 years and above
                        </div>
                      </div>

                      <div className="flex items-center space-x-2.5">
                        <button
                          type="button"
                          onClick={() => handleUpdateAdults(roomIdx, -1)}
                          disabled={room.adults <= 1}
                          className="w-8 h-8 rounded-full border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-gray-700 transition-all active:scale-95 shadow-xs cursor-pointer"
                          aria-label="Decrease adults"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center font-bold text-sm sm:text-base text-[#0B1733]">
                          {room.adults}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateAdults(roomIdx, 1)}
                          disabled={room.adults >= 4}
                          className="w-8 h-8 rounded-full border border-primary-500 bg-primary-50 text-primary-700 hover:bg-primary-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all active:scale-95 shadow-xs cursor-pointer"
                          aria-label="Increase adults"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Children Stepper */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <div>
                        <div className="font-bold text-xs sm:text-sm text-gray-900">
                          Children
                        </div>
                        <div className="text-[11px] text-gray-500">
                          0 - 12 years
                        </div>
                      </div>

                      <div className="flex items-center space-x-2.5">
                        <button
                          type="button"
                          onClick={() => handleUpdateChildren(roomIdx, -1)}
                          disabled={room.children <= 0}
                          className="w-8 h-8 rounded-full border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-gray-700 transition-all active:scale-95 shadow-xs cursor-pointer"
                          aria-label="Decrease children"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center font-bold text-sm sm:text-base text-[#0B1733]">
                          {room.children}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateChildren(roomIdx, 1)}
                          disabled={room.children >= 2}
                          className="w-8 h-8 rounded-full border border-primary-500 bg-primary-50 text-primary-700 hover:bg-primary-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all active:scale-95 shadow-xs cursor-pointer"
                          aria-label="Increase children"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Child Age Selectors (Goibibo Style) */}
                    {room.children > 0 && (
                      <div className="mt-2.5 pt-2.5 border-t border-dashed border-gray-200 grid grid-cols-2 gap-2 bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/60">
                        {Array.from({ length: room.children }).map((_, cIdx) => (
                          <div key={cIdx} className="space-y-1">
                            <label className="text-[10px] font-bold text-amber-900 uppercase tracking-wide block">
                              Child {cIdx + 1} Age
                            </label>
                            <select
                              value={room.childAges?.[cIdx] ?? 5}
                              onChange={(e) =>
                                handleUpdateChildAge(
                                  roomIdx,
                                  cIdx,
                                  Number(e.target.value)
                                )
                              }
                              className="w-full bg-white border border-amber-300 rounded-lg px-2 py-1 text-xs font-semibold text-[#0B1733] focus:outline-none focus:ring-1 focus:ring-primary-600 cursor-pointer shadow-xs"
                            >
                              <option value={0}>&lt; 1 yr (Infant)</option>
                              <option value={1}>1 year</option>
                              <option value={2}>2 years</option>
                              <option value={3}>3 years</option>
                              <option value={4}>4 years</option>
                              <option value={5}>5 years</option>
                              <option value={6}>6 years</option>
                              <option value={7}>7 years</option>
                              <option value={8}>8 years</option>
                              <option value={9}>9 years</option>
                              <option value={10}>10 years</option>
                              <option value={11}>11 years</option>
                              <option value={12}>12 years</option>
                            </select>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Add Room Button (Goibibo Style) */}
              {roomsConfig.length < maxRooms ? (
                <button
                  type="button"
                  onClick={handleAddRoom}
                  className="w-full py-3 px-4 border-2 border-dashed border-primary-300 hover:border-primary-500 bg-primary-50/50 hover:bg-primary-50 text-primary-700 font-bold text-xs sm:text-sm rounded-2xl flex items-center justify-center space-x-2 transition-all cursor-pointer active:scale-98"
                >
                  <Plus className="w-4 h-4 text-primary-600" />
                  <span>+ Add Another Room</span>
                </button>
              ) : (
                <div className="text-center py-2 text-xs text-amber-700 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-center space-x-1">
                  <Info className="w-3.5 h-3.5" />
                  <span>Maximum estate capacity: 7 Rooms reached.</span>
                </div>
              )}
            </div>

            {/* Bottom Actions Bar */}
            <div className="p-3.5 sm:p-4 bg-gray-50 border-t border-gray-200/90 flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#0B1733] truncate">
                  {totalRooms} {totalRooms === 1 ? 'Room' : 'Rooms'} · {totalGuests} {totalGuests === 1 ? 'Guest' : 'Guests'}
                </div>
                <div className="text-[10px] text-gray-500 truncate">
                  {breakdownLabel}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="bg-gradient-to-r from-[#FE6E00] to-[#EA580C] hover:from-[#EA580C] hover:to-[#C2410C] active:scale-95 text-white font-bold text-xs sm:text-sm px-6 py-2.5 rounded-full shadow-[0_4px_12px_rgba(254,110,0,0.35)] transition-all cursor-pointer flex items-center space-x-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Apply</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
