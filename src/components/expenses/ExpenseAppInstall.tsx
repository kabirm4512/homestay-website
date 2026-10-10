'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Check,
  Copy,
  Download,
  MoreVertical,
  PlusSquare,
  Share,
  Share2,
  ShieldCheck,
  Smartphone,
  WifiOff,
  Wallet,
  X,
  Zap,
  ExternalLink,
} from 'lucide-react';
import { InstallPlatform, isIosNonSafari, useInstallPrompt } from '@/lib/pwa-install';

/**
 * Getting the Expense Logger onto a manager's phone.
 *
 *  - ExpenseAppButton: the "Expense App" button in the admin header. Opens a sheet with a
 *    QR code and link to share with managers; on a phone it goes straight to installing.
 *  - ExpenseInstallCard: the "Install the app" card inside the Expense Logger (and on its
 *    sign-in screen). Hidden once the app is installed or opened from the home screen.
 *  - ExpenseInstallSheet: step-by-step install for Android, iPhone and desktop.
 */

export const EXPENSE_APP = 'expenses';
const ICON = '/icons/expenses-192.png';
const DISMISS_KEY = 'savera_expense_install_dismissed_at';

function appUrl() {
  if (typeof window === 'undefined') return '/expenses?install=1';
  return `${window.location.origin}/expenses?install=1`;
}

