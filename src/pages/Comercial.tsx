/**
 * Comercial — Deck-de-vendas vivo do FX KONTROL.
 *
 * Posicionamento: "Codificar imaginação; garantir precisão."
 * ICP: produtoras premium de eventos / show design; operador técnico = usuário diário.
 *
 * Esta página existe SEPARADA de /landing e /pricing porque:
 *   • /landing → conversão pública genérica (Free/Pro/Enterprise via Paddle).
 *   • /pricing → checkout overlay Paddle.
 *   • /comercial → narrativa B2B premium para vendas guiadas a produtoras
 *     (Previs / LiveOps / Enterprise) com fluxo vendável + GO/NO-GO + roadmap 90d.
 *
 * Paleta: usa data-theme="commercial" — tokens isolados em commercial-tokens.css
 * que aplicam o brief #121214/#00FFFF/#FF7700 SEM contaminar o app operacional
 * (que mantém Vantablack + cyan-dessat por OLED/WCAG/semântica).
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  Radio,
  Plane,
  Flame,
  Shield,
  Eye,
  ClipboardCheck,
  FileSignature,
  RotateCcw,
  Calendar,
  Cpu,
  Layers,
  Activity,
  Mail,
  MapPin,
  Github,
  Linkedin,
  Globe,
  Zap,
  Lock,
  Gauge,
  Users,
  ChevronDown,
} from "lucide-react";

/* ─── SEO helpers (idênticos ao Landing.tsx para coerência) ─────────────── */
function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/* ─── Conteúdo (alinhado ao brief comercial 90d) ────────────────────────── */
const PROMISES = [
  { icon: Layers,   text: "Controle técnico unificado: DMX, Art-Net, drones, pirotecnia e previs 3D." },
  { icon: Shield,   text: "Segurança operacional: simulação, validação, ESTOP, logs e rollback." },
  { icon: Cpu,      text: "Experiência premium em dark mode, densa, técnica, inspirada em conectores XLR." },
];

const PACKAGES = [
  {
    id: "previs",
    name: "Previs",
    tagline: "Aprovação remota com previs 3D fotorrealista",
    price: "Sob consulta",
    icon: Eye,
    features: [
      "Editor 3D com física realista (combustão, Newton cooling, blackbody)",
      "Pixel Streaming (Unreal) para apresentação ao cliente sem instalar nada",
      "Render de demo cinematográfica para aprovação remota",
      "Importação de Finale 3D, VVIZ, MAVLink",
      "Sem hardware real — ideal para fase de design e venda",
    ],
    cta: "Agendar demo Previs",
    highlight: false,
  },
  {
    id: "liveops",
    name: "LiveOps",
    tagline: "Hardware real, iPhone readiness e runbook GO/NO-GO",
    price: "Sob consulta",
    icon: Activity,
    features: [
      "Conexão real: USB Serial, BLE, Art-Net, FXK16, FireOne, Showven",
      "Go-Live Center com checklist GO/NO-GO formal antes do evento",
      "iPhone Safari + iOS Capacitor: pareamento USB/BLE assistido",
      "ESTOP global <50ms + lockout visual + black box 100ms",
      "Runbook de rollback com responsáveis e validação pós-reversão",
      "Logs de transporte (timestamp, erro, latência ACK, armado, sessão)",
    ],
    cta: "Solicitar piloto LiveOps",
    highlight: true, // pacote destaque (brief)
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "Compliance, multiusuário e integrações customizadas",
    price: "Contrato anual",
    icon: Shield,
    features: [
      "Auditoria completa de safety + compliance NFPA/ABNT",
      "SLA dedicado, suporte on-call e on-site",
      "Multiusuário com papéis (Engenharia / Operação / Cliente)",
      "Integrações customizadas (DMX nodes proprietários, drones swarm)",
      "Treinamento técnico + certificação operacional",
      "White-label opcional para grandes produtoras",
    ],
    cta: "Falar com vendas",
    highlight: false,
  },
];

const FLOW = [
  { n: "01", title: "Criar ou importar show",          desc: "Editor 3D do zero, ou import Finale 3D / VVIZ / MAVLink." },
  { n: "02", title: "Previs 3D fotorrealista",         desc: "Pixel Streaming Unreal — cliente aprova sem instalar." },
  { n: "03", title: "Go-Live Center",                  desc: "Checklist técnico, evidências, signoffs Eng/Ops." },
  { n: "04", title: "Anexar evidências",               desc: "Prints, logs, vídeos curtos, assinaturas digitais." },
  { n: "05", title: "Decisão GO/NO-GO",                desc: "Cálculo automático com bloqueadores e mitigações." },
  { n: "06", title: "Relatório exportável",            desc: "PDF/JSON para Engenharia, Operação e Cliente." },
];

