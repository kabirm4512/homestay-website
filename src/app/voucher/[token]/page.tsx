import type { Metadata } from 'next';
import { loadVoucher, VoucherData } from '@/lib/server/vouchers';
import PrintButton from './PrintButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Booking Voucher · Savera Homestay',
  robots: { index: false, follow: false },
};

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const longDate = (d: string) =>
  new Date(`${d}T00:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

const STATUS: Record<VoucherData['status'], { label: string; cls: string }> = {
  confirmed: { label: 'Confirmed', cls: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  checked_in: { label: 'Checked in', cls: 'bg-blue-100 text-blue-900 border-blue-300' },
  checked_out: { label: 'Completed', cls: 'bg-gray-100 text-gray-800 border-gray-300' },
  hold: { label: 'Provisional', cls: 'bg-amber-100 text-amber-900 border-amber-300' },
  cancelled: { label: 'Cancelled', cls: 'bg-rose-100 text-rose-900 border-rose-300' },
};

export default async function VoucherPage({ params }: { params: { token: string } }) {
  let v: VoucherData | null = null;
  try {
    v = await loadVoucher(decodeURIComponent(params.token));
  } catch {
    v = null;
  }

  if (!v) {
    return (
      <main className="min-h-screen bg-[#FAF6EE] flex items-center justify-center p-6 font-sans">
        <div className="max-w-sm text-center space-y-2">
          <h1 className="font-serif text-2xl font-bold text-[#142820]">Voucher not found</h1>
          <p className="text-sm text-[#5C6D66]">This link is invalid or has expired. Please contact Savera Homestay for a new voucher.</p>
        </div>
      </main>
    );
  }

  const st = STATUS[v.status];
  const guests = v.rooms.reduce((s, r) => s + r.adults, 0);
  const kids = v.rooms.reduce((s, r) => s + r.children, 0);

  return (
    <main className="min-h-screen bg-[#EFE8DA] py-6 px-3 sm:py-10 font-sans text-[#142820] print:bg-white print:p-0">
      <div className="mx-auto max-w-2xl">
        <div className="mb-3 flex justify-end">
          <PrintButton />
        </div>

        <article className="overflow-hidden rounded-3xl bg-white shadow-xl print:shadow-none print:rounded-none">
          {/* Header */}
          <header className="bg-[#142820] px-6 py-6 sm:px-8 text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#C5A059]">Booking voucher</p>
                <h1 className="mt-1 font-serif text-2xl sm:text-3xl font-bold">{v.site.name}</h1>
                {v.site.address && <p className="mt-1 max-w-sm text-xs text-white/70">{v.site.address}</p>}
              </div>
              <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-extrabold ${st.cls}`}>{st.label}</span>
            </div>
          </header>

          {v.status === 'cancelled' && (
            <p className="bg-rose-50 px-6 sm:px-8 py-3 text-sm font-semibold text-rose-800">This booking has been cancelled. This voucher is no longer valid for a stay.</p>
          )}
          {v.status === 'hold' && (
            <p className="bg-amber-50 px-6 sm:px-8 py-3 text-sm font-semibold text-amber-900">These rooms are held for you. The booking is confirmed once the advance is received.</p>
          )}

          <div className="space-y-6 px-6 py-6 sm:px-8">
            {/* Guest + reference */}
            <section className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#5C6D66]">Guest</p>
                <p className="mt-0.5 font-serif text-lg font-bold">{v.guestName}</p>
                {v.guestPhoneMasked && <p className="text-xs text-[#5C6D66]">Mobile {v.guestPhoneMasked}</p>}
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#5C6D66]">Booking ID</p>
                {v.references.map((r) => (
                  <p key={r} className="font-mono text-base font-bold">{r}</p>
                ))}
              </div>
            </section>

            {/* Stay */}
            <section className="grid grid-cols-3 overflow-hidden rounded-2xl border border-[#E5DEC9] text-center">
              <div className="p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#5C6D66]">Check-in</p>
                <p className="mt-0.5 text-sm font-bold">{longDate(v.checkInDate)}</p>
                <p className="text-xs text-[#5C6D66]">from {v.site.checkInTime}</p>
              </div>
              <div className="border-x border-[#E5DEC9] bg-[#FAF6EE] p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#5C6D66]">Stay</p>
                <p className="mt-0.5 font-serif text-xl font-bold">{v.nights} night{v.nights > 1 ? 's' : ''}</p>
                <p className="text-xs text-[#5C6D66]">
                  {guests} adult{guests !== 1 ? 's' : ''}
                  {kids ? `, ${kids} child${kids > 1 ? 'ren' : ''}` : ''}
                </p>
              </div>
              <div className="p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#5C6D66]">Check-out</p>
                <p className="mt-0.5 text-sm font-bold">{longDate(v.checkOutDate)}</p>
                <p className="text-xs text-[#5C6D66]">by {v.site.checkOutTime}</p>
              </div>
            </section>

            {/* Rooms */}
            <section>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="font-serif text-base font-bold">Room{v.rooms.length > 1 ? 's' : ''}</h2>
                <p className="text-xs text-[#5C6D66]">Meal plan: {v.mealPlan}</p>
              </div>
              <div className="divide-y divide-[#E5DEC9] rounded-2xl border border-[#E5DEC9] text-sm">
                {v.rooms.map((r) => (
                  <div key={`${r.bookingReference}-${r.roomNumber}`} className={`flex items-center gap-3 p-3 ${r.status === 'cancelled' ? 'opacity-50 line-through' : ''}`}>
                    <span className="flex h-10 min-w-[48px] items-center justify-center rounded-xl bg-[#142820] px-2 font-mono text-sm font-bold text-[#C5A059]">{r.roomNumber}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{r.roomType || `Room ${r.roomNumber}`}</p>
                      <p className="text-xs text-[#5C6D66]">
                        {r.adults} adult{r.adults !== 1 ? 's' : ''}
                        {r.children ? `, ${r.children} child${r.children > 1 ? 'ren' : ''}` : ''} · {r.nights} night{r.nights > 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className="font-mono font-bold">{inr(r.amount)}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Payment */}
            <section className="rounded-2xl bg-[#FAF6EE] p-4 text-sm">
              <div className="flex justify-between">
                <span>Total</span>
                <span className="font-mono font-bold">{inr(v.total)}</span>
              </div>
              <div className="mt-1 flex justify-between text-emerald-800">
                <span>Advance received</span>
                <span className="font-mono font-bold">{inr(v.paid)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-[#E5DEC9] pt-2 text-base">
                <span className="font-bold">Balance payable at check-in</span>
                <span className="font-mono font-extrabold">{inr(v.balance)}</span>
              </div>
            </section>

            {v.specialRequests && (
              <section className="text-sm">
                <h2 className="font-serif text-base font-bold">Your requests</h2>
                <p className="mt-1 text-[#3C4B44]">{v.specialRequests}</p>
              </section>
            )}

            {v.site.policies.length > 0 && (
              <section className="text-xs">
                <h2 className="mb-2 font-serif text-base font-bold">Good to know</h2>
                <ul className="space-y-1.5 text-[#3C4B44]">
                  {v.site.policies.map((p) => (
                    <li key={p.title}>
                      <strong className="text-[#142820]">{p.title}:</strong> {p.desc}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* Contact */}
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5DEC9] px-6 py-4 sm:px-8 text-xs">
            <div className="space-y-0.5 text-[#3C4B44]">
              <p>
                Call <a className="font-bold text-[#142820]" href={`tel:${v.site.phone.replace(/\s/g, '')}`}>{v.site.phone}</a>
                {v.site.email && (
                  <>
                    {' '}· <a className="font-bold text-[#142820]" href={`mailto:${v.site.email}`}>{v.site.email}</a>
                  </>
                )}
              </p>
              <p className="text-[10px] text-[#8C9B90]">Computer-generated voucher. Please show it at check-in with a government photo ID for every adult.</p>
            </div>
            <div className="flex gap-2 print:hidden">
              {v.site.mapUrl && (
                <a href={v.site.mapUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-[#142820]/20 px-3 py-1.5 font-bold">
                  Directions
                </a>
              )}
              <a href={`https://wa.me/${v.site.whatsapp}`} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[#25D366] px-3 py-1.5 font-bold text-white">
                WhatsApp us
              </a>
            </div>
          </footer>
        </article>
      </div>
    </main>
  );
}
