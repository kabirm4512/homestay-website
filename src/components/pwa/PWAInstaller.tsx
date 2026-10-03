'use client';

import React, { useState, useEffect } from 'react';
import { Smartphone, Download, CheckCircle2, Share, PlusSquare, X, Chrome, Sparkles } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __wp_pwa_event?: BeforeInstallPromptEvent | null;
  }
}

/** Remembered per app so the button stays hidden after installing (localStorage). */
export function markPwaInstalled(app: string) {
  try {
    localStorage.setItem(`wp_pwa_installed_${app}`, '1');
  } catch {}
}

function rememberedInstalled(app: string): boolean {
  try {
    return localStorage.getItem(`wp_pwa_installed_${app}`) === '1';
  } catch {
    return false;
  }
}

export default function PWAInstaller({
  variant = 'button',
  className = '',
  app = 'main',
  appName = 'Savera Homestay App',
  label = 'Install App',
}: {
  variant?: 'button' | 'badge' | 'banner';
  className?: string;
  /** Which installable app this page's manifest describes ('main' or 'expenses'). */
  app?: string;
  appName?: string;
  label?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [browserType, setBrowserType] = useState<'chrome' | 'ios' | 'other'>('chrome');

  useEffect(() => {
    setMounted(true);
    // 1. Already running as the installed app, or installed earlier from this browser
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) {
      markPwaInstalled(app);
      setIsInstalled(true);
      return;
    }
    if (rememberedInstalled(app)) {
      setIsInstalled(true);
      return;
    }

    // 2. Chrome/Edge can tell us directly when the app (listed in the manifest) is installed
    const nav = window.navigator as unknown as { getInstalledRelatedApps?: () => Promise<{ platform: string }[]> };
    if (typeof nav.getInstalledRelatedApps === 'function') {
      nav
        .getInstalledRelatedApps()
        .then((apps) => {
          if (apps.some((a) => a.platform === 'webapp')) {
            markPwaInstalled(app);
            setIsInstalled(true);
          }
        })
        .catch(() => {});
    }

    // 3. Browser detection
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setBrowserType('ios');
    } else if (/chrome|chromium|crios|edg\//.test(userAgent)) {
      setBrowserType('chrome');
    } else {
      setBrowserType('other');
    }

    // 4. Prompt captured before this component mounted
    if (window.__wp_pwa_event) {
      setDeferredPrompt(window.__wp_pwa_event);
    }

    // 5. Chrome only fires this when the app can be installed (i.e. it is NOT installed)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      const pwaEvent = e as BeforeInstallPromptEvent;
      window.__wp_pwa_event = pwaEvent;
      setDeferredPrompt(pwaEvent);
    };

    const handleAppInstalled = () => {
      markPwaInstalled(app);
      setIsInstalled(true);
      setDeferredPrompt(null);
      window.__wp_pwa_event = null;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [app]);

  const handleInstallClick = async () => {
    if (isInstalled) return;

    const activePrompt = deferredPrompt || window.__wp_pwa_event;

    if (activePrompt) {
      try {
        await activePrompt.prompt();
        const choice = await activePrompt.userChoice;
        if (choice.outcome === 'accepted') {
          markPwaInstalled(app);
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
        window.__wp_pwa_event = null;
      } catch (err) {
        console.warn('PWA install prompt error:', err);
        setShowGuideModal(true);
      }
    } else {
      // If event has not yet fired or browser needs manual trigger, show guidance modal
      setShowGuideModal(true);
    }
  };

  if (!mounted || isInstalled) {
    return null;
  }
  // Chrome/Edge: show the button only while the browser offers installation (it stops
  // offering once the app is installed). iPhone/iPad: show the Add-to-Home-Screen guide.
  // Other desktop browsers cannot install apps, so nothing is shown.
  if (browserType === 'other' || (browserType === 'chrome' && !deferredPrompt)) {
    return null;
  }

  return (
    <>
      {variant === 'banner' ? (
        <div
          className={`bg-gradient-to-r from-forest-900 via-forest-850 to-forest-800 text-sand-50 p-3.5 rounded-2xl shadow-md border border-amber-500/30 flex items-center justify-between gap-3 ${className}`}
        >
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-forest-950 flex items-center justify-center shrink-0 shadow-sm">
              <Download className="w-5 h-5 text-forest-950" />
            </div>
            <div className="truncate">
              <p className="text-xs font-bold text-white flex items-center space-x-1">
                <span>Install {appName}</span>
                <Sparkles className="w-3 h-3 text-amber-300" />
              </p>
              <p className="text-[11px] text-sand-300 truncate">
                Fast home-screen access & instant in-room concierge
              </p>
            </div>
          </div>
          <button
            onClick={handleInstallClick}
            className="min-h-[44px] px-4 py-2 bg-amber-400 hover:bg-amber-300 active:scale-95 text-forest-950 text-xs font-black rounded-xl shadow transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{label}</span>
          </button>
        </div>
      ) : (
        <button
          onClick={handleInstallClick}
          aria-label={`Install ${appName} to home screen`}
          className={`min-h-[44px] inline-flex items-center justify-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-extrabold bg-amber-400 hover:bg-amber-300 active:scale-95 text-forest-950 shadow-md transition-all border border-amber-300/40 cursor-pointer ${className}`}
        >
          <Download className="w-4 h-4 text-forest-950" />
          <span>{label}</span>
        </button>
      )}

      {/* Manual Install Guide Modal (For iOS or Chrome manual install) */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-sand-200 text-forest-950 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowGuideModal(false)}
              aria-label="Close install modal"
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-sand-100 text-gray-400 hover:text-gray-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mb-4">
              <Smartphone className="w-6 h-6" />
            </div>

            <h3 className="font-serif font-bold text-lg text-forest-900 mb-1">
              Install {appName}
            </h3>
            <p className="text-xs text-forest-700 mb-4 leading-relaxed">
              Add our boutique mountain homestay app to your home screen for instant in-room concierge, offline access, and fast booking.
            </p>

            {browserType === 'ios' ? (
              /* iOS Safari Guide */
              <div className="space-y-3 bg-sand-50 p-4 rounded-2xl border border-sand-200 text-xs text-forest-800 mb-5">
                <div className="flex items-start space-x-3">
                  <div className="p-1.5 bg-sand-200/80 rounded-lg text-forest-900 shrink-0">
                    <Share className="w-4 h-4 text-forest-800" />
                  </div>
                  <p>1. Tap the <strong>Share</strong> icon in the Safari toolbar.</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="p-1.5 bg-sand-200/80 rounded-lg text-forest-900 shrink-0">
                    <PlusSquare className="w-4 h-4 text-forest-800" />
                  </div>
                  <p>2. Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong>.</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-800 shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  </div>
                  <p>3. Tap <strong>Add</strong> to launch the native fullscreen experience anytime.</p>
                </div>
              </div>
            ) : (
              /* Chrome & Chromium Guide */
              <div className="space-y-3 bg-sand-50 p-4 rounded-2xl border border-sand-200 text-xs text-forest-800 mb-5">
                <div className="flex items-start space-x-3">
                  <div className="p-1.5 bg-sand-200/80 rounded-lg text-forest-900 shrink-0">
                    <Chrome className="w-4 h-4 text-forest-800" />
                  </div>
                  <p>1. Tap the <strong>⋮ three dots menu</strong> at the top right of Chrome.</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="p-1.5 bg-sand-200/80 rounded-lg text-forest-900 shrink-0">
                    <Download className="w-4 h-4 text-forest-800" />
                  </div>
                  <p>2. Select <strong>&quot;Install app&quot;</strong> or <strong>&quot;Install Savera Homestay&quot;</strong>.</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-800 shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  </div>
                  <p>3. Click <strong>Install</strong> to add the official PWA to your device!</p>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowGuideModal(false)}
              className="w-full min-h-[44px] py-2.5 bg-forest-900 text-white hover:bg-forest-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Got it, thanks!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
