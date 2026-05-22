/**
 * HardwareDiagnosticsBanner — banner contextual no topo dos painéis de
 * conexão (USB, EasyConnect). Mostra a causa raiz quando o ambiente
 * atual não consegue acessar hardware (ex.: iOS Safari) e oferece
 * passos acionáveis. Em ambiente OK, mostra um indicador discreto.
 */

import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  RefreshCw,
  Smartphone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useHardwareDiagnostics } from '@/hooks/useHardwareDiagnostics';
import type { RecommendedAction } from '@/lib/platformCapabilities';

interface Props {
  /** Compacto: só mostra a linha de status, expande sob demanda. */
  compact?: boolean;
  className?: string;
}

const TONE: Record<RecommendedAction, { ring: string; text: string; icon: React.ElementType; label: string }> = {
  'install-native-app':    { ring: 'ring-amber-500/40 bg-amber-500/5',  text: 'text-amber-300', icon: Smartphone,     label: 'App nativo necessário' },
  'install-cap-plugin':    { ring: 'ring-amber-500/40 bg-amber-500/5',  text: 'text-amber-300', icon: AlertTriangle,  label: 'Plugin serial faltando' },
  'use-supported-browser': { ring: 'ring-orange-500/40 bg-orange-500/5',text: 'text-orange-300',icon: AlertTriangle,  label: 'Navegador incompatível' },
  'request-permission':    { ring: 'ring-cyan-500/30 bg-cyan-500/5',    text: 'text-cyan-300',  icon: Info,           label: 'Pronto para conectar' },
  'all-good':              { ring: 'ring-emerald-500/30 bg-emerald-500/5', text: 'text-emerald-300', icon: CheckCircle2, label: 'Ambiente compatível' },
};

function CapRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between text-xs py-1 px-2 rounded bg-black/20">
      <span className="text-muted-foreground">{label}</span>
      <span className={ok ? 'text-emerald-400' : 'text-red-400'}>
        {ok ? '✓ Disponível' : '✗ Indisponível'}
      </span>
    </div>
  );
}

export function HardwareDiagnosticsBanner({ compact = false, className }: Props) {
  const diag = useHardwareDiagnostics();
  const [expanded, setExpanded] = useState(!compact);
  const tone = TONE[diag.capabilities.recommendation];
  const Icon = tone.icon;

  return (
    <div className={cn('rounded-lg ring-1 backdrop-blur-sm', tone.ring, className)}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/5 rounded-t-lg"
      >
        <Icon className={cn('w-4 h-4 shrink-0', tone.text)} />
        <div className="flex-1 min-w-0">
          <div className={cn('text-xs font-semibold uppercase tracking-wider', tone.text)}>
            {tone.label}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {diag.platformDisplay} • {diag.authorizedCount} autorizado(s) • {diag.discoveredCount} descoberto(s)
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-white/5">
          <p className="text-xs text-foreground/80 mt-2 leading-relaxed">
            {diag.capabilities.hint}
          </p>

          {/* Causa raiz */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              Causa raiz
            </div>
            <p className="text-xs text-foreground/70 leading-relaxed">{diag.rootCause}</p>
          </div>

          {/* Matriz de capacidades */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              APIs de hardware
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              <CapRow ok={diag.capabilities.webSerial}      label="Web Serial" />
              <CapRow ok={diag.capabilities.webUsb}         label="WebUSB" />
              <CapRow ok={diag.capabilities.webBle}         label="Web Bluetooth" />
              <CapRow ok={diag.capabilities.capacitorNative}label="Capacitor Nativo" />
              <CapRow ok={diag.capabilities.capacitorSerial}label="Plugin Serial (Cap)" />
              <CapRow ok={diag.capabilities.capacitorBle}   label="Plugin BLE (Cap)" />
            </div>
          </div>

          {/* Passos acionáveis */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              Como resolver
            </div>
            <ol className="space-y-1 list-decimal list-inside text-xs text-foreground/80">
              {diag.fixSteps.map((step, i) => (
                <li key={i} className="leading-relaxed">{step}</li>
              ))}
            </ol>
          </div>

          {/* Persistência */}
          {diag.persistedCount > 0 && (
            <div className="text-[11px] text-muted-foreground">
              {diag.persistedCount} dispositivo(s) memorizado(s) — reconectarão sozinhos quando plugados.
            </div>
          )}

          {/* Refresh */}
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={diag.refresh}
              className="h-7 text-xs gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Re-avaliar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
