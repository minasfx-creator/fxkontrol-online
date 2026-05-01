/**
 * IOSReadiness — Matriz de compatibilidade pública (Desktop Chrome / Android
 * Chrome / iPhone Safari / iOS Capacitor).
 *
 * Roadmap brief 90d (d1-15): "Compatibilidade Desktop Chrome, Android Chrome,
 * iPhone Safari e iOS Capacitor mapeada" + "Mensagens de iPhone revisadas
 * para transportes indisponíveis".
 *
 * Esta página é o destino canônico de TODOS os botões disabled em iOS Safari.
 * Pública (sem auth) porque também serve para vendas — produtora abre antes
 * de comprar para entender o que funciona em campo.
 *
 * Mostra:
 *   • Matriz visual: 4 plataformas × 4 transportes (USB Serial / WebUSB / BLE
 *     / Art-Net) com ✓ / ✗ / via Capacitor.
 *   • Detecção AO VIVO da plataforma do usuário (badge "você está aqui").
 *   • Recomendação de fallback operacional contextualizada.
 *   • Link para /install (PWA) e instruções Capacitor.
 */

import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Smartphone, Monitor, Globe, ArrowRight, CheckCircle2, XCircle,
  AlertTriangle, Apple, Cable, Bluetooth, Usb, Network, Info,
} from 'lucide-react';
import { detectPlatformCapabilities, platformLabel, type Platform } from '@/lib/platformCapabilities';
import { cn } from '@/lib/utils';

type Cell =
  | { kind: 'ok'; note?: string }
  | { kind: 'no'; note: string }
  | { kind: 'partial'; note: string }
  | { kind: 'native'; note: string };

interface PlatformRow {
  id: Platform | 'desktop-chrome-edge';
  matches: Platform[];
  label: string;
  icon: typeof Monitor;
  webserial: Cell;
  webusb: Cell;
  webble: Cell;
  artnet: Cell;
  fallback: string;
}

const ROWS: PlatformRow[] = [
  {
    id: 'desktop-chrome-edge',
    matches: ['desktop-chrome'],
    label: 'Desktop Chrome / Edge / Opera',
    icon: Monitor,
    webserial: { kind: 'ok' },
    webusb:    { kind: 'ok' },
    webble:    { kind: 'ok' },
    artnet:    { kind: 'ok', note: 'via UDP bridge' },
    fallback:  'Caminho feliz — todos os transportes funcionam nativamente.',
  },
  {
    id: 'android-chrome',
    matches: ['android-chrome'],
    label: 'Android Chrome',
    icon: Smartphone,
    webserial: { kind: 'ok',      note: 'requer cabo USB-OTG' },
    webusb:    { kind: 'ok',      note: 'requer cabo USB-OTG' },
    webble:    { kind: 'ok' },
    artnet:    { kind: 'ok',      note: 'mesma rede Wi-Fi' },
    fallback:  'Suporte completo. Para hardware USB, use cabo OTG certificado.',
  },
  {
    id: 'ios-safari-pwa',
    matches: ['ios-safari-pwa'],
    label: 'iPhone Safari (Web/PWA)',
    icon: Apple,
    webserial: { kind: 'no', note: 'Apple bloqueia' },
    webusb:    { kind: 'no', note: 'Apple bloqueia' },
    webble:    { kind: 'no', note: 'Web Bluetooth indisponível' },
    artnet:    { kind: 'partial', note: 'só leitura (read-only via fetch)' },
    fallback:
      'Use o app FX KONTROL nativo (Capacitor) para conexão real, OU mantenha o iPhone como segunda tela read-only enquanto o operador principal usa desktop Chrome.',
  },
  {
    id: 'ios-capacitor',
    matches: ['ios-capacitor'],
    label: 'iPhone (App Nativo Capacitor)',
    icon: Apple,
    webserial: { kind: 'native', note: 'plugin @capacitor-community/serial + adaptador MFi' },
    webusb:    { kind: 'native', note: 'via plugin serial' },
    webble:    { kind: 'native', note: 'plugin @capacitor-community/bluetooth-le' },
    artnet:    { kind: 'ok',     note: 'via Wi-Fi nativo' },
    fallback:
      'Recomendado para operação em campo. Adaptador Apple Lightning/USB-C MFi obrigatório para FXK16/FireOne USB.',
  },
];

