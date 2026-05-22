import { describe, it, expect } from 'vitest';
import { VENUE_SHOW_PRESETS } from '@/lib/showVenuePresets';
import {
  buildBoM,
  buildIcetWindow,
  buildPrefireMatrix,
  renderTechnicalLayerMarkdown,
} from '@/utils/joiTechnicalBriefing';

const preset = VENUE_SHOW_PRESETS.find((v) => v.id === 'reveillon-copacabana-12min')!;

describe('joiTechnicalBriefing', () => {
  it('buildBoM rows match launch points and have positive shells for non-drone roles', () => {
    const bom = buildBoM(preset);
    expect(bom.length).toBe(preset.venue.launchPoints.length);
    for (const r of bom) {
      expect(r.calibreMm).toBeGreaterThan(0);
      if (r.role !== 'drone-pad') expect(r.estShells).toBeGreaterThan(0);
    }
  });

  it('buildIcetWindow exposes T0 UTC, pre-roll, drift budget and per-beat offsets', () => {
    const w = buildIcetWindow(preset, '2026-01-01T03:00:00.000Z');
    expect(w.utcAnchor).toBe('2026-01-01T03:00:00.000Z');
    expect(w.preRollSec).toBeGreaterThan(0);
    expect(w.driftBudgetMs).toBeLessThanOrEqual(50);
    expect(w.beatOffsetsSec.length).toBe(preset.narrativeBeats.length);
  });

  it('buildPrefireMatrix scales lift with caliber and excludes drone-pads', () => {
    const m = buildPrefireMatrix(preset);
    expect(m.every((r) => r.liftTimeSec >= 3 && r.liftTimeSec <= 8)).toBe(true);
    expect(m.every((r) => r.pftSec >= r.liftTimeSec - 0.01)).toBe(true);
    expect(m.every((r) => r.measuredSec === +(r.delaySec + r.liftTimeSec).toFixed(2))).toBe(true);
  });

  it('renderTechnicalLayerMarkdown contains BoM, ICET and Prefire sections', () => {
    const md = renderTechnicalLayerMarkdown(preset);
    expect(md).toContain('Bill of Materials');
    expect(md).toContain('Janela de Sincronização ICET');
    expect(md).toContain('Prefire Matrix (Finale 3D)');
    expect(md).toContain('marketing_hypothesis');
  });
});
