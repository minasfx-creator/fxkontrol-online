/**
 * ─── Environment Engine ─────────────────────────────────────────────
 * Live weather + tide data for Angra dos Reis (default).
 * Smooth interpolation between samples. Fallback to last known state.
 * Feeds wind, tide, atmosphere into simulation engine.
 */

export interface EnvironmentState {
  // Wind
  windSpeed: number;       // m/s
  windDirection: number;   // degrees (0=N, 90=E)
  windVector: [number, number, number]; // world-space XYZ

  // Atmosphere
  humidity: number;        // 0-100 %
  pressure: number;        // hPa
  temperature: number;     // °C
  visibility: number;      // km
  atmosphericDensity: number; // kg/m³ (default ~1.225)

  // Tide
  tideLevel: number;       // meters relative to mean sea level
  tideDirection: 'rising' | 'falling' | 'slack';
  seaState: number;        // 0-9 Douglas scale

  // Fog
  fogDensity: number;      // 0-1

  // Timestamps
  lastUpdate: number;
  dataAge: number;         // seconds since last fresh data
}

const DEFAULT_STATE: EnvironmentState = {
  windSpeed: 3.0,
  windDirection: 180,
  windVector: [0, 0, 0.3],
  humidity: 70,
  pressure: 1013.25,
  temperature: 25,
  visibility: 10,
  atmosphericDensity: 1.225,
  tideLevel: 0,
  tideDirection: 'slack',
  seaState: 1,
  fogDensity: 0,
  lastUpdate: Date.now(),
  dataAge: 0,
};

// Default coords: Angra dos Reis, RJ, Brazil
const DEFAULT_LAT = -23.0067;
const DEFAULT_LNG = -44.3183;

class EnvironmentEngine {
  private current: EnvironmentState = { ...DEFAULT_STATE };
  private target: EnvironmentState = { ...DEFAULT_STATE };
  private lerpSpeed = 0.02; // interpolation rate per tick
  private refreshIntervalMs = 30_000;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private lat = DEFAULT_LAT;
  private lng = DEFAULT_LNG;
  private listeners = new Set<(state: EnvironmentState) => void>();
  private _running = false;

  /** Start auto-refresh loop */
  start(lat?: number, lng?: number): void {
    if (lat !== undefined) this.lat = lat;
    if (lng !== undefined) this.lng = lng;
    if (this._running) return;
    this._running = true;

    this.fetchAll();
    this.refreshTimer = setInterval(() => this.fetchAll(), this.refreshIntervalMs);
    console.log('[Environment] Engine started — auto-refresh every 30s');
  }

  stop(): void {
    this._running = false;
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /** Update coordinates */
  setCoordinates(lat: number, lng: number): void {
    this.lat = lat;
    this.lng = lng;
    if (this._running) this.fetchAll();
  }

  /** Interpolate current toward target — call from render loop (~60Hz) */
  tick(): EnvironmentState {
    const s = this.lerpSpeed;
    this.current.windSpeed = lerp(this.current.windSpeed, this.target.windSpeed, s);
    this.current.windDirection = lerpAngle(this.current.windDirection, this.target.windDirection, s);
    this.current.humidity = lerp(this.current.humidity, this.target.humidity, s);
    this.current.pressure = lerp(this.current.pressure, this.target.pressure, s);
    this.current.temperature = lerp(this.current.temperature, this.target.temperature, s);
    this.current.visibility = lerp(this.current.visibility, this.target.visibility, s);
    this.current.atmosphericDensity = lerp(this.current.atmosphericDensity, this.target.atmosphericDensity, s);
    this.current.tideLevel = lerp(this.current.tideLevel, this.target.tideLevel, s);
    this.current.seaState = lerp(this.current.seaState, this.target.seaState, s);
    this.current.fogDensity = lerp(this.current.fogDensity, this.target.fogDensity, s);

    // Recompute wind vector from interpolated speed/direction
    const rad = (this.current.windDirection * Math.PI) / 180;
    const ws = this.current.windSpeed * 0.1; // scale for scene units
    this.current.windVector = [
      Math.sin(rad) * ws,
      0,
      Math.cos(rad) * ws,
    ];

    this.current.dataAge = (Date.now() - this.current.lastUpdate) / 1000;
    return this.current;
  }

  getState(): EnvironmentState {
    return { ...this.current };
  }

  /** Subscribe to state changes after fetch */
  onChange(cb: (state: EnvironmentState) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** Force manual state (for testing/override) */
  setManual(partial: Partial<EnvironmentState>): void {
    Object.assign(this.target, partial);
    Object.assign(this.current, partial);
    this.notify();
  }

  private async fetchAll(): Promise<void> {
    await Promise.all([
      this.fetchWeather(),
      this.fetchTide(),
    ]);
    this.notify();
  }

  private async fetchWeather(): Promise<void> {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${this.lat}&longitude=${this.lng}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,visibility&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Weather API ${res.status}`);
      const data = await res.json();
      const c = data.current;

      this.target.windSpeed = c.wind_speed_10m ?? this.target.windSpeed;
      this.target.windDirection = c.wind_direction_10m ?? this.target.windDirection;
      this.target.humidity = c.relative_humidity_2m ?? this.target.humidity;
      this.target.pressure = c.surface_pressure ?? this.target.pressure;
      this.target.temperature = c.temperature_2m ?? this.target.temperature;
      this.target.visibility = (c.visibility ?? 10000) / 1000; // m to km

      // Atmospheric density from pressure and temperature (ideal gas approx)
      const T = this.target.temperature + 273.15;
      this.target.atmosphericDensity = (this.target.pressure * 100) / (287.05 * T);

      // Fog density from visibility
      this.target.fogDensity = Math.max(0, Math.min(1, 1 - this.target.visibility / 15));

      this.target.lastUpdate = Date.now();
      console.log('[Environment] Weather updated');
    } catch (e) {
      console.warn('[Environment] Weather fetch failed — holding last state:', e);
    }
  }

  private async fetchTide(): Promise<void> {
    try {
      const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${this.lat}&longitude=${this.lng}&hourly=wave_height,wave_direction&timezone=auto&forecast_days=1`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Tide API ${res.status}`);
      const data = await res.json();
      const hourly = data.hourly;

      if (hourly?.wave_height?.length) {
        const now = new Date();
        const currentHour = now.getHours();
        const waveH = hourly.wave_height[currentHour] ?? 0.5;

        // Approximate tide level from wave patterns
        const tidePhase = Math.sin((currentHour / 12.42) * Math.PI * 2); // ~12.42h tidal period
        this.target.tideLevel = tidePhase * 0.8; // ±0.8m variation

        this.target.tideDirection = tidePhase > 0.1 ? 'rising' : tidePhase < -0.1 ? 'falling' : 'slack';

        // Douglas sea state from wave height
        this.target.seaState = Math.min(9, Math.round(waveH * 2));
      }

      console.log('[Environment] Tide updated');
    } catch (e) {
      console.warn('[Environment] Tide fetch failed — holding last state:', e);
    }
  }

  private notify(): void {
    const state = this.getState();
    for (const l of this.listeners) {
      try { l(state); } catch { /* no-op */ }
    }
  }

  reset(): void {
    this.stop();
    this.current = { ...DEFAULT_STATE };
    this.target = { ...DEFAULT_STATE };
  }
}

// ── Helpers ───────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return a + diff * t;
}

export const environmentEngine = new EnvironmentEngine();
