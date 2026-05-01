/**
 * Manifesto — FXKONTROL brand manifesto and positioning page.
 *
 * Public route (no auth, no MainLayout chrome). Mirrors the canonical
 * source in docs/branding/MANIFESTO.md but rendered with DS tokens for
 * the public/marketing surface.
 *
 * Palette rules respected:
 *  - Operational palette only (Vantablack + cyan-dessat). No orange.
 *  - Mono (.ds-mono) reserved for technical literals (timecode, DMX, latency).
 *  - No emoji in operational examples; status semantics via dot colors.
 */
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Activity, Radio, Cpu, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FxkLogo } from "@/components/brand/FxkLogo";

const beliefs = [
  { icon: Cpu, title: "Simulação é execução", body: "Se não roda igual no 3D, não vai rodar igual no campo. Determinismo acima de improviso." },
  { icon: Activity, title: "Hardware honesto", body: "Nada é “online” até a camada física confirmar. Sem dado sintético, sem mock disfarçado de telemetria." },
  { icon: ShieldCheck, title: "Segurança é o piso", body: "E-STOP em <50 ms, intertravamentos físicos em modo real, IA proibida de armar ou disparar." },
  { icon: Eye, title: "A ferramenta serve o operador", body: "Vantablack para visão noturna, mono para timecode, snap para precisão." },
  { icon: Radio, title: "Compatibilidade é respeito", body: "Showven, FireOne, Finale 3D, Art-Net, sACN, MAVLink. Não reinventamos protocolos consagrados." },
];

const messages = [
  { who: "Diretor técnico", what: "Um plano. Um relógio. Uma cadeia auditável.", proof: "ShowPlan canônico · log 100ms · export Finale 3D / FireOne / MAVLink" },
  { who: "Pirotécnico", what: "Nada arma sem você. Nada dispara sem continuidade.", proof: "Hold-to-Confirm 600ms · E-STOP global · Safety State Machine" },
  { who: "Piloto de drone", what: "Música, pyro e drone no mesmo timecode.", proof: "SMPTE Drop-Frame 29.97 · VVIZ streaming · ICET Sync" },
  { who: "Operador DMX/laser", what: "Art-Net, sACN, ILDA — do jeito que a indústria já fala.", proof: "33 PPS Art-Net · FB3/FB4 sim · Showven PBUS dual-band" },
  { who: "Produtor", what: "Veja o show antes do show, no terreno real.", proof: "Google 3D Tiles · Studio Mode cinematográfico · paleta noturna" },
];

const voiceDo = [
  "ARMED. Pressione 600 ms para confirmar.",
  "Continuidade OK em 14/16 canais.",
  "E-STOP latência 38 ms.",
  "Hardware desconectado — modo simulação.",
];
const voiceDont = [
  "Pronto para a magia acontecer",
  "Tudo certo, pode mandar bala!",
  "Segurança em primeiro lugar",
  "Ops, parece que algo deu errado.",
];