const TRANSPORTS = [
  { key: 'webserial', label: 'USB Serial', icon: Cable, hint: 'FXK16, FireOne FXKPYRO, ENTTEC' },
  { key: 'webusb',    label: 'WebUSB',     icon: Usb,   hint: 'DMX adapters genéricos' },
  { key: 'webble',    label: 'BLE',        icon: Bluetooth, hint: 'FXK16 BLE-UART, Tuya' },
  { key: 'artnet',    label: 'Art-Net',    icon: Network, hint: 'Nodes DMX over Ethernet' },
] as const;

function CellBadge({ cell }: { cell: Cell }) {
  const cfg = {
    ok:      { icon: CheckCircle2,  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', label: 'OK' },
    no:      { icon: XCircle,       color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/30',         label: 'NÃO' },
    partial: { icon: AlertTriangle, color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30',     label: 'PARCIAL' },
    native:  { icon: CheckCircle2,  color: 'text-cyan-400',    bg: 'bg-cyan-500/10 border-cyan-500/30',       label: 'NATIVO' },
  }[cell.kind];
  const Icon = cfg.icon;
  return (
    <div className={cn('rounded border px-2 py-1.5 flex flex-col items-start gap-1', cfg.bg)}>
      <div className={cn('flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider', cfg.color)}>
        <Icon className="w-3 h-3" /> {cfg.label}
      </div>
      {cell.note && <div className="text-[10px] text-muted-foreground leading-tight">{cell.note}</div>}
    </div>
  );
}

export default function IOSReadiness() {
  const caps = useMemo(() => detectPlatformCapabilities(true), []);
  const here = useMemo(() => ROWS.find(r => r.matches.includes(caps.platform)), [caps.platform]);

  useEffect(() => {
    document.title = 'iPhone & Compatibilidade — FX KONTROL';
    let m = document.head.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!m) {
      m = document.createElement('meta');
      m.setAttribute('name', 'description');
      document.head.appendChild(m);
    }
    m.setAttribute('content',
      'Matriz de compatibilidade FX KONTROL: Desktop Chrome, Android, iPhone Safari e iOS Capacitor. Quais transportes (USB Serial, WebUSB, BLE, Art-Net) funcionam em cada plataforma e como contornar limitações da Apple.');
  }, []);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="border-b border-border/30 sticky top-0 backdrop-blur-md bg-background/80 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="text-sm font-bold tracking-wider">FX KONTROL</Link>
          <Link to="/comercial" className="text-xs text-muted-foreground hover:text-foreground uppercase tracking-widest">
            Comercial
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 md:py-16">
        {/* Hero */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/5 text-[10px] font-mono uppercase tracking-widest text-cyan-300 mb-6">
            <Smartphone className="w-3 h-3" /> Compatibilidade & iPhone
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            O que funciona <span className="text-cyan-400">em cada plataforma</span>.
          </h1>
          <p className="text-muted-foreground text-lg max-w-3xl leading-relaxed">
            FX KONTROL roda em qualquer browser moderno, mas o acesso a hardware físico
            (DMX, BLE, USB) depende de APIs que <strong className="text-foreground">só algumas plataformas suportam</strong>.
            Esta matriz mostra exatamente o que esperar antes de levar para campo.
          </p>
        </div>

        {/* Você está aqui */}
        {here && (
          <div className="mb-10 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-4 md:p-5 flex items-start gap-3">
            <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-300 mb-1">Você está aqui</div>
              <div className="text-sm font-semibold mb-1">{platformLabel(caps.platform)}</div>
              <p className="text-xs text-muted-foreground leading-relaxed">{caps.hint}</p>
            </div>
          </div>
        )}

        {/* Matriz */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Globe className="w-5 h-5 text-cyan-400" />
            Matriz Plataforma × Transporte
          </h2>

          {/* Mobile: cards. Desktop: tabela. */}
          <div className="space-y-4 md:hidden">
            {ROWS.map(row => {
              const Icon = row.icon;
              const isHere = row.matches.includes(caps.platform);
              return (
                <div key={row.id} className={cn(
                  'rounded-lg border p-4',
                  isHere ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-border/30 bg-card/30',
                )}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="w-4 h-4 text-foreground" />
                    <span className="font-semibold text-sm">{row.label}</span>
                    {isHere && <span className="ml-auto text-[9px] font-mono uppercase text-cyan-400">Atual</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {TRANSPORTS.map(t => (
                      <div key={t.key}>
                        <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                          <t.icon className="w-2.5 h-2.5" /> {t.label}
                        </div>
                        <CellBadge cell={row[t.key]} />
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed border-t border-border/20 pt-2">
                    {row.fallback}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  <th className="py-3 pr-4 border-b border-border/30">Plataforma</th>
                  {TRANSPORTS.map(t => (
                    <th key={t.key} className="py-3 px-2 border-b border-border/30">
                      <div className="flex items-center gap-1.5"><t.icon className="w-3 h-3" />{t.label}</div>
                      <div className="text-[9px] text-muted-foreground/60 font-normal normal-case mt-0.5">{t.hint}</div>
                    </th>
                  ))}
                  <th className="py-3 pl-2 border-b border-border/30">Fallback recomendado</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map(row => {
                  const Icon = row.icon;
                  const isHere = row.matches.includes(caps.platform);
                  return (
                    <tr key={row.id} className={cn(
                      'border-b border-border/15',
                      isHere && 'bg-cyan-500/5',
                    )}>
                      <td className="py-4 pr-4 align-top">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-foreground shrink-0" />
                          <span className="font-semibold text-sm">{row.label}</span>
                        </div>
                        {isHere && (
                          <span className="inline-block mt-1 text-[9px] font-mono uppercase text-cyan-400">Você está aqui</span>
                        )}
                      </td>
                      {TRANSPORTS.map(t => (
                        <td key={t.key} className="py-4 px-2 align-top min-w-[140px]">
                          <CellBadge cell={row[t.key]} />
                        </td>
                      ))}
                      <td className="py-4 pl-2 align-top text-xs text-muted-foreground leading-relaxed max-w-xs">
                        {row.fallback}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Fallback operacional para iPhone Safari */}
        <section className="mb-16 rounded-lg border border-amber-500/30 bg-amber-500/5 p-5 md:p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Fallback operacional — iPhone em campo sem app nativo
          </h2>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            Se você precisa operar com iPhone HOJE sem o build nativo, use este modelo dual:
          </p>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[10px] font-bold">1</span>
              <div>
                <strong className="text-foreground">Operador principal:</strong> notebook com Chrome/Edge desktop conectado
                ao FXK16/FireOne via USB. Esse é o caminho que arma e dispara.
              </div>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[10px] font-bold">2</span>
              <div>
                <strong className="text-foreground">iPhone Safari:</strong> abre <code className="text-cyan-300 bg-black/30 px-1.5 py-0.5 rounded text-xs">/field</code> em
                modo monitor (read-only). Vê telemetria, status de armado, logs e GO/NO-GO em tempo real
                via Art-Net read + websocket.
              </div>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[10px] font-bold">3</span>
              <div>
                <strong className="text-foreground">E-STOP no iPhone:</strong> botão global continua acessível e dispara
                via comando remoto (não requer USB local). Latência {'<'}500ms na mesma rede.
              </div>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[10px] font-bold">4</span>
              <div>
                <strong className="text-foreground">Próximo evento:</strong> compile o app nativo (instruções abaixo)
                e o iPhone vira controle primário com adaptador MFi.
              </div>
            </li>
          </ol>
        </section>

        {/* CTAs */}
        <section className="grid md:grid-cols-2 gap-4 mb-12">
          <Link to="/install" className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-5 hover:bg-cyan-500/10 transition-colors group">
            <Smartphone className="w-6 h-6 text-cyan-400 mb-3" />
            <h3 className="font-bold text-sm mb-1">Instalar como PWA</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Adicione FX KONTROL à tela inicial do iPhone para usar como segunda tela / monitor.
            </p>
            <span className="text-xs text-cyan-400 inline-flex items-center gap-1 group-hover:gap-2 transition-all">
              Ver guia <ArrowRight className="w-3 h-3" />
            </span>
          </Link>
          <a
            href="https://capacitorjs.com/docs/ios"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-border/30 bg-card/30 p-5 hover:bg-card/60 transition-colors group"
          >
            <Apple className="w-6 h-6 text-foreground mb-3" />
            <h3 className="font-bold text-sm mb-1">Build nativo (Capacitor + Xcode)</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Para conexão USB MFi e BLE no iPhone: requer Mac + Xcode + plugin serial.
              Veja docs/iphone-usb-serial.md no repositório.
            </p>
            <span className="text-xs text-foreground/70 inline-flex items-center gap-1 group-hover:gap-2 transition-all">
              Documentação Capacitor <ArrowRight className="w-3 h-3" />
            </span>
          </a>
        </section>

        {/* Voltar */}
        <div className="flex flex-wrap gap-3 pt-6 border-t border-border/20">
          <Link to="/studio" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            ← Voltar ao Studio
          </Link>
          <Link to="/comercial" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 ml-auto">
            Ver pacotes comerciais →
          </Link>
        </div>
      </main>
    </div>
  );
}
