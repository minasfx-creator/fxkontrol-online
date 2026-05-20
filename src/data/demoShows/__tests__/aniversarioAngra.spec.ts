import { describe, it, expect } from 'vitest';
import {
  buildAniversarioAngraShow,
  ANIVERSARIO_ANGRA_ID,
  ANIVERSARIO_ANGRA_DURATION_S,
} from '../aniversarioAngraDemo';
import { exportFinaleFiringCSV, exportFullShowJSON, FINALE_FIRING_HEADER_COLUMNS, FULL_SHOW_SCHEMA } from '@/lib/exportEngine';

describe('Aniversário Angra demo seed', () => {
  const plan = buildAniversarioAngraShow();

  it('has 110 pyro cues across 4 modules and 2 positions', () => {
    expect(plan.metadata.id).toBe(ANIVERSARIO_ANGRA_ID);
    expect(plan.pyroCues.length).toBe(110);
    expect(plan.positions.map((p) => p.name).sort()).toEqual(['P-01', 'P-02']);
    expect(plan.hardwareConfig.modules.length).toBe(4);
    expect(ANIVERSARIO_ANGRA_DURATION_S).toBeGreaterThanOrEqual(220);
  });

  it('P-01 and P-02 are at canonical X offsets', () => {
    const p1 = plan.positions.find((p) => p.name === 'P-01')!;
    const p2 = plan.positions.find((p) => p.name === 'P-02')!;
    expect(p1.x).toBeCloseTo(-49.15, 1);
    expect(p2.x).toBeCloseTo(51.85, 1);
  });

  it('Finale firing CSV round-trips header + 110 data rows', () => {
    const items = plan.pyroCues.map((c) => ({
      id: c.id, effectId: c.effectId, startTime: c.time, trackIndex: 0,
      position: c.position, positionName: c.positionId,
      cueHeading: c.heading, cuePitch: c.elevation,
      notes: c.notes, rack: c.rack, tube: c.tube,
      universe: String(c.module),
    }));
    const positions = plan.positions.map((p) => ({
      id: p.id, name: p.name, type: 'pyro' as const,
      x: p.x, y: p.y, z: p.z, heading: 0, pitch: 0, roll: 0, color: '#FF6B35',
    }));
    const csv = exportFinaleFiringCSV(items, positions);
    const lines = csv.split('\n');
    expect(lines[0]).toBe(FINALE_FIRING_HEADER_COLUMNS.join(','));
    expect(lines.length - 1).toBe(110);
    expect(lines[1].startsWith('FIRING_DATA_ROW,')).toBe(true);
  });

  it('Full JSON export tags schema and counts', () => {
    const json = JSON.parse(exportFullShowJSON({
      projectName: plan.metadata.name,
      duration: plan.metadata.duration,
      positions: plan.positions.map((p) => ({
        id: p.id, name: p.name, type: 'pyro' as const,
        x: p.x, y: p.y, z: p.z, heading: 0, pitch: 0, roll: 0, color: '#FF6B35',
      })),
      timelineItems: [],
      trajectories: [],
      droneFormations: [],
    }));
    expect(json.schema).toBe(FULL_SHOW_SCHEMA);
    expect(json.counts.positions).toBe(2);
  });
});
