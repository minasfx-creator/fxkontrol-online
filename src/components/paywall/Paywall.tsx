import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Lock, ArrowUpRight } from "lucide-react";
import { useEntitlement, trackPlgEvent } from "@/hooks/useEntitlement";
import { Button } from "@/components/ui/button";

interface PaywallProps {
  feature: string;
  /** Human label for the gated capability (used in the upsell card). */
  label?: string;
  /** Optional one-liner shown under the label. */
  reason?: string;
  /** When true, render a compact inline pill instead of a full card. */
  compact?: boolean;
  children: ReactNode;
}

/**
 * Wrap any premium UI element. If the user's plan does not include `feature`,
 * the child is replaced by an upsell card (or a compact lock pill).
 *
 *   <Paywall feature="fir_export" label="Exportar .FIR (FireOne)">
 *     <Button onClick={doExportFir}>Exportar .FIR</Button>
 *   </Paywall>
 *
 * Authority lives server-side (RLS + request-export edge function). This is UX only.
 */
export function Paywall({ feature, label, reason, compact, children }: PaywallProps) {
  const ent = useEntitlement();

  useEffect(() => {
    if (!ent.loading && !ent.has(feature)) {
      trackPlgEvent("paywall.shown", feature, { plan: ent.plan });
    }
  }, [ent.loading, ent.plan, feature, ent]);

  if (ent.loading || ent.has(feature)) return <>{children}</>;

  if (compact) {
    return (
      <Link
        to="/pricing"
        onClick={() => trackPlgEvent("paywall.clicked", feature, { plan: ent.plan })}
        className="ds-interactive inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        aria-label={`${label ?? feature} requer plano superior`}
      >
        <Lock className="h-3 w-3" />
        <span className="ds-mono uppercase tracking-wider">PRO</span>
      </Link>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-background p-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground">
            {label ?? "Recurso premium"}
          </div>
          {reason ? (
            <div className="mt-0.5 text-xs text-muted-foreground">{reason}</div>
          ) : (
            <div className="mt-0.5 text-xs text-muted-foreground">
              Disponível nos planos Pro e Enterprise.
            </div>
          )}
        </div>
        <Button asChild size="sm" variant="secondary">
          <Link
            to="/pricing"
            onClick={() => trackPlgEvent("paywall.clicked", feature, { plan: ent.plan })}
          >
            Upgrade
            <ArrowUpRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * Chip exibido na GlobalSafetyBar. Mostra o plano efetivo do usuário.
 */
export function PlanStatusChip() {
  const ent = useEntitlement();
  if (ent.loading) return null;
  const tone =
    ent.plan === "enterprise" ? "ds-status-ok"
    : ent.plan === "pro" ? "ds-status-sync"
    : "ds-status-warn";
  return (
    <Link
      to="/pricing"
      title={`Plano atual: ${ent.plan}`}
      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${tone}`}
      onClick={() => trackPlgEvent("plan_chip.clicked", undefined, { plan: ent.plan })}
    >
      <span>{ent.plan}</span>
    </Link>
  );
}
