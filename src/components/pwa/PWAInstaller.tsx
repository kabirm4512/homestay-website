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

export default function PWAInstaller({
  variant = 'button',
  className = '',
}: {
  variant?: 'button' | 'badge' | 'banner';
  className?: string;
}) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [browserType, setBrowserType] = useState<'chrome' | 'ios' | 'other'>('chrome');

  useEffect(() => {
    // 1. Check if already running in standalone PWA mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // 2. Browser detection
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setBrowserType('ios');
    } else if (/chrome|chromium|crios/.test(userAgent)) {
      setBrowserType('chrome');
    } else {
      setBrowserType('other');
    }

    // 3. Check for globally cached prompt
    if (window.__wp_pwa_event) {
      setDeferredPrompt(window.__wp_pwa_event);
    }

    // 4. Intercept Chrome beforeinstallprompt event
    const handleBeforeInstall = (e: Event) => {
      // Suppress default ambient infobar so we show our prominent Install button
      e.preventDefault();
      const pwaEvent = e as BeforeInstallPromptEvent;
      window.__wp_pwa_event = pwaEvent;
      setDeferredPrompt(pwaEvent);
    };

    const handleAppInstalled = () => {
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
  }, []);

  const handleInstallClick = async () => {
    if (isInstalled) {
      alert('Savera Homestay App is already installed on your device!');
      return;
    }

    const activePrompt = deferredPrompt || window.__wp_pwa_event;

    if (activePrompt) {
      try {
        await activePrompt.prompt();
        const choice = await activePrompt.userChoice;
        if (choice.outcome === 'accepted') {
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

  if (isInstalled) {
    return (
      <div
        className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/70 text-emerald-300 text-xs font-semibold border border-emerald-800/60 shadow-xs ${className}`}
        title="Savera Homestay App is installed on this device"
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        <span>App Installed</span>
      </div>
    );
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
                <span>Install Savera Homestay App</span>
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
            <span>Install App</span>
          </button>
        </div>
      ) : (
        <button
          onClick={handleInstallClick}
          aria-label="Install Savera Homestay App to home screen"
          className={`min-h-[44px] inline-flex items-center justify-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-extrabold bg-amber-400 hover:bg-amber-300 active:scale-95 text-forest-950 shadow-md transition-all border border-amber-300/40 cursor-pointer ${className}`}
        >
          <Download className="w-4 h-4 text-forest-950" />
          <span>Install App</span>
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
              Install Savera Homestay App
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
