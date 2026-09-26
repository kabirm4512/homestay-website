'use client';

import { MessageCircle, CalendarCheck, PhoneCall } from 'lucide-react';

interface FloatingCTAProps {
  whatsappNumber?: string;
  phoneNumber?: string;
  homestayName?: string;
  onOpenInquiry: () => void;
}

export default function FloatingCTA({
  whatsappNumber = '918101298882',
  phoneNumber = '+91 81012 98882',
  homestayName = 'Savera Homestay',
  onOpenInquiry,
}: FloatingCTAProps) {
  // Clean phone numbers for links
  const cleanPhone = phoneNumber.replace(/[^0-9+]/g, '');
  const cleanWhatsapp = whatsappNumber.replace(/[^0-9]/g, '');

  const whatsappMessage = encodeURIComponent(
    `Hello ${homestayName}! I'm interested in booking a stay at your homestay. Could you please share availability and rates?`
  );

  return (
    <aside
      aria-label="Quick Actions"
      className="fixed bottom-0 left-0 right-0 z-40 p-3 sm:p-4 pointer-events-none"
    >
      <div className="max-w-md mx-auto pointer-events-auto">
        <div className="bg-[#142820]/95 backdrop-blur-xl border border-white/20 shadow-[0_12px_40px_rgba(0,0,0,0.35)] rounded-full p-2 sm:p-2.5 flex items-center justify-between gap-2 text-white">
          {/* Button 1: WhatsApp Host */}
          <a
            href={`https://wa.me/${cleanWhatsapp}?text=${whatsappMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat on WhatsApp"
            className="flex-1 flex items-center justify-center space-x-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-white py-2.5 sm:py-3 px-3 rounded-full font-semibold text-xs sm:text-sm shadow-md transition-all transform hover:scale-[1.02] active:scale-95 text-center"
          >
            <MessageCircle className="w-4 h-4 fill-white flex-shrink-0" />
            <span className="truncate">WhatsApp</span>
          </a>

          {/* Button 2: Check Dates (Terracotta Accent) */}
          <button
            onClick={onOpenInquiry}
            aria-label="Check Dates and Rates"
            className="flex-[1.4] flex items-center justify-center space-x-1.5 bg-[#C85A32] hover:bg-[#B34D28] text-white py-2.5 sm:py-3 px-3 rounded-full font-semibold text-xs sm:text-sm shadow-[0_4px_14px_rgba(200,90,50,0.35)] transition-all transform hover:scale-[1.02] active:scale-95 text-center cursor-pointer"
          >
            <CalendarCheck className="w-4 h-4 text-white flex-shrink-0" />
            <span className="truncate">Check Dates</span>
          </button>

          {/* Button 3: Direct Call */}
          <a
            href={`tel:${cleanPhone}`}
            aria-label="Call Homestay Directly"
            className="flex-1 flex items-center justify-center space-x-1.5 bg-white/10 hover:bg-white/20 text-[#FAF8F5] border border-white/25 py-2.5 sm:py-3 px-3 rounded-full font-semibold text-xs sm:text-sm transition-all transform hover:scale-[1.02] active:scale-95 text-center"
          >
            <PhoneCall className="w-4 h-4 text-[#C5A059] flex-shrink-0" />
            <span className="truncate">Call</span>
          </a>
        </div>
      </div>
    </aside>
  );
}
