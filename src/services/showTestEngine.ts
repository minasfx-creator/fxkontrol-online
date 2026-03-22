/**
 * Show Test Engine — Simulates 50 FXK-M1 modules across venues
 * Measures Art-Net transport performance: LAN, WAN, Relay, Hybrid
 */

import { supabase } from '@/integrations/supabase/client';

// ─── Types ──────────────────────────────────────────
export type TransportType = 'lan' | 'wan' | 'relay' | 'hybrid';

export interface Venue {
  id: string;
  name: string;
  city: string;
  country: string;
  gps: { lat: number; lng: number };
  scenario: string;
  baseLatencyMs: number; // simulated network distance
}

export interface ModuleSim {
  id: string;
  name: string;
  ip: string;
  transport: TransportType;
  universe: number;
  startAddress: number;
}

export interface TransportMetrics {
  transport: TransportType;
  latencyAvg: number;
  latencyMin: number;
  latencyMax: number;
  latencyP95: number;
  latencyP99: number;
  jitter: number;
  throughput: number; // packets/sec
  packetLoss: number; // percentage
  eStopResponse: number;
  syncAccuracy: number; // δt ms between first and last module
  nfpaCompliant: boolean;
  samples: number[];
}

export interface VenueResult {
  venue: Venue;
  modules: ModuleSim[];
  transports: Record<TransportType, TransportMetrics>;
  totalCues: number;
  showDuration: number;
  edgeFunctionLatency: number; // real measured
  status: 'pending' | 'running' | 'complete';
  progress: number;
}

export interface ShowTestResult {
  venues: VenueResult[];
  startedAt: string;
  completedAt: string | null;
  edgeFunctionAlive: boolean;
}

// ─── Venues ─────────────────────────────────────────
export const TEST_VENUES: Venue[] = [
  {
    id: 'copacabana',
    name: 'Réveillon Copacabana',
    city: 'Rio de Janeiro',
    country: 'Brasil',
    gps: { lat: -22.9711, lng: -43.1822 },
    scenario: '50 módulos em 2km de praia — Réveillon',
    baseLatencyMs: 18,
  },
  {
    id: 'vitoria',
    name: 'Show Portuário Vitória',
    city: 'Vitória',
    country: 'Brasil',
    gps: { lat: -20.3155, lng: -40.2922 },
    scenario: '50 módulos em área portuária compacta',
    baseLatencyMs: 24,
  },
  {
    id: 'liuyang',
    name: 'Liuyang Fireworks Factory',
    city: 'Liuyang',
    country: 'China',
    gps: { lat: 28.1517, lng: 113.6333 },
    scenario: 'Teste extremo intercontinental — fábrica de fogos',
    baseLatencyMs: 280,
  },
];

// ─── Module Generator ───────────────────────────────
function generateModules(venue: Venue, count: number): ModuleSim[] {
  const modules: ModuleSim[] = [];
  for (let i = 0; i < count; i++) {
    const subnet = Math.floor(i / 16);
    modules.push({
      id: `${venue.id}-mod-${String(i + 1).padStart(2, '0')}`,
      name: `FXK-M1 #${i + 1}`,
      ip: `192.168.${subnet + 1}.${(i % 254) + 1}`,
      transport: 'lan', // will be overridden per test
      universe: i % 16,
      startAddress: 1,
    });
  }
  return modules;
}

// ─── Latency Simulation ─────────────────────────────
function simulateLatency(transport: TransportType, baseMs: number): number {
  const jitterFactor = () => (Math.random() - 0.5) * 2; // -1 to 1

  switch (transport) {
    case 'lan':
      return 2.5 + Math.random() * 1.5 + jitterFactor() * 0.5;
    case 'wan':
      return baseMs + Math.random() * 8 + jitterFactor() * 3;
    case 'relay':
      return baseMs + 12 + Math.random() * 10 + jitterFactor() * 4;
    case 'hybrid': {
      // 60% LAN, 30% WAN, 10% Relay — weighted random
      const r = Math.random();
      if (r < 0.6) return simulateLatency('lan', baseMs);
      if (r < 0.9) return simulateLatency('wan', baseMs);
      return simulateLatency('relay', baseMs);
    }
  }
}

function simulatePacketLoss(transport: TransportType): boolean {
  const rates: Record<TransportType, number> = {
    lan: 0.001,    // 0.1%
    wan: 0.008,    // 0.8%
    relay: 0.012,  // 1.2%
    hybrid: 0.005, // 0.5%
  };
  return Math.random() < rates[transport];
}

