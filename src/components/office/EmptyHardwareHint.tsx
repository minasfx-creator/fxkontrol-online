/**
 * EmptyHardwareHint — honest empty state for hardware-zero context.
 * Pure presentation. Never arms / fires / mutates workMode.
 */
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Cable, Radar, ArrowRight, Loader2 } from 'lucide-react';
import { deviceAggregator } from '@/core/discovery/DeviceAggregator';
import { unifiedDiscovery } from '@/core/discovery/UnifiedDiscoveryService';

export default function EmptyHardwareHint() {
  const [onlineCount, setOnlineCount] = useState(0);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    const recompute = () => {
      try {
        setOnlineCount(deviceAggregator.getDevices().filter((d) => d.online).length);
      } catch {
        setOnlineCount(0);
      }
    };
    recompute();
    const unsub = deviceAggregator.watch(recompute);
    return () => { try { unsub(); } catch { /* noop */ } };
  }, []);

  const handleScan = useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    try {
      const fn = (unifiedDiscovery as unknown as { scanLight?: () => Promise<unknown> }).scanLight;
      if (typeof fn === 'function') await fn.call(unifiedDiscovery);
    } catch {
      /* swallow — discovery is best-effort */
    } finally {
      setScanning(false);
    }
  }, [scanning]);

  if (onlineCount > 0) return null;

  return (
    <section
      role="status"
      aria-live="polite"
      data-testid="empty-hardware-hint"
      className="rounded-md border border-border/40 bg-card/60 px-4 py-3 mb-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-status-sync/10 border border-status-sync/20 shrink-0">
          <Cable className="h-4 w-4 text-status-sync" aria-hidden />
        </div>
        <div className="flex-1 min-w-[220px]">
          <p className="text-sm font-medium text-foreground">Nenhum hardware detectado</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Conecte FXK16, FireOne, Art-Net ou DMX-USB para ver módulos reais — sem dados simulados.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleScan}
            disabled={scanning}
            className="inline-flex items-center gap-2 rounded-md border border-status-sync/40 bg-status-sync/5 px-3 py-1.5 text-xs font-medium text-status-sync hover:bg-status-sync/15 disabled:opacity-50 transition-colors"
            aria-label="Iniciar descoberta de hardware"
          >
            {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radar className="h-3.5 w-3.5" />}
            {scanning ? 'Escaneando…' : 'Iniciar Discovery'}
          </button>
          <Link
            to="/pairing"
            className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Pareamento <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
