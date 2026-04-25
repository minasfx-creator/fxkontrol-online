/**
 * Pricing — Public 3-tier pricing page (Free / Pro / Enterprise).
 *
 * Routes the user to the right Paddle checkout flow based on the selected plan
 * and billing cycle. Paddle prices are the source of truth; the resolver edge
 * function maps `pro_monthly` etc. to the Paddle internal ID at click time, so
 * the same hard-coded human IDs work in sandbox + live.
 *
 * Free tier: routes to /auth (or /editor if logged in) — no checkout.
 * Pro / Enterprise: open Paddle overlay. If unauthenticated, redirect to /auth
 * with ?next=/pricing&plan=<priceId> so we can resume after sign-in.
 */
import { useState, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Check, Sparkles, ArrowRight, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useEntitlements, type Tier } from "@/hooks/useEntitlements";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Cycle = "monthly" | "annual";

interface PlanDef {
  tier: Tier;
  name: string;
  tagline: string;
  monthlyPrice: number; // USD per month, what we show
  annualPrice: number;  // USD per year, what we show
  priceIds: { monthly: string; annual: string } | null; // null = no checkout (Free)
  highlight?: boolean;
  features: string[];
  cta: string;
}

const PLANS: PlanDef[] = [
  {
    tier: "free",
    name: "Free",
    tagline: "Para começar e simular shows visualmente",
    monthlyPrice: 0,
    annualPrice: 0,
    priceIds: null,
    features: [
      "Editor visual 3D com física realista",
      "Shows de qualquer tamanho",
      "Simulação ilimitada (preview)",
      "5 gerações JOI por dia",
      "Sem exportação industrial",
      "Sem conexão com hardware físico",
    ],
    cta: "Começar grátis",
  },
  {
    tier: "pro",
    name: "Pro",
    tagline: "Para profissionais de pirotecnia e drone shows",
    monthlyPrice: 49,
    annualPrice: 490,
    priceIds: { monthly: "pro_monthly", annual: "pro_annual" },
    highlight: true,
    features: [
      "Tudo do Free, mais:",
      "Exportação Finale 3D (CSV)",
      "Exportação FireOne, MAVLink, ILDA, VDL",
      "Exportação VVIZ + SKYC (Skybrush)",
      "JOI AI ilimitado",
      "Conexão hardware (Art-Net, FXK)",
      "Suporte prioritário",
    ],
    cta: "Assinar Pro",
  },
  {
    tier: "enterprise",
    name: "Enterprise",
    tagline: "Operação de campo em larga escala",
    monthlyPrice: 199,
    annualPrice: 1990,
    priceIds: { monthly: "enterprise_monthly", annual: "enterprise_annual" },
    features: [
      "Tudo do Pro, mais:",
      "Hardware completo: DMX/Art-Net/sACN",
      "Showven PBUS dual-band",
      "FireOne FXK-PYRO 2.0",
      "Rádio 433/868 MHz",
      "Suporte 24/7 dedicado",
      "Onboarding personalizado",
    ],
    cta: "Assinar Enterprise",
  },
];