function QrCode({ value, size = 184 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string>('');
  useEffect(() => {
    QRCode.toDataURL(value, { margin: 1, width: size * 2, color: { dark: '#142820', light: '#ffffff' }, errorCorrectionLevel: 'H' })
      .then(setSrc)
      .catch(() => setSrc(''));
  }, [value, size]);
  return (
    <div className="relative rounded-3xl bg-white p-3 border border-sand-200 shadow-sm" style={{ width: size + 24, height: size + 24 }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} width={size} height={size} alt="QR code that opens the Expense Logger" className="rounded-xl" />
      ) : (
        <div className="w-full h-full rounded-xl bg-sand-100 animate-pulse" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ICON} alt="" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-xl ring-4 ring-white" />
    </div>
  );
}

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 w-full rounded-2xl border border-sand-200 bg-sand-50 pl-3.5 pr-1.5 py-1.5">
      <span className="flex-1 min-w-0 truncate font-mono text-[12px] text-forest-800">{url.replace(/^https?:\/\//, '')}</span>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          } catch {}
        }}
        className="min-h-[40px] px-3 rounded-xl bg-white border border-sand-200 text-[12px] font-bold text-forest-900 inline-flex items-center gap-1.5"
      >
        {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function Step({ n, icon: Icon, children }: { n: number; icon: typeof Share; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="w-7 h-7 rounded-full bg-[#142820] text-[#E8D3A2] text-[12px] font-bold flex items-center justify-center shrink-0">{n}</span>
      <div className="flex-1 pt-0.5 text-[14px] leading-snug text-forest-900">{children}</div>
      <span className="w-9 h-9 rounded-xl bg-sand-100 border border-sand-200 flex items-center justify-center shrink-0">
        <Icon className="w-[18px] h-[18px] text-forest-800" />
      </span>
    </li>
  );
}

const PERKS = [
  { icon: Zap, title: '3 taps', text: 'Recent bills repeat with one tap' },
  { icon: WifiOff, title: 'No signal? Fine', text: 'Saved on the phone, sent later' },
  { icon: ShieldCheck, title: 'Signed', text: 'Your name and the time, every entry' },
  { icon: Wallet, title: 'Cash in hand', text: 'Always know what you hold' },
];

export function ExpenseInstallSheet({
  open,
  onClose,
  mode = 'install',
}: {
  open: boolean;
  onClose: () => void;
  /** 'share' = admin sending the app to managers; 'install' = this device. */
  mode?: 'install' | 'share';
}) {
  const { platform, canPrompt, installed, install } = useInstallPrompt(EXPENSE_APP);
  const [url, setUrl] = useState('/expenses?install=1');
  const [done, setDone] = useState(false);
  useEffect(() => setUrl(appUrl()), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;

  const onPhone = platform !== 'desktop';
  // On a phone, installing must happen inside the app's own pages (its scope).
  const insideApp = typeof window !== 'undefined' && window.location.pathname.startsWith('/expenses');
  const showShare = mode === 'share' || !onPhone;

  const share = async () => {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: 'Savera Expense Logger', text: 'Install the Savera Expense Logger and sign in with your manager account:', url });
      } catch {}
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="exp-install-title">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-[#0B1712]/70 backdrop-blur-sm animate-in fade-in duration-200" />
      <div className="relative w-full sm:max-w-[440px] max-h-[92dvh] overflow-y-auto bg-[#FBF8F2] sm:rounded-[28px] rounded-t-[28px] shadow-2xl animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-300 pb-[max(env(safe-area-inset-bottom),16px)]">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-t-[28px] bg-[#142820] text-white px-6 pt-6 pb-7">
          <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-[#C5A059]/20 blur-3xl pointer-events-none" />
          <div className="absolute -left-10 bottom-0 w-40 h-40 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none" />
          <div className="sm:hidden mx-auto -mt-2 mb-4 h-1.5 w-10 rounded-full bg-white/25" />
          <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 w-11 h-11 rounded-full text-white/70 hover:text-white hover:bg-white/10 flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
          <div className="relative flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ICON} alt="" className="w-16 h-16 rounded-[20px] shadow-lg ring-1 ring-white/10" />
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#E8D3A2] font-bold">Savera · for managers</p>
              <h2 id="exp-install-title" className="font-serif text-[24px] leading-tight font-bold">Expense Logger</h2>
              <p className="text-[13px] text-[#B9C9B1]">Log a bill in seconds, even offline.</p>
            </div>
          </div>
          <div className="relative mt-5 grid grid-cols-2 gap-2">
            {PERKS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl bg-white/[0.06] border border-white/10 px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-[13px] font-bold"><Icon className="w-4 h-4 text-[#E8D3A2]" />{title}</p>
                <p className="text-[11.5px] text-[#B9C9B1] leading-snug mt-0.5">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 pt-5 space-y-5">
          {installed && !showShare ? (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-[14px] text-emerald-900 flex gap-3">
              <Check className="w-5 h-5 shrink-0" /> The app is installed on this phone. Open it from your home screen.
            </div>
          ) : null}

          {/* This phone */}
          {onPhone && !installed && (
            <section className="space-y-3">
              {!insideApp ? (
                <a
                  href="/expenses?install=1"
                  className="w-full min-h-[54px] rounded-2xl bg-[#C85A32] hover:bg-[#B44E2A] text-white text-[16px] font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#C85A32]/25 active:scale-[0.98] transition"
                >
                  <Download className="w-5 h-5" /> Install on this phone
                </a>
              ) : platform === 'android' && canPrompt ? (
                <button
                  onClick={async () => setDone(await install())}
                  className="w-full min-h-[54px] rounded-2xl bg-[#C85A32] hover:bg-[#B44E2A] text-white text-[16px] font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#C85A32]/25 active:scale-[0.98] transition"
                >
                  <Download className="w-5 h-5" /> Install app
                </button>
              ) : (
                <PhoneSteps platform={platform} />
              )}
              {done && (
                <p className="text-[13px] text-emerald-800 font-semibold flex items-center gap-1.5"><Check className="w-4 h-4" /> Installing… find “Expenses” on your home screen.</p>
              )}
            </section>
          )}

          {/* Another phone */}
          {showShare && (
            <section className="space-y-3">
              <div>
                <h3 className="text-[15px] font-bold text-forest-950">{mode === 'share' ? 'Send it to your managers' : 'Open it on your phone'}</h3>
                <p className="text-[13px] text-forest-700">
                  Scan with the phone&apos;s camera, then tap <strong>Install</strong> (Android) or <strong>Share → Add to Home Screen</strong> (iPhone). Managers sign in with their own account.
                </p>
              </div>
              <div className="flex flex-col items-center gap-3">
                <QrCode value={url} />
                <CopyLink url={url} />
                <div className="grid grid-cols-2 gap-2 w-full">
                  {typeof navigator !== 'undefined' && 'share' in navigator ? (
                    <button onClick={share} className="min-h-[46px] rounded-2xl bg-[#142820] text-white text-[13px] font-bold inline-flex items-center justify-center gap-1.5">
                      <Share2 className="w-4 h-4" /> Share link
                    </button>
                  ) : (
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`Savera Expense Logger: ${url}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[46px] rounded-2xl bg-[#142820] text-white text-[13px] font-bold inline-flex items-center justify-center gap-1.5"
                    >
                      <Share2 className="w-4 h-4" /> WhatsApp
                    </a>
                  )}
                  <a
                    href="/expenses"
                    target={insideApp ? undefined : '_blank'}
                    rel="noopener"
                    className="min-h-[46px] rounded-2xl border border-sand-300 bg-white text-forest-900 text-[13px] font-bold inline-flex items-center justify-center gap-1.5"
                  >
                    <ExternalLink className="w-4 h-4" /> Open here
                  </a>
                </div>
                {mode === 'share' && (
                  <a href="/admin?tab=ledger&subtab=staff" className="text-[12.5px] font-semibold text-[#C85A32] hover:underline">
                    Managers need an account first: add or manage staff →
                  </a>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function PhoneSteps({ platform }: { platform: InstallPlatform }) {
  if (platform === 'ios') {
    if (isIosNonSafari()) {
      return (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-[14px] text-amber-950">
          On iPhone, apps are added from <strong>Safari</strong>. Copy this page&apos;s link, open it in Safari, then follow the steps.
        </div>
      );
    }
    return (
      <ol className="space-y-3 rounded-2xl bg-white border border-sand-200 p-4">
        <Step n={1} icon={Share}>Tap the <strong>Share</strong> button in Safari&apos;s toolbar.</Step>
        <Step n={2} icon={PlusSquare}>Scroll and tap <strong>Add to Home Screen</strong>.</Step>
        <Step n={3} icon={Check}>Tap <strong>Add</strong>. Open <strong>Expenses</strong> from your home screen and sign in.</Step>
      </ol>
    );
  }
  return (
    <ol className="space-y-3 rounded-2xl bg-white border border-sand-200 p-4">
      <Step n={1} icon={MoreVertical}>Tap Chrome&apos;s <strong>⋮</strong> menu (top right).</Step>
      <Step n={2} icon={Smartphone}>Tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>).</Step>
      <Step n={3} icon={Check}>Tap <strong>Install</strong>. Open <strong>Expenses</strong> from your home screen.</Step>
    </ol>
  );
}

/** Install card inside the Expense Logger. `?install=1` opens the install sheet at once. */
export function ExpenseInstallCard({ className = '', tone = 'light' }: { className?: string; tone?: 'light' | 'dark' }) {
  const { ready, platform, installed, standalone, canPrompt, install } = useInstallPrompt(EXPENSE_APP);
  const [sheet, setSheet] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    let recent = false;
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
      recent = Date.now() - at < 3 * 24 * 3600e3;
    } catch {}
    const asked = new URLSearchParams(window.location.search).get('install') === '1';
    setDismissed(recent && !asked);
    if (asked) setSheet(true);
  }, []);

  if (!ready || standalone || installed || dismissed) {
    return <ExpenseInstallSheet open={sheet && !standalone} onClose={() => setSheet(false)} />;
  }
  const primary =
    platform === 'android' && canPrompt
      ? { label: 'Install', onClick: () => void install() }
      : platform === 'desktop'
      ? { label: 'Get it on your phone', onClick: () => setSheet(true) }
      : { label: platform === 'ios' ? 'Add to Home Screen' : 'Install', onClick: () => setSheet(true) };
  const dark = tone === 'dark';

  return (
    <>
      <div
        className={`relative flex items-center gap-3 rounded-3xl p-3 pr-2 ${
          dark ? 'bg-white/[0.07] border border-white/10 text-white' : 'bg-white border border-sand-200 shadow-[0_8px_24px_-12px_rgba(20,40,32,0.25)]'
        } ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ICON} alt="" className="w-12 h-12 rounded-2xl shrink-0" />
        <div className="flex-1 min-w-0">
          <p className={`text-[14px] font-bold leading-tight ${dark ? 'text-white' : 'text-forest-950'}`}>Install the Expense Logger</p>
          <p className={`text-[12px] leading-snug ${dark ? 'text-[#B9C9B1]' : 'text-forest-600'}`}>One tap from your home screen. Works offline.</p>
        </div>
        <button
          onClick={primary.onClick}
          className="min-h-[42px] px-4 rounded-2xl bg-[#C85A32] hover:bg-[#B44E2A] text-white text-[13px] font-bold shrink-0 active:scale-95 transition"
        >
          {primary.label}
        </button>
        <button
          onClick={() => {
            try {
              localStorage.setItem(DISMISS_KEY, String(Date.now()));
            } catch {}
            setDismissed(true);
          }}
          aria-label="Not now"
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${dark ? 'text-white/50 hover:bg-white/10' : 'text-forest-400 hover:bg-sand-100'}`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <ExpenseInstallSheet open={sheet} onClose={() => setSheet(false)} />
    </>
  );
}

/** "Expense App" button for the admin header. */
export function ExpenseAppButton({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
        title="Expense Logger app for managers' phones"
      >
        <Smartphone className="w-3.5 h-3.5 text-[#C5A059]" />
        <span>Expense App</span>
      </button>
      <ExpenseInstallSheet open={open} onClose={() => setOpen(false)} mode="share" />
    </>
  );
}
