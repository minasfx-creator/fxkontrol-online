/**
 * ─── Turbulent Wind Field ───────────────────────────────────────────
 * Procedural wind with base direction, gusts, and Perlin-like turbulence.
 * Produces time-varying, spatially coherent wind vectors.
 * 
 * Wind influence by particle type:
 *   smoke  → 100%
 *   embers → 60%
 *   shells → 20%
 */

// ── Hash-based pseudo-noise (no dependencies) ───────────────────────

function hash(x: number): number {
  const s = Math.sin(x * 127.1 + x * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function smoothNoise(t: number): number {
  const i = Math.floor(t);
  const f = t - i;
  const u = f * f * (3 - 2 * f); // smoothstep
  return hash(i) * (1 - u) + hash(i + 1) * u;
}

/** Multi-octave noise for natural turbulence */
function fbm(t: number, octaves = 3): number {
  let val = 0;
  let amp = 1;
  let freq = 1;
  let total = 0;
  for (let i = 0; i < octaves; i++) {
    val += smoothNoise(t * freq) * amp;
    total += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return val / total;
}

// ── Wind influence multipliers ──────────────────────────────────────

export type WindParticleType = 'smoke' | 'ember' | 'shell' | 'spark_light' | 'spark_heavy';

const WIND_INFLUENCE: Record<WindParticleType, number> = {
  smoke:       1.00,
  ember:       0.60,
  spark_light: 0.50,
  shell:       0.20,
  spark_heavy: 0.15,
};

// ── Wind Field Configuration ────────────────────────────────────────

export interface WindFieldConfig {
  /** Base wind speed in m/s (0–8) */
  baseSpeed: number;
  /** Wind direction in degrees (0 = north, 90 = east) */
  directionDeg: number;
  /** Max gust additional speed (0–3 m/s) */
  gustMax: number;
  /** Gust frequency (events/second, ~0.1–0.5) */
  gustFrequency: number;
  /** Turbulence intensity (0–1) */
  turbulenceIntensity: number;
  /** Turbulence spatial scale (lower = more local variation) */
  turbulenceScale: number;
  /** Enable altitude-based wind shearing (default true) */
  altitudeShearing: boolean;
}

const DEFAULT_CONFIG: WindFieldConfig = {
  baseSpeed: 2.0,
  directionDeg: 45,
  gustMax: 1.5,
  gustFrequency: 0.2,
  turbulenceIntensity: 0.3,
  turbulenceScale: 0.05,
  altitudeShearing: true,
};

// ── Wind Field Class ────────────────────────────────────────────────

class WindField {
  private config: WindFieldConfig;
  private time = 0;

  constructor(config: Partial<WindFieldConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Update internal clock */
  tick(dt: number): void {
    this.time += dt;
  }

  /** Configure wind parameters at runtime */
  setConfig(partial: Partial<WindFieldConfig>): void {
    Object.assign(this.config, partial);
  }

  getConfig(): Readonly<WindFieldConfig> {
    return this.config;
  }

  /**
   * Sample wind force at a world position and time.
   * Returns [wx, wy, wz] in m/s.
   */
  sample(
    x: number, y: number, z: number,
    particleType: WindParticleType = 'ember',
  ): [number, number, number] {
    const { baseSpeed, directionDeg, gustMax, gustFrequency, turbulenceIntensity, turbulenceScale, altitudeShearing } = this.config;
    const influence = WIND_INFLUENCE[particleType];

    // Altitude shearing: wind strength and direction vary by height
    let altMult = 1.0;
    let dirOffset = 0; // degrees
    if (altitudeShearing) {
      if (y < 50) {
        altMult = 0.3 + (y / 50) * 0.2; // 0.3–0.5 near ground
      } else if (y < 150) {
        altMult = 0.5 + ((y - 50) / 100) * 0.5; // 0.5–1.0
      } else if (y < 400) {
        altMult = 1.0; // nominal
      } else {
        altMult = 1.0 + Math.min(0.3, (y - 400) / 1000); // 1.0–1.3
        dirOffset = Math.min(15, (y - 400) / 100 * 2.5); // up to 15° rotation
      }
    }

    // Base wind direction with altitude shearing rotation
    const rad = ((directionDeg + dirOffset) * Math.PI) / 180;
    const effectiveSpeed = baseSpeed * altMult;
    const baseX = Math.sin(rad) * effectiveSpeed;
    const baseZ = Math.cos(rad) * effectiveSpeed;

    // Gusts: low-frequency noise modulating speed
    const gustNoise = fbm(this.time * gustFrequency + 17.3, 2);
    const gustFactor = gustNoise * gustMax * altMult;
    const gustX = Math.sin(rad) * gustFactor;
    const gustZ = Math.cos(rad) * gustFactor;

    // Turbulence: spatially varying high-frequency noise
    const turbScale = turbulenceScale;
    const turbX = (fbm(x * turbScale + this.time * 0.7 + 0.0, 3) - 0.5) * 2 * turbulenceIntensity * effectiveSpeed;
    const turbY = (fbm(y * turbScale + this.time * 0.5 + 33.7, 3) - 0.5) * 2 * turbulenceIntensity * effectiveSpeed * 0.3;
    const turbZ = (fbm(z * turbScale + this.time * 0.6 + 77.1, 3) - 0.5) * 2 * turbulenceIntensity * effectiveSpeed;

    return [
      (baseX + gustX + turbX) * influence,
      turbY * influence,
      (baseZ + gustZ + turbZ) * influence,
    ];
  }

  /**
   * Simple global wind (no spatial variation).
   * Used by systems that don't need per-position sampling.
   */
  getGlobalWind(particleType: WindParticleType = 'ember'): [number, number, number] {
    return this.sample(0, 50, 0, particleType);
  }

  /** Get current time for external use */
  getTime(): number {
    return this.time;
  }
}

export const windField = new WindField();