const NOGO_RULES = [
  "Qualquer bloqueador não passou.",
  "Bloqueador aprovado sem evidência obrigatória.",
  "Rollback não foi validado.",
  "Engenharia ou Operação ainda não assinaram.",
  "Existe bug crítico aberto.",
  "Item crítico falhou e ainda exige mitigação.",
];

const GO_RULES = [
  "Bloqueadores aprovados.",
  "Evidências presentes em todos os itens críticos.",
  "Rollback validado em bancada.",
  "Signoffs Engenharia + Operação completos.",
  "Sem risco crítico aberto.",
];

const ROADMAP = [
  {
    range: "Dias 1–15",
    title: "Fundação",
    items: [
      "Checklist do PDF convertido em dados do app.",
      "Tela Go-Live Center ativa.",
      "Compatibilidade Desktop Chrome / Android Chrome / iPhone Safari / iOS Capacitor.",
      "Mensagens iPhone para transportes indisponíveis.",
      "Narrativa comercial e pacotes SaaS documentados.",
    ],
  },
  {
    range: "Dias 16–35",
    title: "Demo Vendável",
    items: [
      "Demo guiada de 15 minutos.",
      "Unreal/Pixel Streaming para aprovação remota.",
      "Script comercial: problema, integração, segurança, ROI, prova técnica.",
      "Relatório pós-demo com setup, alertas, status e evidências.",
    ],
  },
  {
    range: "Dias 36–60",
    title: "Operação Real Controlada",
    items: [
      "Bancada com 10 ciclos de conecta/desconecta.",
      "Heartbeat por 5 minutos sem perda.",
      "ACK de comando em dummy load.",
      "ESTOP com lockout visual imediato.",
      "Logs completos + Runbook de rollback.",
    ],
  },
  {
    range: "Dias 61–90",
    title: "Piloto Comercial",
    items: [
      "Piloto controlado com produtora premium.",
      "GO/NO-GO formal antes do evento.",
      "Evidências, vídeos, métricas e depoimento técnico.",
      "Case final + pricing inicial + onboarding padrão.",
    ],
  },
];

const HARDWARE_BADGES = [
  { icon: Radio, label: "DMX / Art-Net" },
  { icon: Plane, label: "Drones / MAVLink" },
  { icon: Flame, label: "Pirotecnia / FireOne" },
  { icon: Cpu,   label: "FXK16 / Showven" },
];

/* Provas técnicas — métricas verificáveis (alinhadas à memória de safety/perf) */
const PROOFS = [
  { icon: Zap,   metric: "<50ms",  label: "Latência ESTOP global", desc: "Hot path com Hold-to-Confirm e lockout visual imediato." },
  { icon: Lock,  metric: "100ms",  label: "Black box de auditoria", desc: "Snapshot de comando, transporte, ACK e estado físico." },
  { icon: Gauge, metric: "33 PPS", label: "DMX / Art-Net broadcast", desc: "Budget presets safe / standard / aggressive." },
  { icon: Users, metric: "3 papéis", label: "Engenharia · Operação · Cliente", desc: "Signoffs separados, evidências por papel." },
];

/* Stack de confiança — diferenciais técnicos defensáveis */
const STACK = [
  { title: "WebGPU + WebGL2 fallback",   desc: "Render GPGPU com seleção automática; nunca quebra em hardware antigo." },
  { title: "Multi-transport agregado",   desc: "Web Serial + USB + BLE + Art-Net no mesmo dispositivo, com auto-fallback." },
  { title: "Honest Hardware Layer",      desc: "Adapters honestos: NO_HARDWARE é estado válido, não fingimos conexão." },
  { title: "Real-Only Mode",             desc: "Telemetria só conta com handshake verificado — sem dado sintético." },
  { title: "iPhone-aware",               desc: "Pareamento USB/BLE assistido em Safari + Capacitor com fallback dual-device." },
  { title: "Zero-GC timeline",           desc: "ECS/DOD com SoA, busca binária e batch eval para shows densos." },
];

