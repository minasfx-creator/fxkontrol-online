/**
 * Google Geo Intelligence Hub
 * Centralized service for Geocoding, TimeZone, Elevation, and Static Maps.
 * All calls go through edge function to keep API key server-side.
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
  // errors
  geocodeError?: string;
  timeZoneError?: string;
  elevationError?: string;
}

/**
 * Fetch all geo intelligence in a single call (geocode + timezone + elevation + static map).
 */
export async function fetchGeoIntelligence(lat: number, lng: number, timestamp?: number): Promise<GeoIntelligenceResult> {
  try {
    const { data, error } = await supabase.functions.invoke('google-geo-intelligence', {
      body: { action: 'all', lat, lng, timestamp },
    });
    if (error) {
      console.warn('[GeoIntel] Edge function error:', error);
      return {};
    }
    return data as GeoIntelligenceResult;
  } catch (e) {
    console.warn('[GeoIntel] Fetch failed:', e);
    return {};
  }
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
