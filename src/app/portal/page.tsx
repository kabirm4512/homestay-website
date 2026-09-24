'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function PortalRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams.toString();
    const target = qs ? `/guest-portal?${qs}` : '/guest-portal';
    router.replace(target);
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-[#0B1733] text-white flex items-center justify-center p-4 font-sans">
      <div className="flex flex-col items-center space-y-3 text-center">
        <div className="w-10 h-10 border-3 border-[#FE6E00] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-white tracking-wide">Savera Homestay</p>
        <p className="text-xs text-gray-400">Redirecting to Guest Portal...</p>
      </div>
    </div>
  );
}

export default function PortalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0B1733] text-white flex items-center justify-center p-4">
          <div className="w-10 h-10 border-3 border-[#FE6E00] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <PortalRedirect />
    </Suspense>
  );
}
