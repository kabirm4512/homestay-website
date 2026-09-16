'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Users,
  LogIn,
  LogOut,
  BedDouble,
  Truck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flame,
  CheckSquare,
  Square,
  Car,
  Bike,
  ShieldCheck,
  ChevronRight,
  Phone,
  User,
} from 'lucide-react';
import { useCRM } from '@/context/CRMContext';
import { HousekeepingTask, TransportRequest, HousekeepingStatus } from '@/types/crm';

export default function OperationsHub() {
  const {
    rooms,
    bookings,
    housekeepingTasks,
    dispatchRequests,
    toggleHousekeepingCheck,
    updateHousekeepingStatus,
    confirmDispatchRequest,
    cancelDispatchRequest,
    checkInRoom,
    checkOutRoom,
    showToast,
  } = useCRM();

  // Dispatch Hub driver modal state
  const [selectedDispatch, setSelectedDispatch] = useState<TransportRequest | null>(null);
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [plateNumber, setPlateNumber] = useState('');

  // 1. Front Desk calculations for today (2026-09-16)
  const todayDateStr = '2026-09-16';

  const todayCheckIns = bookings.filter((b) => b.checkInDate === todayDateStr);
  const todayCheckOuts = bookings.filter((b) => b.checkOutDate === todayDateStr);
  const todayStayOvers = bookings.filter(
    (b) => b.tapeStatus === 'checked_in' && b.checkInDate < todayDateStr && b.checkOutDate > todayDateStr
  );

  const pendingHousekeepingCount = housekeepingTasks.filter((t) => t.status !== 'completed').length;
  const pendingDispatchCount = dispatchRequests.filter((d) => d.dispatchStatus === 'pending_confirmation').length;

  const handleOpenDispatchModal = (req: TransportRequest) => {
    setSelectedDispatch(req);
    setDriverName(req.assignedDriverName || 'Pemba Sherpa');
    setDriverPhone(req.assignedDriverPhone || '+91 98320 44556');
    setPlateNumber(req.vehiclePlateNumber || 'WB 74 D 4419');
  };

  const handleConfirmDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDispatch) return;
    confirmDispatchRequest(selectedDispatch.id, {
      assignedDriverName: driverName,
      assignedDriverPhone: driverPhone,
      vehiclePlateNumber: plateNumber,
    });
    setSelectedDispatch(null);
  };

  return (
    <div className="space-y-8">
      {/* SECTION 1: Front Desk Live Tally */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-serif font-bold text-xl text-forest-950 flex items-center space-x-2">
              <span>The Operations Hub</span>
              <span className="text-xs bg-amber-100 text-amber-900 border border-amber-300 font-mono px-2.5 py-0.5 rounded-full font-bold">
                Mid-Day Live Sync
              </span>
            </h2>
            <p className="text-xs text-forest-700">
              Real-time front desk tallies, housekeeping turnovers, and dispatch management.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: Check-Ins */}
          <div className="bg-white rounded-3xl p-5 border border-sand-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-700 block">
                Today&apos;s Arrivals
              </span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-3xl font-serif font-bold text-forest-950">
                  {todayCheckIns.length}
                </span>
                <span className="text-xs text-forest-600">Parties</span>
              </div>
              <p className="text-[11px] text-forest-600 mt-1">
                {todayCheckIns.filter((b) => b.tapeStatus === 'checked_in').length} of {todayCheckIns.length} Arrived
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <LogIn className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2: Check-Outs */}
          <div className="bg-white rounded-3xl p-5 border border-sand-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-bold text-rose-700 block">
                Today&apos;s Departures
              </span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-3xl font-serif font-bold text-forest-950">
                  {todayCheckOuts.length}
                </span>
                <span className="text-xs text-forest-600">Rooms</span>
              </div>
              <p className="text-[11px] text-forest-600 mt-1">
                {todayCheckOuts.filter((b) => b.tapeStatus === 'available').length} Cleared & Billed
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center">
              <LogOut className="w-6 h-6" />
            </div>
          </div>

          {/* Card 3: In-House Stay-Overs */}
          <div className="bg-white rounded-3xl p-5 border border-sand-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-bold text-blue-700 block">
                In-House Stay-Overs
              </span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-3xl font-serif font-bold text-forest-950">
                  {todayStayOvers.length}
                </span>
                <span className="text-xs text-forest-600">Active Suites</span>
              </div>
              <p className="text-[11px] text-forest-600 mt-1">
                Digital Concierge Active
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <BedDouble className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Front Desk Live Arrivals Queue */}
        <div className="mt-4 bg-white rounded-3xl p-5 border border-sand-200 shadow-xs">
          <h3 className="font-serif font-bold text-sm text-forest-950 mb-3 flex items-center space-x-2">
            <Users className="w-4 h-4 text-forest-700" />
            <span>Today&apos;s Active Guest Roster</span>
          </h3>

          <div className="divide-y divide-sand-100">
            {bookings.slice(0, 4).map((bk) => (
              <div key={bk.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-sand-100 text-forest-900 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                    R{bk.roomNumber}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-forest-950">
                        {bk.guest.fullName}
                      </span>
                      <span className="text-[10px] bg-sand-200/80 text-forest-800 px-2 py-0.5 rounded-full font-mono">
                        Plan: {bk.mealPlan}
                      </span>
                      <span className="text-[10px] text-forest-600 hidden sm:inline">
                        • {bk.roomName}
                      </span>
                    </div>
                    <p className="text-[11px] text-forest-600">
                      Stay: {bk.checkInDate} → {bk.checkOutDate} ({bk.totalNights} nights)
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {bk.tapeStatus !== 'checked_in' ? (
                    <button
                      onClick={() => checkInRoom(bk.id)}
                      className="min-h-[44px] px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center space-x-1"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Check-In</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => checkOutRoom(bk.id)}
                      className="min-h-[44px] px-3.5 py-1.5 bg-sand-100 hover:bg-sand-200 text-forest-900 text-xs font-bold rounded-xl transition-colors flex items-center space-x-1"
                    >
                      <LogOut className="w-3.5 h-3.5 text-forest-700" />
                      <span>Check-Out</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 2: Housekeeping Turnover & Interactive Checklists */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-sand-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-amber-600" />
              <h3 className="font-serif font-bold text-lg text-forest-950">
                Housekeeping Turnovers & Room Status
              </h3>
            </div>
            <p className="text-xs text-forest-700 mt-0.5">
              Turnover schedule: Deep Clean vs. Light Refresh with interactive sanitization checklist.
            </p>
          </div>
          <span className="text-xs font-bold px-3 py-1 bg-amber-100 text-amber-900 rounded-full border border-amber-200 self-start sm:self-auto">
            {pendingHousekeepingCount} Turnovers in Progress
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {housekeepingTasks.map((task) => {
            const isCompleted = task.status === 'completed';
            const isDeepClean = task.taskType === 'deep_clean_turnover';

            return (
              <div
                key={task.id}
                className={`rounded-2xl p-5 border transition-all ${
                  isCompleted
                    ? 'bg-sand-50/60 border-sand-200 opacity-85'
                    : 'bg-white border-sand-300 shadow-xs'
                }`}
              >
                {/* Task Card Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-serif font-bold text-sm text-forest-950">
                        {task.roomName}
                      </span>
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          isDeepClean
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : task.taskType === 'maintenance_inspection'
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {task.taskType.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-[11px] text-forest-600 mt-0.5">
                      Assigned to: <strong>{task.assignedToName}</strong> • Priority: {task.priority.toUpperCase()}
                    </p>
                  </div>

                  <select
                    value={task.status}
                    onChange={(e) =>
                      updateHousekeepingStatus(task.id, e.target.value as any)
                    }
                    className="text-xs font-bold rounded-xl border border-sand-300 bg-sand-50 py-1.5 px-2.5 text-forest-900"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="inspected">Inspected</option>
                    <option value="completed">Clean & Ready ✓</option>
                  </select>
                </div>

                {/* Interactive Checklist */}
                <div className="space-y-2 bg-sand-100/50 p-3.5 rounded-xl border border-sand-200 text-xs">
                  <span className="text-[10px] uppercase font-bold text-forest-600 block mb-1">
                    Room Prep Checklist:
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Linens */}
                    <button
                      onClick={() => toggleHousekeepingCheck(task.id, 'linens_changed')}
                      className="min-h-[44px] flex items-center space-x-2 text-left p-1.5 rounded-lg hover:bg-white transition-colors"
                    >
                      {task.checklist.linens_changed ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400 shrink-0" />
                      )}
                      <span className={task.checklist.linens_changed ? 'line-through text-gray-500' : 'text-forest-900 font-medium'}>
                        Fresh Linens & Duvet
                      </span>
                    </button>

                    {/* Toiletries */}
                    <button
                      onClick={() => toggleHousekeepingCheck(task.id, 'toiletries_restocked')}
                      className="min-h-[44px] flex items-center space-x-2 text-left p-1.5 rounded-lg hover:bg-white transition-colors"
                    >
                      {task.checklist.toiletries_restocked ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400 shrink-0" />
                      )}
                      <span className={task.checklist.toiletries_restocked ? 'line-through text-gray-500' : 'text-forest-900 font-medium'}>
                        Organic Toiletries
                      </span>
                    </button>

                    {/* Fireplace */}
                    <button
                      onClick={() => toggleHousekeepingCheck(task.id, 'fireplace_prepped')}
                      className="min-h-[44px] flex items-center space-x-2 text-left p-1.5 rounded-lg hover:bg-white transition-colors"
                    >
                      {task.checklist.fireplace_prepped ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400 shrink-0" />
                      )}
                      <span className={task.checklist.fireplace_prepped ? 'line-through text-gray-500' : 'text-forest-900 font-medium'}>
                        Firewood & Kindle
                      </span>
                    </button>

                    {/* Balcony */}
                    <button
                      onClick={() => toggleHousekeepingCheck(task.id, 'balcony_cleaned')}
                      className="min-h-[44px] flex items-center space-x-2 text-left p-1.5 rounded-lg hover:bg-white transition-colors"
                    >
                      {task.checklist.balcony_cleaned ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400 shrink-0" />
                      )}
                      <span className={task.checklist.balcony_cleaned ? 'line-through text-gray-500' : 'text-forest-900 font-medium'}>
                        Balcony Swept
                      </span>
                    </button>
                  </div>
                </div>

                {task.notes && (
                  <p className="text-[11px] text-forest-700 italic mt-2.5">
                    Note: &ldquo;{task.notes}&rdquo;
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: Dispatch Hub (Transport & Transfers) */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-sand-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <div className="flex items-center space-x-2">
              <Truck className="w-5 h-5 text-forest-800" />
              <h3 className="font-serif font-bold text-lg text-forest-950">
                Transport & Dispatch Hub
              </h3>
            </div>
            <p className="text-xs text-forest-700 mt-0.5">
              Incoming guest transport and vehicle rental bookings requiring manager driver assignment.
            </p>
          </div>
          {pendingDispatchCount > 0 && (
            <span className="text-xs font-bold px-3 py-1 bg-amber-500 text-forest-950 rounded-full animate-pulse self-start sm:self-auto">
              {pendingDispatchCount} Awaiting Dispatch Confirmation
            </span>
          )}
        </div>

        <div className="space-y-4">
          {dispatchRequests.map((req) => {
            const isConfirmed = req.dispatchStatus === 'confirmed_dispatched';
            const isPointToPoint = req.serviceType === 'point_to_point';

            return (
              <div
                key={req.id}
                className="bg-sand-50/70 rounded-2xl p-5 border border-sand-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                {/* Left: Request details */}
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center space-x-2.5">
                    <span className="text-xs font-mono font-bold bg-forest-900 text-sand-200 px-2.5 py-0.5 rounded-lg">
                      {req.requestNumber}
                    </span>
                    <span className="font-serif font-bold text-sm text-forest-950">
                      {isPointToPoint ? req.routeTitle : req.rentalVehicleName}
                    </span>
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        isConfirmed
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : req.dispatchStatus === 'pending_confirmation'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {req.dispatchStatus.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-forest-700 pt-1">
                    <div>
                      <span className="text-gray-500 block text-[10px] uppercase font-bold">Guest & Room:</span>
                      <span className="font-semibold text-forest-900">{req.guestName} ({req.roomName})</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[10px] uppercase font-bold">Contact Phone:</span>
                      <span>{req.guestContactPhone}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[10px] uppercase font-bold">Pickup Time:</span>
                      <span>{new Date(req.pickupDatetime).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  {req.selectedModifiers && req.selectedModifiers.length > 0 && (
                    <div className="text-[11px] text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-200/60 inline-block mt-1">
                      <strong>Scenic Modifiers:</strong> {req.selectedModifiers.map((m) => m.name).join(', ')}
                    </div>
                  )}

                  {/* Confirmed driver & vehicle credentials */}
                  {isConfirmed && req.assignedDriverName && (
                    <div className="mt-2 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 text-xs text-emerald-950 flex flex-wrap items-center gap-4">
                      <span><strong>Driver:</strong> {req.assignedDriverName} ({req.assignedDriverPhone})</span>
                      <span><strong>Vehicle Plate:</strong> {req.vehiclePlateNumber}</span>
                      <span className="text-[11px] text-emerald-700">✓ Folio posted ₹{req.quotedPrice}</span>
                    </div>
                  )}
                </div>

                {/* Right: Pricing & Actions */}
                <div className="flex flex-col sm:flex-row lg:flex-col items-end justify-between gap-3 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-sand-200">
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-gray-500 block">
                      Quoted Price (Folio)
                    </span>
                    <span className="font-mono font-bold text-base text-forest-950">
                      ₹{req.quotedPrice.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] text-emerald-700 block font-medium">
                      Est. Homestay Comm: ₹{req.homestayCommission}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    {!isConfirmed ? (
                      <button
                        onClick={() => handleOpenDispatchModal(req)}
                        className="min-h-[44px] px-4 py-2 bg-forest-900 hover:bg-forest-800 active:scale-95 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center space-x-1.5"
                      >
                        <Car className="w-4 h-4 text-amber-300" />
                        <span>Assign Driver & Confirm</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenDispatchModal(req)}
                        className="min-h-[44px] px-3 py-1.5 bg-sand-200 hover:bg-sand-300 text-forest-900 font-bold text-xs rounded-xl transition-colors"
                      >
                        Edit Driver
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Driver Assignment & Confirmation Modal */}
      {selectedDispatch && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-sand-200 text-forest-950 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-serif font-bold text-base text-forest-950 mb-1 flex items-center space-x-2">
              <Truck className="w-5 h-5 text-forest-800" />
              <span>Confirm Dispatch #{selectedDispatch.requestNumber}</span>
            </h3>
            <p className="text-xs text-forest-700 mb-4">
              Assign local vehicle details and dispatch driver for {selectedDispatch.guestName}.
            </p>

            <form onSubmit={handleConfirmDispatch} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-forest-800 block mb-1">
                  Driver Full Name
                </label>
                <input
                  type="text"
                  required
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-sand-50"
                  placeholder="e.g., Tashi Bhutia"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-forest-800 block mb-1">
                  Driver Phone Number
                </label>
                <input
                  type="text"
                  required
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-sand-50"
                  placeholder="+91 98320 12345"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-forest-800 block mb-1">
                  Vehicle Registration Plate
                </label>
                <input
                  type="text"
                  required
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-sand-50 uppercase font-mono"
                  placeholder="WB 74 BK 1234"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedDispatch(null)}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-sand-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 py-2 rounded-xl text-xs font-bold bg-forest-900 text-white hover:bg-forest-800 shadow transition-all flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Confirm & Notify Guest</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
