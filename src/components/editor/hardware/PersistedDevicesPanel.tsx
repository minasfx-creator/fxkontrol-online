/**
 * ─── Persisted Devices Panel ───────────────────────────────────────
 * Lists every entry in `portRegistry` (devices the operator authorized
 * at some point) with an inline status badge that explains *why*
 * auto-reopen did — or did NOT — happen this session:
 *
 *  • READY              → entry matches a live, online discovered device
 *  • OFFLINE            → entry matched but the device is not present
 *                         (cable unplugged, node powered off, etc.)
 *  • NEEDS PERMISSION   → entry exists but the browser no longer reports
 *                         it (permission revoked, different Chrome
 *                         profile, or `forget()` was called externally)
 *  • CONFIRM GENERIC    → live + matched, but a generic DMX adapter that
 *                         still requires the Hold-to-Confirm gate
 *  • ERROR              → live but the discoverer recorded `lastError`
 *
 * Each row exposes a FORGET shortcut so the operator can prune stale
 * entries directly from this surface.
 */

import { useEffect, useState, useMemo } from 'react';
import { Cable, Usb, Bluetooth, Wifi, Trash2, AlertTriangle, RefreshCw, Search, X, Wrench } from 'lucide-react';
import { PersistedDeviceTroubleshootSheet } from './PersistedDeviceTroubleshootSheet';
import { Input } from '@/components/ui/input';
import type { DiscoveryTransport } from '@/core/discovery/types';
import { portRegistry, type PortRegistryEntry } from '@/core/discovery/portRegistry';
import { unifiedDiscovery } from '@/core/discovery/UnifiedDiscoveryService';
import type { DiscoveredDevice } from '@/core/discovery/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Status = 'ready' | 'offline' | 'needs-permission' | 'confirm-generic' | 'error';

interface RowState {
  entry: PortRegistryEntry;
  device?: DiscoveredDevice;
  status: Status;
  reason: string;
}

const STATUS_META: Record<Status, { label: string; tone: string; hint: string }> = {
  ready: {
    label: 'READY',
    tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    hint: 'Auto-reopen ok — dispositivo visível, autorizado e online',
  },
  offline: {
    label: 'OFFLINE',
    tone: 'border-muted-foreground/30 bg-muted/20 text-muted-foreground',
    hint: 'Registro encontrado mas o dispositivo não está fisicamente presente',
  },
  'needs-permission': {
    label: 'NEEDS PERMISSION',
    tone: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    hint: 'Navegador não retorna mais este dispositivo — autorize novamente',
  },
  'confirm-generic': {
    label: 'CONFIRM GENERIC',
    tone: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
    hint: 'Adaptador genérico (FTDI/CH340/CP210x) — Hold-to-Confirm pendente',
  },
  error: {
    label: 'ERROR',
    tone: 'border-red-500/50 bg-red-500/10 text-red-300',
    hint: 'Último open/scan falhou — veja o drawer do device para detalhes',
  },
};

function iconForEntry(entry: PortRegistryEntry, device?: DiscoveredDevice) {
  if (entry.host || device?.transport === 'mdns-artnet') return Wifi;
  if (device?.transport === 'webble') return Bluetooth;
  if (device?.transport === 'webusb') return Usb;
  // Default to serial-style cable for VID:PID-only legacy entries.
  return Cable;
}

function classify(entry: PortRegistryEntry, device?: DiscoveredDevice): { status: Status; reason: string } {
  if (!device) {
    return {
      status: 'needs-permission',
      reason: 'Não apareceu no scan silencioso (`getPorts()` / `getDevices()`). Autorização foi revogada ou está em outro perfil/navegador.',
    };
  }
  if (device.lastError) {
    return {
      status: 'error',
      reason: `Último erro: ${device.lastError.message}`,
    };
  }
  if (!device.online) {
    return {
      status: 'offline',
      reason: 'Visível no registro do navegador mas não está respondendo agora.',
    };
  }
  if (!device.recognized && !entry.operatorConfirmedGeneric
      && (device.transport === 'webserial' || device.transport === 'webusb')) {
    return {
      status: 'confirm-generic',
      reason: 'Adaptador genérico — abra o painel USB e faça Hold-to-Confirm para liberar transmissão DMX.',
    };
  }
  return {
    status: 'ready',
    reason: 'Dispositivo reaberto automaticamente e pronto para comandos.',
  };
}

