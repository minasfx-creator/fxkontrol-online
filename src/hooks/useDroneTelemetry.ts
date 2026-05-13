/**
 * ─── useDroneTelemetry ────────────────────────────────────────────
 * Real-only telemetria do swarm de drones. Lê `deviceAggregator` filtrando
 * por famílias drone (futuro `kind: 'drone-link'` — hoje aceitamos qualquer
 * família que case a regex `/drone|swarm|skybrush/i` enquanto o
 * controllerRegistry não declara `drone-link` formalmente).
 *
 * Honest-Hardware Layer compatible:
 *   • Sem device verificado → `live: false`, arrays vazios.
 *   • NUNCA gera dados sintéticos. Se um adapter de drone real existir e
 *     emitir telemetria via deviceAggregator + provenance live_read_only,
 *     o hook reflete; caso contrário, o painel pai mostra empty state.
 *
 * Roadmap: quando o adapter MAVLink/Skybrush for plugado em deviceAggregator,
 * basta estender o filtro abaixo p/ casar a `family` correta.
 */
import { useEffect, useState } from 'react';
import { deviceAggregator } from '@/core/discovery/DeviceAggregator';
import type { PhysicalDevice } from '@/core/discovery/types';

export interface DroneSample {
  id: number;
  alt: number;
  speed: number;
  heading: number;
  battery: number;
}

export interface DroneWindReading {
  dirDeg: number;
  speedMps: number;
  /** Lock estimado pelo aggregator (true só com link estável). */
  formationLock: boolean;
}

export interface DroneTelemetrySnapshot {
  /** True quando há ao menos um device drone online com link verificado. */
  live: boolean;
  /** Quantidade de drones reportados pelo link real. */
  fleetSize: number;
  samples: DroneSample[];
  wind: DroneWindReading | null;
}

const EMPTY: DroneTelemetrySnapshot = {
  live: false,
  fleetSize: 0,
  samples: [],
  wind: null,
};

const DRONE_FAMILY_RE = /drone|swarm|skybrush|mavlink/i;

function isDroneDevice(d: PhysicalDevice): boolean {
  if (!d.online) return false;
  for (const link of Object.values(d.links)) {
    if (!link) continue;
    if (link.family && DRONE_FAMILY_RE.test(link.family)) return true;
    if (link.label && DRONE_FAMILY_RE.test(link.label)) return true;
  }
  return false;
}

function readSnapshot(): DroneTelemetrySnapshot {
  const droneDevices = deviceAggregator.getDevices().filter(isDroneDevice);
  if (droneDevices.length === 0) return EMPTY;

  // Real adapter integration pending. Until a real drone adapter publishes
  // structured telemetry through deviceAggregator metadata, we surface
  // ONLY presence/count — not synthetic values.
  return {
    live: true,
    fleetSize: droneDevices.length,
    samples: [],
    wind: null,
  };
}

export function useDroneTelemetry(): DroneTelemetrySnapshot {
  const [snap, setSnap] = useState<DroneTelemetrySnapshot>(() => readSnapshot());

  useEffect(() => {
    let mounted = true;
    const tick = () => { if (mounted) setSnap(readSnapshot()); };
    tick();
    const off = deviceAggregator.watch(tick);
    return () => {
      mounted = false;
      try { off(); } catch { /* noop */ }
    };
  }, []);

  return snap;
}

export default useDroneTelemetry;
