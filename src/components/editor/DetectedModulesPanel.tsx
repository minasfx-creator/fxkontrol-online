/**
 * DetectedModulesPanel — Real-time list of modules detected by any transport,
 * subscribed directly to `moduleAggregator` (single source of truth).
 *
 * Honest hardware: shows nothing when no module was upserted. Never invents
 * entries. Groups by inferred model (XL4 Gateway / FXK-M1 / IFMx-i32Q / FXK /
 * ESP32-Generic / Unknown) and tags transport + freshness.
 *
 * UI: text search + model & transport filter chips for fast triage.
 */
import { useEffect, useState, useMemo } from 'react';
import { Cpu, Radio, Usb, Bluetooth, Globe, Cable, Wifi, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  moduleAggregator,
  type AggregatedModule,
  type AggregatedTransport,
} from '@/lib/moduleAggregator';
import type { FxkModel } from '@/lib/inferFxkModel';

const MODEL_LABEL: Record<FxkModel, string> = {
  'FXK-M1': 'FXK-M1 (FireOne single-shot)',
  'IFMx-i32Q': 'IFMx-i32Q (32-cue XL4 module)',
  'FXK': 'FXK16 (16-cue)',
  'ESP32-Generic': 'ESP32 generic',
  'Unknown': 'Unknown model',
};

const MODEL_SHORT: Record<FxkModel, string> = {
  'FXK-M1': 'FXK-M1',
  'IFMx-i32Q': 'IFMx',
  'FXK': 'FXK16',
  'ESP32-Generic': 'ESP32',
  'Unknown': 'Unknown',
};

const TRANSPORT_ICON: Record<AggregatedTransport, typeof Radio> = {
  serial: Cable,
  usb: Usb,
  ble: Bluetooth,
  ble_lr: Bluetooth,
  websocket: Globe,
  wifi_direct: Wifi,
  two_wire: Cable,
  artnet: Globe,
  direct_relay: Radio,
};

const TRANSPORT_LABEL: Record<AggregatedTransport, string> = {
  serial: 'RS-485',
  usb: 'USB',
  ble: 'BLE',
  ble_lr: 'BLE-LR',
  websocket: 'WS',
  wifi_direct: 'Wi-Fi Direct',
  two_wire: '2-Wire',
  artnet: 'Art-Net',
  direct_relay: 'Relay',
};

type Freshness = 'online' | 'stale' | 'offline';

function freshness(lastSeen: number, now: number): Freshness {
  const age = now - lastSeen;
  if (age < 5_000) return 'online';
  if (age < 15_000) return 'stale';
  return 'offline';
}

const FRESH_TOKEN: Record<Freshness, { dot: string; label: string; text: string }> = {
  online: { dot: 'bg-[hsl(var(--success))]', label: 'ONLINE', text: 'text-[hsl(var(--success))]' },
  stale: { dot: 'bg-[hsl(var(--warning))]', label: 'STALE', text: 'text-[hsl(var(--warning))]' },
  offline: { dot: 'bg-[hsl(var(--destructive))]', label: 'OFFLINE', text: 'text-[hsl(var(--destructive))]' },
};

function matchesSearch(m: AggregatedModule, q: string): boolean {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    m.address.toString(),
    `#${m.address.toString().padStart(2, '0')}`,
    m.model,
    MODEL_SHORT[m.model] ?? '',
    MODEL_LABEL[m.model] ?? '',
    m.transport,
    TRANSPORT_LABEL[m.transport] ?? '',
    m.deviceName ?? '',
    m.controllerLabel ?? '',
    m.controllerId ?? '',
    m.firmware ?? '',
  ].join(' ').toLowerCase();
  return hay.includes(needle);
}

