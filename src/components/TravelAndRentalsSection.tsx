'use client';

import { useState, useMemo } from 'react';
import { useCRM } from '@/context/CRMContext';
import {
  Car,
  Bike,
  Calendar,
  Clock,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  Phone,
  Sparkles,
  TrendingUp,
  Compass,
  ArrowRight,
  Info,
  X,
  RotateCcw,
} from 'lucide-react';
import { todayInIST } from '@/lib/tariff-calculator';

interface TravelAndRentalsSectionProps {
  whatsappNumber?: string;
  onOpenBookingModal?: () => void;
}

export default function TravelAndRentalsSection({
  whatsappNumber = '+91 81012 98882',
  onOpenBookingModal,
}: TravelAndRentalsSectionProps) {
  const {
    transferRoutes,
    rentalVehicles,
    calculateDynamicTransferRate,
    calculateDynamicRentalRate,
    getSeasonForDate,
  } = useCRM();

  const [activeTab, setActiveTab] = useState<'transfers' | 'rentals'>('transfers');
  
  // Date selector: initially empty so starting "From ₹X" rates are shown
  const todayStr = useMemo(() => todayInIST(), []);
  const [selectedDate, setSelectedDate] = useState<string>('');

  const hasSelectedDate = Boolean(selectedDate);

  // Active seasonal window for the selected date (or default if unselected)
  const activeSeason = useMemo(() => {
    if (!selectedDate) return null;
    return getSeasonForDate(selectedDate);
  }, [selectedDate, getSeasonForDate]);

  // Formatted date string for user-friendly display
  const formattedSelectedDate = useMemo(() => {
    if (!selectedDate) return '';
    try {
      const [year, month, day] = selectedDate.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  // WhatsApp generator helper
  const cleanPhone = whatsappNumber.replace(/\D/g, '');

  const createWhatsAppLink = (message: string) => {
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  return (
    <section id="travel-rentals" className="py-20 sm:py-28 bg-[#F4EFE6]/40 border-t border-[#EBE5DA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-[#142820]/5 text-[#142820] border border-[#142820]/10 text-xs font-semibold tracking-wide uppercase shadow-xs">
            <Compass className="w-3.5 h-3.5 text-[#C85A32]" />
            <span>Himalayan Transit & Private Mountain Fleet</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#142820] font-serif tracking-tight">
            Curated Transfers & Bike Fleet
          </h2>
          <p className="text-sm sm:text-base text-[#5C6D66] leading-relaxed font-normal">
            Arrive stress-free with verified local mountain chauffeurs from Bagdogra (IXB) or NJP, or explore Darjeeling&apos;s misty tea estates at your own pace with our serviced Royal Enfield bikes and Scooties.
          </p>
          <div className="w-16 h-0.5 bg-[#C85A32] mx-auto rounded-full mt-4" />
        </div>

        {/* Dynamic Seasonal Date & Tariff Indicator Bar */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#EBE5DA] shadow-[0_8px_30px_rgba(20,40,32,0.04)] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#FAF8F5] border border-[#E5DEC9] flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-[#142820]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase font-bold text-[#7B8B84] tracking-wider">
                  {hasSelectedDate ? 'Calculated Tariff for Travel Date:' : 'Check Exact Seasonal Tariff:'}
                </span>

                {hasSelectedDate && activeSeason ? (
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 ${
                      activeSeason.seasonType === 'season'
                        ? 'bg-rose-50 text-rose-800 border border-rose-200'
                        : activeSeason.seasonType === 'off_season'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-[#F4EFE6] text-[#142820] border border-[#D5CDBD]'
                    }`}
                  >
                    {activeSeason.seasonType === 'season' && <TrendingUp className="w-3 h-3 text-rose-600" />}
                    {activeSeason.seasonType === 'off_season' && <Sparkles className="w-3 h-3 text-emerald-600" />}
                    <span>{activeSeason.seasonName}</span>
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#F5EFE6] text-[#142820] border border-[#D5CDBD] inline-flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#C5A059]" />
                    <span>Initial Rates: Starting &quot;From ₹X&quot;</span>
                  </span>
                )}
              </div>

              <p className="text-xs text-[#7B8B84] mt-0.5">
                {hasSelectedDate && activeSeason
                  ? activeSeason.seasonType === 'season'
                    ? `Peak holiday season active for ${formattedSelectedDate}: Transparent fixed peak tariffs ensure guaranteed vehicle reservation.`
                    : activeSeason.seasonType === 'off_season'
                    ? `Special off-season value pricing auto-applied for ${formattedSelectedDate}.`
                    : `Standard regular tariffs apply for ${formattedSelectedDate} with zero hidden surge fees.`
                  : 'Tariffs initially display starting "From ₹X" rates. Select your arrival or travel date to calculate the guaranteed final tariff.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-end md:self-auto">
            <label className="text-xs font-bold text-[#142820] whitespace-nowrap">
              Travel Date:
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={todayStr}
              className="px-3.5 py-2 bg-[#FAF8F5] border border-[#D5CDBD] rounded-xl text-xs sm:text-sm font-semibold text-[#142820] focus:ring-2 focus:ring-[#C85A32] outline-none"
            />
            {hasSelectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate('')}
                className="px-2.5 py-2 bg-[#F2ECE0] hover:bg-[#E5DEC9] text-[#142820] rounded-xl text-xs font-semibold flex items-center space-x-1 transition-colors cursor-pointer"
                title="Reset date and show starting rates"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex justify-center">
          <div className="bg-[#ECE6DA] p-1.5 rounded-2xl flex items-center space-x-1 text-xs sm:text-sm shadow-xs max-w-md w-full">
            <button
              onClick={() => setActiveTab('transfers')}
              className={`flex-1 py-2.5 px-4 rounded-xl font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                activeTab === 'transfers'
                  ? 'bg-[#142820] text-white shadow-md'
                  : 'text-[#4B5E54] hover:text-[#142820] hover:bg-white/50'
              }`}
            >
              <Car className="w-4 h-4" />
              <span>Airport & Sightseeing Cabs</span>
            </button>
            <button
              onClick={() => setActiveTab('rentals')}
              className={`flex-1 py-2.5 px-4 rounded-xl font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                activeTab === 'rentals'
                  ? 'bg-[#142820] text-white shadow-md'
                  : 'text-[#4B5E54] hover:text-[#142820] hover:bg-white/50'
              }`}
            >
              <Bike className="w-4 h-4" />
              <span>Scooty & Bike Rentals</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 1. TRANSFERS & SIGHTSEEING TAB */}
        {/* ========================================================================= */}
        {activeTab === 'transfers' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {transferRoutes.map((route) => {
                const lowestWagonR = route.seasonalTariffs?.offSeason?.priceWagonR || Math.round(route.priceWagonR * 0.85);
                const lowestSedan = route.seasonalTariffs?.offSeason?.priceSedan || Math.round(route.priceSedan * 0.85);
                const lowestSUV = route.seasonalTariffs?.offSeason?.priceSUV || Math.round(route.priceSUV * 0.85);

                const wagonR = hasSelectedDate ? calculateDynamicTransferRate(route, selectedDate, 'wagonr') : null;
                const sedan = hasSelectedDate ? calculateDynamicTransferRate(route, selectedDate, 'sedan') : null;
                const suv = hasSelectedDate ? calculateDynamicTransferRate(route, selectedDate, 'suv') : null;

                const inquiryText = hasSelectedDate
                  ? `Hi Savera Homestay! I would like to book the transfer route: "${route.title}" for travel date ${formattedSelectedDate} (Quoted Final Tariff: ₹${wagonR?.rate} WagonR / ₹${sedan?.rate} Sedan / ₹${suv?.rate} SUV, ${activeSeason?.seasonName}). Please let me know vehicle availability.`
                  : `Hi Savera Homestay! I would like to inquire about the transfer route: "${route.title}" (Starting from ₹${lowestWagonR}). Please let me know vehicle availability.`;

                return (
                  <div
                    key={route.id}
                    className="bg-white rounded-3xl border border-[#EBE5DA] p-6 shadow-[0_8px_30px_rgba(20,40,32,0.04)] hover:shadow-[0_16px_36px_rgba(20,40,32,0.09)] hover:-translate-y-1 transition-all flex flex-col justify-between space-y-5"
                  >
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between">
                        <span className="px-3 py-1 bg-[#FAF8F5] text-[#142820] text-[11px] font-bold rounded-full border border-[#E5DEC9] flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-[#C85A32]" />
                          <span>~{route.estimatedDurationHours} Hours Mountain Route</span>
                        </span>
                        
                        {hasSelectedDate && wagonR ? (
                          <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-900 border border-emerald-200 text-[11px] font-bold rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Fixed: ₹{wagonR.rate.toLocaleString('en-IN')}</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 bg-[#F5EFE6] text-[#142820] border border-[#D5CDBD] text-[11px] font-bold rounded-full">
                            From ₹{lowestWagonR.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>

                      <div>
                        <h3 className="text-lg sm:text-xl font-bold text-[#142820] font-serif">
                          {route.title}
                        </h3>
                        <div className="flex items-center space-x-1.5 text-xs text-[#5C6D66] mt-1">
                          <MapPin className="w-3.5 h-3.5 text-[#C85A32] shrink-0" />
                          <span className="line-clamp-1">{route.origin} → {route.destination}</span>
                        </div>
                      </div>

                      {/* Tier Pricing Cards */}
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-[#7B8B84] uppercase tracking-wider">
                            {hasSelectedDate
                              ? `Guaranteed Mountain Fare (${formattedSelectedDate}):`
                              : 'Starting Rates (Off-Season / Regular):'}
                          </span>
                          {hasSelectedDate && (
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              Fixed Fare
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center">
                          {/* WagonR */}
                          <div className={`p-2.5 rounded-xl border transition-all ${
                            hasSelectedDate ? 'bg-emerald-50/40 border-emerald-300' : 'bg-[#FAF8F5] border-[#E8E2D5]'
                          }`}>
                            <span className="text-[10px] font-bold text-[#7B8B84] block uppercase">
                              WagonR
                            </span>
                            <span className="text-sm font-bold text-[#142820] block mt-0.5">
                              {hasSelectedDate && wagonR ? (
                                `₹${wagonR.rate.toLocaleString('en-IN')}`
                              ) : (
                                <>
                                  <span className="text-[10px] text-gray-400 font-normal mr-0.5">From </span>
                                  ₹{lowestWagonR.toLocaleString('en-IN')}
                                </>
                              )}
                            </span>
                            <span className="text-[9px] text-[#7B8B84] block">
                              {hasSelectedDate ? 'Fixed' : '3-4 Pax'}
                            </span>
                          </div>

                          {/* Sedan */}
                          <div className={`p-2.5 rounded-xl border transition-all ${
                            hasSelectedDate ? 'bg-[#FAF8F5] border-[#C85A32] ring-1 ring-[#C85A32]/30' : 'bg-[#FAF8F5] border-[#E8E2D5]'
                          }`}>
                            <span className="text-[10px] font-bold text-[#142820] block uppercase">
                              Sedan
                            </span>
                            <span className="text-sm font-bold text-[#142820] block mt-0.5">
                              {hasSelectedDate && sedan ? (
                                `₹${sedan.rate.toLocaleString('en-IN')}`
                              ) : (
                                <>
                                  <span className="text-[10px] text-gray-400 font-normal mr-0.5">From </span>
                                  ₹{lowestSedan.toLocaleString('en-IN')}
                                </>
                              )}
                            </span>
                            <span className="text-[9px] text-[#7B8B84] block">
                              {hasSelectedDate ? 'Dzire Boot' : 'Boot Space'}
                            </span>
                          </div>

                          {/* SUV */}
                          <div className={`p-2.5 rounded-xl border transition-all ${
                            hasSelectedDate ? 'bg-emerald-50/40 border-emerald-300' : 'bg-[#FAF8F5] border-[#E8E2D5]'
                          }`}>
                            <span className="text-[10px] font-bold text-[#7B8B84] block uppercase">
                              SUV
                            </span>
                            <span className="text-sm font-bold text-[#142820] block mt-0.5">
                              {hasSelectedDate && suv ? (
                                `₹${suv.rate.toLocaleString('en-IN')}`
                              ) : (
                                <>
                                  <span className="text-[10px] text-gray-400 font-normal mr-0.5">From </span>
                                  ₹{lowestSUV.toLocaleString('en-IN')}
                                </>
                              )}
                            </span>
                            <span className="text-[9px] text-[#7B8B84] block">
                              {hasSelectedDate ? 'Innova' : '6-7 Pax'}
                            </span>
                          </div>
                        </div>

                        {/* Status Note under Tiers */}
                        <div className="text-[10px] text-center pt-1 text-gray-500">
                          {hasSelectedDate ? (
                            <span className="text-emerald-800 font-semibold flex items-center justify-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Guaranteed mountain fare for {formattedSelectedDate} • Zero surge at pickup
                            </span>
                          ) : (
                            <span className="text-[#7B8B84] font-medium">
                              Tariffs shown from off-season rates. Pick date above for exact tariff.
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Scenic Modifiers / Via stops */}
                      {route.modifiers && route.modifiers.length > 0 && (
                        <div className="pt-2 border-t border-[#EBE5DA]">
                          <span className="text-[11px] font-bold text-[#142820] block mb-1">
                            Optional Scenic Detours:
                          </span>
                          <div className="space-y-1">
                            {route.modifiers.map((mod) => (
                              <div
                                key={mod.id}
                                className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-[#FAF8F5] text-[#142820] border border-[#E5DEC9]"
                              >
                                <span>{mod.name}</span>
                                <span className="font-bold text-[#C85A32]">+₹{mod.extraCharge}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-[#EBE5DA] flex items-center gap-2">
                      <a
                        href={createWhatsAppLink(inquiryText)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2.5 px-3 bg-[#C85A32] hover:bg-[#B34D28] text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-1.5 shadow-[0_4px_12px_rgba(200,90,50,0.25)] cursor-pointer"
                      >
                        <Phone className="w-3.5 h-3.5 text-white" />
                        <span>{hasSelectedDate ? 'Reserve Quoted Cab' : 'Inquire Route'}</span>
                      </a>
                      {onOpenBookingModal && (
                        <button
                          onClick={onOpenBookingModal}
                          className="py-2.5 px-3 border border-[#D5CDBD] text-[#142820] bg-[#FAF8F5] hover:bg-[#ECE6DA] rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Book Stay
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Chauffeur Trust Banner */}
            <div className="bg-[#142820] text-white rounded-3xl p-6 sm:p-8 border border-white/10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-[#C5A059] text-xs font-bold uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Savera Safe Arrival Mountain Guarantee</span>
                </div>
                <h4 className="text-xl sm:text-2xl font-bold text-white font-serif">
                  Need a custom pickup from Siliguri, Kalimpong, or Pelling?
                </h4>
                <p className="text-xs sm:text-sm text-gray-300 max-w-2xl font-normal leading-relaxed">
                  We coordinate directly with verified Darjeeling driver associations. AC on plains, skilled mountain cornering, upfront toll/parking clearance, and flight monitoring included.
                </p>
              </div>

              <a
                href={createWhatsAppLink('Hi Savera Homestay! I need a custom mountain transfer or inter-city taxi quote.')}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3.5 bg-[#C85A32] hover:bg-[#B34D28] text-white font-semibold text-xs sm:text-sm rounded-full shadow-[0_4px_14px_rgba(200,90,50,0.3)] transition-all whitespace-nowrap flex items-center space-x-2 cursor-pointer"
              >
                <span>WhatsApp Custom Route</span>
                <ArrowRight className="w-4 h-4 text-white" />
              </a>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. SCOOTY & BIKE RENTALS TAB */}
        {/* ========================================================================= */}
        {activeTab === 'rentals' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rentalVehicles.map((veh) => {
                const lowestRate = veh.seasonalTariffs?.offSeasonRatePerDay || veh.ratePerDay || 800;
                const dynRate = hasSelectedDate ? calculateDynamicRentalRate(veh, selectedDate) : null;

                const inquiryText = hasSelectedDate && dynRate
                  ? `Hi Savera Homestay! I would like to rent the "${veh.vehicleName}" starting on ${formattedSelectedDate} (Quoted Daily Tariff: ₹${dynRate.dailyAvgRate}, ${activeSeason?.seasonName}). Please let me know the booking procedure.`
                  : `Hi Savera Homestay! I would like to inquire about renting the "${veh.vehicleName}" (Tariffs starting from ₹${lowestRate}/day). Please let me know the booking procedure.`;

                return (
                  <div
                    key={veh.id}
                    className="bg-white rounded-3xl border border-[#EBE5DA] overflow-hidden shadow-[0_8px_30px_rgba(20,40,32,0.04)] hover:shadow-[0_16px_36px_rgba(20,40,32,0.09)] hover:-translate-y-1 transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Vehicle Image */}
                      {veh.imageUrl && (
                        <div className="relative h-48 w-full bg-[#ECE7DC] overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={veh.imageUrl}
                            alt={veh.vehicleName}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute top-3 left-3 bg-[#142820]/90 backdrop-blur-xs text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                            {veh.vehicleType}
                          </div>
                          <div className="absolute top-3 right-3 bg-white/95 text-[#142820] text-[10px] font-bold px-2.5 py-1 rounded-full shadow-xs">
                            {veh.isAvailable ? 'In Fleet' : 'Reserved'}
                          </div>
                        </div>
                      )}

                      <div className="p-6 space-y-4">
                        <div>
                          <h3 className="text-xl font-bold text-[#142820] font-serif">
                            {veh.vehicleName}
                          </h3>
                          {veh.specs && (
                            <p className="text-xs text-[#5C6D66] mt-1 leading-relaxed">
                              {veh.specs}
                            </p>
                          )}
                        </div>

                        {/* Rental Rate Box */}
                        <div className="bg-[#FAF8F5] p-4 rounded-2xl border border-[#E8E2D5] space-y-2">
                          <div className="flex items-baseline justify-between">
                            <span className="text-xs text-[#7B8B84] font-medium">
                              {hasSelectedDate ? 'Calculated Daily Tariff:' : 'Daily Tariff (Starting From):'}
                            </span>
                            <div className="text-right">
                              {hasSelectedDate && dynRate ? (
                                <div>
                                  <span className="text-2xl font-bold text-[#142820] font-serif">
                                    ₹{dynRate.dailyAvgRate.toLocaleString('en-IN')}
                                  </span>
                                  <span className="text-xs text-[#7B8B84]"> / 24 hrs</span>
                                </div>
                              ) : (
                                <div>
                                  <span className="text-xs text-gray-400 font-normal mr-1">From</span>
                                  <span className="text-2xl font-bold text-[#142820] font-serif">
                                    ₹{lowestRate.toLocaleString('en-IN')}
                                  </span>
                                  <span className="text-xs text-[#7B8B84]"> / 24 hrs</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="text-[10px] text-[#7B8B84]">
                            {hasSelectedDate ? (
                              <span className="text-emerald-800 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Locked for {formattedSelectedDate} ({activeSeason?.seasonName})
                              </span>
                            ) : (
                              <span className="text-[#C85A32]">
                                Starting off-season rate • Pick date above for final tariff
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[11px] pt-2 border-t border-[#E8E2D5] text-[#5C6D66]">
                            <span>Refundable Security Deposit</span>
                            <span className="font-bold text-[#142820]">₹{veh.depositRequired}</span>
                          </div>
                        </div>

                        {/* Inclusions */}
                        <div className="space-y-1.5 text-xs text-[#142820] pt-1">
                          <span className="text-[11px] font-bold text-[#7B8B84] uppercase tracking-wider block mb-1">
                            Included with Every Rental:
                          </span>
                          <div className="flex items-center space-x-2 text-[#4A5752]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#2C6B4F] shrink-0" />
                            <span>2 ISI Certified Mountain Helmets</span>
                          </div>
                          <div className="flex items-center space-x-2 text-[#4A5752]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#2C6B4F] shrink-0" />
                            <span>Vibration-Damped Phone Mount for GPS</span>
                          </div>
                          <div className="flex items-center space-x-2 text-[#4A5752]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#2C6B4F] shrink-0" />
                            <span>Homestay Gate Handover & Return</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 pt-0">
                      <a
                        href={createWhatsAppLink(inquiryText)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3.5 px-4 bg-[#C85A32] hover:bg-[#B34D28] text-white rounded-2xl text-xs sm:text-sm font-semibold transition-all shadow-[0_4px_14px_rgba(200,90,50,0.25)] flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <Bike className="w-4 h-4 text-white" />
                        <span>{hasSelectedDate ? `Reserve This ${veh.vehicleType === 'scooty' ? 'Scooty' : 'Bike'}` : `Inquire This ${veh.vehicleType === 'scooty' ? 'Scooty' : 'Bike'}`}</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Rental Requirements Callout */}
            <div className="bg-[#FAF8F5] border border-[#E5DEC9] rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-[#142820]">
              <div className="flex items-start space-x-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#F2ECE0] flex items-center justify-center shrink-0 mt-0.5">
                  <Info className="w-5 h-5 text-[#C85A32]" />
                </div>
                <div className="text-xs sm:text-sm text-[#4A5752]">
                  <strong className="block font-bold text-[#142820]">Rental Requirements:</strong>
                  <span>Valid original Driving License & Aadhaar/Passport required at handover. Security deposit refunded instantly upon return inspection. Fuel is self-refill (nearest pump 1.2 km).</span>
                </div>
              </div>

              <a
                href={createWhatsAppLink('Hi! I have questions regarding bike rental terms and licensing requirements.')}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-white text-[#142820] border border-[#D5CDBD] rounded-xl text-xs font-semibold shadow-xs whitespace-nowrap hover:bg-[#FAF8F5] transition-colors self-end sm:self-auto"
              >
                Inquire on WhatsApp
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
