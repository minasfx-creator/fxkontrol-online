/**
 * Wrapper for the `get-maps-key` edge function. The function requires a
 * valid Supabase user JWT (defense-in-depth so the Google Maps key never
 * leaks to anonymous callers). On dev/smoke routes (e.g. /dev/skycanvas-smoke)
 * the visitor is usually anonymous, which would otherwise surface as a
 * confusing 401 + blank screen.
 *
 * This helper:
 *  - Short-circuits with `{ key: null, reason: 'unauthenticated' }` when
 *    there is no session, instead of triggering a 401 in the network log.
 *  - Normalises edge-function errors so callers only need to check `.key`.
 */
import { supabase } from '@/integrations/supabase/client';

export interface MapsKeyResult {
  key: string | null;
  reason?: 'unauthenticated' | 'edge-error' | 'no-key';
  error?: string;
}

export async function fetchGoogleMapsKey(): Promise<MapsKeyResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session?.access_token) {
    return { key: null, reason: 'unauthenticated' };
  }
  try {
    const { data, error } = await supabase.functions.invoke('get-maps-key');
    if (error) return { key: null, reason: 'edge-error', error: error.message };
    const key = (data as { key?: string } | null)?.key ?? null;
    if (!key) return { key: null, reason: 'no-key' };
    return { key };
  } catch (e) {
    return { key: null, reason: 'edge-error', error: (e as Error).message };
  }
}
