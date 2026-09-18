'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Download,
  Printer,
  Sparkles,
  Trees,
  Wifi,
  Utensils,
  Car,
  MessageSquare,
  CheckCircle2,
  Layers,
  ArrowRight,
  X,
  Globe,
  ShieldAlert,
} from 'lucide-react';
import { PhysicalRoom } from '@/types/crm';
import { useCRM } from '@/context/CRMContext';

interface InRoomQRHubProps {
  initialRoomNumber?: number;
  isOpen?: boolean;
  onClose?: () => void;
  standalone?: boolean;
}

export default function InRoomQRHub({
  initialRoomNumber = 101,
  isOpen = true,
  onClose,
  standalone = false,
}: InRoomQRHubProps) {
  const { rooms } = useCRM();

  // All 7 rooms sorted
  const sortedRooms = [...rooms].sort((a, b) => a.roomNumber - b.roomNumber);

  const [selectedRoomNumber, setSelectedRoomNumber] = useState<number>(initialRoomNumber);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [customDomain, setCustomDomain] = useState<string>('');

  // Initialize domain from window
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCustomDomain(window.location.origin);
    }
  }, []);

  const currentRoom = sortedRooms.find((r) => r.roomNumber === selectedRoomNumber) || sortedRooms[0] || {
    id: 'room-101',
    roomNumber: 101,
    name: 'Room 101 - Sunrise Mountain Balcony',
    categoryName: 'Deluxe Mountain View with Balcony',
    floorLevel: 1,
  };

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate QR payload URL
  const getRoomUrl = useCallback((roomNum: number) => {
    let cleanOrigin = customDomain.trim();
    if (!cleanOrigin) {
      cleanOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://saverahomestay.com';
    }
    if (!cleanOrigin.startsWith('http://') && !cleanOrigin.startsWith('https://')) {
      cleanOrigin = `https://${cleanOrigin}`;
    }
    cleanOrigin = cleanOrigin.replace(/\/+$/, '');
    return `${cleanOrigin}/concierge?room=${roomNum}`;
  }, [customDomain]);

  // Generate QR Code for currently selected room
  useEffect(() => {
    let isMounted = true;
    const roomUrl = getRoomUrl(selectedRoomNumber);

    QRCode.toDataURL(roomUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#1b382b', // Deep forest green
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => {
        if (isMounted) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Failed to generate QR code', err);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedRoomNumber, getRoomUrl]);

  // Draw printable standee card onto high-res canvas (1200 x 1600 px)
  const drawCardOnCanvas = async (
    room: PhysicalRoom,
    targetCanvas: HTMLCanvasElement
  ): Promise<string> => {
    const ctx = targetCanvas.getContext('2d');
    if (!ctx) return '';

    const width = 1200;
    const height = 1600;
    targetCanvas.width = width;
    targetCanvas.height = height;

    // Background - warm luxury cream
    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, width, height);

    // Outer double border
    ctx.strokeStyle = '#1b382b';
    ctx.lineWidth = 14;
    ctx.strokeRect(36, 36, width - 72, height - 72);

    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 4;
    ctx.strokeRect(48, 48, width - 96, height - 96);

    // Header container (Deep Forest)
    ctx.fillStyle = '#1b382b';
    ctx.beginPath();
    ctx.roundRect(80, 80, width - 160, 240, 24);
    ctx.fill();

    // Brand Name & Subtitle in Header
    ctx.fillStyle = '#f59e0b'; // Amber Gold
    ctx.font = 'bold 30px serif';
    ctx.textAlign = 'center';
    ctx.fillText('SAVERA HOMESTAY - DARJEELING', width / 2, 150);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px serif';
    ctx.fillText('IN-ROOM DIGITAL CONCIERGE', width / 2, 220);

    ctx.fillStyle = '#d1d5db';
    ctx.font = '22px sans-serif';
    ctx.fillText('Scan with your smartphone camera for dining, cabs & front desk service', width / 2, 270);

    // Room Badge (Gold foil banner)
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 280, 360, 560, 100, 50);
    ctx.fill();

    ctx.fillStyle = '#1b382b';
    ctx.font = '900 48px sans-serif';
    ctx.fillText(`ROOM ${room.roomNumber}`, width / 2, 428);

    // Room Category Name
    ctx.fillStyle = '#374151';
    ctx.font = 'italic bold 28px serif';
    ctx.fillText(room.categoryName || 'Boutique Room with Balcony', width / 2, 510);

    // Generate QR code image on the canvas
    const roomUrl = getRoomUrl(room.roomNumber);
    const qrData = await QRCode.toDataURL(roomUrl, {
      width: 540,
      margin: 2,
      color: { dark: '#1b382b', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    });

    const qrImg = new Image();
    await new Promise<void>((resolve, reject) => {
      qrImg.onload = () => resolve();
      qrImg.onerror = reject;
      qrImg.src = qrData;
    });

    // QR Code Container Box with shadow & border
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(width / 2 - 280, 550, 560, 560, 28);
    ctx.fill();
    ctx.stroke();

    // Draw QR image
    ctx.drawImage(qrImg, width / 2 - 260, 560, 520, 520);

    // Instructions Section
    ctx.fillStyle = '#1b382b';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('WHAT YOU CAN ORDER FROM YOUR BED:', width / 2, 1170);

    // 3 Feature Pills
    const features = [
      { text: 'Farm-Fresh Kitchen Meals', sub: 'Steamed Momos, Pahadi Thalis & Chai' },
      { text: 'Mountain Cabs & Scooter Hire', sub: 'NJP / Bagdogra / Gangtok Transfers' },
      { text: 'Direct Front Desk WhatsApp', sub: 'Instant Room Service & Luggage Drop' },
    ];

    features.forEach((feat, idx) => {
      const y = 1220 + idx * 72;
      ctx.fillStyle = '#f3f4f6';
      ctx.beginPath();
      ctx.roundRect(140, y, width - 280, 58, 16);
      ctx.fill();

      ctx.fillStyle = '#1b382b';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${idx + 1}. ${feat.text}`, 170, y + 36);

      ctx.fillStyle = '#6b7280';
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(feat.sub, width - 170, y + 36);
    });

    // Wi-Fi Footer Card
    ctx.fillStyle = '#fef3c7'; // warm amber tint
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(140, 1460, width - 280, 80, 20);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#78350f';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('High-Speed Wi-Fi: SaveraHomestay_Guest  |  Password: savera@darjeeling', width / 2, 1508);

    return targetCanvas.toDataURL('image/png');
  };

  // Download Single Room PNG
  const handleDownloadSingle = async () => {
    if (!canvasRef.current) return;
    const dataUrl = await drawCardOnCanvas(currentRoom, canvasRef.current);
    const link = document.createElement('a');
    link.download = `savera-homestay-room-${currentRoom.roomNumber}-dine-in-qr.png`;
    link.href = dataUrl;
    link.click();
  };

  // Print Standee Card directly
  const handlePrintCard = async () => {
    if (!canvasRef.current) return;
    const dataUrl = await drawCardOnCanvas(currentRoom, canvasRef.current);

    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Please allow popups to print the in-room card.');
      return;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Room ${currentRoom.roomNumber} - Dine-In Standee Card</title>
          <style>
            @page {
              size: A5 portrait;
              margin: 8mm;
            }
            body {
              margin: 0;
              padding: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #fff;
            }
            img {
              max-width: 100%;
              max-height: 98vh;
              object-fit: contain;
              border-radius: 8px;
            }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" alt="Room ${currentRoom.roomNumber} Dine-In QR Standee" />
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  // Batch Download All 7 Rooms sequentially
  const handleDownloadAllRooms = async () => {
    if (!canvasRef.current || isGeneratingBatch) return;
    setIsGeneratingBatch(true);

    try {
      for (let i = 0; i < sortedRooms.length; i++) {
        const room = sortedRooms[i];
        setBatchProgress({ current: i + 1, total: sortedRooms.length });

        const dataUrl = await drawCardOnCanvas(room, canvasRef.current);
        const link = document.createElement('a');
        link.download = `savera-homestay-room-${room.roomNumber}-dine-in-qr.png`;
        link.href = dataUrl;
        link.click();

        // Small delay so browser doesn't throttle downloads
        await new Promise((r) => setTimeout(r, 600));
      }
    } finally {
      setIsGeneratingBatch(false);
      setBatchProgress(null);
    }
  };

  if (!isOpen) return null;

  const content = (
    <div className="space-y-6">
      {/* Hidden high-res canvas used for exporting 1200x1600 print graphics */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sand-200 pb-5">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-forest-900 text-amber-300 flex items-center justify-center shadow-xs">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-xl text-forest-950">
                In-Room Dine-In & Concierge QR Center
              </h2>
              <p className="text-xs text-forest-700">
                Generate, preview, print and download branded table and bedside standees for all 7 rooms.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadAllRooms}
            disabled={isGeneratingBatch}
            className="min-h-[42px] px-4 py-2 bg-sand-200 hover:bg-sand-300 text-forest-950 font-bold text-xs rounded-xl transition-all shadow-xs flex items-center space-x-2 disabled:opacity-50"
          >
            <Layers className="w-4 h-4 text-forest-800" />
            <span>
              {isGeneratingBatch
                ? `Exporting ${batchProgress?.current}/${batchProgress?.total}...`
                : 'Download All 7 QR Cards'}
            </span>
          </button>
        </div>
      </div>

      {/* 7 Rooms Quick Select Buttons */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-forest-700 mb-2">
          Select Room to Preview & Export:
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {sortedRooms.map((room) => {
            const isSelected = room.roomNumber === selectedRoomNumber;
            return (
              <button
                key={room.id}
                onClick={() => setSelectedRoomNumber(room.roomNumber)}
                className={`p-3 rounded-2xl border text-left transition-all relative ${
                  isSelected
                    ? 'bg-forest-900 text-white border-forest-900 shadow-md ring-2 ring-amber-400/50'
                    : 'bg-white text-forest-950 border-sand-200 hover:border-forest-700 hover:bg-sand-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`font-mono font-bold text-sm ${
                      isSelected ? 'text-amber-300' : 'text-forest-900'
                    }`}
                  >
                    Room {room.roomNumber}
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      room.currentStatus === 'checked_in'
                        ? 'bg-emerald-400'
                        : room.currentStatus === 'confirmed'
                        ? 'bg-blue-400'
                        : 'bg-amber-400'
                    }`}
                  />
                </div>
                <p
                  className={`text-[11px] truncate ${
                    isSelected ? 'text-sand-300' : 'text-forest-700'
                  }`}
                >
                  {room.categoryName.includes('Suite')
                    ? 'Premium Suite'
                    : room.categoryName.includes('Forest')
                    ? 'Forest Balcony'
                    : 'Mtn Balcony'}
                </p>
                <span
                  className={`text-[10px] block mt-1 uppercase font-semibold tracking-wider ${
                    isSelected ? 'text-sand-400' : 'text-gray-400'
                  }`}
                >
                  Floor {room.floorLevel}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* QR Target Domain & Vercel Authentication Notice */}
      <div className="bg-white rounded-2xl p-4 border border-sand-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <Globe className="w-4 h-4 text-forest-700 shrink-0" />
            <span className="text-xs font-bold text-forest-950">QR Destination Base Domain:</span>
          </div>
          <div className="text-[11px] text-gray-500 truncate">
            Active QR URL: <code className="font-mono font-bold text-forest-800 bg-sand-100 px-1.5 py-0.5 rounded">{getRoomUrl(currentRoom.roomNumber)}</code>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
            placeholder="e.g. https://saverahomestay.com or current domain"
            className="flex-1 px-3 py-2 text-xs bg-sand-50/80 border border-sand-300 rounded-xl font-mono text-forest-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-forest-800"
          />
          <button
            onClick={() => setCustomDomain(typeof window !== 'undefined' ? window.location.origin : 'https://saverahomestay.com')}
            className="min-h-[36px] px-3 py-1.5 bg-sand-200 hover:bg-sand-300 text-forest-950 text-xs font-semibold rounded-xl transition-colors shrink-0 cursor-pointer"
          >
            Use Current URL
          </button>
        </div>

        {/* Vercel Login Guard Notice */}
        <div className="flex items-start space-x-2 text-[11px] text-amber-900 bg-amber-50/90 p-3 rounded-xl border border-amber-200/80">
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold text-amber-950">Why does scanning the QR redirect to Vercel login? </span>
            <span>Vercel enables <strong>Deployment Protection (Vercel Authentication)</strong> by default. To allow all guests to open the in-room concierge freely without a Vercel login, go to your <strong>Vercel Dashboard &rarr; Settings &rarr; Deployment Protection</strong>, toggle <strong>Vercel Authentication</strong> to <strong>Disabled</strong>, and click Save.</span>
          </div>
        </div>
      </div>

      {/* Main Preview & Action Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Interactive Printable Standee Mockup (7 cols) */}
        <div className="lg:col-span-7 flex justify-center">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-xl border-4 border-forest-900 text-center relative overflow-hidden">
            {/* Inner Gold Border */}
            <div className="absolute inset-2 border-2 border-amber-500/60 rounded-2xl pointer-events-none" />

            {/* Top Brand Banner */}
            <div className="bg-forest-900 text-white rounded-2xl p-4 mb-4 shadow-sm">
              <div className="flex items-center justify-center space-x-2 text-amber-300 text-xs font-bold tracking-widest uppercase mb-1">
                <Trees className="w-4 h-4" />
                <span>Savera Homestay</span>
              </div>
              <h3 className="font-serif font-bold text-lg sm:text-xl text-white">
                IN-ROOM DIGITAL CONCIERGE
              </h3>
              <p className="text-[10px] text-sand-300 mt-0.5">
                Scan with your phone camera for room dining, cab transfers & host chat
              </p>
            </div>

            {/* Room Badge */}
            <div className="inline-block bg-amber-400 text-forest-950 font-black text-xl sm:text-2xl px-6 py-1.5 rounded-full shadow-sm mb-1 font-mono tracking-wide">
              ROOM {currentRoom.roomNumber}
            </div>

            <p className="font-serif italic text-forest-800 text-xs sm:text-sm font-semibold mb-4">
              {currentRoom.categoryName}
            </p>

            {/* QR Code Graphic */}
            <div className="bg-white p-3 rounded-2xl border-2 border-sand-200 shadow-inner inline-block mb-4">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt={`Dine-In QR Code for Room ${currentRoom.roomNumber}`}
                  className="w-48 h-48 sm:w-56 sm:h-56 mx-auto object-contain"
                />
              ) : (
                <div className="w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center text-xs text-gray-400">
                  Rendering QR...
                </div>
              )}
            </div>

            {/* Target URL Pill */}
            <div className="bg-sand-100 px-3 py-1.5 rounded-xl text-[11px] font-mono text-forest-800 break-all mb-4 border border-sand-300">
              {getRoomUrl(currentRoom.roomNumber)}
            </div>

            {/* In-Room Features */}
            <div className="space-y-1.5 text-left text-xs text-forest-900 bg-sand-50/80 p-3.5 rounded-2xl border border-sand-200 mb-4">
              <div className="flex items-center space-x-2">
                <Utensils className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Fresh kitchen thalis, momos & tea ordered to bedside</span>
              </div>
              <div className="flex items-center space-x-2">
                <Car className="w-3.5 h-3.5 text-forest-700 shrink-0" />
                <span>NJP / Bagdogra airport cabs & scooty rentals</span>
              </div>
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>One-tap front desk WhatsApp service</span>
              </div>
            </div>

            {/* Wi-Fi Info */}
            <div className="bg-amber-50 text-amber-950 text-[11px] font-semibold py-2 px-3 rounded-xl border border-amber-200 flex items-center justify-center space-x-2">
              <Wifi className="w-3.5 h-3.5 text-amber-700" />
              <span>Wi-Fi: SaveraHomestay_Guest | Password: savera@darjeeling</span>
            </div>
          </div>
        </div>

        {/* Right: Actions, Room Specs & Instructions (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-sand-200 shadow-sm space-y-4">
            <h4 className="font-serif font-bold text-base text-forest-950">
              Print & Standee Actions for Room {currentRoom.roomNumber}
            </h4>

            <p className="text-xs text-forest-700 leading-relaxed">
              Print or export this high-resolution QR card designed for bedside acrylic standees, dining table acrylic blocks, or wall mount cards.
            </p>

            <div className="space-y-2.5 pt-2">
              <button
                onClick={handleDownloadSingle}
                className="w-full min-h-[46px] bg-forest-900 hover:bg-forest-800 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 active:scale-98"
              >
                <Download className="w-4 h-4 text-amber-300" />
                <span>Download High-Res PNG (Room {currentRoom.roomNumber})</span>
              </button>

              <button
                onClick={handlePrintCard}
                className="w-full min-h-[46px] bg-sand-200 hover:bg-sand-300 text-forest-950 font-bold text-xs py-3 px-4 rounded-xl transition-all flex items-center justify-center space-x-2 active:scale-98"
              >
                <Printer className="w-4 h-4 text-forest-800" />
                <span>Print Standee Card (A5 / Table Stand)</span>
              </button>
            </div>
          </div>

          {/* Room Summary Card */}
          <div className="bg-sand-50 rounded-3xl p-5 border border-sand-200 text-xs text-forest-900 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-forest-950">Room Category:</span>
              <span className="font-semibold text-amber-800">{currentRoom.categoryName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-forest-950">Physical Location:</span>
              <span>Floor {currentRoom.floorLevel} (Private Balcony)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-forest-950">Current Status:</span>
              <span className="capitalize font-mono font-bold">{currentRoom.currentStatus}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-forest-950">Direct Concierge Link:</span>
              <a
                href={getRoomUrl(currentRoom.roomNumber)}
                target="_blank"
                rel="noreferrer"
                className="text-forest-700 underline font-mono text-[11px] truncate max-w-[200px]"
              >
                /concierge?room={currentRoom.roomNumber}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (standalone) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-[#faf8f5] rounded-3xl p-6 sm:p-8 max-w-5xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-sand-300 relative animate-in fade-in zoom-in-95 duration-200 my-auto">
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close QR Hub"
            className="absolute top-5 right-5 p-2 rounded-full hover:bg-sand-200 text-forest-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center z-10"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        {content}
      </div>
    </div>
  );
}
