/**
 * DMX Heatmap Data — pure aggregator.
 * Reads ShowPlan dmxCues + FixtureAddressing and returns a per-universe
 * 512-channel intensity map (0..1) for live preview overlay.
 *
 * Pure / read-only. Computed on demand by the overlay component.
 */
import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { fixtureAddressing } from '@/core/protocols/FixtureAddressing';

export interface UniverseHeatmap {
  universe: number;
  /** 512-length Float32Array, normalized 0..1 (cue value / 255 max). */
  intensities: Float32Array;
  /** Counts per channel (cues + fixture footprints). */
  ownership: Uint8Array;
  channelsUsed: number;
  hottestChannel: number;
  hottestValue: number;
}

export function buildDmxHeatmap(): UniverseHeatmap[] {
  const plan = showPlanManager.current;
  const cues = plan.dmxCues ?? [];
  const fixtures = fixtureAddressing.getAll();

  const map = new Map<number, UniverseHeatmap>();
  const ensure = (u: number): UniverseHeatmap => {
    let h = map.get(u);
    if (!h) {
      h = {
        universe: u,
        intensities: new Float32Array(512),
        ownership: new Uint8Array(512),
        channelsUsed: 0,
        hottestChannel: 0,
        hottestValue: 0,
      };
      map.set(u, h);
    }
    return h;
  };

  // Fixture footprints contribute baseline ownership (intensity 0.15).
  for (const f of fixtures) {
    if (f.universe < 0) continue;
    const h = ensure(f.universe);
    for (let i = 0; i < f.channelCount; i++) {
      const ch = f.startChannel + i;
      if (ch < 1 || ch > 512) continue;
      const idx = ch - 1;
      if (h.ownership[idx] === 0) h.intensities[idx] = Math.max(h.intensities[idx], 0.15);
      h.ownership[idx] = Math.min(255, h.ownership[idx] + 1);
    }
  }

  // Cues drive the intensity (value/255 normalized).
  for (const cue of cues) {
    if (cue.universe < 0 || cue.channel < 1 || cue.channel > 512) continue;
    const h = ensure(cue.universe);
    const idx = cue.channel - 1;
    const norm = Math.max(0, Math.min(1, (cue.value ?? 0) / 255));
    if (norm > h.intensities[idx]) h.intensities[idx] = norm;
    h.ownership[idx] = Math.min(255, h.ownership[idx] + 1);
  }

  // Finalize stats.
  for (const h of map.values()) {
    let used = 0;
    let hottestCh = 0;
    let hottestVal = 0;
    for (let i = 0; i < 512; i++) {
      if (h.ownership[i] > 0) used++;
      if (h.intensities[i] > hottestVal) {
        hottestVal = h.intensities[i];
        hottestCh = i + 1;
      }
    }
    h.channelsUsed = used;
    h.hottestChannel = hottestCh;
    h.hottestValue = hottestVal;
  }

  return Array.from(map.values()).sort((a, b) => a.universe - b.universe);
}

/** Get color for a normalized intensity 0..1 — Vantablack→Cyan→Amber→Red. */
export function intensityToColor(v: number): string {
  const n = Math.max(0, Math.min(1, v));
  if (n < 0.001) return 'hsl(220 30% 8%)';
  if (n < 0.25) {
    // dim cyan
    const a = (n / 0.25) * 0.6 + 0.2;
    return `hsl(190 80% ${20 + n * 30}% / ${a})`;
  }
  if (n < 0.6) {
    return `hsl(170 90% ${30 + n * 25}%)`;
  }
  if (n < 0.85) {
    return `hsl(45 95% ${40 + n * 20}%)`;
  }
  return `hsl(0 90% ${45 + n * 15}%)`;
}