export function PersistedDevicesPanel() {
  const [tick, setTick] = useState(0);
  const [devices, setDevices] = useState<DiscoveredDevice[]>(unifiedDiscovery.getDevices());
  const [isRescanning, setIsRescanning] = useState(false);
  const [query, setQuery] = useState('');
  const [transportFilter, setTransportFilter] = useState<DiscoveryTransport | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
  const [troubleshootKey, setTroubleshootKey] = useState<string | null>(null);

  const handleRescan = async () => {
    if (isRescanning) return;
    setIsRescanning(true);
    try {
      await unifiedDiscovery.scanLight();
      setDevices(unifiedDiscovery.getDevices());
      setTick(t => t + 1);
      toast.success('Rescan concluído — status atualizado');
    } catch (e) {
      toast.error(`Rescan falhou: ${(e as Error).message}`);
    } finally {
      setIsRescanning(false);
    }
  };

  // Re-render when the unified discovery stream changes (covers hot-plug
  // and `forgetDevice` events that mutate the registry indirectly).
  useEffect(() => {
    setDevices(unifiedDiscovery.getDevices());
    return unifiedDiscovery.watch(() => {
      setDevices(unifiedDiscovery.getDevices());
    });
  }, []);

  const rows = useMemo<RowState[]>(() => {
    const entries = portRegistry.listRecent();
    return entries.map(entry => {
      // Match by transport-suffixed id when possible, else fall back to
      // any device whose VID:PID / host matches the registry key.
      const device = devices.find(d => {
        if (entry.host && d.host === entry.host) return true;
        if (d.vendorId == null || d.productId == null) return false;
        const k = `${d.vendorId.toString(16).padStart(4, '0')}:${d.productId.toString(16).padStart(4, '0')}`;
        return entry.key === k || entry.key.startsWith(k + ':');
      });
      const { status, reason } = classify(entry, device);
      return { entry, device, status, reason };
    });
    // `tick` forces re-evaluation after a manual forget.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices, tick]);

  const transportOf = (row: RowState): DiscoveryTransport | 'unknown' => {
    if (row.device?.transport) return row.device.transport;
    if (row.entry.host) return 'mdns-artnet';
    return 'unknown';
  };

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(row => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (transportFilter !== 'all' && transportOf(row) !== transportFilter) return false;
      if (q) {
        const hay = [
          row.entry.lastLabel,
          row.entry.key,
          row.entry.profileId ?? '',
          row.entry.host ?? '',
          row.device?.label ?? '',
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, query, transportFilter, statusFilter]);

  const handleForget = async (row: RowState) => {
    const ok = window.confirm(
      `Esquecer "${row.entry.lastLabel}"?\n\nEntrada persistida será removida e o auto-reopen será interrompido.`,
    );
    if (!ok) return;
    if (row.device) {
      await unifiedDiscovery.forgetDevice(row.device.id);
    } else {
      portRegistry.forget(row.entry.key);
    }
    setTick(t => t + 1);
    toast.success(`${row.entry.lastLabel} removido do registro`);
  };

  const rescanButton = (
    <Button
      size="sm"
      variant="outline"
      className="h-6 px-2 gap-1 text-[8px] font-mono uppercase tracking-wider"
      onClick={handleRescan}
      disabled={isRescanning}
      title="Forçar rescan silencioso (getPorts/getDevices) e recalcular badges"
    >
      <RefreshCw className={cn('w-3 h-3', isRescanning && 'animate-spin')} />
      {isRescanning ? 'Rescanning…' : 'Rescan now'}
    </Button>
  );

  if (rows.length === 0) {
    return (
      <div className="rounded border border-border/40 bg-card/30 p-3 space-y-2 text-center">
        <div className="text-[8px] font-mono text-muted-foreground/60">
          Nenhum dispositivo persistido ainda. Autorize um adaptador para habilitar auto-reopen na próxima sessão.
        </div>
        <div className="flex justify-center">{rescanButton}</div>
      </div>
    );
  }

  const TRANSPORT_OPTS: Array<{ value: DiscoveryTransport | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'webserial', label: 'Serial' },
    { value: 'webusb', label: 'USB' },
    { value: 'webble', label: 'BLE' },
    { value: 'mdns-artnet', label: 'Art-Net' },
  ];
  const STATUS_OPTS: Array<{ value: Status | 'all'; label: string }> = [
    { value: 'all', label: 'Any' },
    { value: 'ready', label: 'Ready' },
    { value: 'offline', label: 'Offline' },
    { value: 'needs-permission', label: 'Needs perm' },
    { value: 'confirm-generic', label: 'Confirm' },
    { value: 'error', label: 'Error' },
  ];
  const filtersActive = query.trim() !== '' || transportFilter !== 'all' || statusFilter !== 'all';

  const chip = <T extends string>(active: boolean, onClick: () => void, label: string, key: T) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      className={cn(
        'px-1.5 py-0.5 rounded border text-[7px] font-mono uppercase tracking-wider transition-colors',
        active
          ? 'border-primary/60 bg-primary/15 text-primary'
          : 'border-border/40 bg-surface-0/40 text-muted-foreground/70 hover:text-foreground/80',
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="rounded border border-border/40 bg-card/30 p-2 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[7px] font-mono uppercase tracking-wider text-muted-foreground/70">
          Persisted devices ({filteredRows.length}/{rows.length})
        </span>
        <div className="flex items-center gap-2">
          {filtersActive && (
            <button
              type="button"
              onClick={() => { setQuery(''); setTransportFilter('all'); setStatusFilter('all'); }}
              className="text-[7px] font-mono uppercase tracking-wider text-muted-foreground/60 hover:text-foreground/80 inline-flex items-center gap-1"
              title="Limpar filtros"
            >
              <X className="w-2.5 h-2.5" /> Clear
            </button>
          )}
          {rescanButton}
        </div>
      </div>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/50 pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por label, VID:PID, host, profile…"
          className="h-7 pl-7 text-[9px] font-mono bg-surface-0/40 border-border/40"
        />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[7px] font-mono uppercase tracking-wider text-muted-foreground/50 mr-1">Transport:</span>
        {TRANSPORT_OPTS.map(opt => chip(transportFilter === opt.value, () => setTransportFilter(opt.value), opt.label, opt.value))}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[7px] font-mono uppercase tracking-wider text-muted-foreground/50 mr-1">Status:</span>
        {STATUS_OPTS.map(opt => chip(statusFilter === opt.value, () => setStatusFilter(opt.value), opt.label, opt.value))}
      </div>
      {filteredRows.length === 0 ? (
        <div className="rounded border border-dashed border-border/40 bg-surface-0/30 p-3 text-[8px] font-mono text-muted-foreground/60 text-center">
          Nenhum dispositivo corresponde aos filtros atuais.
        </div>
      ) : (
      <ul className="space-y-1">
        {filteredRows.map(row => {
          const Icon = iconForEntry(row.entry, row.device);
          const meta = STATUS_META[row.status];
          return (
            <li
              key={row.entry.key}
              className="flex items-center gap-2 rounded border border-border/30 bg-surface-0/40 px-2 py-1.5"
              title={row.reason}
            >
              <Icon className="w-3 h-3 text-muted-foreground/70 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono text-foreground/90 truncate">
                    {row.entry.lastLabel}
                  </span>
                  {row.status === 'error' && (
                    <AlertTriangle className="w-2.5 h-2.5 text-red-400 shrink-0" />
                  )}
                </div>
                <div className="text-[7px] font-mono text-muted-foreground/60 truncate">
                  {row.entry.key}
                  {row.entry.profileId ? ` · ${row.entry.profileId}` : ''}
                  {' · visto '}
                  {new Date(row.entry.lastSeen).toLocaleTimeString()}
                </div>
              </div>
              <span
                className={cn(
                  'shrink-0 inline-flex items-center px-1.5 py-0.5 rounded border text-[7px] font-mono uppercase tracking-wider',
                  meta.tone,
                )}
              >
                {meta.label}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-muted-foreground/60 hover:text-primary"
                onClick={() => setTroubleshootKey(row.entry.key)}
                title="Troubleshoot — abrir drawer de diagnóstico"
              >
                <Wrench className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-muted-foreground/60 hover:text-destructive"
                onClick={() => handleForget(row)}
                title="Esquecer este dispositivo"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </li>
          );
        })}
      </ul>
      )}
      {(() => {
        const active = troubleshootKey ? rows.find(r => r.entry.key === troubleshootKey) : null;
        return (
          <PersistedDeviceTroubleshootSheet
            open={!!active}
            onOpenChange={(o) => { if (!o) setTroubleshootKey(null); }}
            entry={active?.entry ?? null}
            device={active?.device}
            status={active?.status ?? 'offline'}
            reason={active?.reason ?? ''}
            transport={active ? transportOf(active) : 'unknown'}
          />
        );
      })()}
    </div>
  );
}
