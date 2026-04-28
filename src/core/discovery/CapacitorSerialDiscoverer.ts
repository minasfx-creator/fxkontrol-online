/**
 * ─── Capacitor Serial Discoverer ───────────────────────────────────
 * Bridge para o plugin `@capacitor-community/serial` (ou
 * `cordova-plugin-usbserial` como fallback). Roda APENAS em build
 * nativo Capacitor (iOS/Android) — em PWA degrada graciosamente para
 * `isSupported() === false` sem quebrar o build web.
 *
 * Lazy import: o módulo do plugin é carregado dinamicamente apenas
 * quando estamos em ambiente nativo, evitando erro de "module not
 * found" no `npm install` do Lovable web.
 *
 * Read-only: enumera dispositivos visíveis. Abertura/IO acontece nos
 * adapters específicos (PBUS, DMX, etc.).
 */

import { logger } from '@/lib/logger';
import { detectPlatformCapabilities } from '@/lib/platformCapabilities';
import { keyFor, portRegistry } from './portRegistry';
import type { DiscoveredDevice, DiscoveryEvent, TransportDiscoverer } from './types';

interface CapSerialDevice {
  deviceId: string | number;
  vendorId?: number;
  productId?: number;
  manufacturerName?: string;
  productName?: string;
  serialNumber?: string;
}

interface CapSerialPlugin {
  listDevices: () => Promise<{ devices: CapSerialDevice[] }>;
  // Eventos opcionais — nem todos os plugins suportam
  addListener?: (
    event: 'attach' | 'detach',
    cb: (d: CapSerialDevice) => void,
  ) => Promise<{ remove: () => Promise<void> }>;
}

let _pluginPromise: Promise<CapSerialPlugin | null> | null = null;

async function loadPlugin(): Promise<CapSerialPlugin | null> {
  if (_pluginPromise) return _pluginPromise;
  _pluginPromise = (async () => {
    const caps = detectPlatformCapabilities();
    if (!caps.capacitorNative) return null;
    // Tenta resolver via window.Capacitor.Plugins primeiro (não falha o build web)
    const cap = (window as unknown as {
      Capacitor?: { Plugins?: { Serial?: CapSerialPlugin; UsbSerial?: CapSerialPlugin } };
    }).Capacitor;
    const plugin = cap?.Plugins?.Serial ?? cap?.Plugins?.UsbSerial ?? null;
    if (!plugin) {
      logger.info(
        '[CapacitorSerialDiscoverer] Plugin não encontrado — instale @capacitor-community/serial e rode `npx cap sync`.',
      );
      return null;
    }
    return plugin;
  })();
  return _pluginPromise;
}

function deviceToDiscovered(d: CapSerialDevice): DiscoveredDevice {
  const vid = d.vendorId;
  const pid = d.productId;
  const registryKey = keyFor({ vendorId: vid, productId: pid, serialNumber: d.serialNumber });
  const id = `capserial:${registryKey}`;
  const persisted = portRegistry.get(registryKey);
  const label =
    d.productName?.trim() ||
    persisted?.lastLabel ||
    (vid != null
      ? `Native Serial ${vid.toString(16).padStart(4, '0')}:${(pid ?? 0).toString(16).padStart(4, '0')}`
      : `Native Serial ${d.deviceId}`);

  portRegistry.recordSuccess({
    vendorId: vid,
    productId: pid,
    serialNumber: d.serialNumber,
    label,
  });

  return {
    // Mapeado para o transport `webserial` para que os adapters reaproveitem
    // o pipeline existente sem precisar de um novo branch.
    id,
    transport: 'webserial',
    label,
    vendorId: vid,
    productId: pid,
    recognized: vid != null,
    authorized: true, // Capacitor já passou pela permissão MFi/USB Host
    online: true,
    family: 'capacitor-native',
    lastSeen: Date.now(),
    metadata: {
      manufacturer: d.manufacturerName,
      serialNumber: d.serialNumber,
      capacitorDeviceId: String(d.deviceId),
      operatorConfirmedGeneric: persisted?.operatorConfirmedGeneric === true,
    },
  };
}

class CapacitorSerialDiscoverer implements TransportDiscoverer {
  readonly id = 'webserial' as const; // compat com pipeline existente
  private _devices = new Map<string, DiscoveredDevice>();
  private _listeners = new Set<(ev: DiscoveryEvent) => void>();
  private _attached = false;
  private _pluginCache: CapSerialPlugin | null = null;

  isSupported(): boolean {
    return detectPlatformCapabilities().capacitorSerial;
  }

  async scan(): Promise<DiscoveredDevice[]> {
    if (!this.isSupported()) return [];
    const plugin = (this._pluginCache ??= await loadPlugin());
    if (!plugin) return [];
    await this._ensureHotPlug(plugin);
    try {
      const { devices } = await plugin.listDevices();
      const seen = new Set<string>();
      for (const raw of devices ?? []) {
        const dev = deviceToDiscovered(raw);
        seen.add(dev.id);
        const prev = this._devices.get(dev.id);
        this._devices.set(dev.id, dev);
        this._emit({ type: prev ? 'updated' : 'discovered', device: dev });
      }
      for (const [id, dev] of this._devices) {
        if (!seen.has(id)) {
          this._devices.delete(id);
          this._emit({ type: 'lost', device: { ...dev, online: false } });
        }
      }
      return this.getDevices();
    } catch (e) {
      logger.warn('[CapacitorSerialDiscoverer] listDevices failed', e);
      return this.getDevices();
    }
  }

  watch(listener: (ev: DiscoveryEvent) => void): () => void {
    this._listeners.add(listener);
    return () => { this._listeners.delete(listener); };
  }

  getDevices(): DiscoveredDevice[] {
    return Array.from(this._devices.values());
  }

  private async _ensureHotPlug(plugin: CapSerialPlugin): Promise<void> {
    if (this._attached || !plugin.addListener) return;
    try {
      await plugin.addListener('attach', d => {
        const dev = deviceToDiscovered(d);
        this._devices.set(dev.id, dev);
        this._emit({ type: 'discovered', device: dev });
        logger.info('[CapacitorSerialDiscoverer] hot-plug attach', dev.id);
      });
      await plugin.addListener('detach', d => {
        const k = keyFor({ vendorId: d.vendorId, productId: d.productId, serialNumber: d.serialNumber });
        const id = `capserial:${k}`;
        const dev = this._devices.get(id);
        if (dev) {
          this._devices.delete(id);
          this._emit({ type: 'lost', device: { ...dev, online: false } });
          logger.info('[CapacitorSerialDiscoverer] hot-plug detach', id);
        }
      });
      this._attached = true;
    } catch (e) {
      logger.warn('[CapacitorSerialDiscoverer] hot-plug attach failed', e);
    }
  }

  private _emit(ev: DiscoveryEvent): void {
    for (const fn of this._listeners) {
      try { fn(ev); } catch (e) { logger.warn('[CapacitorSerialDiscoverer] listener err', e); }
    }
  }
}

export const capacitorSerialDiscoverer = new CapacitorSerialDiscoverer();
