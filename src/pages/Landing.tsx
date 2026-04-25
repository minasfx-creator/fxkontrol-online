/**
 * Landing — Página pública de marketing do FX KONTROL.
 *
 * Página React completa (não-iframe) alinhada ao design system tático do app:
 *   Hero → Recursos → Demo (preview do editor 3D) → Preço → CTA final
 *
 * Tokens semânticos (hsl) de index.css/tailwind.config.ts — sem cores hardcoded.
 * SEO/OG/Twitter/canonical setados via upsert no <head> ao montar.
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Sparkles,
  Rocket,
  Radio,
  Shield,
  Layers,
  Zap,
  ArrowRight,
  Check,
  Plane,
  Flame,
  Activity,
  Globe2,
} from "lucide-react";
import { LANDING_SITE, buildLandingSeo } from "@/config/landing";

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  const prev = el.getAttribute("content");
  el.setAttribute("content", content);
  return { el, prev, created: prev === null };
}
function upsertLink(rel: string, href: string, extra?: Record<string, string>) {
  const selector = extra?.as
    ? `link[rel="${rel}"][href="${href}"]`
    : `link[rel="${rel}"]`;
  let el = document.head.querySelector<HTMLLinkElement>(selector);
  const created = !el;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  const prev = el.getAttribute("href");
  el.setAttribute("href", href);
  if (extra) for (const [k, v] of Object.entries(extra)) el.setAttribute(k, v);
  return { el, prev, created };
}

const FEATURES = [
  {
    icon: Layers,
    title: "Editor 3D em tempo real",
    desc: "Coreografias, balística, terreno Google 3D Tiles, vento e física industrial — tudo em uma única timeline canônica.",
  },
  {
    icon: Plane,
    title: "Drones swarm + pirotecnia",
    desc: "VVIZ streaming para 2000+ drones e PBUS/FireOne/Showven nativos. SIMULAÇÃO = EXECUÇÃO = REALIDADE.",
  },
  {
    icon: Radio,
    title: "DMX, ArtNet e sACN",
    desc: "Art-Net 4/5, ArtPoll/ArtSync, sACN priorizado e Wireless DMX 2.4GHz prontos pro palco.",
  },
  {
    icon: Shield,
    title: "Safety crítico < 50ms",
    desc: "E-STOP com latência garantida, SafetyStateMachine, NFPA deconfliction e black-box auditável.",
  },
  {
    icon: Sparkles,
    title: "JOI — IA copiloto",
    desc: "Architect, Analyst, Verifier: 8 modos técnicos para gerar, auditar e otimizar o show com você.",
  },
  {
    icon: Activity,
    title: "Live Read-Only honesto",
    desc: "Telemetria passiva de hardware real sem comandos espúrios. Provenance LIVE / SIMULATED / REPLAY explícito.",
  },
] as const;

const PRICING = [
  {
    name: "Studio",
    price: "R$ 0",
    period: "/sempre",
    desc: "Para conhecer a ferramenta e desenhar shows pessoais.",
    features: [
      "Editor 3D completo",
      "Até 200 cues + 50 drones",
      "Exportação VDL / FXK",
      "Comunidade e tutoriais",
    ],
    cta: { label: "Começar grátis", to: "/auth" },
    variant: "outline" as const,
    highlight: false,
  },
  {
    name: "Pro",
    price: "R$ 349",
    period: "/mês",
    desc: "Para operadores e estúdios profissionais.",
    features: [
      "Cues ilimitadas + 2000 drones",
      "DMX/ArtNet/sACN nativos",
      "JOI Copiloto + Studio Mode",
      "Suporte prioritário 24/7",
      "Migração assistida do Finale 3D",
    ],
    cta: { label: "Assinar Pro", to: "/pricing" },
    variant: "default" as const,
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    desc: "Multi-equipe, on-prem e integrações sob medida.",
    features: [
      "Cluster + Auto-Recovery",
      "Hardware dedicado / on-prem",
      "SAML SSO + auditoria",
      "SLA contratual",
    ],
    cta: { label: "Falar com vendas", to: "/pricing" },
    variant: "outline" as const,
    highlight: false,
  },
] as const;

export default function Landing() {
  useEffect(() => {
    // Todo o SEO da landing é derivado de LANDING_SITE em src/config/landing.ts.
    // Edite aquele arquivo para mudar provedor / canonical / OG.
    const seo = buildLandingSeo(LANDING_SITE);

    const prevTitle = document.title;
    const prevHtmlLang = document.documentElement.lang;
    document.title = seo.title;
    document.documentElement.lang = seo.htmlLang;

    const restorers: Array<() => void> = [];

    for (const m of seo.metas) {
      const { el, prev, created } = upsertMeta(m.attr, m.key, m.content);
      restorers.push(() => {
        if (created) el.remove();
        else if (prev !== null) el.setAttribute("content", prev);
      });
    }
    for (const l of seo.links) {
      const { el, prev, created } = upsertLink(l.rel, l.href, l.extra);
      restorers.push(() => {
        if (created) el.remove();
        else if (prev !== null) el.setAttribute("href", prev);
      });
    }

    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.id = "ld-landing";
    ld.text = JSON.stringify(seo.jsonLd);
    document.head.appendChild(ld);
    restorers.push(() => ld.remove());

    return () => {
      document.title = prevTitle;
      document.documentElement.lang = prevHtmlLang;
      restorers.forEach((r) => r());
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-background text-foreground antialiased">
      {/* Skip-to-content for keyboard / screen-reader users */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[300] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-primary-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
      >
        Pular para o conteúdo
      </a>

      {/* ── NAV ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6 md:px-8">
          <Link
            to="/landing"
            aria-label="FX KONTROL — Página inicial"
            className="flex flex-shrink-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <div
              aria-hidden="true"
              className="h-6 w-6 rounded-lg bg-gradient-to-br from-primary to-[hsl(var(--electric-glow))] shadow-[0_0_24px_hsl(var(--primary)/0.4)] sm:h-7 sm:w-7"
            />
            <span className="text-xs font-black tracking-[0.18em] sm:text-sm">
              FX <span className="text-primary">KONTROL</span>
            </span>
          </Link>
          <nav aria-label="Principal" className="hidden items-center gap-6 text-sm text-muted-foreground lg:flex xl:gap-7">
            <a href="#features" className="rounded transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background">Recursos</a>
            <a href="#demo" className="rounded transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background">Demo</a>
            <a href="#pricing" className="rounded transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background">Preço</a>
            <Link to="/pricing" className="rounded transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background">Planos</Link>
          </nav>
          <div className="flex flex-shrink-0 items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/auth">Entrar</Link>
            </Button>
            <Button asChild size="sm" className="rounded-full px-3 text-xs sm:px-4 sm:text-sm">
              <Link to="/studio" aria-label="Abrir o editor 3D Studio">
                <span className="hidden sm:inline">Abrir Studio</span>
                <span className="inline sm:hidden">Studio</span>
                <ArrowRight aria-hidden="true" className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="main">

      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Aurora background */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/2 h-[400px] w-[100vw] max-w-[1200px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.25),transparent_60%)] blur-3xl sm:h-[600px]" />
          <div className="absolute -bottom-40 right-0 h-[350px] w-[100vw] max-w-[800px] rounded-full bg-[radial-gradient(circle_at_center,hsl(var(--fxk-cyan)/0.18),transparent_60%)] blur-3xl sm:h-[500px]" />
          <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--foreground)/0.03)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--foreground)/0.03)_1px,transparent_1px)] [background-size:40px_40px] sm:[background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-20 sm:px-6 sm:pb-24 sm:pt-28 md:px-8 md:pb-32 md:pt-36">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur sm:mb-6 sm:text-xs sm:tracking-[0.2em]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[hsl(var(--success))]" />
              Plataforma viva — v5 Reliability
            </div>
            <h1 className="font-display text-[2.25rem] font-black leading-[1.05] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              O novo padrão para shows{" "}
              <span className="bg-gradient-to-r from-primary via-[hsl(var(--electric-glow))] to-[hsl(var(--fxk-gold))] bg-clip-text text-transparent">
                pirotécnicos & SFX
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:mt-6 sm:text-base md:text-lg">
              Desenhe, simule e dispare shows com pirotecnia, drones, lasers, DMX e ArtNet — em uma só plataforma.
              Mesma fidelidade do Finale 3D, com automação moderna e segurança crítica.
            </p>
            <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:mt-9 sm:flex-row sm:items-center">
              <Button asChild size="lg" className="h-12 rounded-full px-6 text-sm font-bold shadow-[0_10px_40px_hsl(var(--primary)/0.3)] sm:px-7">
                <Link to="/studio">
                  <Rocket aria-hidden="true" className="mr-2 h-4 w-4" />
                  Abrir editor 3D
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 rounded-full border-border/60 bg-card/40 px-6 text-sm font-semibold backdrop-blur sm:px-7">
                <Link to="/pricing">Ver planos</Link>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70 sm:mt-10 sm:gap-x-8 sm:gap-y-3 sm:text-xs sm:tracking-[0.18em]">
              <span>Showven™ PBUS</span>
              <span>FireOne FXK-PYRO</span>
              <span>Art-Net 4/5</span>
              <span>VVIZ Drones</span>
              <span>SMPTE LTC</span>
            </div>
          </div>

          {/* Hero "screenshot" — gradient mockup of the 3D editor */}
          <div className="relative mx-auto mt-10 max-w-6xl sm:mt-16">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-primary/30 via-[hsl(var(--fxk-cyan)/0.2)] to-[hsl(var(--fxk-violet)/0.25)] opacity-40 blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-[hsl(var(--surface-1))] shadow-[0_50px_120px_-20px_hsl(220_30%_1%/0.9)]">
              <div className="flex h-9 items-center gap-2 border-b border-border/50 bg-[hsl(var(--surface-2))] px-4">
                <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--destructive))]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--warning))]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--success))]" />
                <span className="ml-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  fxkontrol.online / studio
                </span>
              </div>
              <div role="img" aria-label="Pré-visualização do editor 3D do FX KONTROL com timeline, HUD ARMED e bursts pirotécnicos" className="relative aspect-[16/9] w-full bg-gradient-to-br from-[hsl(var(--surface-0))] via-[hsl(220_30%_4%)] to-[hsl(var(--surface-1))]">
                {/* Synthetic 3D scene */}
                <div className="absolute inset-0">
                  <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-[hsl(var(--surface-0))] to-transparent" />
                  {/* burst flares */}
                  <div className="absolute left-[20%] top-[35%] h-40 w-40 rounded-full bg-[radial-gradient(circle,hsl(var(--fxk-gold)/0.9),transparent_60%)] blur-md" />
                  <div className="absolute left-[55%] top-[25%] h-56 w-56 rounded-full bg-[radial-gradient(circle,hsl(var(--primary)/0.85),transparent_60%)] blur-md" />
                  <div className="absolute right-[15%] top-[40%] h-32 w-32 rounded-full bg-[radial-gradient(circle,hsl(var(--fxk-cyan)/0.8),transparent_60%)] blur-md" />
                  <div className="absolute left-[40%] top-[55%] h-24 w-24 rounded-full bg-[radial-gradient(circle,hsl(var(--fxk-magenta)/0.7),transparent_60%)] blur-md" />
                  {/* drone grid */}
                  <div className="absolute bottom-[18%] left-1/2 h-1 w-[70%] -translate-x-1/2 rounded-full bg-[hsl(var(--fxk-cyan)/0.4)] shadow-[0_0_20px_hsl(var(--fxk-cyan)/0.6)]" />
                </div>
                {/* HUD */}
                <div className="absolute left-4 top-4 rounded-md border border-border/50 bg-card/70 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground backdrop-blur">
                  ARMED · 32 cues · T-00:14
                </div>
                <div className="absolute right-4 top-4 flex gap-1.5">
                  <span className="rounded-md border border-[hsl(var(--success)/0.4)] bg-[hsl(var(--success)/0.1)] px-2 py-1 text-[10px] font-mono text-[hsl(var(--success))]">
                    LINK OK
                  </span>
                  <span className="rounded-md border border-border/50 bg-card/70 px-2 py-1 text-[10px] font-mono text-muted-foreground">
                    SMPTE
                  </span>
                </div>
                <div className="absolute bottom-3 left-4 right-4 h-8 rounded-md border border-border/50 bg-card/70 backdrop-blur">
                  <div className="flex h-full items-center gap-1 px-2">
                    {Array.from({ length: 24 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-3 flex-1 rounded-sm"
                        style={{
                          background: `hsl(var(--primary) / ${0.15 + (i % 5) * 0.15})`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ───────────────────────────────────────────────────── */}
      <section id="features" aria-labelledby="features-heading" className="relative border-t border-border/40 bg-[hsl(var(--surface-1))] py-16 sm:py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-primary">Recursos</p>
            <h2 id="features-heading" className="text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">
              Mesmo core do Finale. <br />
              <span className="text-muted-foreground">Mais moderno. Mais acessível.</span>
            </h2>
          </div>

          <div className="mt-10 sm:mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card
                key={f.title}
                className="group relative overflow-hidden border-border/50 bg-[hsl(var(--surface-2))] p-6 transition hover:border-primary/40 hover:bg-[hsl(var(--surface-3))]"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-transparent to-primary/0 opacity-0 transition group-hover:opacity-100 group-hover:from-primary/5 group-hover:to-[hsl(var(--fxk-cyan)/0.05)]" />
                <div className="relative">
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEMO ───────────────────────────────────────────────────────── */}
      <section id="demo" aria-labelledby="demo-heading" className="relative border-t border-border/40 py-16 sm:py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
          <div className="grid items-center gap-10 sm:gap-12 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-primary">Demo</p>
              <h2 id="demo-heading" className="text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">
                O editor 3D que <span className="text-primary">dispara o show de verdade</span>.
              </h2>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">
                Coreografe drones, pirotecnia e lasers em uma timeline canônica (ShowPlan), valide com simulação física e
                envie pra hardware real via PBUS, ArtNet ou FireOne — sem retrabalho, sem export quebrado.
              </p>

              <ul className="mt-8 space-y-3">
                {[
                  "Google 3D Tiles — encene em qualquer cidade do mundo",
                  "Studio Mode 11-camadas: blackbody, bloom ACES, halation",
                  "GPGPU WebGPU + fallback WebGL2 — 30k partículas a 60fps",
                  "Black-box 100ms para auditoria pós-show",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm">
                    <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                      <Check aria-hidden="true" className="h-3 w-3" strokeWidth={3} />
                    </div>
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-10 flex gap-3">
                <Button asChild size="lg" className="rounded-full">
                  <Link to="/studio">
                    <Sparkles aria-hidden="true" className="mr-2 h-4 w-4" />
                    Testar agora
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="rounded-full border-border/60">
                  <Link to="/swarmgpt">Ver JOI</Link>
                </Button>
              </div>
            </div>

            {/* Right column: feature stack */}
            <div className="relative">
              <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-primary/20 via-transparent to-[hsl(var(--fxk-cyan)/0.15)] opacity-50 blur-2xl" />
              <div className="relative grid gap-3">
                <Card className="border-border/50 bg-[hsl(var(--surface-2))] p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--fxk-cyan)/0.15)] text-[hsl(var(--fxk-cyan))]">
                      <Globe2 aria-hidden="true" className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Terreno real
                      </div>
                      <div className="text-sm font-semibold">Google 3D Tiles · Geoid sync</div>
                    </div>
                    <span className="rounded-md border border-[hsl(var(--success)/0.4)] bg-[hsl(var(--success)/0.1)] px-2 py-0.5 text-[10px] font-mono text-[hsl(var(--success))]">
                      LIVE
                    </span>
                  </div>
                </Card>
                <Card className="border-border/50 bg-[hsl(var(--surface-2))] p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <Flame aria-hidden="true" className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Balística Piroex/Skyking
                      </div>
                      <div className="text-sm font-semibold">Fuse, prefire, ascensão calibrados</div>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">±0.04s</span>
                  </div>
                </Card>
                <Card className="border-border/50 bg-[hsl(var(--surface-2))] p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--fxk-violet)/0.2)] text-[hsl(var(--fxk-violet))]">
                      <Zap aria-hidden="true" className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        E-STOP
                      </div>
                      <div className="text-sm font-semibold">SafetyStateMachine &lt; 50ms</div>
                    </div>
                    <span className="rounded-md bg-[hsl(var(--destructive)/0.15)] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--destructive))]">
                      ARMED
                    </span>
                  </div>
                </Card>
                <Card className="border-border/50 bg-[hsl(var(--surface-2))] p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--fxk-cyan)/0.15)] text-[hsl(var(--fxk-cyan))]">
                      <Plane aria-hidden="true" className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Swarm
                      </div>
                      <div className="text-sm font-semibold">2000 drones · VVIZ streaming</div>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">60 fps</span>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ────────────────────────────────────────────────────── */}
      <section id="pricing" aria-labelledby="pricing-heading" className="relative border-t border-border/40 bg-[hsl(var(--surface-1))] py-16 sm:py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-primary">Preço</p>
            <h2 id="pricing-heading" className="text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">
              Preço de ataque por mercado.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base text-muted-foreground">
              Saia do Finale 3D sem dor de cabeça. Mesmo workflow, custo menor, automação superior.
            </p>
          </div>

          <div className="mt-10 sm:mt-16 grid gap-5 md:grid-cols-3">
            {PRICING.map((plan) => (
              <Card
                key={plan.name}
                className={`relative flex flex-col p-7 transition ${
                  plan.highlight
                    ? "border-primary/60 bg-[hsl(var(--surface-3))] shadow-[0_20px_60px_-15px_hsl(var(--primary)/0.3)]"
                    : "border-border/50 bg-[hsl(var(--surface-2))]"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-primary to-[hsl(var(--electric-glow))] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-lg">
                    Mais escolhido
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-black tracking-tight">{plan.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.desc}</p>
                  <div className="mt-5 flex items-baseline gap-1">
                    <span className="text-4xl font-black tracking-tight">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  </div>
                </div>
                <ul className="mt-7 flex-1 space-y-2.5">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5 text-sm">
                      <Check aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" strokeWidth={3} />
                      <span className="text-muted-foreground">{feat}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild variant={plan.variant} size="lg" className="mt-8 w-full rounded-full">
                  <Link to={plan.cta.to}>{plan.cta.label}</Link>
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-border/40 py-20 sm:py-28 md:py-36">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[400px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,hsl(var(--primary)/0.25),transparent_70%)] blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 md:px-8">
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl md:text-6xl">
            Construa o próximo show <br />
            <span className="bg-gradient-to-r from-primary via-[hsl(var(--electric-glow))] to-[hsl(var(--fxk-gold))] bg-clip-text text-transparent">
              antes do concorrente.
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground">
            Abra o editor 3D agora — sem instalação, sem cartão. Em 60 segundos você dispara o primeiro burst.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 rounded-full px-8 text-sm font-bold shadow-[0_10px_40px_hsl(var(--primary)/0.35)]">
              <Link to="/studio">
                <Rocket aria-hidden="true" className="mr-2 h-4 w-4" />
                Abrir editor 3D
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 rounded-full border-border/60 px-8 text-sm font-semibold">
              <Link to="/auth">Criar conta</Link>
            </Button>
          </div>
        </div>
      </section>

      </main>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-border/40 bg-[hsl(var(--surface-1))] py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-xs text-muted-foreground sm:px-6 md:flex-row md:px-8">
          <div className="flex items-center gap-2">
            <div aria-hidden="true" className="h-5 w-5 rounded-md bg-gradient-to-br from-primary to-[hsl(var(--electric-glow))]" />
            <span className="font-bold tracking-[0.18em] text-foreground/80">FX KONTROL</span>
            <span>© {new Date().getFullYear()} Minas FX</span>
          </div>
          <nav aria-label="Rodapé" className="flex items-center gap-5">
            <Link to="/legal/terms" className="transition hover:text-foreground">Termos</Link>
            <Link to="/legal/privacy" className="transition hover:text-foreground">Privacidade</Link>
            <Link to="/legal/refund" className="transition hover:text-foreground">Reembolso</Link>
            <Link to="/pricing" className="transition hover:text-foreground">Planos</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