export default function Manifesto() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Top bar */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <FxkLogo size={28} variant="full" />
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link to="/pricing" className="px-3 py-2 text-muted-foreground hover:text-foreground transition-colors">Planos</Link>
            <Link to="/landing" className="px-3 py-2 text-muted-foreground hover:text-foreground transition-colors">Plataforma</Link>
            <Link to="/auth"><Button size="sm" variant="default">Entrar</Button></Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary mb-6">
          <span className="ds-mono uppercase tracking-wider">Manifesto · v1.0</span>
        </div>
        <h1 className="text-5xl md:text-6xl font-semibold tracking-tight leading-tight">
          Espinha dorsal digital<br />
          <span className="text-primary">do show ao vivo.</span>
        </h1>
        <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
          Onde DMX, pyro, drone, laser e mesh convergem em uma única linha de comando —
          auditável, rastreável e preparada para falhar com segurança.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <Link to="/pricing"><Button size="lg" className="gap-2">Ver planos <ArrowRight className="size-4" /></Button></Link>
          <a href="#posicionamento"><Button size="lg" variant="outline">Ler manifesto</Button></a>
        </div>
      </section>

      {/* Razão de existir */}
      <section className="mx-auto max-w-4xl px-6 py-16 border-t border-border/40">
        <h2 className="text-3xl font-semibold mb-6">Por que existimos</h2>
        <p className="text-lg text-muted-foreground leading-relaxed">
          A indústria do espetáculo ao vivo opera há décadas com ferramentas fragmentadas:
          um software para timeline, outro para DMX, outro para disparo, outro para drone,
          outro para laser. Entre eles, planilhas, adesivos, rádio HT e fé.
        </p>
        <p className="mt-4 text-lg text-foreground leading-relaxed">
          <strong>FXKONTROL existe para acabar com a lacuna entre o que foi planejado
          e o que dispara em campo.</strong> Um único plano. Um único relógio.
          Uma única cadeia de comando.
        </p>
      </section>

      {/* Crenças */}
      <section className="mx-auto max-w-6xl px-6 py-16 border-t border-border/40">
        <h2 className="text-3xl font-semibold mb-10">Crenças</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {beliefs.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-lg border border-border/60 bg-card/50 p-6 hover:border-primary/40 transition-colors">
              <Icon className="size-5 text-primary mb-3" />
              <h3 className="font-semibold mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Posicionamento */}
      <section id="posicionamento" className="mx-auto max-w-4xl px-6 py-16 border-t border-border/40">
        <h2 className="text-3xl font-semibold mb-8">Posicionamento</h2>
        <blockquote className="border-l-2 border-primary pl-6 text-lg leading-relaxed text-foreground/90">
          <p><span className="text-muted-foreground">Para</span> equipes técnicas de espetáculos ao vivo</p>
          <p><span className="text-muted-foreground">que</span> precisam coordenar pyro, drone, laser, DMX e cenografia em tempo real,</p>
          <p><span className="text-primary font-semibold">FXKONTROL é</span> a plataforma de controle e simulação determinística</p>
          <p><span className="text-muted-foreground">que</span> unifica o plano, o ensaio 3D e o disparo em uma única cadeia auditável,</p>
          <p><span className="text-muted-foreground">diferente de</span> softwares de cue isolados ou planilhas com rádio,</p>
          <p><span className="text-muted-foreground">porque</span> garante que o que você vê no estúdio é exatamente o que dispara em campo.</p>
        </blockquote>
      </section>

      {/* Mensagens-chave */}
      <section className="mx-auto max-w-6xl px-6 py-16 border-t border-border/40">
        <h2 className="text-3xl font-semibold mb-2">Mensagens-chave</h2>
        <p className="text-muted-foreground mb-8">Uma frase por audiência. Uma prova por frase.</p>
        <div className="overflow-hidden rounded-lg border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left p-4 font-semibold w-48">Audiência</th>
                <th className="text-left p-4 font-semibold">Mensagem</th>
                <th className="text-left p-4 font-semibold w-80">Prova</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m.who} className="border-t border-border/40">
                  <td className="p-4 text-muted-foreground align-top">{m.who}</td>
                  <td className="p-4 font-medium align-top">{m.what}</td>
                  <td className="p-4 text-muted-foreground ds-mono text-xs leading-relaxed align-top">{m.proof}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Tom de voz */}
      <section className="mx-auto max-w-6xl px-6 py-16 border-t border-border/40">
        <h2 className="text-3xl font-semibold mb-2">Tom de voz</h2>
        <p className="text-muted-foreground mb-8">
          Operacional, não publicitário. Falamos como um briefing de voo: curto, exato, sem floreio.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="size-2 rounded-full bg-emerald-500" />
              <h3 className="font-semibold text-emerald-400">Sim — assim falamos</h3>
            </div>
            <ul className="space-y-2 text-sm">
              {voiceDo.map((v) => (
                <li key={v} className="ds-mono text-foreground/90 border-l-2 border-emerald-500/40 pl-3">{v}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="size-2 rounded-full bg-destructive" />
              <h3 className="font-semibold text-destructive">Não — assim não falamos</h3>
            </div>
            <ul className="space-y-2 text-sm">
              {voiceDont.map((v) => (
                <li key={v} className="text-muted-foreground line-through border-l-2 border-destructive/40 pl-3">{v}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 grid md:grid-cols-3 gap-4 text-sm">
          <div className="rounded-lg border border-border/60 p-5">
            <h4 className="font-semibold mb-2">Ritmo</h4>
            <p className="text-muted-foreground">Verbo no imperativo para ação crítica. Substantivo técnico em <span className="ds-mono text-foreground">mono</span>.</p>
          </div>
          <div className="rounded-lg border border-border/60 p-5">
            <h4 className="font-semibold mb-2">Estado</h4>
            <p className="text-muted-foreground">
              <span className="text-emerald-400">OK</span> ·{" "}
              <span className="text-amber-400">WARN</span> ·{" "}
              <span className="text-destructive">FAIL</span> ·{" "}
              <span className="text-primary">SYNC</span>. Cor sempre, ícone também.
            </p>
          </div>
          <div className="rounded-lg border border-border/60 p-5">
            <h4 className="font-semibold mb-2">Idioma</h4>
            <p className="text-muted-foreground">Português direto. Termos da indústria mantêm-se em inglês: <span className="ds-mono text-foreground">cue, ARM, E-STOP, timecode</span>.</p>
          </div>
        </div>
      </section>

      {/* Promessas */}
      <section className="mx-auto max-w-4xl px-6 py-16 border-t border-border/40">
        <h2 className="text-3xl font-semibold mb-8">Promessas</h2>
        <ol className="space-y-4">
          {[
            ["Determinismo", "o que você simula é o que dispara."],
            ["Honestidade", "se não está conectado, dizemos disconnected. Sem ícone verde mentiroso."],
            ["Latência crítica", "E-STOP < 50 ms. Sempre."],
            ["Auditoria", "cada comando em janela de 100 ms na black box."],
            ["Compatibilidade", "Finale 3D, Showven, FireOne, Art-Net 4/5, sACN, MAVLink, ILDA."],
            ["Offline-first", "a plataforma continua operando em degraded mode sem internet."],
          ].map(([title, body], i) => (
            <li key={title} className="flex gap-4">
              <span className="ds-mono text-primary text-sm pt-1 w-8">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <strong className="text-foreground">{title}.</strong>{" "}
                <span className="text-muted-foreground">{body}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Assinatura */}
      <section className="mx-auto max-w-4xl px-6 py-24 border-t border-border/40 text-center">
        <FxkLogo size={48} variant="mark-only" className="mx-auto mb-6" />
        <p className="text-2xl md:text-3xl font-semibold tracking-tight">
          Plan it. Rehearse it. Fire it.
        </p>
        <p className="mt-2 text-primary text-2xl md:text-3xl font-semibold">One chain.</p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <Link to="/auth"><Button size="lg" className="gap-2">Começar agora <ArrowRight className="size-4" /></Button></Link>
          <Link to="/pricing"><Button size="lg" variant="outline">Ver planos</Button></Link>
        </div>
      </section>

      <footer className="border-t border-border/40 py-8 text-center text-xs text-muted-foreground">
        <p>FXKONTROL — Manifesto v1.0 · <Link to="/legal/terms" className="hover:text-foreground">Termos</Link> · <Link to="/legal/privacy" className="hover:text-foreground">Privacidade</Link></p>
      </footer>
    </div>
  );
}
