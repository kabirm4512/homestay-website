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
    data?: { tariffs?: unknown; seasonalDateRanges?: unknown; gstConfig?: unknown; addonRates?: AddonRates };
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

/** Pushes freshly saved data (e.g. from an admin save) to every mounted consumer. */
export function publishLiveTariffs(data: Omit<LiveTariffData, 'fetchedAt'>): void {
  cached = { ...data, fetchedAt: Date.now() };
  listeners.forEach((fn) => fn(cached!));
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
    const listener = (fresh: LiveTariffData) => {
      setData(fresh);
      setStatus('ready');
      setError(null);
    };
    listeners.add(listener);
    load(false);
    // Pick up price changes when the guest comes back to the tab (cached copy older than a minute)
    const onVisible = () => {
      if (document.visibilityState === 'visible') load(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    // A failed load is retried automatically every 20 s
    const retry = setInterval(() => {
      if (!cached || Date.now() - cached.fetchedAt > MAX_AGE_MS * 5) load(true);
    }, 20_000);
    return () => {
      listeners.delete(listener);
      document.removeEventListener('visibilitychange', onVisible);
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
}
