import { CheckCircle2, ArrowRight, RotateCcw, ScrollText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import type { PairingAuditEntry } from '@/lib/pairingAuditLog';
import { getRecentPairings } from '@/lib/pairingAuditLog';
import { useMemo, useState } from 'react';

interface Props {
  entry: PairingAuditEntry;
  onPairAnother: () => void;
}

export function SuccessStep({ entry, onPairAnother }: Props) {
  const navigate = useNavigate();
  const [showLog, setShowLog] = useState(false);
  const recent = useMemo(() => getRecentPairings(10), [showLog]);

  const ts = new Date(entry.at);
  const timeStr = ts.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = ts.toLocaleDateString('pt-BR');

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent p-6 text-center space-y-3">
        <div className="h-16 w-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
          <CheckCircle2 className="w-9 h-9 text-emerald-400" />
        </div>
        <h2 className="text-lg font-bold text-emerald-300">Pareamento concluído</h2>
        <p className="text-xs text-muted-foreground">Dispositivo registrado e pronto para uso.</p>
      </div>

      <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur p-4 space-y-3">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Acessório</p>
          <p className="text-sm font-mono">{entry.label}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Protocolo</p>
            <p className="font-mono text-primary">{entry.protocolLabel}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Baud</p>
            <p className="font-mono">{entry.baudRate}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Transporte</p>
            <p className="font-mono">{entry.transport}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Plataforma</p>
            <p className="font-mono">{entry.platform}</p>
          </div>
        </div>
        <div className="pt-2 border-t border-border/30">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Auditoria</p>
          <p className="text-xs font-mono text-muted-foreground">
            Autorizado em {dateStr} às {timeStr}
          </p>
          <p className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">id: {entry.id}</p>
        </div>
      </div>

      <div className="space-y-2">
        <Button onClick={() => navigate('/studio')} className="w-full min-h-[56px] gap-2">
          Abrir Studio
          <ArrowRight className="w-4 h-4" />
        </Button>
        <Button variant="outline" onClick={onPairAnother} className="w-full min-h-[48px] gap-2">
          <RotateCcw className="w-4 h-4" />
          Parear outro dispositivo
        </Button>
        <button
          type="button"
          onClick={() => setShowLog(s => !s)}
          className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
        >
          <ScrollText className="w-3 h-3" />
          {showLog ? 'Ocultar' : 'Ver'} log de auditoria
        </button>
      </div>

      {showLog && (
        <div className="rounded-xl border border-border/40 bg-card/20 p-3 space-y-1.5 max-h-[280px] overflow-y-auto">
          {recent.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhum registro.</p>
          )}
          {recent.map(r => (
            <div
              key={r.id}
              className="text-[11px] font-mono flex items-center justify-between gap-2 py-1 border-b border-border/20 last:border-0"
            >
              <span className={r.success ? 'text-emerald-400' : 'text-destructive'}>
                {r.success ? '✓' : '✗'}
              </span>
              <span className="flex-1 truncate">{r.label}</span>
              <span className="text-muted-foreground">{r.protocolKind}</span>
              <span className="text-muted-foreground/60">
                {new Date(r.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