export default function Pricing() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const entitlements = useEntitlements();
  const { openCheckout, loading: checkoutLoading } = usePaddleCheckout();
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [cycle, setCycle] = useState<Cycle>(
    (searchParams.get("cycle") as Cycle) === "annual" ? "annual" : "monthly",
  );

  const handleSelect = async (plan: PlanDef) => {
    // Free tier — straight into the app
    if (plan.tier === "free") {
      navigate(user ? "/" : "/auth");
      return;
    }
    if (!plan.priceIds) return;

    // Require auth before opening checkout — preserves the selection via query string
    if (!user) {
      const priceId = plan.priceIds[cycle];
      navigate(`/auth?next=${encodeURIComponent(`/pricing?plan=${priceId}&cycle=${cycle}`)}`);
      return;
    }

    // Already on this exact plan? bounce to billing instead.
    if (entitlements.tier === plan.tier && entitlements.isPaid) {
      toast.info(`Você já está no plano ${plan.name}. Gerencie em Configurações → Cobrança.`);
      navigate("/settings");
      return;
    }

    setPendingPlan(plan.tier);
    try {
      await openCheckout({
        priceId: plan.priceIds[cycle],
        userId: user.id,
        customerEmail: user.email ?? undefined,
        successUrl: `${window.location.origin}/checkout/success`,
      });
    } catch (e) {
      toast.error(
        `Não foi possível abrir o checkout: ${e instanceof Error ? e.message : "erro desconhecido"}`,
      );
    } finally {
      setPendingPlan(null);
    }
  };

  // If we landed here with ?plan=<priceId>, auto-resolve the plan and prefill cycle
  const autoSelectPlan = useMemo(() => {
    const planParam = searchParams.get("plan");
    if (!planParam) return null;
    return PLANS.find((p) =>
      p.priceIds && (p.priceIds.monthly === planParam || p.priceIds.annual === planParam),
    );
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Preços — FX KONTROL</title>
        <meta
          name="description"
          content="Planos FX KONTROL: Free, Pro e Enterprise. Exportação Finale 3D, drone shows, hardware completo e JOI AI ilimitado."
        />
        <link rel="canonical" href="https://www.fxkontrol.online/pricing" />
      </Helmet>

      <PaymentTestModeBanner />

      {/* Header */}
      <header className="border-b border-border/40">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-foreground">
            <Sparkles className="h-5 w-5 text-primary" />
            FX KONTROL
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            {user ? (
              <Button variant="outline" size="sm" asChild>
                <Link to="/">Voltar ao app</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/auth">Entrar</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/auth">Criar conta</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-12 md:py-20">
        {/* Hero */}
        <div className="text-center mb-10 md:mb-14">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground mb-3">
            Planos FX KONTROL
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            Comece grátis. Faça upgrade quando precisar exportar, conectar hardware ou
            escalar a operação.
          </p>
          {autoSelectPlan && (
            <p className="mt-3 text-xs text-primary">
              Continue selecionando o plano <strong>{autoSelectPlan.name}</strong> abaixo.
            </p>
          )}
        </div>

        {/* Cycle toggle */}
        <div className="flex justify-center mb-10">
          <div
            className="inline-flex rounded-full border border-border/50 p-1"
            style={{ background: "hsl(var(--muted) / 0.3)" }}
          >
            <button
              type="button"
              onClick={() => setCycle("monthly")}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                cycle === "monthly"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setCycle("annual")}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5",
                cycle === "annual"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Anual
              <span className="text-[10px] font-semibold text-primary">−17%</span>
            </button>
          </div>
        </div>

        {/* Plan grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLANS.map((plan) => {
            const isCurrent = entitlements.tier === plan.tier && (plan.tier === "free" || entitlements.isPaid);
            const isLoading = pendingPlan === plan.tier && checkoutLoading;
            const price = cycle === "monthly" ? plan.monthlyPrice : plan.annualPrice;
            const perLabel = cycle === "monthly" ? "/mês" : "/ano";

            return (
              <div
                key={plan.tier}
                className={cn(
                  "relative rounded-2xl border p-6 flex flex-col",
                  plan.highlight
                    ? "border-primary/50 shadow-lg"
                    : "border-border/50",
                )}
                style={
                  plan.highlight
                    ? { background: "hsl(var(--card))", boxShadow: "0 0 40px hsl(var(--primary) / 0.08)" }
                    : { background: "hsl(var(--card))" }
                }
              >
                {plan.highlight && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1"
                    style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                  >
                    <Star className="h-3 w-3" /> Mais escolhido
                  </div>
                )}

                <h2 className="text-xl font-bold text-foreground">{plan.name}</h2>
                <p className="text-xs text-muted-foreground mt-1 mb-5 min-h-[2.5em]">{plan.tagline}</p>

                <div className="mb-5">
                  {plan.monthlyPrice === 0 ? (
                    <div className="text-3xl font-bold text-foreground">Grátis</div>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-foreground">${price}</span>
                      <span className="text-sm text-muted-foreground">{perLabel}</span>
                    </div>
                  )}
                  {plan.monthlyPrice > 0 && cycle === "annual" && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Equivale a ${(plan.annualPrice / 12).toFixed(0)}/mês
                    </p>
                  )}
                </div>

                <Button
                  size="lg"
                  variant={plan.highlight ? "default" : "outline"}
                  className="w-full mb-6"
                  disabled={isCurrent || isLoading}
                  onClick={() => handleSelect(plan)}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isCurrent ? (
                    "Plano atual"
                  ) : (
                    <>
                      {plan.cta} <ArrowRight className="h-4 w-4 ml-1.5" />
                    </>
                  )}
                </Button>

                <ul className="space-y-2.5 text-sm flex-1">
                  {plan.features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span
                        className={
                          feat.includes("Sem ")
                            ? "text-muted-foreground/60 line-through"
                            : "text-muted-foreground"
                        }
                      >
                        {feat}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Trust footer */}
        <div className="mt-16 text-center text-xs text-muted-foreground space-y-2">
          <p>
            Pagamentos processados com segurança por Paddle (Merchant of Record).
            IVA / impostos calculados automaticamente.
          </p>
          <p>
            <Link to="/legal/refund" className="underline hover:text-foreground">Política de Reembolso</Link>
            {" · "}
            <Link to="/legal/terms" className="underline hover:text-foreground">Termos</Link>
            {" · "}
            <Link to="/legal/privacy" className="underline hover:text-foreground">Privacidade</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
