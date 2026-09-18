'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function QRRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const room = searchParams.get('room') || '101';
    router.replace(`/concierge?room=${room}`);
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center">
      <div className="flex flex-col items-center space-y-3">
        <div className="w-8 h-8 border-3 border-forest-700 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-forest-800 font-medium">Scanning In-Room QR Code...</span>
      </div>
    </div>
  );
}

export default function QRPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-forest-700 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <QRRedirect />
    </Suspense>
  );
}
