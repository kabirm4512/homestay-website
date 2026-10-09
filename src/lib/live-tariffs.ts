'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RoomSeasonalTariffs, SeasonalDateRange } from '@/types/crm';
import { sanitizeSeasonalRanges, sanitizeTariffsMap } from '@/lib/tariff-calculator';
import { DEFAULT_GST_CONFIG, GstConfig, sanitizeGstConfig } from '@/lib/gst';

export interface AddonRates {
  airportTransfer: number;
  bikeRentalPerNight: number;
}

/**
 * The ONE client-side fetch of live pricing data (GET /api/tariffs).
 * Every guest-facing price and the CRM use this, and nothing falls back to seed data:
 * while loading or on failure, callers show "price on request" instead of a number.
 */

export interface LiveTariffData {
  tariffs: Record<string, RoomSeasonalTariffs>;
  seasonalDateRanges: SeasonalDateRange[];
  gstConfig: GstConfig;
  addonRates: AddonRates | null;
  /** Server change token (see GET /api/tariffs?only=version). */
  version: string | null;
  fetchedAt: number;
}

export type LiveTariffStatus = 'loading' | 'ready' | 'error';

export interface LiveTariffState {
  status: LiveTariffStatus;
  tariffs: Record<string, RoomSeasonalTariffs> | null;
  seasonalDateRanges: SeasonalDateRange[] | null;
  gstConfig: GstConfig;
  addonRates: AddonRates | null;
  error: string | null;
  reload: () => Promise<void>;
}

// Re-fetch when the cached copy is older than this (e.g. a modal opened later in the visit).
const MAX_AGE_MS = 60 * 1000;

let cached: LiveTariffData | null = null;
let inFlight: Promise<LiveTariffData> | null = null;
const listeners = new Set<(data: LiveTariffData) => void>();

/** Parses the /api/tariffs JSON body into validated pricing data (throws when unusable). */
export function parseTariffResponse(json: unknown): Omit<LiveTariffData, 'fetchedAt'> {
  const body = json as {
    success?: boolean;
    data?: { tariffs?: unknown; seasonalDateRanges?: unknown; gstConfig?: unknown; addonRates?: AddonRates; version?: unknown };
    error?: string;
  };
  if (!body || body.success !== true || !body.data) {
    throw new Error(body?.error || 'Live tariffs unavailable');
  }
  if (!Array.isArray(body.data.seasonalDateRanges)) {
    throw new Error('Live seasonal calendar unavailable');
  }
  const rates = body.data.addonRates;
  return {
    tariffs: sanitizeTariffsMap(body.data.tariffs),
    seasonalDateRanges: sanitizeSeasonalRanges(body.data.seasonalDateRanges),
    gstConfig: sanitizeGstConfig(body.data.gstConfig),
    addonRates:
      rates && typeof rates.airportTransfer === 'number' && typeof rates.bikeRentalPerNight === 'number'
        ? { airportTransfer: rates.airportTransfer, bikeRentalPerNight: rates.bikeRentalPerNight }
        : null,
    version: typeof body.data.version === 'string' ? body.data.version : null,
  };
}

/** Fetches live tariffs once per page (deduplicated), bypassing every cache layer. */
export async function fetchLiveTariffs(force = false): Promise<LiveTariffData> {
  if (!force && cached && Date.now() - cached.fetchedAt < MAX_AGE_MS) return cached;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      // Up to 3 quick attempts: a slow or failed first answer is retried instead of
      // leaving guests on "price on request".
      let json: unknown = null;
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch('/api/tariffs', { cache: 'no-store', signal: AbortSignal.timeout(attempt === 0 ? 8000 : 12000) });
          const body = await res.json().catch(() => null);
          if (!res.ok) throw new Error((body as { error?: string } | null)?.error || `Live tariffs request failed (${res.status})`);
          json = body;
          break;
        } catch (err) {
          lastError = err;
          if (attempt < 2) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        }
      }
      if (!json) throw lastError instanceof Error ? lastError : new Error('Live tariffs unavailable');
      const data: LiveTariffData = { ...parseTariffResponse(json), fetchedAt: Date.now() };
      cached = data;
      listeners.forEach((fn) => fn(data));
      return data;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/** Pushes freshly saved data (e.g. from an admin save) to every mounted consumer, in every tab. */
