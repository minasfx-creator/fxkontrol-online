/**
 * ─── ICETDirectSendPanel ─────────────────────────────────────────────
 * Envio direto do script ICET (RJ Equipamentos) ao equipamento via
 * Web Serial. SEM disparar — apenas transfere o script. O equipamento
 * físico decide quando armar.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { Usb, AlertTriangle, CheckCircle2, Loader2, X, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useProjectStore } from '@/store/useProjectStore';
import {
  buildIcetScript,
  ICET_MAX_CUES,
  ICET_TITLE_MAX,
} from '@/lib/rjIcetScript';
import {
  isWebSerialAvailable,
  requestIcetPort,
  sendIcetScript,
  ICET_USB_FILTERS,
  type SerialPortLike,
  type IcetSendResult,
} from '@/lib/rjIcetSerialBridge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
  onClose?: () => void;
}

export default function ICETDirectSendPanel({ onClose }: Props) {
  const items = useProjectStore(s => s.timelineItems);
  const positions = useProjectStore(s => s.positions);
  const projectName = useProjectStore(s => s.projectName);

  const [title, setTitle] = useState(() => projectName.slice(0, ICET_TITLE_MAX));
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, total: 0 });
  const [lastResult, setLastResult] = useState<IcetSendResult | null>(null);
  const [pairedLabel, setPairedLabel] = useState<string | null>(null);
  const portRef = useRef<SerialPortLike | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const build = useMemo(
    () => buildIcetScript(items, positions, { title }),
    [items, positions, title],
  );

  const webSerialOk = isWebSerialAvailable();
  const canSend =
    webSerialOk &&
    !busy &&
    build.cues.length > 0 &&
    build.errors.length === 0 &&
    portRef.current !== null;

  const handlePair = useCallback(async () => {
    if (!webSerialOk) {
      toast.error('Web Serial indisponível. Use Chrome/Edge desktop em HTTPS.');
      return;
    }
    const port = await requestIcetPort();
    if (!port) {
      toast.error('Nenhuma porta selecionada.');
      return;
    }
    portRef.current = port;
    const info = port.getInfo?.();
    const match = ICET_USB_FILTERS.find(
      f => f.usbVendorId === info?.usbVendorId && f.usbProductId === info?.usbProductId,
    );
    setPairedLabel(match?.label ?? 'porta serial');
    toast.success(`Equipamento pareado (${match?.label ?? 'USB'})`);
  }, [webSerialOk]);

  const handleSend = useCallback(async () => {
    const port = portRef.current;
    if (!port) return;
    setBusy(true);
    setProgress({ sent: 0, total: build.cues.length });
    setLastResult(null);
    const ac = new AbortController();
    abortRef.current = ac;

    const result = await sendIcetScript(port, build.title, build.cues, {
      signal: ac.signal,
      onProgress: (sent, total) => setProgress({ sent, total }),
    });

    setLastResult(result);
    setBusy(false);
    abortRef.current = null;
    portRef.current = null;
    setPairedLabel(null);

    if (result.ok) {
      toast.success(`Exportação concluída — ${result.cuesSent} cues enviados`);
    } else {
      toast.error(result.message);
    }
  }, [build]);

  const handleAbort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return (
    <div className="h-full flex flex-col bg-surface-0 border border-border/40 rounded">
      <div className="p-3 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Usb className="w-4 h-4 text-status-sync" />
          <span className="text-xs font-bold uppercase tracking-wider">
            RJ Equipamentos · ICET Direct Send
          </span>
          <Badge variant="outline" className="text-[8px] uppercase">V1.5</Badge>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>

      <div className="p-3 space-y-3 flex-1 overflow-y-auto">
        {/* Safety banner */}
        <div className="flex items-start gap-2 p-2 rounded bg-status-warn/5 border border-status-warn/30">
          <ShieldAlert className="w-3.5 h-3.5 text-status-warn shrink-0 mt-0.5" />
          <p className="text-[10px] text-muted-foreground leading-snug">
            Esta operação apenas <strong>transfere o script</strong> para o equipamento.
            O equipamento físico (módulo de disparo ICET) decide quando armar e disparar.
            O app não toca CommandBus, FieldBus nem altera <code>workMode</code>.
          </p>
        </div>

        {/* Título do show */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Título do show (ASCII ≤ {ICET_TITLE_MAX})
          </label>
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={ICET_TITLE_MAX}
            className="h-7 text-xs"
            placeholder="SHOW"
          />
          <div className="text-[9px] text-muted-foreground font-mono">
            Sanitizado → <span className="text-foreground">{build.title}</span> ({build.title.length}/{ICET_TITLE_MAX})
          </div>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Cues" value={`${build.cues.length}`} sub={`max ${ICET_MAX_CUES}`} />
          <Stat label="Erros" value={`${build.errors.length}`} tone={build.errors.length > 0 ? 'fail' : 'ok'} />
          <Stat label="Avisos" value={`${build.warnings.length}`} tone={build.warnings.length > 0 ? 'warn' : 'ok'} />
        </div>

        {/* Lista de erros */}
        {build.errors.length > 0 && (
          <div className="rounded border border-status-fail/30 bg-status-fail/5 p-2 max-h-32 overflow-y-auto">
            <div className="flex items-center gap-1 text-[10px] font-bold text-status-fail mb-1">
              <AlertTriangle className="w-3 h-3" /> Erros bloqueiam envio
            </div>
            <ul className="text-[9px] font-mono text-foreground space-y-0.5">
              {build.errors.slice(0, 20).map((e, i) => <li key={i}>• {e}</li>)}
            </ul>
          </div>
        )}

        {/* Lista de warnings */}
        {build.warnings.length > 0 && build.errors.length === 0 && (
          <details className="rounded border border-status-warn/30 bg-status-warn/5 p-2">
            <summary className="text-[10px] font-bold text-status-warn cursor-pointer">
              {build.warnings.length} avisos (envio permitido)
            </summary>
            <ul className="text-[9px] font-mono text-foreground space-y-0.5 mt-1 max-h-32 overflow-y-auto">
              {build.warnings.slice(0, 50).map((w, i) => <li key={i}>• {w}</li>)}
            </ul>
          </details>
        )}

        {/* Web Serial check */}
        {!webSerialOk && (
          <div className="rounded border border-status-warn/30 bg-status-warn/5 p-2 text-[10px] text-muted-foreground">
            <strong>Web Serial indisponível.</strong> Use Chrome/Edge desktop em HTTPS.
            Em iOS/Safari/iframe sem permissions-policy não funciona.
          </div>
        )}

        {/* Progress */}
        {busy && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span>Enviando…</span>
              <span>{progress.sent}/{progress.total}</span>
            </div>
            <div className="h-1.5 bg-surface-1 rounded overflow-hidden">
              <div
                className="h-full bg-status-sync transition-all"
                style={{ width: `${progress.total ? (progress.sent / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Resultado */}
        {lastResult && !busy && (
          <div className={cn(
            'rounded p-2 text-[10px] flex items-start gap-2',
            lastResult.ok
              ? 'bg-status-ok/5 border border-status-ok/30 text-status-ok'
              : 'bg-status-fail/5 border border-status-fail/30 text-status-fail',
          )}>
            {lastResult.ok
              ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              : <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
            <div className="flex-1">
              {lastResult.ok
                ? <>
                    <div className="font-bold">Exportação concluída</div>
                    <div className="text-muted-foreground">
                      {lastResult.cuesSent} cues enviados
                      {lastResult.firmwareVersion && ` · FW ${lastResult.firmwareVersion}`}
                    </div>
                  </>
                : <>
                    <div className="font-bold">{lastResult.message}</div>
                    <div className="text-muted-foreground font-mono">code: {lastResult.code}</div>
                  </>}
            </div>
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="p-3 border-t border-border/30 grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={handlePair}
          disabled={!webSerialOk || busy}
        >
          <Usb className="w-3.5 h-3.5 mr-1.5" />
          {pairedLabel ? `Pareado · ${pairedLabel}` : 'Parear equipamento'}
        </Button>
        {busy ? (
          <Button variant="destructive" size="sm" className="h-8" onClick={handleAbort}>
            Cancelar envio
          </Button>
        ) : (
          <Button size="sm" className="h-8" onClick={handleSend} disabled={!canSend}>
            {busy
              ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              : null}
            Enviar para equipamento
          </Button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'warn' | 'fail' }) {
  const color =
    tone === 'fail' ? 'text-status-fail' :
    tone === 'warn' ? 'text-status-warn' :
    tone === 'ok' ? 'text-status-ok' : 'text-foreground';
  return (
    <div className="rounded border border-border/30 bg-surface-1/40 p-2">
      <div className={cn('text-base font-bold font-mono', color)}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      {sub && <div className="text-[8px] text-muted-foreground/70 font-mono">{sub}</div>}
    </div>
  );
}
