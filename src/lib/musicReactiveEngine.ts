/**
 * Music-Reactive Engine
 * Real-time audio analysis for driving visual intensity during playback.
 * Also provides onset-driven cue placement for pyrotechnics.
 */

import type { AudioAnalysisResult, Beat, Onset } from './audioAnalyzer';

export interface CuePlacement {
  time: number;
  effectId: string;
  positionId?: string;
  strength: number;        // 0-1
  source: 'beat' | 'onset' | 'peak';
  onsetType?: Onset['type'];
}

export interface ReactiveState {
  intensity: number;       // 0-1 overall energy
  bassIntensity: number;   // 0-1 low freq
  midIntensity: number;    // 0-1 mid freq
  highIntensity: number;   // 0-1 high freq
  isBeat: boolean;
  isOnset: boolean;
  bpm: number;
}

/**
 * Generate automatic cue placements from audio analysis.
 */
export function generateCuePlacements(
  analysis: AudioAnalysisResult,
  options: {
    mode: 'beats' | 'onsets' | 'peaks' | 'combined';
    effectIds: string[];
    positionIds: string[];
    minInterval: number;      // min seconds between cues
    sensitivity: number;      // 0-1
    startTime: number;
    endTime: number;
    beatDivisor: number;      // 1 = every beat, 2 = every 2 beats, 4 = every measure
    onsetTypes: Onset['type'][];
    distributePositions: boolean; // cycle through positions
    distributeEffects: boolean;   // cycle through effects
  }
): CuePlacement[] {
  const placements: CuePlacement[] = [];
  const { mode, effectIds, positionIds, minInterval, sensitivity, startTime, endTime, beatDivisor, onsetTypes, distributePositions, distributeEffects } = options;

  if (effectIds.length === 0) return [];

  let candidates: { time: number; strength: number; source: CuePlacement['source']; onsetType?: Onset['type'] }[] = [];

  // Collect candidates based on mode
  if (mode === 'beats' || mode === 'combined') {
    analysis.beats.forEach((b, i) => {
      if (i % beatDivisor === 0 && b.time >= startTime && b.time <= endTime) {
        candidates.push({ time: b.time, strength: b.strength, source: 'beat' });
      }
    });
  }

  if (mode === 'onsets' || mode === 'combined') {
    const threshold = (1 - sensitivity) * 0.15;
    analysis.onsets
      .filter(o => o.time >= startTime && o.time <= endTime)
      .filter(o => o.energy > threshold)
      .filter(o => onsetTypes.length === 0 || onsetTypes.includes(o.type))
      .forEach(o => {
        candidates.push({ time: o.time, strength: Math.min(1, o.energy * 5), source: 'onset', onsetType: o.type });
      });
  }

  if (mode === 'peaks' || mode === 'combined') {
    analysis.peakTimes
      .filter(t => t >= startTime && t <= endTime)
      .forEach(t => {
        candidates.push({ time: t, strength: 1, source: 'peak' });
      });
  }

  // Sort by time and enforce minimum interval
  candidates.sort((a, b) => a.time - b.time);
  const filtered: typeof candidates = [];
  let lastTime = -Infinity;
  for (const c of candidates) {
    if (c.time - lastTime >= minInterval) {
      filtered.push(c);
      lastTime = c.time;
    }
  }

  // Create placements with distribution
  filtered.forEach((c, i) => {
    const effectId = distributeEffects
      ? effectIds[i % effectIds.length]
      : effectIds[0];
    const positionId = distributePositions && positionIds.length > 0
      ? positionIds[i % positionIds.length]
      : positionIds[0];

    placements.push({
      time: c.time,
      effectId,
      positionId,
      strength: c.strength,
      source: c.source,
      onsetType: c.onsetType,
    });
  });

  return placements;
}

/**
 * Get reactive state at a given time from pre-computed analysis.
 * Used during playback to modulate visual intensity.
 */
export function getReactiveState(
  analysis: AudioAnalysisResult,
  time: number,
  lookAhead: number = 0.05
): ReactiveState {
  // Find nearest frequency band
  const freq = analysis.frequencies.reduce((best, f) =>
    Math.abs(f.time - time) < Math.abs(best.time - time) ? f : best,
    analysis.frequencies[0] || { time: 0, low: 0, mid: 0, high: 0 }
  );

  const maxE = Math.max(freq.low + freq.mid + freq.high, 0.001);

  // Check if we're on a beat
  const isBeat = analysis.beats.some(b => Math.abs(b.time - time) < lookAhead);
  const isOnset = analysis.onsets.some(o => Math.abs(o.time - time) < lookAhead);

  // Find nearest beat strength
  const nearestBeat = analysis.beats.reduce((best, b) =>
    Math.abs(b.time - time) < Math.abs(best.time - time) ? b : best,
    analysis.beats[0] || { time: 0, strength: 0 }
  );
  const beatProximity = Math.max(0, 1 - Math.abs(nearestBeat.time - time) * 4);

  return {
    intensity: Math.min(1, (freq.low + freq.mid + freq.high) * 3 + beatProximity * 0.3),
    bassIntensity: Math.min(1, freq.low * 5),
    midIntensity: Math.min(1, freq.mid * 5),
    highIntensity: Math.min(1, freq.high * 5),
    isBeat,
    isOnset,
    bpm: analysis.bpm,
  };
}

/**
 * Map onset types to suggested effect categories.
 */
export const ONSET_EFFECT_MAP: Record<Onset['type'], string[]> = {
  kick: ['morteiros', 'mines'],           // Big impacts → big effects
  snare: ['peonias', 'cakes_batteries'],  // Sharp hits → bursts
  'hi-hat': ['roman_candles', 'sfx'],     // High freq → sparkle effects
  transient: ['waterfalls', 'iluminacao'], // Generic → ambient
};
