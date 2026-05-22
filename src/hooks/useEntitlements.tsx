/**
 * useEntitlements — Single source of truth for what the current user is allowed to do.
 *
 * Tiers:
 *   • free       — no active subscription row
 *   • pro        — product_id starts with "pro_"  (e.g. pro_plan / pro_launch_plan)
 *   • enterprise — product_id starts with "enterprise"
 *
 * Capabilities (hard gates per the product plan):
 *   • canExport           — Finale CSV, FireOne, VVIZ, MAVLink, ILDA, all firing-system exports
 *   • canConnectHardware  — physical pairing / live firing transports
 *   • joiUnlimited        — bypasses free-tier daily JOI quota
 *
 * Free-tier JOI quota is enforced at the call site (see lib/joiQuota.ts).
 *
 * SECURITY: This hook is for UX only. Sensitive operations (webhook-driven
 * subscription state) are written by service role and read with RLS.
 */
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { promptUpgrade } from '@/lib/upgradePrompt';

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;
export const PADDLE_ENV: 'sandbox' | 'live' = clientToken?.startsWith('test_') ? 'sandbox' : 'live';

export type Tier = 'free' | 'pro' | 'enterprise';

export interface Entitlements {
  tier: Tier;
  isPaid: boolean;
  canExport: boolean;
  canConnectHardware: boolean;
  joiUnlimited: boolean;
  loading: boolean;
  checkExport: () => boolean;
  checkHardware: () => boolean;
  checkJoi: () => boolean;
}

const FREE: Entitlements = {
  tier: 'free',
  isPaid: false,
  canExport: false,
  canConnectHardware: false,
  joiUnlimited: false,
  loading: true,
  checkExport: () => false,
  checkHardware: () => false,
  checkJoi: () => false,
};

function tierFromProductId(productId: string | null | undefined): Tier {
  if (!productId) return 'free';
  const id = productId.toLowerCase();
  if (id.startsWith('enterprise')) return 'enterprise';
  if (id.startsWith('pro')) return 'pro';
  return 'free';
}

function entitlementsForTier(tier: Tier, loading = false): Omit<Entitlements, 'checkExport' | 'checkHardware' | 'checkJoi'> {
  if (tier === 'free') return { ...FREE, loading };
  // Pro and Enterprise both unlock the hard-gated features.
  return {
    tier,
    isPaid: true,
    canExport: true,
    canConnectHardware: true,
    joiUnlimited: true,
    loading,
  };
}

export function useEntitlements(): Entitlements {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<Omit<Entitlements, 'checkExport' | 'checkHardware' | 'checkJoi'>>({ ...FREE, loading: true });

  const fetchEntitlements = useCallback(async () => {
    if (!user) {
      setState({ ...FREE, loading: false });
      return;
    }
    const { data } = await (supabase as any)
      .from('subscriptions')
      .select('product_id, status, current_period_end')
      .eq('user_id', user.id)
      .eq('environment', PADDLE_ENV)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const row = data as { product_id: string; status: string; current_period_end: string | null } | null;

    // Mirrors has_active_subscription logic: active/trialing/past_due grant access,
    // canceled grants access until current_period_end.
    const periodEnd = row?.current_period_end ? new Date(row.current_period_end).getTime() : null;
    const inGrace = periodEnd === null || periodEnd > Date.now();
    const grants =
      !!row &&
      ((['active', 'trialing', 'past_due'].includes(row.status) && inGrace) ||
        (row.status === 'canceled' && periodEnd !== null && periodEnd > Date.now()));

    const tier = grants ? tierFromProductId(row.product_id) : 'free';
    setState(entitlementsForTier(tier, false));
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    fetchEntitlements();
  }, [authLoading, fetchEntitlements]);

  // Realtime — keep entitlements in sync when webhooks land.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`entitlements-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subscriptions', filter: `user_id=eq.${user.id}` },
        () => fetchEntitlements(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchEntitlements]);

  const checkExport = () => {
    if (state.canExport) return true;
    promptUpgrade({ reason: 'export' });
    return false;
  };

  const checkHardware = () => {
    if (state.canConnectHardware) return true;
    promptUpgrade({ reason: 'hardware' });
    return false;
  };

  const checkJoi = () => {
    if (state.joiUnlimited) return true;
    promptUpgrade({ reason: 'joi-unlimited' });
    return false;
  };

  return {
    ...state,
    checkExport,
    checkHardware,
    checkJoi,
  };
}