/* FAQ comercial — objeções recorrentes mapeadas */
const FAQ = [
  {
    q: "Substitui Finale 3D, FireOne ou Showven?",
    a: "Não. FX KONTROL orquestra esses sistemas. Importamos VVIZ, MAVLink, layouts FireOne e protocolo PBUS Showven — você mantém o ecossistema atual e ganha previs, GO/NO-GO e auditoria.",
  },
  {
    q: "Funciona offline / em campo sem internet?",
    a: "Sim. O editor, simulação e operação rodam localmente. Sincronização de evidências e relatórios é assíncrona quando a conexão volta.",
  },
  {
    q: "Como vocês garantem que o ESTOP é realmente <50ms?",
    a: "O caminho UI → uiCommandGateway → CommandBus → SafetyStateMachine → FieldBus é instrumentado. Medimos cada ciclo, exportamos no black box e validamos em bancada antes de cada piloto.",
  },
  {
    q: "Posso usar só para previs sem comprar o LiveOps?",
    a: "Sim — esse é exatamente o pacote Previs. Aprovação remota com Pixel Streaming, sem hardware real, sem compromisso operacional.",
  },
  {
    q: "Quem opera o sistema no evento? Vocês ou minha equipe?",
    a: "Sua equipe. Treinamos seus operadores e ficamos disponíveis on-call (Enterprise inclui on-site no piloto). O sistema foi desenhado para o operador técnico ser o usuário diário.",
  },
  {
    q: "Como vocês cobram?",
    a: "Previs e LiveOps por evento ou assinatura mensal. Enterprise é contrato anual com SLA. Pricing final depende de escopo — agendamos uma call de 15min para dimensionar.",
  },
];

