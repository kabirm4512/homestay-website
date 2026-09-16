'use client';

import React, { useState, useEffect } from 'react';
import { Smartphone, Download, CheckCircle2, Share, PlusSquare, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
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
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if running as installed standalone PWA
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isInstalled) {
      alert('Whispering Pines App is already installed on your device!');
      return;
    }

    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.warn('Install prompt error:', err);
      }
    } else if (isIOS) {
      setShowIOSModal(true);
    } else {
      // Fallback modal or prompt
      setShowIOSModal(true);
    }
  };

  if (isInstalled) {
    return (
      <div className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-emerald-950/60 text-emerald-300 text-xs font-semibold border border-emerald-800/60 ${className}`}>
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        <span>PWA Installed</span>
      </div>
    );
  }

  return (
    <>
      {variant === 'banner' ? (
        <div className={`bg-gradient-to-r from-forest-900 to-forest-800 text-sand-50 p-3 rounded-2xl shadow-md border border-forest-700/50 flex items-center justify-between gap-3 ${className}`}>
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-forest-700 flex items-center justify-center shrink-0 border border-forest-600">
              <Smartphone className="w-5 h-5 text-amber-300" />
            </div>
            <div className="truncate">
              <p className="text-xs font-bold text-white leading-tight">Install Staff & Guest App</p>
              <p className="text-[11px] text-sand-300 truncate">Offline access, instant alerts & native feel</p>
            </div>
          </div>
          <button
            onClick={handleInstallClick}
            className="min-h-[44px] px-4 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-forest-950 text-xs font-bold rounded-xl shadow transition-all flex items-center space-x-1.5 shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Install App</span>
          </button>
        </div>
      ) : (
        <button
          onClick={handleInstallClick}
          aria-label="Install Whispering Pines App to home screen"
          className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 text-forest-950 hover:bg-amber-400 active:scale-95 shadow-md hover:shadow-lg transition-all border border-amber-300/40 ${className}`}
        >
          <Download className="w-4 h-4 text-forest-950" />
          <span className="hidden sm:inline">Install App</span>
        </button>
      )}

      {/* iOS & Manual Install Modal Guide */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-sand-200 text-forest-950 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowIOSModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-sand-100 text-gray-400 hover:text-gray-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mb-4">
              <Smartphone className="w-6 h-6" />
            </div>

            <h3 className="font-serif font-bold text-lg text-forest-900 mb-1">
              Install to Home Screen
            </h3>
            <p className="text-xs text-forest-700 mb-4">
              Get fast offline access and native fullscreen experience on your device.
            </p>

            <div className="space-y-3 bg-sand-50 p-4 rounded-2xl border border-sand-200 text-xs text-forest-800 mb-5">
              <div className="flex items-start space-x-3">
                <div className="p-1.5 bg-sand-200/80 rounded-lg text-forest-900 shrink-0">
                  <Share className="w-4 h-4 text-forest-800" />
                </div>
                <p>1. Tap the <strong>Share</strong> button in your mobile browser toolbar.</p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="p-1.5 bg-sand-200/80 rounded-lg text-forest-900 shrink-0">
                  <PlusSquare className="w-4 h-4 text-forest-800" />
                </div>
                <p>2. Scroll down and select <strong>&quot;Add to Home Screen&quot;</strong>.</p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-800 shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                </div>
                <p>3. Tap <strong>Add</strong> to launch it like a native mountain app anytime.</p>
              </div>
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full min-h-[44px] py-2.5 bg-forest-900 text-white hover:bg-forest-800 rounded-xl text-xs font-bold transition-colors"
            >
              Got it, thanks!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
