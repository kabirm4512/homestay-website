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
  Copy,
  Check,
  Eye,
  EyeOff,
  Smartphone,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { PhysicalRoom } from '@/types/crm';
import { useCRM } from '@/context/CRMContext';

interface InRoomQRHubProps {
  initialRoomNumber?: number;
  initialTab?: 'rooms' | 'wifi';
  isOpen?: boolean;
  onClose?: () => void;
  standalone?: boolean;
  guestMode?: boolean;
}

export default function InRoomQRHub({
  initialRoomNumber = 101,
  initialTab = 'rooms',
  isOpen = true,
  onClose,
  standalone = false,
  guestMode = false,
}: InRoomQRHubProps) {
  const { rooms } = useCRM();

  // Active view tab: 'rooms' (Concierge & Dining QRs) or 'wifi' (Estate Wi-Fi QR Center)
  const [activeTab, setActiveTab] = useState<'rooms' | 'wifi'>(guestMode ? 'wifi' : initialTab);

  // All 7 rooms sorted
  const sortedRooms = [...rooms].sort((a, b) => a.roomNumber - b.roomNumber);

  const [selectedRoomNumber, setSelectedRoomNumber] = useState<number>(initialRoomNumber);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [customDomain, setCustomDomain] = useState<string>('');

  // Estate Wi-Fi configuration (decoded from official QR)
  const [wifiSsid, setWifiSsid] = useState<string>('Airtel_nabi_8882');
  const [wifiPassword, setWifiPassword] = useState<string>('air69080');
  const [wifiSecurity, setWifiSecurity] = useState<string>('WPA');
  const [wifiQrDataUrl, setWifiQrDataUrl] = useState<string>('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showWifiEditor, setShowWifiEditor] = useState<boolean>(false);

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

  // Generate Wi-Fi QR Code data URL whenever SSID/password changes
  useEffect(() => {
    let isMounted = true;
    const wifiPayload = `WIFI:S:${wifiSsid};T:${wifiSecurity};P:${wifiPassword};H:false;;`;

    QRCode.toDataURL(wifiPayload, {
      width: 600,
      margin: 2,
      color: {
        dark: '#1b382b',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => {
        if (isMounted) setWifiQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Failed to generate Wi-Fi QR code', err);
      });

    return () => {
      isMounted = false;
    };
  }, [wifiSsid, wifiPassword, wifiSecurity]);

  // Clipboard copy handler
  const handleCopy = (text: string, fieldName: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => {
        setCopiedField(null);
      }, 2000);
    }
  };

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
    ctx.roundRect(75, 75, width - 150, 185, 22);
    ctx.fill();

    // Brand Name & Subtitle in Header
    ctx.fillStyle = '#f59e0b'; // Amber Gold
    ctx.font = 'bold 26px serif';
    ctx.textAlign = 'center';
    ctx.fillText('SAVERA HOMESTAY • DARJEELING', width / 2, 130);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px serif';
    ctx.fillText('IN-ROOM GUEST SERVICES & WI-FI', width / 2, 185);

    ctx.fillStyle = '#d1d5db';
    ctx.font = '20px sans-serif';
    ctx.fillText('Scan with your smartphone camera to connect to Wi-Fi & order services', width / 2, 228);

    // Room Badge (Gold foil banner)
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 260, 280, 520, 76, 38);
    ctx.fill();

    ctx.fillStyle = '#1b382b';
    ctx.font = '900 42px sans-serif';
    ctx.fillText(`ROOM ${room.roomNumber}`, width / 2, 334);

    // Room Category Name
    ctx.fillStyle = '#374151';
    ctx.font = 'italic bold 25px serif';
    ctx.fillText(room.categoryName || 'Boutique Room with Balcony', width / 2, 390);

    // -------------------------------------------------------------
    // GENERATE BOTH QR CODES
    // -------------------------------------------------------------
    // 1. Wi-Fi QR Code
    const wifiPayload = `WIFI:S:${wifiSsid};T:${wifiSecurity};P:${wifiPassword};H:false;;`;
    const wifiQrData = await QRCode.toDataURL(wifiPayload, {
      width: 400,
      margin: 2,
      color: { dark: '#1b382b', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    });

    const wifiQrImg = new Image();
    await new Promise<void>((resolve, reject) => {
      wifiQrImg.onload = () => resolve();
      wifiQrImg.onerror = reject;
      wifiQrImg.src = wifiQrData;
    });

    // 2. Concierge & Dining QR Code
    const roomUrl = getRoomUrl(room.roomNumber);
    const conciergeQrData = await QRCode.toDataURL(roomUrl, {
      width: 400,
      margin: 2,
      color: { dark: '#1b382b', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    });

    const conciergeQrImg = new Image();
    await new Promise<void>((resolve, reject) => {
      conciergeQrImg.onload = () => resolve();
      conciergeQrImg.onerror = reject;
      conciergeQrImg.src = conciergeQrData;
    });

    // -------------------------------------------------------------
    // DUAL QR PANELS (SIDE BY SIDE)
    // -------------------------------------------------------------
    const panelY = 415;
    const panelH = 780;
    const panelW = 495;
    const leftX = 85;
    const rightX = 620;

    // --- LEFT PANEL: 1. FREE HIGH-SPEED WI-FI ---
    ctx.fillStyle = '#fffdfa';
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(leftX, panelY, panelW, panelH, 24);
    ctx.fill();
    ctx.stroke();

    // Wi-Fi Header Pill
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.roundRect(leftX + 20, panelY + 20, panelW - 40, 56, 16);
    ctx.fill();

    ctx.fillStyle = '#92400e';
    ctx.font = 'bold 23px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('1. FREE HIGH-SPEED WI-FI', leftX + panelW / 2, panelY + 56);

    // Wi-Fi QR Image Container Box
    const qrBoxSize = 380;
    const leftQrX = leftX + (panelW - qrBoxSize) / 2;
    const leftQrY = panelY + 95;

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(leftQrX, leftQrY, qrBoxSize, qrBoxSize, 20);
    ctx.fill();
    ctx.stroke();

    ctx.drawImage(wifiQrImg, leftQrX + 10, leftQrY + 10, qrBoxSize - 20, qrBoxSize - 20);

    // Wi-Fi Credentials Box
    const wifiCredY = leftQrY + qrBoxSize + 22;
    ctx.fillStyle = '#fdf8ea';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(leftX + 20, wifiCredY, panelW - 40, 160, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#92400e';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ESTATE NETWORK (SSID)', leftX + panelW / 2, wifiCredY + 32);

    ctx.fillStyle = '#1b382b';
    ctx.font = 'bold 26px monospace';
    ctx.fillText(wifiSsid, leftX + panelW / 2, wifiCredY + 68);

    ctx.fillStyle = '#92400e';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('PASSWORD', leftX + panelW / 2, wifiCredY + 105);

    ctx.fillStyle = '#78350f';
    ctx.font = 'bold 26px monospace';
    ctx.fillText(wifiPassword, leftX + panelW / 2, wifiCredY + 138);

    // Wi-Fi Action Footer Callout
    ctx.fillStyle = '#1b382b';
    ctx.beginPath();
    ctx.roundRect(leftX + 20, panelY + panelH - 68, panelW - 40, 48, 14);
    ctx.fill();

    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Point camera to connect without typing', leftX + panelW / 2, panelY + panelH - 38);

    // --- RIGHT PANEL: 2. IN-ROOM CONCIERGE & DINING ---
    ctx.fillStyle = '#f8faf9';
    ctx.strokeStyle = '#1b382b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(rightX, panelY, panelW, panelH, 24);
    ctx.fill();
    ctx.stroke();

    // Concierge Header Pill
    ctx.fillStyle = '#e8f2ec';
    ctx.beginPath();
    ctx.roundRect(rightX + 20, panelY + 20, panelW - 40, 56, 16);
    ctx.fill();

    ctx.fillStyle = '#1b382b';
    ctx.font = 'bold 23px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('2. IN-ROOM DIGITAL CONCIERGE', rightX + panelW / 2, panelY + 56);

    // Concierge QR Image Container Box
    const rightQrX = rightX + (panelW - qrBoxSize) / 2;
    const rightQrY = panelY + 95;

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(rightQrX, rightQrY, qrBoxSize, qrBoxSize, 20);
    ctx.fill();
    ctx.stroke();

    ctx.drawImage(conciergeQrImg, rightQrX + 10, rightQrY + 10, qrBoxSize - 20, qrBoxSize - 20);

    // Concierge Features Box
    const concCredY = rightQrY + qrBoxSize + 22;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#a7f3d0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(rightX + 20, concCredY, panelW - 40, 160, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#1b382b';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('• Fresh Kitchen Thalis, Momos & Tea', rightX + 40, concCredY + 36);
    ctx.fillText('• Mountain Cabs & Scooty Hire', rightX + 40, concCredY + 74);
    ctx.fillText('• Direct Host WhatsApp & Room Service', rightX + 40, concCredY + 112);
    ctx.fillText('• View Running Room Folio / Bill', rightX + 40, concCredY + 146);

    // Concierge Action Footer Callout
    ctx.fillStyle = '#1b382b';
    ctx.beginPath();
    ctx.roundRect(rightX + 20, panelY + panelH - 68, panelW - 40, 48, 14);
    ctx.fill();

    ctx.fillStyle = '#d1fae5';
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Instant Bedside Ordering • No App Needed', rightX + panelW / 2, panelY + panelH - 38);

    // -------------------------------------------------------------
    // BOTTOM SUMMARY BANNER (INSTRUCTIONS & HOTLINE)
    // -------------------------------------------------------------
    const guideY = 1225;
    const guideH = 295;
    ctx.fillStyle = '#1b382b';
    ctx.beginPath();
    ctx.roundRect(75, guideY, width - 150, guideH, 24);
    ctx.fill();

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HOW TO USE YOUR IN-ROOM DIGITAL SERVICE STAND', width / 2, guideY + 45);

    // 3 Step Columns
    const colW = 310;
    const colGap = 35;
    const colStartX = 105;

    // Step 1
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('STEP 1: CONNECT WI-FI', colStartX, guideY + 95);
    ctx.fillStyle = '#d1d5db';
    ctx.font = '15px sans-serif';
    ctx.fillText('Point your phone camera at the left QR code. Tap the pop-up notification to join Wi-Fi instantly.', colStartX, guideY + 124, colW);

    // Step 2
    const col2X = colStartX + colW + colGap;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('STEP 2: ORDER FOOD & CABS', col2X, guideY + 95);
    ctx.fillStyle = '#d1d5db';
    ctx.font = '15px sans-serif';
    ctx.fillText('Point camera at the right QR code to order fresh hot food, chai, or reserve airport cabs & bikes.', col2X, guideY + 124, colW);

    // Step 3
    const col3X = col2X + colW + colGap;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('STEP 3: 24x7 FRONT DESK', col3X, guideY + 95);
    ctx.fillStyle = '#d1d5db';
    ctx.font = '15px sans-serif';
    ctx.fillText('Need extra blankets, heater, or local sightseeing tips? Tap WhatsApp on your phone screen.', col3X, guideY + 124, colW);

    // Front Desk Assistance Bar
    const hotlineY = guideY + 215;
    ctx.fillStyle = '#274b39';
    ctx.beginPath();
    ctx.roundRect(105, hotlineY, width - 210, 56, 14);
    ctx.fill();

    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Front Desk & Caretaker Assistance: +91 81012 98882  •  Savera Homestay, Darjeeling', width / 2, hotlineY + 35);

    return targetCanvas.toDataURL('image/png');
  };

  // Draw Standalone Printable Wi-Fi Standee Card onto high-res canvas (1200 x 1600 px)
  const drawWifiCardOnCanvas = async (targetCanvas: HTMLCanvasElement): Promise<string> => {
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

    // Header Container (Deep Forest)
    ctx.fillStyle = '#1b382b';
    ctx.beginPath();
    ctx.roundRect(80, 80, width - 160, 240, 24);
    ctx.fill();

    // Brand Name & Title in Header
    ctx.fillStyle = '#f59e0b'; // Amber Gold
    ctx.font = 'bold 28px serif';
    ctx.textAlign = 'center';
    ctx.fillText('SAVERA HOMESTAY - DARJEELING', width / 2, 145);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 52px serif';
    ctx.fillText('HIGH-SPEED GUEST WI-FI', width / 2, 215);

    ctx.fillStyle = '#d1d5db';
    ctx.font = '22px sans-serif';
    ctx.fillText('Complimentary High-Speed Broadband for Workations & Streaming', width / 2, 268);

    // Gold Foil Connect Banner
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 320, 355, 640, 95, 48);
    ctx.fill();

    ctx.fillStyle = '#1b382b';
    ctx.font = '900 36px sans-serif';
    ctx.fillText('SCAN WITH CAMERA TO CONNECT', width / 2, 415);

    // Large Wi-Fi QR Code Container Box
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(width / 2 - 280, 480, 560, 560, 32);
    ctx.fill();
    ctx.stroke();

    // Wi-Fi QR Code Image
    const wifiPayload = `WIFI:S:${wifiSsid};T:${wifiSecurity};P:${wifiPassword};H:false;;`;
    const qrData = await QRCode.toDataURL(wifiPayload, {
      width: 520,
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

    ctx.drawImage(qrImg, width / 2 - 250, 510, 500, 500);

    // Network Credentials Banner Box
    const credY = 1080;
    ctx.fillStyle = '#fef3c7'; // warm amber tint
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(140, credY, width - 280, 160, 24);
    ctx.fill();
    ctx.stroke();

    // Column 1: Network Name (SSID)
    ctx.fillStyle = '#92400e';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('WI-FI NETWORK (SSID)', 180, credY + 50);

    ctx.fillStyle = '#1b382b';
    ctx.font = 'bold 36px monospace';
    ctx.fillText(wifiSsid, 180, credY + 105);

    // Column 2: Network Password
    ctx.fillStyle = '#92400e';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('WI-FI PASSWORD', width / 2 + 50, credY + 50);

    ctx.fillStyle = '#1b382b';
    ctx.font = 'bold 36px monospace';
    ctx.fillText(wifiPassword, width / 2 + 50, credY + 105);

    // 3 Step Guide Cards
    const steps = [
      { num: '1', title: 'Open Camera', desc: 'Use phone camera (iOS / Android)' },
      { num: '2', title: 'Point at QR', desc: 'Center viewfinder on the code' },
      { num: '3', title: 'Tap Connect', desc: `Tap "Join ${wifiSsid}" prompt` },
    ];

    const stepY = 1275;
    steps.forEach((step, idx) => {
      const stepX = 140 + idx * 315;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(stepX, stepY, 290, 120, 18);
      ctx.fill();
      ctx.stroke();

      // Number badge
      ctx.fillStyle = '#1b382b';
      ctx.beginPath();
      ctx.arc(stepX + 40, stepY + 40, 20, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(step.num, stepX + 40, stepY + 48);

      ctx.fillStyle = '#1b382b';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(step.title, stepX + 75, stepY + 47);

      ctx.fillStyle = '#6b7280';
      ctx.font = '16px sans-serif';
      ctx.fillText(step.desc, stepX + 22, stepY + 90);
    });

    // Footer Brand Note
    ctx.fillStyle = '#78350f';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Savera Homestay • Darjeeling • 24/7 High-Speed Guest Connectivity', width / 2, 1490);

    return targetCanvas.toDataURL('image/png');
  };

  // Download Single Room Concierge PNG
  const handleDownloadSingle = async () => {
    if (!canvasRef.current) return;
    const dataUrl = await drawCardOnCanvas(currentRoom, canvasRef.current);
    const link = document.createElement('a');
    link.download = `savera-homestay-room-${currentRoom.roomNumber}-dine-in-qr.png`;
    link.href = dataUrl;
    link.click();
  };

  // Download Standalone Wi-Fi Standee PNG
  const handleDownloadWifiStandee = async () => {
    if (!canvasRef.current) return;
    const dataUrl = await drawWifiCardOnCanvas(canvasRef.current);
    const link = document.createElement('a');
    link.download = `savera-homestay-estate-wifi-standee.png`;
    link.href = dataUrl;
    link.click();
  };

  // Print Standalone Wi-Fi Standee
  const handlePrintWifiStandee = async () => {
    if (!canvasRef.current) return;
    const dataUrl = await drawWifiCardOnCanvas(canvasRef.current);

    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Please allow popups to print the Wi-Fi standee card.');
      return;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Savera Homestay - High-Speed Wi-Fi Standee Card</title>
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
          <img src="${dataUrl}" alt="Savera Homestay Estate Wi-Fi Standee" />
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

  // Download Wi-Fi QR Code Image Only
  const handleDownloadWifiQrOnly = () => {
    const link = document.createElement('a');
    link.download = `savera-wifi-${wifiSsid}-qr.png`;
    link.href = wifiQrDataUrl || '/images/wifi-qr.png';
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
                Generate, preview, print and download branded table and bedside standees for room concierge & high-speed Wi-Fi.
              </p>
            </div>
          </div>
        </div>

        {/* Mode Switcher Pills (Hidden in guestMode to prevent guests from seeing other rooms) */}
        {!guestMode && (
          <div className="flex items-center space-x-2 bg-sand-200/90 p-1.5 rounded-2xl">
            <button
              onClick={() => setActiveTab('rooms')}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                activeTab === 'rooms'
                  ? 'bg-forest-900 text-white shadow-sm'
                  : 'text-forest-800 hover:text-forest-950 hover:bg-sand-300/50'
              }`}
            >
              <QrCode className="w-4 h-4 text-amber-400" />
              <span>Room Concierge QRs</span>
            </button>

            <button
              onClick={() => setActiveTab('wifi')}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                activeTab === 'wifi'
                  ? 'bg-forest-900 text-white shadow-sm'
                  : 'text-forest-800 hover:text-forest-950 hover:bg-sand-300/50'
              }`}
            >
              <Wifi className="w-4 h-4 text-amber-400" />
              <span>Wi-Fi Connect QR</span>
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: IN-ROOM CONCIERGE QRs (ROOMS 101-204) - Admin/Staff only */}
      {/* ========================================================================= */}
      {!guestMode && activeTab === 'rooms' && (
        <>
          {/* Quick Actions & 7 Rooms Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-forest-700">
              Select Room to Preview & Export:
            </label>
            <button
              onClick={handleDownloadAllRooms}
              disabled={isGeneratingBatch}
              className="min-h-[38px] px-3.5 py-1.5 bg-sand-200 hover:bg-sand-300 text-forest-950 font-bold text-xs rounded-xl transition-all shadow-xs flex items-center space-x-2 disabled:opacity-50 self-start sm:self-auto cursor-pointer"
            >
              <Layers className="w-4 h-4 text-forest-800" />
              <span>
                {isGeneratingBatch
                  ? `Exporting ${batchProgress?.current}/${batchProgress?.total}...`
                  : 'Download All 7 QR Cards'}
              </span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {sortedRooms.map((room) => {
              const isSelected = room.roomNumber === selectedRoomNumber;
              return (
                <button
                  key={room.id}
                  onClick={() => setSelectedRoomNumber(room.roomNumber)}
                  className={`p-3 rounded-2xl border text-left transition-all relative cursor-pointer ${
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
              <div className="w-full max-w-2xl bg-white rounded-3xl p-5 sm:p-7 shadow-xl border-4 border-forest-900 text-center relative overflow-hidden">
                {/* Inner Gold Border */}
                <div className="absolute inset-2 border-2 border-amber-500/60 rounded-2xl pointer-events-none" />

                {/* Top Brand Banner */}
                <div className="bg-forest-900 text-white rounded-2xl p-4 mb-3 shadow-sm">
                  <div className="flex items-center justify-center space-x-2 text-amber-300 text-xs font-bold tracking-widest uppercase mb-1">
                    <Trees className="w-4 h-4" />
                    <span>Savera Homestay • Darjeeling</span>
                  </div>
                  <h3 className="font-serif font-bold text-lg sm:text-xl text-white">
                    IN-ROOM GUEST SERVICES & WI-FI
                  </h3>
                  <p className="text-[11px] text-sand-300 mt-0.5">
                    Scan with your smartphone camera to connect to Wi-Fi & order room services
                  </p>
                </div>

                {/* Room Badge */}
                <div className="inline-block bg-amber-400 text-forest-950 font-black text-xl sm:text-2xl px-6 py-1 rounded-full shadow-sm mb-1 font-mono tracking-wide">
                  ROOM {currentRoom.roomNumber}
                </div>

                <p className="font-serif italic text-forest-800 text-xs sm:text-sm font-semibold mb-3">
                  {currentRoom.categoryName}
                </p>

                {/* Dual Scannable QR Cards (Side-by-Side) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-3 text-left">
                  {/* Panel 1: Free Wi-Fi QR */}
                  <div className="bg-[#fffdf9] border-2 border-amber-400/90 rounded-2xl p-3.5 flex flex-col justify-between shadow-xs">
                    <div>
                      <div className="bg-amber-100/90 text-amber-950 px-2.5 py-1 rounded-xl text-xs font-extrabold flex items-center justify-between mb-2.5">
                        <span className="flex items-center gap-1.5">
                          <Wifi className="w-3.5 h-3.5 text-amber-700" />
                          <span>1. Free High-Speed Wi-Fi</span>
                        </span>
                        <span className="text-[9px] uppercase bg-amber-200/80 px-1.5 py-0.5 rounded font-mono">
                          Auto-Join
                        </span>
                      </div>

                      {/* Scannable Wi-Fi QR Code */}
                      <div className="bg-white p-2.5 rounded-xl border border-amber-200 shadow-inner text-center mb-2.5">
                        {wifiQrDataUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={wifiQrDataUrl}
                            alt="Savera Homestay Wi-Fi QR"
                            className="w-36 h-36 sm:w-40 sm:h-40 mx-auto object-contain"
                          />
                        ) : (
                          <div className="w-36 h-36 sm:w-40 sm:h-40 mx-auto flex items-center justify-center text-xs text-gray-400">
                            Rendering Wi-Fi QR...
                          </div>
                        )}
                        <span className="block text-[9px] font-bold text-amber-900 mt-1 uppercase tracking-wider">
                          Scan to connect instantly
                        </span>
                      </div>

                      {/* Network Credentials */}
                      <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-amber-800">Network:</span>
                          <span className="font-mono font-bold text-forest-950">{wifiSsid}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-amber-800">Password:</span>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono font-bold text-forest-950">{wifiPassword}</span>
                            <button
                              onClick={() => handleCopy(wifiPassword, 'preview-wifi-pass')}
                              className="text-[9px] px-1.5 py-0.5 bg-amber-200 hover:bg-amber-300 text-amber-950 rounded font-sans font-bold cursor-pointer transition-colors"
                            >
                              {copiedField === 'preview-wifi-pass' ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 text-center text-[10px] text-amber-900 font-semibold bg-amber-100/50 py-1 rounded-lg">
                      No password typing required
                    </div>
                  </div>

                  {/* Panel 2: In-Room Concierge QR */}
                  <div className="bg-[#f8faf9] border-2 border-forest-800 rounded-2xl p-3.5 flex flex-col justify-between shadow-xs">
                    <div>
                      <div className="bg-forest-100/80 text-forest-950 px-2.5 py-1 rounded-xl text-xs font-extrabold flex items-center justify-between mb-2.5">
                        <span className="flex items-center gap-1.5">
                          <QrCode className="w-3.5 h-3.5 text-forest-800" />
                          <span>2. Digital Concierge</span>
                        </span>
                        <span className="text-[9px] uppercase bg-forest-200/80 px-1.5 py-0.5 rounded font-mono">
                          Room {currentRoom.roomNumber}
                        </span>
                      </div>

                      {/* Scannable Concierge QR Code */}
                      <div className="bg-white p-2.5 rounded-xl border border-sand-200 shadow-inner text-center mb-2.5">
                        {qrDataUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={qrDataUrl}
                            alt={`Concierge QR for Room ${currentRoom.roomNumber}`}
                            className="w-36 h-36 sm:w-40 sm:h-40 mx-auto object-contain"
                          />
                        ) : (
                          <div className="w-36 h-36 sm:w-40 sm:h-40 mx-auto flex items-center justify-center text-xs text-gray-400">
                            Rendering Concierge QR...
                          </div>
                        )}
                        <span className="block text-[9px] font-bold text-forest-900 mt-1 uppercase tracking-wider">
                          Scan for dining, cabs & front desk
                        </span>
                      </div>

                      {/* In-Room Services List */}
                      <div className="bg-white p-2 rounded-xl border border-sand-200 text-[11px] space-y-1 text-forest-950">
                        <div className="flex items-center space-x-1.5">
                          <Utensils className="w-3 h-3 text-amber-600 shrink-0" />
                          <span className="truncate">Fresh kitchen thalis, momos & tea</span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <Car className="w-3 h-3 text-forest-700 shrink-0" />
                          <span className="truncate">Airport cabs & scooter rental</span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <MessageSquare className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span className="truncate">Direct front desk WhatsApp chat</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 text-center text-[10px] text-forest-800 font-semibold bg-forest-100/50 py-1 rounded-lg truncate">
                      {getRoomUrl(currentRoom.roomNumber)}
                    </div>
                  </div>
                </div>

                {/* Bottom Standee Guide & Front Desk Hotline */}
                <div className="bg-forest-950 text-sand-200 p-2.5 rounded-2xl text-[11px] flex flex-col sm:flex-row items-center justify-between gap-2 text-left">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Point phone camera at either QR code • No app download needed</span>
                  </div>
                  <div className="text-[10px] text-amber-300 font-mono font-bold shrink-0">
                    Host: +91 81012 98882
                  </div>
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
                  Print or export this high-resolution QR card designed for bedside acrylic standees, dining table blocks, or room entry cards. Includes integrated Wi-Fi connection QR at the footer.
                </p>

                <div className="space-y-2.5 pt-2">
                  <button
                    onClick={handleDownloadSingle}
                    className="w-full min-h-[46px] bg-forest-900 hover:bg-forest-800 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 active:scale-98 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-amber-300" />
                    <span>Download High-Res PNG (Room {currentRoom.roomNumber})</span>
                  </button>

                  <button
                    onClick={handlePrintCard}
                    className="w-full min-h-[46px] bg-sand-200 hover:bg-sand-300 text-forest-950 font-bold text-xs py-3 px-4 rounded-xl transition-all flex items-center justify-center space-x-2 active:scale-98 cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-forest-800" />
                    <span>Print Standee Card (A5 / Table Stand)</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('wifi')}
                    className="w-full min-h-[42px] bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 font-bold text-xs py-2.5 px-4 rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <Wifi className="w-4 h-4 text-amber-700" />
                    <span>View Dedicated Wi-Fi QR Standee &rarr;</span>
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
        </>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: DEDICATED ESTATE WI-FI QR CENTER */}
      {/* ========================================================================= */}
      {activeTab === 'wifi' && (
        <div className="space-y-6">
          {/* Top Wi-Fi Info Banner */}
          <div className="bg-gradient-to-r from-forest-900 via-forest-850 to-forest-900 text-white rounded-3xl p-5 sm:p-6 shadow-md border border-forest-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-amber-300 text-xs font-bold tracking-widest uppercase">
                <Wifi className="w-4 h-4" />
                <span>Estate High-Speed Broadband</span>
              </div>
              <h3 className="font-serif font-bold text-xl sm:text-2xl text-white">
                Savera Homestay Wi-Fi QR Center
              </h3>
              <p className="text-xs text-sand-300 max-w-xl">
                Guests can scan this QR code with their smartphone camera (iPhone or Android) to connect automatically without typing passwords.
              </p>
            </div>

            {!guestMode && (
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  onClick={() => setShowWifiEditor(!showWifiEditor)}
                  className="min-h-[40px] px-3.5 py-2 bg-forest-800 hover:bg-forest-750 text-sand-200 border border-forest-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  {showWifiEditor ? 'Hide Wi-Fi Settings' : 'Configure Network'}
                </button>
              </div>
            )}
          </div>

          {/* Wi-Fi Configuration Drawer (Admin/Staff only) */}
          {!guestMode && showWifiEditor && (
            <div className="bg-white rounded-3xl p-5 border border-sand-300 shadow-sm space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-sand-200 pb-3">
                <span className="font-bold text-xs text-forest-950 uppercase tracking-wider">
                  Update Estate Wi-Fi Credentials
                </span>
                <span className="text-[11px] text-gray-500">
                  Updates QR code and printable standees live
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-forest-800 mb-1">
                    Network SSID (Name):
                  </label>
                  <input
                    type="text"
                    value={wifiSsid}
                    onChange={(e) => setWifiSsid(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-sand-50 border border-sand-300 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-forest-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-forest-800 mb-1">
                    Password:
                  </label>
                  <input
                    type="text"
                    value={wifiPassword}
                    onChange={(e) => setWifiPassword(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-sand-50 border border-sand-300 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-forest-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-forest-800 mb-1">
                    Security Protocol:
                  </label>
                  <select
                    value={wifiSecurity}
                    onChange={(e) => setWifiSecurity(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-sand-50 border border-sand-300 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-forest-800"
                  >
                    <option value="WPA">WPA / WPA2 (Default)</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass">None / Open</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Wi-Fi Preview & Actions Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Interactive Printable Wi-Fi Standee Mockup (7 cols) */}
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
                    HIGH-SPEED GUEST WI-FI
                  </h3>
                  <p className="text-[10px] text-sand-300 mt-0.5">
                    Complimentary High-Speed Broadband for Workations & Streaming
                  </p>
                </div>

                {/* Gold Connect Banner */}
                <div className="inline-block bg-amber-400 text-forest-950 font-black text-xs sm:text-sm px-5 py-2 rounded-full shadow-sm mb-4 tracking-wider uppercase">
                  Scan With Camera to Connect
                </div>

                {/* Wi-Fi QR Code Graphic */}
                <div className="bg-white p-3 rounded-2xl border-2 border-sand-200 shadow-inner inline-block mb-4">
                  {wifiQrDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={wifiQrDataUrl}
                      alt="Wi-Fi Connection QR Code"
                      className="w-52 h-52 sm:w-60 sm:h-60 mx-auto object-contain"
                    />
                  ) : (
                    <div className="w-52 h-52 sm:w-60 sm:h-60 flex items-center justify-center text-xs text-gray-400">
                      Generating Wi-Fi QR...
                    </div>
                  )}
                </div>

                {/* Network Credentials Box */}
                <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-3.5 mb-4 text-left space-y-2">
                  <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                        Network Name (SSID)
                      </span>
                      <span className="font-mono font-bold text-sm text-forest-950">
                        {wifiSsid}
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopy(wifiSsid, 'ssid')}
                      className="min-h-[30px] px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold text-[11px] rounded-lg transition-colors flex items-center space-x-1 cursor-pointer"
                    >
                      {copiedField === 'ssid' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                        Password
                      </span>
                      <span className="font-mono font-bold text-sm text-forest-950">
                        {showPassword ? wifiPassword : '••••••••'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg transition-colors cursor-pointer"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleCopy(wifiPassword, 'password')}
                        className="min-h-[30px] px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold text-[11px] rounded-lg transition-colors flex items-center space-x-1 cursor-pointer"
                      >
                        {copiedField === 'password' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3 Step Guide */}
                <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-forest-900">
                  <div className="bg-sand-50 p-2 rounded-xl border border-sand-200">
                    <span className="w-4 h-4 rounded-full bg-forest-900 text-amber-300 font-bold inline-flex items-center justify-center mb-1">
                      1
                    </span>
                    <p className="font-bold">Open Camera</p>
                    <span className="text-gray-500 text-[9px]">iOS or Android</span>
                  </div>
                  <div className="bg-sand-50 p-2 rounded-xl border border-sand-200">
                    <span className="w-4 h-4 rounded-full bg-forest-900 text-amber-300 font-bold inline-flex items-center justify-center mb-1">
                      2
                    </span>
                    <p className="font-bold">Point at QR</p>
                    <span className="text-gray-500 text-[9px]">Hold camera steady</span>
                  </div>
                  <div className="bg-sand-50 p-2 rounded-xl border border-sand-200">
                    <span className="w-4 h-4 rounded-full bg-forest-900 text-amber-300 font-bold inline-flex items-center justify-center mb-1">
                      3
                    </span>
                    <p className="font-bold">Tap Connect</p>
                    <span className="text-gray-500 text-[9px]">Join network</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Actions & Details (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white rounded-3xl p-6 border border-sand-200 shadow-sm space-y-4">
                <h4 className="font-serif font-bold text-base text-forest-950">
                  Print & Download Wi-Fi Standees
                </h4>

                <p className="text-xs text-forest-700 leading-relaxed">
                  Export or print high-resolution acrylic standee cards for the reception desk, café lounge, dining area, or bedside tables.
                </p>

                <div className="space-y-2.5 pt-2">
                  <button
                    onClick={handleDownloadWifiStandee}
                    className="w-full min-h-[46px] bg-forest-900 hover:bg-forest-800 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 active:scale-98 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-amber-300" />
                    <span>Download Wi-Fi Standee Card (High-Res PNG)</span>
                  </button>

                  <button
                    onClick={handlePrintWifiStandee}
                    className="w-full min-h-[46px] bg-sand-200 hover:bg-sand-300 text-forest-950 font-bold text-xs py-3 px-4 rounded-xl transition-all flex items-center justify-center space-x-2 active:scale-98 cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-forest-800" />
                    <span>Print Wi-Fi Standee (A5 / Table Stand)</span>
                  </button>

                  <button
                    onClick={handleDownloadWifiQrOnly}
                    className="w-full min-h-[42px] bg-white hover:bg-sand-50 text-forest-900 border border-sand-300 font-bold text-xs py-2.5 px-4 rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <QrCode className="w-4 h-4 text-forest-700" />
                    <span>Download Wi-Fi QR Image Only</span>
                  </button>
                </div>
              </div>

              {/* Wi-Fi Details Card */}
              <div className="bg-sand-50 rounded-3xl p-5 border border-sand-200 text-xs text-forest-900 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-forest-950">Network Name:</span>
                  <span className="font-mono font-bold text-forest-900">{wifiSsid}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-forest-950">Password:</span>
                  <span className="font-mono font-bold text-amber-900">{wifiPassword}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-forest-950">Security Type:</span>
                  <span>WPA / WPA2 Personal</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-forest-950">Broadband Tier:</span>
                  <span className="text-emerald-700 font-semibold">High-Speed Optical Fibre</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-forest-950">Standard QR String:</span>
                  <span className="font-mono text-[10px] text-gray-500 truncate max-w-[180px]">
                    WIFI:S:{wifiSsid};T:WPA;...
                  </span>
                </div>
              </div>

              {/* Guest Compatibility Tip */}
              <div className="bg-emerald-50/90 rounded-2xl p-4 border border-emerald-200 text-emerald-950 text-xs space-y-1.5">
                <div className="flex items-center space-x-2 font-bold text-emerald-900">
                  <Smartphone className="w-4 h-4 text-emerald-700" />
                  <span>Universal Camera Auto-Connect</span>
                </div>
                <p className="text-[11px] leading-relaxed text-emerald-800">
                  When guests point their iPhone Camera (iOS 11+) or Android Camera (Android 10+) at this QR code, a notification immediately appears prompting <em>&ldquo;Join network {wifiSsid}?&rdquo;</em>. Tapping it connects their device automatically with zero password typing.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
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
