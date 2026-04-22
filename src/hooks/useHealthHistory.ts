/**
 * useHealthHistory — Fetches recent health_snapshots for sparkline trend.
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface HealthHistory {
  scores: number[];
  loading: boolean;
}

export function useHealthHistory(limit = 60): HealthHistory {
  const { user } = useAuth();
  const [scores, setScores] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setScores([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetch = async () => {
      try {
        const { data } = await supabase
          .from('health_snapshots' as any)
          .select('global_score')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (!cancelled && data) {
          // Reverse so oldest first for sparkline
          setScores((data as any[]).map(r => r.global_score).reverse());
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetch();
    const interval = setInterval(fetch, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user, limit]);

  return { scores, loading };
}
