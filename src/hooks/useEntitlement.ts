import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// Supabase generated types lag behind new tables (entitlements, subscription_features, plg_events).
// We narrow runtime data manually; cast `from()` calls until types regenerate.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type PlanKey = "free" | "pro" | "enterprise";
export type Features = Record<string, boolean>;
export type Limits = Record<string, number>;

interface EntitlementState {
  loading: boolean;
  plan: PlanKey;
  features: Features;
  limits: Limits;
}

const DEFAULTS: EntitlementState = {
  loading: true,
  plan: "free",
  features: {},
  limits: {},
};

/**
 * Client-side helper to read the user's effective plan.
 * THIS IS UX-ONLY. The server (RLS + edge function `request-export`) is the authority.
 *
 *   const ent = useEntitlement();
 *   ent.has("fir_export")        -> boolean
 *   ent.within("drones_sim", 80) -> boolean
 *   ent.plan                     -> "free" | "pro" | "enterprise"
 */
export function useEntitlement() {
  const [state, setState] = useState<EntitlementState>(DEFAULTS);

  const refetch = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setState({ ...DEFAULTS, loading: false });
      return;
    }
    const [planRow, catalog] = await Promise.all([
      supabase
        .from("subscription_features")
        .select("plan_key, expires_at")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("entitlements")
        .select("plan_key, features, limits"),
    ]);
    const plan = (planRow.data?.plan_key as PlanKey | undefined) ?? "free";
    const row = catalog.data?.find((r) => r.plan_key === plan);
    setState({
      loading: false,
      plan,
      features: (row?.features ?? {}) as Features,
      limits: (row?.limits ?? {}) as Limits,
    });
  }, []);

  useEffect(() => {
    refetch();
    const { data: sub } = supabase.auth.onAuthStateChange(() => refetch());
    return () => sub.subscription.unsubscribe();
  }, [refetch]);

  const has = useCallback(
    (feature: string) => state.features[feature] === true,
    [state.features],
  );
  const within = useCallback(
    (limit: string, value: number) => {
      const cap = state.limits[limit];
      if (cap === undefined) return true;
      if (cap === -1) return true;
      return value <= cap;
    },
    [state.limits],
  );

  return { ...state, has, within, refetch, upgradeUrl: "/pricing" };
}

/** Fire-and-forget paywall telemetry. */
export async function trackPlgEvent(
  event_type: string,
  feature?: string,
  metadata?: Record<string, unknown>,
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("plg_events").insert({
      user_id: user.id,
      event_type,
      feature: feature ?? null,
      metadata: (metadata ?? {}) as never,
    });
  } catch (_) { /* noop */ }
}
