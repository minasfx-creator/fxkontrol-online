/**
 * ─── GenericCSVToShowPlan — Generic CSV → ShowPlan ──────────────────
 * Best-effort normalization of arbitrary CSV data into ShowPlan positions and pyro cues.
 */

import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import type { PyroCue, ShowPosition } from '@/core/showplan/ShowPlan';
import { blackbox } from '@/core/reliability/blackBoxRecorder';

export interface GenericCSVParsedRow {
  name?: string;
  type?: string;
  x: number;
  y: number;
  z: number;
  heading?: number;
  pitch?: number;
  time?: number;
  module?: number;
  channel?: number;
  effectId?: string;
  caliber?: number;
  section?: string;
}

export interface GenericCSVImportResult {
  positions: ShowPosition[];
  pyroCues: PyroCue[];
  errors: string[];
}

export function importGenericCSVToShowPlan(rows: GenericCSVParsedRow[]): GenericCSVImportResult {
  const errors: string[] = [];
  const positions: ShowPosition[] = [];
  const pyroCues: PyroCue[] = [];

  rows.forEach((row, idx) => {
    const id = `csv-${idx}`;
    const posType = (row.type === 'drone-pad' || row.type === 'light') ? row.type : 'pyro' as const;

    positions.push({
      id,
      name: row.name || `Position ${idx + 1}`,
      type: posType,
      x: row.x,
      y: row.y,
      z: row.z,
      heading: row.heading ?? 0,
      pitch: row.pitch ?? 90,
      section: row.section,
    });

    // If row has timing info, create a pyro cue
    if (row.time != null && row.time >= 0) {
      pyroCues.push({
        id: `csv-cue-${idx}`,
        time: row.time,
        positionId: id,
        module: row.module ?? Math.floor(idx / 32),
        channel: row.channel ?? (idx % 32),
        effectId: row.effectId || 'default',
        fuseDelay: 0,
        caliber: row.caliber ?? 75,
        elevation: row.pitch ?? 90,
        heading: row.heading ?? 0,
        position: { x: row.x, y: row.y, z: row.z },
        section: row.section,
      });
    }
  });

  // Merge into ShowPlan
  const sp = { ...showPlanManager.current };
  sp.positions = [...sp.positions, ...positions];
  sp.pyroCues = [...sp.pyroCues, ...pyroCues];
  if (pyroCues.length > 0) {
    const maxT = Math.max(...pyroCues.map(c => c.time));
    sp.metadata = { ...sp.metadata, duration: Math.max(sp.metadata.duration, maxT), updatedAt: Date.now() };
  }
  showPlanManager.load(sp as any);

  blackbox.record('import', `GenericCSVToShowPlan: ${positions.length} positions, ${pyroCues.length} cues, ${errors.length} errors`);

  return { positions, pyroCues, errors };
}
