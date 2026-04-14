/**
 * ─── WindFieldSystem ────────────────────────────────────────────────
 * Layered wind with vertical shear + micro-turbulence.
 * 
 * 3 altitude layers:
 *   Low  (0-80m)   — ground-level, turbulent, slow
 *   Mid  (80-200m) — main wind, moderate
 *   High (200m+)   — upper wind, fast, stable
 * 
 * Features:
 *   - Per-layer direction, speed, gust variance
 *   - Smooth interpolation between layers (vertical shear)
 *   - Micro-turbulence via curl noise approximation
 *   - Macro drift: slow sinusoidal wind direction shift
 */

export interface WindLayer {
  altitudeMin: number;
  altitudeMax: number;
  direction: number;     // degrees
  speed: number;         // m/s
  gustVariance: number;  // 0-1
}

export interface WindFieldConfig {
  layers: WindLayer[];
  turbulenceIntensity: number;  // 0-1
  macroDriftSpeed: number;      // degrees/second
  macroDriftAmplitude: number;  // degrees
}

const DEFAULT_CONFIG: WindFieldConfig = {
  layers: [
    { altitudeMin: 0, altitudeMax: 80, direction: 45, speed: 2.0, gustVariance: 0.4 },
    { altitudeMin: 80, altitudeMax: 200, direction: 60, speed: 5.0, gustVariance: 0.25 },
    { altitudeMin: 200, altitudeMax: 9999, direction: 75, speed: 8.0, gustVariance: 0.15 },
  ],
  turbulenceIntensity: 0.3,
  macroDriftSpeed: 2.0,
  macroDriftAmplitude: 15.0,
};

export class WindFieldSystem {
  private config: WindFieldConfig;

  constructor(config?: Partial<WindFieldConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setConfig(config: Partial<WindFieldConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * Set base wind from project settings.
   */
  setBaseWind(directionDeg: number, speed: number, gustStrength: number): void {
    const layers = this.config.layers;
    // Scale layers relative to base
    layers[0].direction = directionDeg - 15;
    layers[0].speed = speed * 0.4;
    layers[0].gustVariance = gustStrength * 0.5;
    layers[1].direction = directionDeg;
    layers[1].speed = speed;
    layers[1].gustVariance = gustStrength * 0.3;
    layers[2].direction = directionDeg + 15;
    layers[2].speed = speed * 1.6;
    layers[2].gustVariance = gustStrength * 0.2;
  }

  /**
   * Sample wind at a world position. Writes into out array (zero-GC).
   */
  sample(
    x: number, y: number, z: number,
    time: number,
    includeTurbulence: boolean,
    out: [number, number, number],
  ): void {
    const alt = Math.max(0, y);

    // Find surrounding layers and interpolate
    const layers = this.config.layers;
    let windDir = layers[0].direction;
    let windSpeed = layers[0].speed;
    let gustVar = layers[0].gustVariance;

    for (let i = 0; i < layers.length - 1; i++) {
      const lo = layers[i];
      const hi = layers[i + 1];
      if (alt >= lo.altitudeMin && alt < hi.altitudeMax) {
        const range = hi.altitudeMin - lo.altitudeMin;
        const t = range > 0 ? Math.min(1, (alt - lo.altitudeMin) / range) : 0;
        // Smooth interpolation
        const smooth = t * t * (3 - 2 * t); // smoothstep
        windDir = lo.direction + (hi.direction - lo.direction) * smooth;
        windSpeed = lo.speed + (hi.speed - lo.speed) * smooth;
        gustVar = lo.gustVariance + (hi.gustVariance - lo.gustVariance) * smooth;
        break;
      }
    }
    // If above all layers, use highest
    if (alt >= layers[layers.length - 1].altitudeMin) {
      const top = layers[layers.length - 1];
      windDir = top.direction;
      windSpeed = top.speed;
      gustVar = top.gustVariance;
    }

    // Macro drift
    const drift = this.config.macroDriftAmplitude * Math.sin(time * this.config.macroDriftSpeed * 0.01);
    windDir += drift;

    // Gust modulation
    const gustPhase = time * 1.7 + x * 0.003 + z * 0.005;
    const gust = 1.0 + gustVar * Math.sin(gustPhase) * Math.sin(gustPhase * 0.37);
    windSpeed *= gust;

    // Direction to vector
    const dirRad = (windDir * Math.PI) / 180;
    out[0] = Math.sin(dirRad) * windSpeed;
    out[1] = 0; // no vertical wind component (buoyancy is separate)
    out[2] = Math.cos(dirRad) * windSpeed;

    // Micro-turbulence (cheap curl noise approximation)
    if (includeTurbulence && this.config.turbulenceIntensity > 0) {
      const ti = this.config.turbulenceIntensity * windSpeed * 0.3;
      const px = x * 0.02 + time * 0.5;
      const py = y * 0.03 + time * 0.3;
      const pz = z * 0.02 + time * 0.4;
      // Cheap 3D hash-based turbulence
      out[0] += ti * (Math.sin(px * 1.3 + py * 0.7) + Math.sin(pz * 2.1) * 0.5);
      out[1] += ti * 0.3 * Math.sin(py * 1.7 + px * 0.9);
      out[2] += ti * (Math.cos(pz * 1.1 + py * 0.6) + Math.cos(px * 1.8) * 0.5);
    }
  }

  /**
   * Get config for debug display / calibration panel.
   */
  getConfig(): Readonly<WindFieldConfig> {
    return this.config;
  }

  /**
   * Reset to defaults.
   */
  reset(): void {
    this.config = { ...DEFAULT_CONFIG };
  }
}

/** Global wind field instance */
export const globalWindField = new WindFieldSystem();