/* ─── Página ────────────────────────────────────────────────────────────── */
export default function Comercial() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    document.title = "FX KONTROL — Codificar imaginação; garantir precisão";
    upsertMeta("name", "description",
      "Sistema operacional técnico para eventos ao vivo. Previs 3D, hardware real, GO/NO-GO formal e compliance para produtoras premium.");
    upsertMeta("property", "og:title", "FX KONTROL — Sistema operacional para eventos ao vivo");
    upsertMeta("property", "og:description",
      "Codificar imaginação; garantir precisão. DMX, drones, pirotecnia, previs 3D, ESTOP <50ms.");
  }, []);

  return (
    <div data-theme="commercial" className="c-surface min-h-[100dvh]">
      {/* ── Topbar ──────────────────────────────────────────────────────── */}
      <header className="border-b border-[hsl(var(--c-border-soft))] sticky top-0 z-40 backdrop-blur-md bg-[hsl(var(--c-bg)/0.85)]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/comercial" className="flex items-center gap-2 c-display text-lg font-bold tracking-wider">
            <span className="c-cyan-pure">FX</span>
            <span className="c-text">KONTROL</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-xs c-text-muted uppercase tracking-widest">
            <a href="#pacotes" className="hover:c-text transition-colors">Pacotes</a>
            <a href="#fluxo" className="hover:c-text transition-colors">Fluxo</a>
            <a href="#go-no-go" className="hover:c-text transition-colors">GO/NO-GO</a>
            <a href="#roadmap" className="hover:c-text transition-colors">Roadmap</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/auth" className="text-xs c-text-muted hover:c-text uppercase tracking-widest">Entrar</Link>
            <a href="#pacotes" className="c-cta-primary text-xs px-4 py-2 rounded">Solicitar demo</a>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative c-grid-bg overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 py-24 md:py-32 relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[hsl(var(--c-cyan)/0.3)] bg-[hsl(var(--c-cyan-glow))] text-[10px] c-mono c-cyan uppercase tracking-widest mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--c-cyan))] animate-pulse" />
            Sistema operacional técnico para eventos ao vivo
          </div>
          <h1 className="c-display c-fs-h1 font-bold mb-6 max-w-5xl">
            <span className="c-text">Codificar imaginação;</span><br/>
            <span className="c-cyan">garantir precisão.</span>
          </h1>
          <p className="c-text-muted c-fs-lead max-w-2xl mb-10">
            FX KONTROL é o cockpit técnico para produtoras premium operarem DMX, Art-Net, drones e pirotecnia
            com previs 3D, validação automática e decisão GO/NO-GO auditável.
          </p>
          <div className="flex flex-wrap gap-4 mb-12">
            <a href="#pacotes" className="c-cta-primary px-6 py-3 rounded text-sm inline-flex items-center gap-2">
              Solicitar demo guiada <ArrowRight className="w-4 h-4" />
            </a>
            <Link to="/studio" className="c-cta-secondary px-6 py-3 rounded text-sm inline-flex items-center gap-2">
              Abrir Studio
            </Link>
          </div>

          {/* Hardware badges */}
          <div className="flex flex-wrap gap-3 pt-8 border-t border-[hsl(var(--c-border-soft))]">
            {HARDWARE_BADGES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 px-3 py-1.5 rounded c-card-overlay text-xs c-text-muted c-mono uppercase tracking-wider">
                <Icon className="w-3.5 h-3.5 c-cyan" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Promessas Fixas ─────────────────────────────────────────────── */}
      <section className="border-y border-[hsl(var(--c-border-soft))] bg-[hsl(var(--c-bg-elevated))]">
        <div className="max-w-7xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-8">
          {PROMISES.map(({ icon: Icon, text }, i) => (
            <div key={i} className="flex gap-4">
              <div className="w-10 h-10 rounded flex items-center justify-center bg-[hsl(var(--c-cyan-glow))] border border-[hsl(var(--c-cyan)/0.3)] shrink-0">
                <Icon className="w-5 h-5 c-cyan" />
              </div>
              <p className="c-text leading-relaxed text-sm">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pacotes ─────────────────────────────────────────────────────── */}
      <section id="pacotes" className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <div className="text-[10px] c-mono c-amber uppercase tracking-widest mb-4">Pacotes SaaS</div>
          <h2 className="c-display c-fs-h2 font-bold mb-4 c-text">Três modos de operar.</h2>
          <p className="c-text-muted max-w-2xl mx-auto">Do design até o piloto comercial, com compliance e auditoria a cada passo.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {PACKAGES.map((pkg) => {
            const Icon = pkg.icon;
            return (
              <div
                key={pkg.id}
                className={`c-card rounded-lg p-8 flex flex-col relative ${pkg.highlight ? 'c-highlight-ring' : ''}`}
              >
                {pkg.highlight && (
                  <div className="absolute -top-3 left-8 px-3 py-1 rounded-full text-[10px] c-mono uppercase tracking-widest font-bold"
                       style={{ background: 'hsl(var(--c-amber))', color: 'hsl(240 10% 5%)' }}>
                    Mais vendido
                  </div>
                )}
                <Icon className={`w-8 h-8 mb-4 ${pkg.highlight ? 'c-amber' : 'c-cyan'}`} />
                <h3 className="c-display text-2xl font-bold c-text mb-1">FXKONTROL {pkg.name}</h3>
                <p className="c-text-muted text-sm mb-6">{pkg.tagline}</p>
                <div className="c-mono text-xs c-text-subtle uppercase tracking-widest mb-6">{pkg.price}</div>
                <ul className="space-y-3 mb-8 flex-1">
                  {pkg.features.map((f, i) => (
                    <li key={i} className="flex gap-2 text-sm c-text-muted leading-snug">
                      <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${pkg.highlight ? 'c-amber' : 'c-cyan'}`} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="mailto:vendas@fxkontrol.online?subject=Demo%20FX%20KONTROL%20"
                  className={pkg.highlight ? 'c-cta-secondary' : 'c-cta-primary'}
                  style={{ padding: '12px 16px', borderRadius: 6, textAlign: 'center', fontSize: 13 }}
                >
                  {pkg.cta}
                </a>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Fluxo Vendável ──────────────────────────────────────────────── */}
      <section id="fluxo" className="border-y border-[hsl(var(--c-border-soft))] bg-[hsl(var(--c-bg-elevated))]">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <div className="text-[10px] c-mono c-cyan uppercase tracking-widest mb-4">Fluxo Vendável</div>
            <h2 className="c-display c-fs-h2 font-bold mb-4 c-text">Da ideia ao GO formal.</h2>
            <p className="c-text-muted max-w-2xl mx-auto">Seis passos. Cada um com evidência, log e signoff.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {FLOW.map((step) => (
              <div key={step.n} className="c-card-overlay rounded-lg p-6">
                <div className="c-mono text-xs c-cyan mb-3">{step.n}</div>
                <h3 className="c-display text-lg font-bold c-text mb-2">{step.title}</h3>
                <p className="c-text-muted text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GO/NO-GO ────────────────────────────────────────────────────── */}
      <section id="go-no-go" className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <div className="text-[10px] c-mono c-amber uppercase tracking-widest mb-4">Regras GO/NO-GO</div>
          <h2 className="c-display c-fs-h2 font-bold mb-4 c-text">Decisão automática, auditável.</h2>
          <p className="c-text-muted max-w-2xl mx-auto">
            O Go-Live Center calcula o resultado a partir de regras determinísticas — sem subjetividade.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* NO-GO */}
          <div className="c-card rounded-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="c-pill-nogo px-3 py-1 rounded text-xs c-mono uppercase tracking-widest font-bold">
                NO-GO
              </div>
              <span className="c-text-muted text-xs c-mono uppercase tracking-widest">qualquer condição</span>
            </div>
            <ul className="space-y-3">
              {NOGO_RULES.map((r, i) => (
                <li key={i} className="flex gap-3 text-sm c-text-muted leading-snug">
                  <XCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'hsl(var(--c-fail))' }} />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* GO */}
          <div className="c-card rounded-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="c-pill-go px-3 py-1 rounded text-xs c-mono uppercase tracking-widest font-bold">
                GO
              </div>
              <span className="c-text-muted text-xs c-mono uppercase tracking-widest">todas as condições</span>
            </div>
            <ul className="space-y-3">
              {GO_RULES.map((r, i) => (
                <li key={i} className="flex gap-3 text-sm c-text-muted leading-snug">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'hsl(var(--c-ok))' }} />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Pillars */}
        <div className="grid md:grid-cols-4 gap-4 mt-12">
          {[
            { icon: ClipboardCheck, label: "Bloqueadores" },
            { icon: FileSignature,  label: "Signoffs Eng/Ops" },
            { icon: RotateCcw,      label: "Rollback validado" },
            { icon: Shield,         label: "Sem risco crítico" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="c-card-overlay rounded p-4 flex items-center gap-3">
              <Icon className="w-5 h-5 c-cyan" />
              <span className="c-text text-sm">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Roadmap 90d ─────────────────────────────────────────────────── */}
      <section id="roadmap" className="border-y border-[hsl(var(--c-border-soft))] bg-[hsl(var(--c-bg-elevated))]">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <div className="text-[10px] c-mono c-cyan uppercase tracking-widest mb-4 inline-flex items-center gap-2">
              <Calendar className="w-3 h-3" /> Roadmap 90 dias
            </div>
            <h2 className="c-display c-fs-h2 font-bold mb-4 c-text">Da fundação ao piloto comercial.</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {ROADMAP.map((phase, i) => (
              <div key={i} className="c-card rounded-lg p-6 flex flex-col">
                <div className="c-mono text-[10px] c-amber uppercase tracking-widest mb-2">{phase.range}</div>
                <h3 className="c-display text-xl font-bold c-text mb-4">{phase.title}</h3>
                <ul className="space-y-2 flex-1">
                  {phase.items.map((item, j) => (
                    <li key={j} className="text-xs c-text-muted leading-relaxed flex gap-2">
                      <span className="c-cyan shrink-0">›</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Final ───────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-24 text-center">
        <h2 className="c-display c-fs-h2 font-bold mb-6 c-text">
          Pronto para um <span className="c-cyan">GO formal</span>?
        </h2>
        <p className="c-text-muted text-lg mb-10 max-w-2xl mx-auto">
          Demo guiada de 15 minutos com previs 3D, hardware real e Go-Live Center.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <a href="mailto:vendas@fxkontrol.online?subject=Demo%20FX%20KONTROL"
             className="c-cta-primary px-8 py-4 rounded inline-flex items-center gap-2">
            Solicitar demo guiada <ArrowRight className="w-4 h-4" />
          </a>
          <Link to="/manifesto" className="c-cta-secondary px-8 py-4 rounded inline-flex items-center gap-2">
            Ler manifesto
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-[hsl(var(--c-border-soft))]">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs c-text-subtle c-mono uppercase tracking-widest">
            FX KONTROL · MinasFX · Reliability Engineering
          </div>
          <div className="flex gap-6 text-xs c-text-muted">
            <Link to="/legal/terms"   className="hover:c-text transition-colors">Termos</Link>
            <Link to="/legal/privacy" className="hover:c-text transition-colors">Privacidade</Link>
            <Link to="/legal/refund"  className="hover:c-text transition-colors">Reembolso</Link>
            <Link to="/pricing"       className="hover:c-text transition-colors">Pricing público</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