export function DetectedModulesPanel({ className }: { className?: string }) {
  const [modules, setModules] = useState<AggregatedModule[]>(() => moduleAggregator.list());
  const [now, setNow] = useState(() => Date.now());
  const [query, setQuery] = useState('');
  const [modelFilter, setModelFilter] = useState<Set<FxkModel>>(new Set());
  const [transportFilter, setTransportFilter] = useState<Set<AggregatedTransport>>(new Set());

  useEffect(() => {
    const unsub = moduleAggregator.subscribe(() => {
      setModules(moduleAggregator.list());
    });
    return unsub;
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const availableModels = useMemo(() => {
    const set = new Set<FxkModel>();
    for (const m of modules) set.add(m.model);
    return Array.from(set).sort();
  }, [modules]);

  const availableTransports = useMemo(() => {
    const set = new Set<AggregatedTransport>();
    for (const m of modules) set.add(m.transport);
    return Array.from(set).sort();
  }, [modules]);

  const filtered = useMemo(() => {
    return modules.filter(m =>
      (modelFilter.size === 0 || modelFilter.has(m.model)) &&
      (transportFilter.size === 0 || transportFilter.has(m.transport)) &&
      matchesSearch(m, query)
    );
  }, [modules, modelFilter, transportFilter, query]);

  const groups = useMemo(() => {
    const map = new Map<FxkModel, AggregatedModule[]>();
    for (const m of filtered) {
      const arr = map.get(m.model) ?? [];
      arr.push(m);
      map.set(m.model, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const onlineCount = filtered.filter(m => freshness(m.lastSeen, now) === 'online').length;
  const hasActiveFilters = query !== '' || modelFilter.size > 0 || transportFilter.size > 0;

  const toggle = <T,>(set: Set<T>, value: T, setter: (s: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  };

  const clearAll = () => {
    setQuery('');
    setModelFilter(new Set());
    setTransportFilter(new Set());
  };

  return (
    <section
      className={cn(
        'rounded-xl border border-[hsl(var(--border)/0.25)] bg-[hsl(var(--surface-0)/0.6)] p-3',
        className,
      )}
      aria-label="Módulos detectados"
    >
      <header className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
          <h3 className="text-[11px] font-bold tracking-wider uppercase text-foreground">
            Módulos Detectados
          </h3>
        </div>
        <span className="text-[9px] font-mono text-[hsl(var(--muted-foreground))]">
          {onlineCount}/{filtered.length} online
          {filtered.length !== modules.length ? ` · ${modules.length} total` : ''}
        </span>
      </header>

      {modules.length > 0 && (
        <div className="space-y-2 mb-2.5" data-testid="detected-modules-controls">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[hsl(var(--muted-foreground))]" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar por endereço, nome, firmware…"
              aria-label="Buscar módulos"
              data-testid="detected-modules-search"
              className="w-full pl-7 pr-7 py-1.5 text-[10px] font-mono rounded-md bg-[hsl(var(--surface-0)/0.8)] border border-[hsl(var(--border)/0.2)] text-foreground placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Limpar busca"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-[hsl(var(--muted-foreground))] hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Model chips */}
          {availableModels.length > 1 && (
            <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar por modelo">
              {availableModels.map(model => {
                const active = modelFilter.has(model);
                const count = modules.filter(m => m.model === model).length;
                return (
                  <button
                    key={model}
                    type="button"
                    onClick={() => toggle(modelFilter, model, setModelFilter)}
                    aria-pressed={active}
                    data-testid={`detected-modules-filter-model-${model}`}
                    className={cn(
                      'text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded border transition-colors',
                      active
                        ? 'bg-[hsl(var(--primary)/0.2)] border-[hsl(var(--primary)/0.6)] text-[hsl(var(--primary))]'
                        : 'bg-transparent border-[hsl(var(--border)/0.3)] text-[hsl(var(--muted-foreground))] hover:text-foreground',
                    )}
                  >
                    {MODEL_SHORT[model] ?? model} ×{count}
                  </button>
                );
              })}
            </div>
          )}

          {/* Transport chips */}
          {availableTransports.length > 1 && (
            <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar por transporte">
              {availableTransports.map(t => {
                const active = transportFilter.has(t);
                const TIcon = TRANSPORT_ICON[t];
                const count = modules.filter(m => m.transport === t).length;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggle(transportFilter, t, setTransportFilter)}
                    aria-pressed={active}
                    data-testid={`detected-modules-filter-transport-${t}`}
                    className={cn(
                      'inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded border transition-colors',
                      active
                        ? 'bg-[hsl(var(--primary)/0.2)] border-[hsl(var(--primary)/0.6)] text-[hsl(var(--primary))]'
                        : 'bg-transparent border-[hsl(var(--border)/0.3)] text-[hsl(var(--muted-foreground))] hover:text-foreground',
                    )}
                  >
                    <TIcon className="w-2.5 h-2.5" />
                    {TRANSPORT_LABEL[t]} ×{count}
                  </button>
                );
              })}
            </div>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAll}
              data-testid="detected-modules-clear-filters"
              className="text-[9px] font-mono uppercase tracking-wide text-[hsl(var(--muted-foreground))] hover:text-foreground underline"
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {modules.length === 0 ? (
        <p className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] italic py-3 text-center">
          Nenhum módulo detectado — pareie um controlador (XL4, FXK16, IFMx, Art-Net).
        </p>
      ) : filtered.length === 0 ? (
        <p
          className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] italic py-3 text-center"
          data-testid="detected-modules-no-match"
        >
          Nenhum módulo corresponde aos filtros.
        </p>
      ) : (
        <div className="space-y-3">
          {groups.map(([model, list]) => (
            <div key={model}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wide text-[hsl(var(--primary))]">
                  {MODEL_LABEL[model] ?? model}
                </span>
                <span className="text-[9px] font-mono text-[hsl(var(--muted-foreground))]">
                  ×{list.length}
                </span>
              </div>
              <ul className="space-y-1">
                {list.map(mod => {
                  const f = freshness(mod.lastSeen, now);
                  const tok = FRESH_TOKEN[f];
                  const TIcon = TRANSPORT_ICON[mod.transport];
                  return (
                    <li
                      key={mod.key}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-[hsl(var(--surface-0)/0.8)] border border-[hsl(var(--border)/0.15)]"
                      data-testid={`detected-module-${mod.key}`}
                    >
                      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', tok.dot)} aria-hidden />
                      <TIcon className="w-3 h-3 text-[hsl(var(--muted-foreground))] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-mono text-foreground truncate">
                          #{mod.address.toString().padStart(2, '0')}
                          {mod.deviceName ? ` · ${mod.deviceName}` : ''}
                          {mod.controllerLabel ? (
                            <span className="text-[hsl(var(--muted-foreground))]"> · {mod.controllerLabel}</span>
                          ) : null}
                        </div>
                        <div className="text-[9px] font-mono text-[hsl(var(--muted-foreground))]">
                          {TRANSPORT_LABEL[mod.transport]}
                          {mod.firmware ? ` · fw ${mod.firmware}` : ''}
                          {mod.rssi !== undefined ? ` · ${mod.rssi}dBm` : ''}
                          {' · '}{mod.channels}ch
                        </div>
                      </div>
                      <span
                        className={cn('text-[8px] font-bold tracking-widest shrink-0', tok.text)}
                        aria-label={`status ${tok.label}`}
                      >
                        {tok.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default DetectedModulesPanel;
