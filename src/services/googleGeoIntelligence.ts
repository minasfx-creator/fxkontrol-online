/**
 * Google Geo Intelligence Hub
 * Centralized service for Geocoding, TimeZone, Elevation, and Static Maps.
 * All calls go through edge function to keep API key server-side.
 * 
 * Features:
 * - In-memory cache with 5-minute TTL (~11m precision)
 * - Inflight request deduplication (same coords → same Promise)
 */
import { supabase } from '@/integrations/supabase/client';

export interface GeoIntelligenceResult {
  locationName?: string | null;
  locationShortName?: string | null;
  timeZoneId?: string;
  timeZoneName?: string;
  rawOffset?: number;
  dstOffset?: number;
  totalOffset?: number;
  elevation?: number;
  resolution?: number;
  staticMapUrl?: string;
  geocodeError?: string;
  timeZoneError?: string;
  elevationError?: string;
}

// ═══ Cache Layer ═══
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  data: GeoIntelligenceResult;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<GeoIntelligenceResult>>();

/** Round coords to ~11m precision for cache key */
function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

function getCached(key: string): GeoIntelligenceResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: GeoIntelligenceResult): void {
  cache.set(key, { data, timestamp: Date.now() });
  // Evict old entries if cache grows too large
  if (cache.size > 200) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now - v.timestamp > CACHE_TTL_MS) cache.delete(k);
    }
  }
}

/**
 * Fetch all geo intelligence in a single call (geocode + timezone + elevation + static map).
 * Uses cache + inflight deduplication to minimize API costs.
 */
export async function fetchGeoIntelligence(lat: number, lng: number, timestamp?: number): Promise<GeoIntelligenceResult> {
  const key = cacheKey(lat, lng);

  // 1. Check cache
  const cached = getCached(key);
  if (cached) return cached;

  // 2. Deduplicate inflight requests
  const existing = inflight.get(key);
  if (existing) return existing;

  // 3. Make the actual request
  const promise = (async (): Promise<GeoIntelligenceResult> => {
    try {
      const { data, error } = await supabase.functions.invoke('google-geo-intelligence', {
        body: { action: 'all', lat, lng, timestamp },
      });
      if (error) {
        console.warn('[GeoIntel] Edge function error:', error);
        return {};
      }
      const result = data as GeoIntelligenceResult;
      setCache(key, result);
      return result;
    } catch (e) {
      console.warn('[GeoIntel] Fetch failed:', e);
      return {};
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

/**
 * Reverse geocode only.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const result = await fetchGeoIntelligence(lat, lng);
  return result.locationShortName || result.locationName || null;
}

/**
 * Get timezone offset in seconds.
 */
export async function getTimeZoneOffset(lat: number, lng: number, timestamp?: number): Promise<number | null> {
  const result = await fetchGeoIntelligence(lat, lng, timestamp);
  return result.totalOffset ?? null;
}

/**
 * Get terrain elevation in meters.
 */
export async function getElevation(lat: number, lng: number): Promise<number | null> {
  const result = await fetchGeoIntelligence(lat, lng);
  return result.elevation ?? null;
}

/**
 * Build a static map URL (returned from edge function, no client-side key needed).
 */
export async function getStaticMapUrl(lat: number, lng: number): Promise<string | null> {
  const result = await fetchGeoIntelligence(lat, lng);
  return result.staticMapUrl ?? null;
}
