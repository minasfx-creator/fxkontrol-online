/**
 * ─── Sound Level Engine ────────────────────────────────────────────
 * Calculates predicted sound pressure levels (dB SPL) from pyrotechnic
 * effects based on caliber, distance, and atmospheric conditions.
 * NFPA 1123 / ISO 17201 reference for aerial shell noise modeling.
 */

export interface SoundEvent {
  time: number;         // seconds
  peakDB: number;       // dB(A) at measurement point
  caliber: number;      // inches
  effectName: string;
  distance: number;     // meters from measurement point
  type: 'burst' | 'lift' | 'crackle' | 'report' | 'whistle';
}

export interface SoundLevelFrame {
  time: number;
  dbA: number;          // A-weighted SPL
  dbC: number;          // C-weighted SPL (low freq emphasis)
  dbLin: number;        // linear (unweighted)
  peakDB: number;       // peak hold for this frame
  leq: number;          // equivalent continuous level up to this point
  events: number;       // number of concurrent events
}

export interface SoundLevelResult {
  frames: SoundLevelFrame[];
  peakDB: number;
  peakTime: number;
  leq: number;          // overall Leq
  duration: number;
  exceedances: { time: number; db: number; limit: number }[];
}

// Reference sound power levels by caliber (dB at 1m) — based on research
const CALIBER_DB_REF: Record<number, number> = {
  2: 138,
  3: 144,
  4: 148,
  5: 152,
  6: 155,
  8: 160,
  10: 164,
  12: 168,
};

function caliberToDB(caliberInches: number): number {
  const known = Object.entries(CALIBER_DB_REF).map(([k, v]) => [Number(k), v] as [number, number]);
  if (caliberInches <= known[0][0]) return known[0][1];
  if (caliberInches >= known[known.length - 1][0]) return known[known.length - 1][1];
  for (let i = 0; i < known.length - 1; i++) {
    if (caliberInches >= known[i][0] && caliberInches <= known[i + 1][0]) {
      const t = (caliberInches - known[i][0]) / (known[i + 1][0] - known[i][0]);
      return known[i][1] + t * (known[i + 1][1] - known[i][1]);
    }
  }
  return 150;
}

/** Inverse square law with atmospheric absorption */
function attenuateDB(refDB: number, distance: number, freqHz = 1000): number {
  if (distance <= 1) return refDB;
  // Geometric spreading: -20*log10(d)
  const geometric = 20 * Math.log10(distance);
  // Atmospheric absorption ~0.005 dB/m at 1kHz, 20°C, 50%RH
  const atmospheric = distance * 0.005 * (freqHz / 1000);
  return refDB - geometric - atmospheric;
}

/** A-weighting correction (simplified) */
function aWeighting(dbLin: number, dominantFreqHz = 500): number {
  // Approximate A-weighting at given frequency
  const f = dominantFreqHz;
  const ra = (12194 ** 2 * f ** 4) /
    ((f ** 2 + 20.6 ** 2) * Math.sqrt((f ** 2 + 107.7 ** 2) * (f ** 2 + 737.9 ** 2)) * (f ** 2 + 12194 ** 2));
  const aCorr = 20 * Math.log10(ra) + 2;
  return dbLin + aCorr;
}

/** C-weighting correction (simplified) */
function cWeighting(dbLin: number, dominantFreqHz = 500): number {
  const f = dominantFreqHz;
  const rc = (12194 ** 2 * f ** 2) / ((f ** 2 + 20.6 ** 2) * (f ** 2 + 12194 ** 2));
  const cCorr = 20 * Math.log10(rc) + 0.06;
  return dbLin + cCorr;
}

/** Combine multiple sound sources (energy addition) */
function combineLevels(levels: number[]): number {
  if (levels.length === 0) return 0;
  const sum = levels.reduce((acc, db) => acc + Math.pow(10, db / 10), 0);
  return 10 * Math.log10(sum);
}

export interface AnalysisConfig {
  measurementDistance: number;  // meters from center of show
  frameRate: number;           // analysis frames per second
  noiseFloor: number;          // ambient dB
  regulatoryLimit: number;     // dB(A) limit
  burstDecayMs: number;        // how fast a burst decays
}

