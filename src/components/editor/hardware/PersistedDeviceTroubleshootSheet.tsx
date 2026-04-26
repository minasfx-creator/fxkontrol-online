/**
 * ─── Persisted Device Troubleshoot Sheet ───────────────────────────
 * Right-side drawer launched from each row of `PersistedDevicesPanel`.
 * Surfaces the *exact* diagnostic context for a single registry entry
 * so the operator can decide how to recover without leaving the panel:
 *
 *   • Status badge + human reason
 *   • Transport, registry key, profile id, last seen timestamp
 *   • Active match policy (vidpid vs vidpid+serial) and a flag when the
 *     registry key embeds a serial — explains why a "same family" spare
 *     dongle did or did not auto-reopen
 *   • Raw `lastError.message` from the underlying discoverer (when any)
 *   • Step-by-step "Recommended next steps" tailored to the status
 *
 * No business logic lives here — purely presentation over the props
 * passed in from the parent panel.
 */

import { Wrench, AlertTriangle, ExternalLink } from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { PortRegistryEntry } from '@/core/discovery/portRegistry';
import type { DiscoveredDevice, DiscoveryTransport } from '@/core/discovery/types';
import { useReopenMatchPolicy } from '@/core/discovery/useReopenMatchPolicy';

export type TroubleshootStatus =
  | 'ready' | 'offline' | 'needs-permission' | 'confirm-generic' | 'error';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: PortRegistryEntry | null;
  device?: DiscoveredDevice;
  status: TroubleshootStatus;
  reason: string;
  transport: DiscoveryTransport | 'unknown';
}

const STATUS_TONE: Record<TroubleshootStatus, string> = {
  ready: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  offline: 'border-muted-foreground/30 bg-muted/20 text-muted-foreground',
  'needs-permission': 'border-amber-500/40 bg-amber-500/10 text-warning',
  'confirm-generic': 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
  error: 'border-destructive/50 bg-destructive/10 text-destructive',
};

const STATUS_LABEL: Record<TroubleshootStatus, string> = {
  ready: 'READY',
  offline: 'OFFLINE',
  'needs-permission': 'NEEDS PERMISSION',
  'confirm-generic': 'CONFIRM GENERIC',
  error: 'ERROR',
};

const TRANSPORT_LABEL: Record<DiscoveryTransport | 'unknown', string> = {
  webserial: 'Web Serial',
  webusb: 'WebUSB',
  webble: 'Web Bluetooth',
  'mdns-artnet': 'mDNS / Art-Net',
  unknown: 'Unknown',
};

function recommendedSteps(status: TroubleshootStatus, transport: DiscoveryTransport | 'unknown'): string[] {
  switch (status) {
    case 'ready':
      return [
        'Nenhuma ação necessária — o dispositivo está autorizado e respondendo.',
        'Se ainda assim a transmissão DMX falhar, abra o drawer do device para ver o último erro de envio.',
      ];
    case 'offline':
      return [
        'Verifique se o adaptador está fisicamente conectado e energizado.',
        'Para Art-Net: confirme que o nó está na mesma rede/subnet do navegador.',
        'Use "Rescan now" depois de reconectar para reavaliar o status.',
      ];
    case 'needs-permission':
      return [
        'O navegador não retorna mais este dispositivo em getPorts()/getDevices().',
        'Abra o painel USB/Serial e clique em "Conectar" para reautorizar manualmente.',
        'Se você está em outro perfil/navegador, autorize o dispositivo ali — registry é por origem.',
        transport === 'webusb'
          ? 'Confirme que o sistema operacional não está reservando o dispositivo (ex: driver exclusivo).'
          : 'Em macOS/Linux, verifique permissões de acesso à porta serial.',
      ];
    case 'confirm-generic':
      return [
        'Adaptador genérico (FTDI/CH340/CP210x) — Hold-to-Confirm pendente.',
        'Abra o painel USB e mantenha pressionado o botão de confirmação por ~1.5s.',
        'Após confirmar, a flag persistida (operatorConfirmedGeneric) libera transmissão DMX automática.',
      ];
    case 'error':
      return [
        'Veja o lastError abaixo para o motivo exato da última falha.',
        'Tente "Rescan now" — falhas transitórias (USB busy, cabo solto) costumam se resolver.',
        'Se persistir, "Forget this device" e reautorize do zero para limpar estado interno do driver.',
      ];
  }
}