export function publishLiveTariffs(data: Omit<LiveTariffData, 'fetchedAt'>): void {
  cached = { ...data, fetchedAt: Date.now() };
  listeners.forEach((fn) => fn(cached!));
  try {
    channel()?.postMessage({ type: 'tariffs-changed', version: data.version });
  } catch {}
}

/** Subscribes to every live update (returns an unsubscribe function). */
export function subscribeLiveTariffs(fn: (data: LiveTariffData) => void): () => void {
  listeners.add(fn);
  startLiveSync();
  return () => {
    listeners.delete(fn);
  };
}

// ----------------------------------------------------------------------------------------
// Live sync: every open page checks a tiny change token every few seconds (and at once when
// the tab becomes visible, regains focus or comes back online). Only when the token changes
// is the full pricing data fetched again. Admin saves are also broadcast to other tabs of
// the same browser instantly. The API is never cached (no-store), so a saved price is live
// for every visitor within POLL_MS.
// ----------------------------------------------------------------------------------------
const POLL_MS = 8_000;
let syncStarted = false;
let checking = false;
let bc: BroadcastChannel | null | undefined;

function channel(): BroadcastChannel | null {
  if (bc !== undefined) return bc;
  try {
    bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('savera-live-tariffs') : null;
  } catch {
    bc = null;
  }
  return bc;
}

/** Fetches the change token and refetches the full data when it differs from what we have. */
export async function checkForTariffUpdate(): Promise<void> {
  if (checking || typeof window === 'undefined') return;
  checking = true;
  try {
    if (!cached) {
      await fetchLiveTariffs(true);
      return;
    }
    const res = await fetch('/api/tariffs?only=version', { cache: 'no-store', signal: AbortSignal.timeout(6000) });
    const body = (await res.json().catch(() => null)) as { success?: boolean; version?: string } | null;
    if (res.ok && body?.success && typeof body.version === 'string' && body.version !== cached.version) {
      await fetchLiveTariffs(true);
    }
  } catch {
    // offline or slow: the next tick tries again
  } finally {
    checking = false;
  }
}

function startLiveSync() {
  if (syncStarted || typeof window === 'undefined') return;
  syncStarted = true;
  const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible';
  setInterval(() => {
    if (visible()) void checkForTariffUpdate();
  }, POLL_MS);
  document.addEventListener('visibilitychange', () => {
    if (visible()) void checkForTariffUpdate();
  });
  window.addEventListener('focus', () => void checkForTariffUpdate());
  window.addEventListener('online', () => void checkForTariffUpdate());
  const ch = channel();
  if (ch) {
    ch.onmessage = (e: MessageEvent) => {
      const v = (e.data as { version?: string | null } | null)?.version;
      if (!cached || !v || v !== cached.version) void fetchLiveTariffs(true).catch(() => {});
    };
  }
}

/** React hook: live tariffs + seasonal ranges with an explicit loading/error status. */
export function useLiveTariffs(): LiveTariffState {
  const [data, setData] = useState<LiveTariffData | null>(cached);
  const [status, setStatus] = useState<LiveTariffStatus>(cached ? 'ready' : 'loading');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force: boolean) => {
    try {
      const fresh = await fetchLiveTariffs(force);
      setData(fresh);
      setStatus('ready');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Live tariffs unavailable');
      setStatus((prev) => (prev === 'ready' ? 'ready' : 'error'));
    }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeLiveTariffs((fresh: LiveTariffData) => {
      setData(fresh);
      setStatus('ready');
      setError(null);
    });
    load(false);
    // A failed first load is retried automatically (the live sync handles later changes)
    const retry = setInterval(() => {
      if (!cached) load(true);
    }, 10_000);
    return () => {
      unsubscribe();
      clearInterval(retry);
    };
  }, [load]);

  const reload = useCallback(() => load(true), [load]);

  return {
    status,
    tariffs: data?.tariffs ?? null,
    seasonalDateRanges: data?.seasonalDateRanges ?? null,
    gstConfig: data?.gstConfig ?? DEFAULT_GST_CONFIG,
    addonRates: data?.addonRates ?? null,
    error,
    reload,
  };
}

// Warm the cache as early as possible on page load (the rooms section reads it when it mounts)
if (typeof window !== 'undefined') {
  fetchLiveTariffs().catch(() => {});
  startLiveSync();
}