export const DEFAULT_ANALYSIS_CONFIG: AnalysisConfig = {
  measurementDistance: 100,
  frameRate: 30,
  noiseFloor: 40,
  regulatoryLimit: 120,
  burstDecayMs: 800,
};

interface EffectInput {
  startTime: number;
  effectName: string;
  caliber: number;       // inches, 0 if unknown
  duration: number;       // seconds
  position: { x: number; y: number; z: number };
  hasReport?: boolean;
  hasCrackle?: boolean;
  hasWhistle?: boolean;
}

export function analyzeSoundLevels(
  effects: EffectInput[],
  showDuration: number,
  config: AnalysisConfig = DEFAULT_ANALYSIS_CONFIG,
): SoundLevelResult {
  const dt = 1 / config.frameRate;
  const frameCount = Math.ceil(showDuration * config.frameRate);
  const frames: SoundLevelFrame[] = [];
  const exceedances: { time: number; db: number; limit: number }[] = [];
  let overallPeak = config.noiseFloor;
  let overallPeakTime = 0;
  let leqSum = 0;

  // Pre-compute sound events from effects
  const events: SoundEvent[] = [];
  for (const eff of effects) {
    const cal = eff.caliber > 0 ? eff.caliber : 3;
    const dist = Math.max(10, Math.sqrt(
      (eff.position.x) ** 2 + (eff.position.z) ** 2
    ));
    // Lift sound
    events.push({
      time: eff.startTime,
      peakDB: attenuateDB(caliberToDB(cal) - 20, Math.max(dist, config.measurementDistance)),
      caliber: cal,
      effectName: eff.effectName,
      distance: dist,
      type: 'lift',
    });
    // Burst sound (after prefire)
    const pft = cal * 0.4 + 0.5;
    events.push({
      time: eff.startTime + pft,
      peakDB: attenuateDB(caliberToDB(cal), config.measurementDistance),
      caliber: cal,
      effectName: eff.effectName,
      distance: config.measurementDistance,
      type: 'burst',
    });
    // Extra: crackle / report tail
    if (eff.hasCrackle || eff.hasReport) {
      events.push({
        time: eff.startTime + pft + 0.3,
        peakDB: attenuateDB(caliberToDB(cal) - 5, config.measurementDistance),
        caliber: cal,
        effectName: eff.effectName,
        distance: config.measurementDistance,
        type: eff.hasReport ? 'report' : 'crackle',
      });
    }
  }

  const decaySec = config.burstDecayMs / 1000;

  for (let f = 0; f < frameCount; f++) {
    const t = f * dt;
    const activeLevels: number[] = [config.noiseFloor];
    let eventCount = 0;

    for (const ev of events) {
      const elapsed = t - ev.time;
      if (elapsed < 0 || elapsed > decaySec * 2) continue;
      // Exponential decay from peak
      const decay = Math.exp(-elapsed / (decaySec * 0.3)) * (1 - elapsed / (decaySec * 2));
      if (decay <= 0) continue;
      const level = ev.peakDB + 10 * Math.log10(Math.max(0.001, decay));
      if (level > config.noiseFloor) {
        activeLevels.push(level);
        eventCount++;
      }
    }

    const dbLin = combineLevels(activeLevels);
    const dbA = aWeighting(dbLin);
    const dbC = cWeighting(dbLin);

    if (dbA > overallPeak) {
      overallPeak = dbA;
      overallPeakTime = t;
    }

    leqSum += Math.pow(10, dbA / 10);

    if (dbA > config.regulatoryLimit) {
      // Only log exceedance if not already logged within 0.5s
      const last = exceedances[exceedances.length - 1];
      if (!last || t - last.time > 0.5) {
        exceedances.push({ time: t, db: dbA, limit: config.regulatoryLimit });
      }
    }

    frames.push({
      time: t,
      dbA,
      dbC,
      dbLin,
      peakDB: overallPeak,
      leq: 10 * Math.log10(leqSum / (f + 1)),
      events: eventCount,
    });
  }

  return {
    frames,
    peakDB: overallPeak,
    peakTime: overallPeakTime,
    leq: frames.length > 0 ? frames[frames.length - 1].leq : config.noiseFloor,
    duration: showDuration,
    exceedances,
  };
}