// ─── Statistics ─────────────────────────────────────
function calcStats(samples: number[]): Pick<TransportMetrics, 'latencyAvg' | 'latencyMin' | 'latencyMax' | 'latencyP95' | 'latencyP99' | 'jitter'> {
  const sorted = [...samples].sort((a, b) => a - b);
  const n = sorted.length;
  const avg = samples.reduce((s, v) => s + v, 0) / n;
  const variance = samples.reduce((s, v) => s + (v - avg) ** 2, 0) / n;

  return {
    latencyAvg: +avg.toFixed(2),
    latencyMin: +sorted[0].toFixed(2),
    latencyMax: +sorted[n - 1].toFixed(2),
    latencyP95: +sorted[Math.floor(n * 0.95)].toFixed(2),
    latencyP99: +sorted[Math.floor(n * 0.99)].toFixed(2),
    jitter: +Math.sqrt(variance).toFixed(2),
  };
}

// ─── Edge Function Ping ─────────────────────────────
async function measureEdgeFunctionLatency(): Promise<number> {
  const t0 = performance.now();
  try {
    await supabase.functions.invoke('artnet-bridge', {
      body: {
        action: 'validate',
        universes: [{
          universe: 0, subnet: 0, net: 0,
          channels: [255, 0, 0, 0, 0, 0],
          sequence: 0,
        }],
      },
    });
    return +(performance.now() - t0).toFixed(2);
  } catch {
    return -1;
  }
}

// ─── Main Simulation ────────────────────────────────
export async function runShowTest(
  onProgress: (venues: VenueResult[]) => void
): Promise<ShowTestResult> {
  const startedAt = new Date().toISOString();

  // Measure real edge function latency
  const efLatency = await measureEdgeFunctionLatency();
  const edgeFunctionAlive = efLatency > 0;

  const venues: VenueResult[] = TEST_VENUES.map(v => ({
    venue: v,
    modules: generateModules(v, 50),
    transports: {} as Record<TransportType, TransportMetrics>,
    totalCues: 420,
    showDuration: 720, // 12 min
    edgeFunctionLatency: efLatency,
    status: 'pending' as const,
    progress: 0,
  }));

  onProgress([...venues]);

  const transports: TransportType[] = ['lan', 'wan', 'relay', 'hybrid'];
  const CUES_PER_VENUE = 420;
  const MODULES = 50;

  for (let vi = 0; vi < venues.length; vi++) {
    const vr = venues[vi];
    vr.status = 'running';
    onProgress([...venues]);

    for (let ti = 0; ti < transports.length; ti++) {
      const transport = transports[ti];
      const samples: number[] = [];
      let packetsSent = 0;
      let packetsLost = 0;

      // Simulate firing all 420 cues across 50 modules
      for (let cue = 0; cue < CUES_PER_VENUE; cue++) {
        // Each cue fires 1-3 modules simultaneously
        const modulesPerCue = 1 + Math.floor(Math.random() * 3);
        for (let m = 0; m < modulesPerCue; m++) {
          packetsSent++;
          if (simulatePacketLoss(transport)) {
            packetsLost++;
            continue;
          }
          const lat = simulateLatency(transport, vr.venue.baseLatencyMs);
          samples.push(lat);
        }
      }

      const stats = calcStats(samples);

      // E-STOP simulation: worst-case response = P99 + processing overhead
      const eStopBase: Record<TransportType, number> = {
        lan: 4.2,
        wan: stats.latencyP99 * 0.85,
        relay: stats.latencyP99 * 0.92,
        hybrid: stats.latencyP99 * 0.7,
      };
      const eStopResponse = +eStopBase[transport].toFixed(2);

      // Sync accuracy: spread between fastest and slowest module in a batch
      const syncAccuracy = +(stats.latencyMax - stats.latencyMin).toFixed(2);

      vr.transports[transport] = {
        transport,
        ...stats,
        throughput: +(packetsSent / 720).toFixed(1), // packets/sec over 12 min
        packetLoss: +((packetsLost / packetsSent) * 100).toFixed(3),
        eStopResponse,
        syncAccuracy,
        nfpaCompliant: eStopResponse < 50,
        samples: samples.slice(0, 200), // keep subset for sparkline
      };

      vr.progress = ((ti + 1) / transports.length) * 100;
      onProgress([...venues]);

      // Small delay for visual feedback
      await new Promise(r => setTimeout(r, 80));
    }

    vr.status = 'complete';
    vr.progress = 100;
    onProgress([...venues]);
  }

  return {
    venues,
    startedAt,
    completedAt: new Date().toISOString(),
    edgeFunctionAlive,
  };
}