export function PersistedDeviceTroubleshootSheet({
  open, onOpenChange, entry, device, status, reason, transport,
}: Props) {
  const policy = useReopenMatchPolicy(s => s.policy);
  if (!entry) return null;

  const keyHasSerial = entry.key.split(':').length > 2 && !entry.host;
  const lastError = device?.lastError;
  const steps = recommendedSteps(status, transport);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md font-mono">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-sm">
            <Wrench className="w-4 h-4 text-primary" />
            Troubleshoot
          </SheetTitle>
          <SheetDescription className="text-[10px] truncate">
            {entry.lastLabel}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {/* Status badge + reason */}
          <div className="space-y-1.5">
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded border text-[9px] uppercase tracking-wider',
                STATUS_TONE[status],
              )}
            >
              {STATUS_LABEL[status]}
            </span>
            <p className="text-[10px] text-muted-foreground/80 leading-relaxed">{reason}</p>
          </div>

          {/* Identity / metadata grid */}
          <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-[9px]">
            <dt className="text-muted-foreground/60 uppercase tracking-wider">Transport</dt>
            <dd className="text-foreground/90">{TRANSPORT_LABEL[transport]}</dd>

            <dt className="text-muted-foreground/60 uppercase tracking-wider">Registry key</dt>
            <dd className="text-foreground/90 truncate" title={entry.key}>{entry.key}</dd>

            {entry.profileId && (
              <>
                <dt className="text-muted-foreground/60 uppercase tracking-wider">Profile</dt>
                <dd className="text-foreground/90">{entry.profileId}</dd>
              </>
            )}

            {entry.host && (
              <>
                <dt className="text-muted-foreground/60 uppercase tracking-wider">Host</dt>
                <dd className="text-foreground/90">{entry.host}</dd>
              </>
            )}

            <dt className="text-muted-foreground/60 uppercase tracking-wider">Last seen</dt>
            <dd className="text-foreground/90">{new Date(entry.lastSeen).toLocaleString()}</dd>

            <dt className="text-muted-foreground/60 uppercase tracking-wider">Generic OK</dt>
            <dd className="text-foreground/90">
              {entry.operatorConfirmedGeneric ? 'yes (Hold-to-Confirm gravado)' : 'no'}
            </dd>
          </dl>

          {/* Match policy */}
          <div className="rounded border border-border/40 bg-surface-0/40 p-2 space-y-1">
            <div className="text-[8px] uppercase tracking-wider text-muted-foreground/60">
              Matching policy
            </div>
            <div className="text-[10px] text-foreground/90">
              {policy === 'vidpid+serial' ? 'VID:PID + serial number' : 'VID:PID only'}
            </div>
            <p className="text-[9px] text-muted-foreground/70 leading-relaxed">
              {policy === 'vidpid+serial'
                ? 'Auto-reopen casa apenas com a unidade física exata (serial USB). Trocar por um dongle idêntico exigirá nova autorização.'
                : 'Auto-reopen aceita qualquer unidade do mesmo VID:PID. Bom para hot-swap de spares idênticos.'}
            </p>
            {keyHasSerial && policy === 'vidpid' && (
              <p className="text-[9px] text-warning leading-relaxed">
                ⚠ Este registro foi gravado sob política <code>vidpid+serial</code>. Mudar para <code>vidpid</code> agora não fará efeito retroativo — autorize novamente para regravar a chave.
              </p>
            )}
            {!keyHasSerial && policy === 'vidpid+serial' && transport === 'webusb' && (
              <p className="text-[9px] text-warning leading-relaxed">
                ⚠ Chave atual não inclui serial — provavelmente o dispositivo não expõe um, ou foi gravada antes da política mudar. Reautorize para regravar.
              </p>
            )}
          </div>

          {/* Last error block */}
          {lastError ? (
            <div className="rounded border border-destructive/40 bg-destructive/10 p-2 space-y-1">
              <div className="flex items-center gap-1.5 text-[8px] uppercase tracking-wider text-destructive">
                <AlertTriangle className="w-3 h-3" />
                Last error
              </div>
              <pre className="text-[9px] text-destructive/90 whitespace-pre-wrap break-words">
                {lastError.message}
              </pre>
              {lastError.code && (
                <div className="text-[8px] text-destructive/70">code: {lastError.code}</div>
              )}
            </div>
          ) : (
            <div className="rounded border border-border/40 bg-surface-0/30 p-2 text-[9px] text-muted-foreground/60">
              Sem lastError registrado neste dispositivo.
            </div>
          )}

          {/* Recommended steps */}
          <div className="space-y-1.5">
            <div className="text-[8px] uppercase tracking-wider text-muted-foreground/60">
              Recommended next steps
            </div>
            <ol className="space-y-1 list-decimal list-inside text-[10px] text-foreground/85 leading-relaxed">
              {steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>

          <a
            href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[9px] text-primary hover:underline"
          >
            Web Serial / WebUSB docs <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </SheetContent>
    </Sheet>
  );
}
