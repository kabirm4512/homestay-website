'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  RotateCcw,
  Check,
  X,
  Clock,
  ArrowRight,
} from 'lucide-react';

// ==========================================
// Robust Local-Time Date Helpers (No Timezone Shift)
// ==========================================
export function toISODateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseISODate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(dateStr: string, days: number): string {
  const d = parseISODate(dateStr);
  d.setDate(d.getDate() + days);
  return toISODateString(d);
}

export function getTodayString(): string {
  return toISODateString(new Date());
}

export function getTomorrowString(): string {
  return addDays(getTodayString(), 1);
}

export function calculateNights(inDate: string, outDate: string): number {
  if (!inDate || !outDate) return 0;
  const d1 = parseISODate(inDate);
  const d2 = parseISODate(outDate);
  const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 3600 * 24));
  return Math.max(0, diff);
}

export function formatHumanDate(
  dateStr: string,
  format: 'short' | 'full' | 'weekday' = 'short'
): string {
  if (!dateStr) return '';
  try {
    const d = parseISODate(dateStr);
    if (format === 'weekday') {
      return d.toLocaleDateString('en-US', { weekday: 'short' });
    }
    if (format === 'full') {
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// Compute upcoming weekend dates
function getUpcomingWeekend(): { checkIn: string; checkOut: string } {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 is Sun, 5 is Fri, 6 is Sat

  let daysUntilFriday = (5 - dayOfWeek + 7) % 7;
  // If today is Saturday, recommend next Friday
  if (dayOfWeek === 6) daysUntilFriday = 6;
  // If today is Sunday, recommend next Friday
  if (dayOfWeek === 0) daysUntilFriday = 5;

  const fri = new Date(today);
  fri.setDate(today.getDate() + daysUntilFriday);

  const sun = new Date(fri);
  sun.setDate(fri.getDate() + 2);

  return {
    checkIn: toISODateString(fri),
    checkOut: toISODateString(sun),
  };
}

// Compute next week's weekend dates
function getNextWeekend(): { checkIn: string; checkOut: string } {
  const thisWeekend = getUpcomingWeekend();
  return {
    checkIn: addDays(thisWeekend.checkIn, 7),
    checkOut: addDays(thisWeekend.checkOut, 7),
  };
}

export interface DateRangePickerProps {
  checkIn: string;
  checkOut: string;
  onChange: (range: { checkIn: string; checkOut: string; nights: number }) => void;
  minDate?: string;
  mode?: 'popover' | 'inline';
  popoverPosition?: 'bottom' | 'top' | 'auto';
  className?: string;
  onApply?: () => void;
  showPresets?: boolean;
}

export default function DateRangePicker({
  checkIn,
  checkOut,
  onChange,
  minDate,
  mode = 'popover',
  popoverPosition = 'auto',
  className = '',
  onApply,
  showPresets = true,
}: DateRangePickerProps) {
  const todayStr = useMemo(() => minDate || getTodayString(), [minDate]);

  // Calendar month state (first displayed month)
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => {
    return checkIn ? parseISODate(checkIn) : parseISODate(todayStr);
  });

  // State: whether popover is open
  const [isOpen, setIsOpen] = useState(mode === 'inline');

  // Active picking target: 'checkIn' | 'checkOut'
  const [pickingTarget, setPickingTarget] = useState<'checkIn' | 'checkOut'>('checkIn');

  // Live hover tracking for smooth range visualization
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync internal month when checkIn changes externally
  useEffect(() => {
    if (checkIn) {
      const d = parseISODate(checkIn);
      setCurrentMonthDate(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }, [checkIn]);

  // Close popover on click outside
  useEffect(() => {
    if (mode === 'inline') return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setHoverDate(null);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setHoverDate(null);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, mode]);

  // Handle Month Navigation
  const handlePrevMonth = () => {
    setCurrentMonthDate(
      new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1)
    );
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(
      new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1)
    );
  };

  // Determine if previous month is in the past
  const canGoPrev = useMemo(() => {
    const today = parseISODate(todayStr);
    const firstOfCurrentMonth = new Date(
      currentMonthDate.getFullYear(),
      currentMonthDate.getMonth(),
      1
    );
    const firstOfTodayMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return firstOfCurrentMonth > firstOfTodayMonth;
  }, [currentMonthDate, todayStr]);

  // Date Selection Logic
  const handleDateClick = (dateStr: string) => {
    if (dateStr < todayStr) return; // Ignore past dates

    if (pickingTarget === 'checkIn') {
      // Pick Check-in
      let newOut = checkOut;
      if (!newOut || newOut <= dateStr) {
        newOut = addDays(dateStr, 1);
      }
      onChange({
        checkIn: dateStr,
        checkOut: newOut,
        nights: calculateNights(dateStr, newOut),
      });
      setPickingTarget('checkOut');
    } else {
      // Pick Check-out
      if (dateStr > checkIn) {
        onChange({
          checkIn,
          checkOut: dateStr,
          nights: calculateNights(checkIn, dateStr),
        });
        setPickingTarget('checkIn');
        if (mode === 'popover') {
          // If on mobile or user picked check-out, close after brief delay
          setTimeout(() => {
            setIsOpen(false);
            if (onApply) onApply();
          }, 200);
        }
      } else {
        // User clicked an earlier date while picking check-out -> adjust check-in
        const newOut = addDays(dateStr, 1);
        onChange({
          checkIn: dateStr,
          checkOut: newOut,
          nights: 1,
        });
        setPickingTarget('checkOut');
      }
    }
  };

  // Quick Preset Handlers
  const applyPreset = (newIn: string, newOut: string) => {
    onChange({
      checkIn: newIn,
      checkOut: newOut,
      nights: calculateNights(newIn, newOut),
    });
    const d = parseISODate(newIn);
    setCurrentMonthDate(new Date(d.getFullYear(), d.getMonth(), 1));
    setPickingTarget('checkIn');
    if (mode === 'popover') {
      setTimeout(() => setIsOpen(false), 250);
    }
  };

  const applyWeekendPreset = (isNext: boolean) => {
    const range = isNext ? getNextWeekend() : getUpcomingWeekend();
    applyPreset(range.checkIn, range.checkOut);
  };

  const applyNightsPreset = (nightsToAdd: number) => {
    const effectiveIn = checkIn >= todayStr ? checkIn : todayStr;
    const newOut = addDays(effectiveIn, nightsToAdd);
    applyPreset(effectiveIn, newOut);
  };

  // Generate Month Grid Data
  const renderMonth = (monthDate: Date) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const monthTitle = monthDate.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sun
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days = [];
    // Padding before 1st of month
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    // Days 1..totalDays
    for (let d = 1; d <= totalDays; d++) {
      const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push(dayStr);
    }

    return (
      <div className="w-full">
        {/* Month Header */}
        <div className="text-center font-serif text-base font-bold text-forest-950 mb-3 tracking-wide">
          {monthTitle}
        </div>

        {/* Days of Week */}
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase tracking-wider text-forest-700/70 mb-2">
          <span>Su</span>
          <span>Mo</span>
          <span>Tu</span>
          <span>We</span>
          <span>Th</span>
          <span>Fr</span>
          <span>Sa</span>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-y-1 gap-x-0">
          {days.map((dayStr, idx) => {
            if (!dayStr) {
              return <div key={`pad-${idx}`} className="h-9 sm:h-10 w-full" />;
            }

            const isPast = dayStr < todayStr;
            const isCheckIn = dayStr === checkIn;
            const isCheckOut = dayStr === checkOut;
            const isInRange = Boolean(checkIn && checkOut && dayStr > checkIn && dayStr < checkOut);
            const isHovered = Boolean(
              pickingTarget === 'checkOut' &&
                hoverDate &&
                hoverDate > checkIn &&
                dayStr > checkIn &&
                dayStr <= hoverDate
            );
            const isToday = dayStr === todayStr;
            const dayNum = Number(dayStr.split('-')[2]);

            // Base cell styling
            let cellStyle = 'relative h-9 sm:h-10 flex items-center justify-center text-xs sm:text-sm font-medium transition-colors cursor-pointer select-none';
            let bgStyle = '';
            let textStyle = 'text-forest-950 hover:bg-sand-100 rounded-xl';

            if (isPast) {
              cellStyle += ' opacity-25 cursor-not-allowed';
              textStyle = 'text-gray-400 line-through';
            } else if (isCheckIn) {
              bgStyle = 'bg-forest-900 text-white font-bold rounded-l-xl z-10 shadow-md';
              textStyle = 'text-white';
            } else if (isCheckOut) {
              bgStyle = 'bg-forest-900 text-white font-bold rounded-r-xl z-10 shadow-md';
              textStyle = 'text-white';
            } else if (isInRange) {
              bgStyle = 'bg-sand-200/90 text-forest-950 font-semibold';
              textStyle = 'text-forest-950';
            } else if (isHovered) {
              bgStyle = 'bg-sand-100 text-forest-900 border-y border-dashed border-sand-300';
              textStyle = 'text-forest-900';
            }

            return (
              <button
                key={dayStr}
                type="button"
                disabled={isPast}
                onClick={() => handleDateClick(dayStr)}
                onMouseEnter={() => {
                  if (pickingTarget === 'checkOut' && !isPast) {
                    setHoverDate(dayStr);
                  }
                }}
                onMouseLeave={() => setHoverDate(null)}
                className={`${cellStyle} ${bgStyle}`}
                title={formatHumanDate(dayStr, 'full')}
              >
                <span className={`w-8 h-8 flex items-center justify-center ${textStyle}`}>
                  {dayNum}
                </span>
                {isToday && !isCheckIn && !isCheckOut && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-forest-600" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const nightsCount = calculateNights(checkIn, checkOut);

  // Month 2 for 2-month desktop layout
  const nextMonthDate = new Date(
    currentMonthDate.getFullYear(),
    currentMonthDate.getMonth() + 1,
    1
  );

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* =========================================================================
          TRIGGER BUTTONS (Check-in card + Duration pill + Check-out card)
         ========================================================================= */}
      {mode === 'popover' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 items-stretch">
          {/* Check-in Trigger */}
          <button
            type="button"
            onClick={() => {
              setPickingTarget('checkIn');
              setIsOpen(true);
            }}
            className={`w-full text-left bg-sand-50/90 hover:bg-sand-100 transition-all border rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between cursor-pointer focus:outline-none ${
              isOpen && pickingTarget === 'checkIn'
                ? 'border-forest-700 ring-2 ring-forest-700/20 shadow-md bg-white'
                : 'border-sand-300/80 hover:border-forest-600/60'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-forest-800 flex items-center space-x-1.5">
                <CalendarIcon className="w-3.5 h-3.5 text-forest-700 shrink-0" />
                <span>Check-in</span>
              </span>
              <span className="text-[10px] text-gray-500 font-medium">From 1:00 PM</span>
            </div>
            <div className="text-sm sm:text-base font-bold text-forest-950">
              {checkIn ? formatHumanDate(checkIn, 'short') : 'Select Arrival'}
            </div>
            <div className="text-[11px] text-forest-700/80 mt-0.5 font-medium">
              {checkIn ? formatHumanDate(checkIn, 'weekday') : 'Choose date'}
            </div>
          </button>

          {/* Check-out Trigger */}
          <button
            type="button"
            onClick={() => {
              setPickingTarget('checkOut');
              setIsOpen(true);
            }}
            className={`w-full text-left bg-sand-50/90 hover:bg-sand-100 transition-all border rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between cursor-pointer focus:outline-none ${
              isOpen && pickingTarget === 'checkOut'
                ? 'border-forest-700 ring-2 ring-forest-700/20 shadow-md bg-white'
                : 'border-sand-300/80 hover:border-forest-600/60'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-forest-800 flex items-center space-x-1.5">
                <CalendarIcon className="w-3.5 h-3.5 text-forest-700 shrink-0" />
                <span>Check-out</span>
              </span>
              <span className="text-[10px] text-gray-500 font-medium">By 11:00 AM</span>
            </div>
            <div className="text-sm sm:text-base font-bold text-forest-950 flex items-center justify-between">
              <span>{checkOut ? formatHumanDate(checkOut, 'short') : 'Select Departure'}</span>
              {nightsCount > 0 && (
                <span className="bg-forest-900 text-sand-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {nightsCount} {nightsCount === 1 ? 'Night' : 'Nights'}
                </span>
              )}
            </div>
            <div className="text-[11px] text-forest-700/80 mt-0.5 font-medium">
              {checkOut ? formatHumanDate(checkOut, 'weekday') : 'Min 1 night'}
            </div>
          </button>
        </div>
      )}

      {/* =========================================================================
          CALENDAR DROPDOWN / INLINE VIEW
         ========================================================================= */}
      {isOpen && (
        <>
          {/* Backdrop on mobile for popover */}
          {mode === 'popover' && (
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 sm:hidden"
              onClick={() => {
                setIsOpen(false);
                setHoverDate(null);
              }}
            />
          )}

          <div
            className={`${
              mode === 'popover'
                ? `fixed sm:absolute inset-x-3 bottom-3 sm:inset-x-auto ${
                    popoverPosition === 'top'
                      ? 'sm:bottom-full sm:mb-2'
                      : popoverPosition === 'bottom'
                      ? 'sm:top-full sm:mt-2'
                      : 'sm:top-full sm:mt-2'
                  } sm:left-0 sm:w-[620px] max-w-[calc(100vw-24px)] z-50 bg-white rounded-3xl shadow-2xl border border-sand-300 overflow-hidden animate-slide-up sm:animate-fade-in`
                : 'w-full bg-sand-50/50 rounded-3xl border border-sand-300/80 p-4 sm:p-6 overflow-hidden'
            }`}
          >
          {/* Header Status & Quick Guidance */}
          <div className="bg-forest-900 text-white px-5 py-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold text-sand-200">
                {pickingTarget === 'checkIn'
                  ? 'Step 1: Select your Arrival (Check-in) date'
                  : 'Step 2: Select your Departure (Check-out) date'}
              </span>
            </div>

            {mode === 'popover' && (
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
                aria-label="Close calendar"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Presets Bar */}
          {showPresets && (
            <div className="bg-sand-100/70 border-b border-sand-200 px-4 py-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
              <span className="text-[11px] font-bold text-forest-800 uppercase tracking-wider shrink-0 mr-1 hidden sm:inline">
                Quick Picks:
              </span>
              <button
                type="button"
                onClick={() => applyWeekendPreset(false)}
                className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-white hover:bg-sand-200 text-forest-900 border border-sand-300/70 text-[11px] font-semibold transition-colors cursor-pointer"
              >
                This Weekend
              </button>
              <button
                type="button"
                onClick={() => applyWeekendPreset(true)}
                className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-white hover:bg-sand-200 text-forest-900 border border-sand-300/70 text-[11px] font-semibold transition-colors cursor-pointer"
              >
                Next Weekend
              </button>
              <button
                type="button"
                onClick={() => applyNightsPreset(1)}
                className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-white hover:bg-sand-200 text-forest-900 border border-sand-300/70 text-[11px] font-semibold transition-colors cursor-pointer"
              >
                1 Night
              </button>
              <button
                type="button"
                onClick={() => applyNightsPreset(2)}
                className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-white hover:bg-sand-200 text-forest-900 border border-sand-300/70 text-[11px] font-semibold transition-colors cursor-pointer"
              >
                +2 Nights
              </button>
              <button
                type="button"
                onClick={() => applyNightsPreset(3)}
                className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-white hover:bg-sand-200 text-forest-900 border border-sand-300/70 text-[11px] font-semibold transition-colors cursor-pointer"
              >
                +3 Nights
              </button>
              <button
                type="button"
                onClick={() => applyNightsPreset(7)}
                className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-white hover:bg-sand-200 text-forest-900 border border-sand-300/70 text-[11px] font-semibold transition-colors cursor-pointer"
              >
                1 Week Stay
              </button>
            </div>
          )}

          {/* Month Navigation Controls & Calendars Grid */}
          <div className="p-4 sm:p-6">
            <div className="relative">
              {/* Previous Month Arrow */}
              <button
                type="button"
                disabled={!canGoPrev}
                onClick={handlePrevMonth}
                aria-label="Previous Month"
                className={`absolute -top-1 left-1 z-10 w-8 h-8 rounded-full border flex items-center justify-center transition-colors cursor-pointer ${
                  canGoPrev
                    ? 'border-sand-300 bg-white hover:bg-sand-100 text-forest-900 shadow-sm'
                    : 'opacity-30 cursor-not-allowed border-gray-200 text-gray-400'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Next Month Arrow */}
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Next Month"
                className="absolute -top-1 right-1 z-10 w-8 h-8 rounded-full border border-sand-300 bg-white hover:bg-sand-100 text-forest-900 shadow-sm flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Responsive 1-Month (Mobile) or 2-Month (Desktop) Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-1">
                <div>{renderMonth(currentMonthDate)}</div>
                <div className="hidden md:block">{renderMonth(nextMonthDate)}</div>
              </div>
            </div>
          </div>

          {/* Bottom Summary Bar & Action Button */}
          <div className="bg-sand-50 border-t border-sand-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-forest-950">Stay:</span>
              <span className="bg-forest-900 text-sand-200 font-bold px-2.5 py-1 rounded-lg">
                {nightsCount} {nightsCount === 1 ? 'Night' : 'Nights'}
              </span>
              <span className="text-gray-600 hidden sm:inline">
                ({formatHumanDate(checkIn)} → {formatHumanDate(checkOut)})
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  const today = getTodayString();
                  const tmrw = getTomorrowString();
                  onChange({ checkIn: today, checkOut: tmrw, nights: 1 });
                  setPickingTarget('checkIn');
                }}
                className="text-forest-700 hover:text-forest-950 underline font-medium px-2 py-1 cursor-pointer flex items-center space-x-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>

              {mode === 'popover' && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    if (onApply) onApply();
                  }}
                  className="bg-forest-800 hover:bg-forest-900 text-white font-bold px-4 py-2 rounded-xl shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 text-sand-300" />
                  <span>Done</span>
                </button>
              )}
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
