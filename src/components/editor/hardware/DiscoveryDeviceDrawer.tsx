/**
 * ─── Discovery Device Details Drawer ───────────────────────────────
 * Right-side drawer that surfaces — for any discovered device — the
 * exact transport, family, authorization/online state, last error
 * (if any), VID:PID/host, and a recommended next action tailored to
 * the device's current status.
 *
 * Triggered by clicking a device row in `DiscoveryGrid`.
 */

import { useMemo } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Cable, Usb, Bluetooth, Wifi, AlertTriangle, CheckCircle2,
  ShieldAlert, ExternalLink, RotateCw, Copy, Trash2,
} from 'lucide-react';
import type { DiscoveredDevice, DiscoveryTransport } from '@/core/discovery/types';
import { unifiedDiscovery } from '@/core/discovery/UnifiedDiscoveryService';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Props {
  device: DiscoveredDevice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TRANSPORT_META: Record<DiscoveryTransport, { label: string; Icon: typeof Usb; tone: string; longLabel: string }> = {
  webserial:     { label: 'Serial',  Icon: Cable,     tone: 'cyan',    longLabel: 'Web Serial API' },
  webusb:        { label: 'USB',     Icon: Usb,       tone: 'emerald', longLabel: 'WebUSB API' },
  webble:        { label: 'BLE',     Icon: Bluetooth, tone: 'sky',     longLabel: 'Web Bluetooth API' },
  'mdns-artnet': { label: 'Art-Net', Icon: Wifi,      tone: 'amber',   longLabel: 'mDNS + ArtPoll bridge' },
};

const TONE_TEXT: Record<string, string> = {
  cyan: 'text-cyan-400',
  emerald: 'text-emerald-400',
  sky: 'text-sky-400',
  amber: 'text-amber-400',
};

/** Pick a contextual next step based on the device's current state. */
function recommendNextAction(d: DiscoveredDevice): { title: string; body: string } {
  if (d.lastError) {
    return {
      title: 'Tentar novamente após ler o erro',
      body: `Veja o erro reportado abaixo. Se for "permission denied", desconecte/reconecte o cabo, recarregue a página, ou autorize manualmente no painel do transporte (${TRANSPORT_META[d.transport].longLabel}). Em seguida clique em RETRY no Hardware Overview.`,
    };
  }
  if (!d.online) {
    return {
      title: 'Reconectar dispositivo',
      body: 'O dispositivo está autorizado mas offline. Verifique alimentação/cabo (Serial/USB), módulo ligado (BLE) ou a rota de rede / IP correto (Art-Net).',
    };
  }
  if (!d.recognized) {
    if (d.transport === 'webserial' || d.transport === 'webusb') {
      return {
        title: 'Confirmar família genérica',
        body: 'Família não reconhecida (FTDI/CH340/CP210x). Use o painel USB → Hold-to-Confirm para autorizar transmissão DMX, ou pin um perfil específico via DMX Profile Editor (Open DMX vs ENTTEC Pro).',
      };
    }
    if (d.transport === 'webble') {
      return {
        title: 'Verificar perfil BLE',
        body: 'Módulo BLE pareado mas sem perfil compatível. Verifique se é um Nordic UART / PyroMote / Tuya BLE conhecido — caso contrário não emitirá comandos.',
      };
    }
    return {
      title: 'Nó Art-Net não classificado',
      body: 'Nó respondeu ao ArtPoll mas o ShortName/LongName não bate com nenhum perfil. Pode operar como "DMX over ArtNet" genérico — verifique o universo configurado.',
    };
  }
  if (!d.authorized) {
    return {
      title: 'Autorizar acesso',
      body: 'O navegador detectou o dispositivo mas o usuário ainda não concedeu permissão. Abra o painel do transporte e clique em "Conectar / Pair" para autorizar.',
    };
  }
  return {
    title: 'Pronto para uso',
    body: 'Dispositivo autorizado, online e reconhecido. Pode ser endereçado via DMXPanel / FiringConsole.',
  };
}

export function DiscoveryDeviceDrawer({ device, open, onOpenChange }: Props) {
  const meta = device ? TRANSPORT_META[device.transport] : null;
  const tone = meta ? TONE_TEXT[meta.tone] : '';
  const next = useMemo(() => device ? recommendNextAction(device) : null, [device]);

  if (!device || !meta) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md bg-card/95 backdrop-blur" />
      </Sheet>
    );
  }

  const Icon = meta.Icon;
  const vidpid = (device.vendorId != null && device.productId != null)
    ? `${device.vendorId.toString(16).padStart(4, '0')}:${device.productId.toString(16).padStart(4, '0')}`
    : null;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text).then(
      () => toast.success(`${label} copiado`),
      () => toast.error(`Falha ao copiar ${label}`),
    );
  };

  const handleRetry = async () => {
    toast.info(`Re-scanning ${meta.label}…`);
    await unifiedDiscovery.scanTransports([device.transport]);
    toast.success(`Re-scan ${meta.label} concluído`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md bg-card/95 backdrop-blur overflow-y-auto">
        <SheetHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <Icon className={cn('w-4 h-4', tone)} />
            <Badge variant="outline" className={cn('text-[8px] font-mono uppercase tracking-wider border-current/30', tone)}>
              {meta.label}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                'text-[8px] font-mono uppercase tracking-wider',
                device.online ? 'border-emerald-500/50 text-emerald-400' : 'border-muted-foreground/30 text-muted-foreground',
              )}
            >
              {device.online ? 'online' : 'offline'}
            </Badge>
            {device.recognized ? (
              <Badge variant="outline" className={cn('text-[8px] font-mono uppercase', tone)}>recognized</Badge>
            ) : (
              <Badge variant="outline" className="text-[8px] font-mono uppercase border-amber-500/40 text-amber-400">generic</Badge>
            )}
          </div>
          <SheetTitle className="text-sm font-mono break-all">{device.label}</SheetTitle>
          <SheetDescription className="text-[10px] font-mono text-muted-foreground/80">
            {meta.longLabel} — descoberto via {device.authorized ? 'autorização do operador' : 'enumeração passiva'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {/* Identification */}
          <section className="rounded border border-border/40 bg-surface-0/40 p-2.5 space-y-1.5">
            <h3 className="text-[8px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
              Identificação
            </h3>
            <Row label="ID interno" value={device.id} mono onCopy={() => handleCopy(device.id, 'ID')} />
            {vidpid && (
              <Row label="VID:PID" value={vidpid} mono onCopy={() => handleCopy(vidpid, 'VID:PID')} />
            )}
            {device.host && (
              <Row label="Host" value={device.host} mono onCopy={() => handleCopy(device.host!, 'Host')} />
            )}
            {device.family && <Row label="Família" value={device.family} />}
            <Row
              label="Última visto"
              value={new Date(device.lastSeen).toLocaleTimeString()}
            />
          </section>

          {/* Status */}
          <section className="rounded border border-border/40 bg-surface-0/40 p-2.5 space-y-1.5">
            <h3 className="text-[8px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
              Status
            </h3>
            <StatusRow label="Autorizado" ok={device.authorized} />
            <StatusRow label="Online" ok={device.online} />
            <StatusRow label="Reconhecido" ok={device.recognized} okLabel="sim" failLabel="genérico" />
          </section>

          {/* Last error */}
          {device.lastError && (
            <section className="rounded border border-red-500/40 bg-red-500/5 p-2.5 space-y-1.5">
              <h3 className="text-[8px] font-mono font-bold uppercase tracking-wider text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Último erro
              </h3>
              <p className="text-[10px] font-mono text-red-300/90 break-words">
                {device.lastError.message}
              </p>
              <p className="text-[8px] font-mono text-muted-foreground">
                {device.lastError.code ? `code: ${device.lastError.code} · ` : ''}
                em {new Date(device.lastError.at).toLocaleTimeString()}
              </p>
            </section>
          )}

          {/* Recommended next action */}
          {next && (
            <section className={cn(
              'rounded border p-2.5 space-y-1.5',
              device.lastError ? 'border-amber-500/40 bg-amber-500/5'
                : !device.online || !device.recognized || !device.authorized
                  ? 'border-cyan-500/40 bg-cyan-500/5'
                  : 'border-emerald-500/40 bg-emerald-500/5',
            )}>
              <h3 className="text-[8px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 text-foreground/90">
                {device.lastError
                  ? <ShieldAlert className="w-3 h-3 text-amber-400" />
                  : !device.online || !device.recognized || !device.authorized
                    ? <ExternalLink className="w-3 h-3 text-cyan-400" />
                    : <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                Próxima ação recomendada
              </h3>
              <p className="text-[10px] font-mono text-foreground/90 leading-relaxed">{next.title}</p>
              <p className="text-[9px] font-mono text-muted-foreground/90 leading-relaxed">{next.body}</p>
            </section>
          )}

          {/* Metadata */}
          {device.metadata && Object.keys(device.metadata).length > 0 && (
            <section className="rounded border border-border/40 bg-surface-0/40 p-2.5 space-y-1.5">
              <h3 className="text-[8px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
                Metadata transporte
              </h3>
              <pre className="text-[9px] font-mono text-foreground/80 whitespace-pre-wrap break-words">
                {JSON.stringify(device.metadata, null, 2)}
              </pre>
            </section>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              className={cn('h-7 text-[9px] font-mono gap-1.5', tone, 'border-current/40')}
              onClick={handleRetry}
            >
              <RotateCw className="w-3 h-3" /> RE-SCAN {meta.label}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[9px] font-mono gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => handleCopy(JSON.stringify(device, null, 2), 'JSON do dispositivo')}
            >
              <Copy className="w-3 h-3" /> COPY JSON
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value, mono, onCopy }: { label: string; value: string; mono?: boolean; onCopy?: () => void }) {
  return (
    <div className="flex items-start gap-2 text-[9px]">
      <span className="text-muted-foreground/70 w-20 shrink-0 uppercase tracking-wider font-mono">{label}</span>
      <span className={cn('flex-1 break-all', mono ? 'font-mono text-foreground/90' : 'text-foreground/90')}>{value}</span>
      {onCopy && (
        <button
          type="button"
          onClick={onCopy}
          className="text-muted-foreground/50 hover:text-foreground"
          title="Copiar"
        >
          <Copy className="w-2.5 h-2.5" />
        </button>
      )}
    </div>
  );
}

function StatusRow({ label, ok, okLabel = 'ok', failLabel = 'não' }: { label: string; ok: boolean; okLabel?: string; failLabel?: string }) {
  return (
    <div className="flex items-center gap-2 text-[9px] font-mono">
      <span className="text-muted-foreground/70 w-20 shrink-0 uppercase tracking-wider">{label}</span>
      <span className={cn(
        'inline-flex items-center gap-1',
        ok ? 'text-emerald-400' : 'text-amber-400',
      )}>
        <span className={cn('w-1.5 h-1.5 rounded-full', ok ? 'bg-emerald-400' : 'bg-amber-400')} />
        {ok ? okLabel : failLabel}
      </span>
    </div>
  );
}
