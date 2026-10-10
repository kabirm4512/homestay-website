'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Install support for the site's installable apps (the guest app at "/" and the
 * Expense Logger at "/expenses"). Chrome/Edge on Android and desktop fire
 * `beforeinstallprompt` once a page in the app's scope is installable; we keep that
 * event so a button can open the browser's own install dialog in one tap.
 * iPhone/iPad have no install API: the person adds the app from Safari's Share menu.
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __wp_pwa_event?: BeforeInstallPromptEvent | null;
  }
}

export type InstallPlatform = 'android' | 'ios' | 'desktop';

const listeners = new Set<() => void>();

// Capture the event as early as this module loads, before any component mounts.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.__wp_pwa_event = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    window.__wp_pwa_event = null;
    listeners.forEach((l) => l());
  });
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function detectPlatform(): InstallPlatform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent.toLowerCase();
  const iPadOS = navigator.platform === 'MacIntel' && (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints! > 1;
  if (/iphone|ipad|ipod/.test(ua) || iPadOS) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

/** True on iPhone/iPad when the page is open in a browser other than Safari (they cannot add to Home Screen on older iOS). */
export function isIosNonSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /crios|fxios|edgios|opios/.test(navigator.userAgent.toLowerCase());
}

function rememberKey(app: string) {
  return `wp_pwa_installed_${app}`;
}
export function rememberInstalled(app: string) {
  try {
    localStorage.setItem(rememberKey(app), '1');
  } catch {}
}
function wasInstalled(app: string) {
  try {
    return localStorage.getItem(rememberKey(app)) === '1';
  } catch {
    return false;
  }
}

export function useInstallPrompt(app: string) {
  const [ready, setReady] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>('desktop');
  const [standalone, setStandalone] = useState(false);
  const [remembered, setRemembered] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    const sa = isStandalone();
    setStandalone(sa);
    if (sa) rememberInstalled(app);
    setRemembered(sa || wasInstalled(app));
    const sync = () => setCanPrompt(Boolean(window.__wp_pwa_event));
    sync();
    listeners.add(sync);
    const onInstalled = () => {
      rememberInstalled(app);
      setRemembered(true);
    };
    window.addEventListener('appinstalled', onInstalled);
    // Chrome can report that this app is already installed on the device.
    const nav = navigator as unknown as { getInstalledRelatedApps?: () => Promise<{ platform: string }[]> };
    nav.getInstalledRelatedApps?.()
      .then((apps) => {
        if (apps.some((a) => a.platform === 'webapp')) onInstalled();
      })
      .catch(() => {});
    setReady(true);
    return () => {
      listeners.delete(sync);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [app]);

  /** Opens the browser's install dialog. Resolves to true when the person accepted. */
  const install = useCallback(async (): Promise<boolean> => {
    const ev = window.__wp_pwa_event;
    if (!ev) return false;
    try {
      await ev.prompt();
      const choice = await ev.userChoice;
      window.__wp_pwa_event = null;
      setCanPrompt(false);
      if (choice.outcome === 'accepted') {
        rememberInstalled(app);
        setRemembered(true);
        return true;
      }
    } catch {}
    return false;
  }, [app]);

  // Chrome only offers installation while the app is NOT installed, so an offer wins over
  // a remembered "installed" (the app may have been removed since).
  const installed = standalone || (remembered && !canPrompt);
  return { ready, platform, standalone, installed, canPrompt, install };
}
