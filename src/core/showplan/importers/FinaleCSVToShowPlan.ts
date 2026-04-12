/**
 * ─── FinaleCSVToShowPlan — Finale 3D CSV → ShowPlan PyroCues ────────
 * Parses Finale 3D CSV format and normalizes into canonical PyroCue entries.
 */

import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import type { PyroCue, DMXCue } from '@/core/showplan/ShowPlan';
import { blackbox } from '@/core/reliability/blackBoxRecorder';

export interface FinaleCSVRow {
  time: number;        // seconds
  module: number;
  channel: number;
  effectId: string;
  caliber: number;     // mm
  elevation: number;   // degrees
  heading: number;     // degrees
  fuseDelay: number;   // ms
  position: { x: number; y: number; z: number };
  positionName?: string;
  rack?: number;
  tube?: number;
  section?: string;
  universe?: number;
  dmxChannel?: number;
  dmxValue?: number;
}

export interface FinaleImportResult {
  pyroCues: PyroCue[];
  dmxCues: DMXCue[];
  errors: string[];
}

export function importFinaleCSVToShowPlan(rows: FinaleCSVRow[]): FinaleImportResult {
  const errors: string[] = [];
  const pyroCues: PyroCue[] = [];
  const dmxCues: DMXCue[] = [];

  rows.forEach((row, idx) => {
    // Validation
    if (row.channel < 0 || row.channel > 31) {
      errors.push(`Row ${idx + 1}: channel ${row.channel} out of range 0-31`);
    }
    if (row.time < 0) {
      errors.push(`Row ${idx + 1}: negative time ${row.time}`);
    }

    const posId = `pos-${row.module}-${row.channel}-${idx}`;

    pyroCues.push({
      id: `finale-pyro-${idx}`,
      time: row.time,
      positionId: posId,
      module: row.module,
      channel: row.channel,
      effectId: row.effectId || 'default',
      fuseDelay: row.fuseDelay || 0,
      caliber: row.caliber || 75,
      elevation: row.elevation || 90,
      heading: row.heading || 0,
      position: row.position,
      rack: row.rack,
      tube: row.tube,
      section: row.section,
    });

    // If row has DMX info, also create a DMX cue
    if (row.universe != null && row.dmxChannel != null) {
      dmxCues.push({
        id: `finale-dmx-${idx}`,
        time: row.time,
        universe: row.universe,
        channel: row.dmxChannel,
        value: row.dmxValue ?? 255,
        duration: 1,
        curve: 'linear',
      });
    }
  });

  // Merge into ShowPlan
  const sp = { ...showPlanManager.current };
  sp.pyroCues = pyroCues;
  sp.dmxCues = [...sp.dmxCues, ...dmxCues];
  const allTimes = [...pyroCues.map(c => c.time), ...dmxCues.map(c => c.time)];
  sp.metadata = { ...sp.metadata, duration: Math.max(sp.metadata.duration, ...allTimes, 0), updatedAt: Date.now() };
  showPlanManager.load(sp as any);

  blackbox.record('state', `FinaleCSVToShowPlan: ${pyroCues.length} pyro, ${dmxCues.length} dmx, ${errors.length} errors`);

  return { pyroCues, dmxCues, errors };
}
