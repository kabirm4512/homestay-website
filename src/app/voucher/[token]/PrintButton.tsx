'use client';

import { Printer } from 'lucide-react';

/** Print / "Save as PDF" from the browser's print dialog. */
export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center gap-2 rounded-full border border-[#142820]/20 bg-white px-4 py-2 text-xs font-bold text-[#142820] hover:bg-[#FAF6EE]"
    >
      <Printer className="h-4 w-4" /> Save as PDF / Print
    </button>
  );
}
