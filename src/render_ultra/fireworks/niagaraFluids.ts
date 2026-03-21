/**
 * FX KONTROL · Niagara Fluids Simulation
 * UE5.7-inspired GPU-style 2D fluid grid for smoke/fog advection.
 * Velocity field + density transport with diffusion, dissipation, and wind forcing.
 */

export interface FluidGrid {
  width: number;
  height: number;
  /** Velocity X component per cell */
  velX: Float32Array;
  /** Velocity Y component per cell */
  velY: Float32Array;
  /** Density (smoke/fog) per cell */
  density: Float32Array;
  /** Temperature per cell (drives buoyancy) */
  temperature: Float32Array;
  /** Scratch buffers for double-buffering */
  _velX0: Float32Array;
  _velY0: Float32Array;
  _density0: Float32Array;
  _temp0: Float32Array;
}

export interface FluidConfig {
  diffusion: number;      // 0-0.001 viscosity/diffusion rate
  dissipation: number;    // 0.95-1.0 density dissipation per step (1 = no loss)
  tempDissipation: number;
  buoyancy: number;       // upward force from temperature
  vorticityConfinement: number; // curl enhancement for swirls
  cellSize: number;       // world units per cell
}

const DEFAULT_CONFIG: FluidConfig = {
  diffusion: 0.00005,
  dissipation: 0.985,
  tempDissipation: 0.99,
  buoyancy: 0.8,
  vorticityConfinement: 0.3,
  cellSize: 2.0,
};

/** Create a new fluid simulation grid */
export function createFluidGrid(width = 64, height = 64): FluidGrid {
  const n = width * height;
  return {
    width, height,
    velX: new Float32Array(n),
    velY: new Float32Array(n),
    density: new Float32Array(n),
    temperature: new Float32Array(n),
    _velX0: new Float32Array(n),
    _velY0: new Float32Array(n),
    _density0: new Float32Array(n),
    _temp0: new Float32Array(n),
  };
}

function idx(x: number, y: number, w: number): number {
  return y * w + x;
}

function clampIdx(v: number, max: number): number {
  return v < 0 ? 0 : v >= max ? max - 1 : v;
}

/** Gauss-Seidel relaxation for diffusion */
function diffuse(
  dest: Float32Array, src: Float32Array,
  w: number, h: number, diff: number, dt: number, iterations = 4
) {
  const a = dt * diff * w * h;
  const div = 1 + 4 * a;
  for (let k = 0; k < iterations; k++) {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = idx(x, y, w);
        dest[i] = (src[i] + a * (
          dest[idx(x - 1, y, w)] + dest[idx(x + 1, y, w)] +
          dest[idx(x, y - 1, w)] + dest[idx(x, y + 1, w)]
        )) / div;
      }
    }
  }
}

/** Semi-Lagrangian advection */
function advect(
  dest: Float32Array, src: Float32Array,
  velX: Float32Array, velY: Float32Array,
  w: number, h: number, dt: number, dissipation: number
) {
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = idx(x, y, w);
      // Trace back
      let px = x - dt * w * velX[i];
      let py = y - dt * h * velY[i];
      px = Math.max(0.5, Math.min(w - 1.5, px));
      py = Math.max(0.5, Math.min(h - 1.5, py));

      const x0 = Math.floor(px);
      const y0 = Math.floor(py);
      const x1 = x0 + 1;
      const y1 = y0 + 1;
      const sx = px - x0;
      const sy = py - y0;

      dest[i] = dissipation * (
        (1 - sx) * ((1 - sy) * src[idx(x0, y0, w)] + sy * src[idx(x0, y1, w)]) +
        sx * ((1 - sy) * src[idx(x1, y0, w)] + sy * src[idx(x1, y1, w)])
      );
    }
  }
}

/** Apply buoyancy: temperature drives upward velocity */
function applyBuoyancy(
  velY: Float32Array, temperature: Float32Array, density: Float32Array,
  w: number, h: number, buoyancy: number, dt: number
) {
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = idx(x, y, w);
      // Temperature pushes up, density pulls down (weight)
      velY[i] += dt * (buoyancy * temperature[i] - 0.05 * density[i]);
    }
  }
}

/** Pressure projection to enforce incompressibility */
function project(velX: Float32Array, velY: Float32Array, w: number, h: number, iterations = 6) {
  const n = w * h;
  const div_arr = new Float32Array(n);
  const p = new Float32Array(n);

  // Compute divergence
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = idx(x, y, w);
      div_arr[i] = -0.5 * (
        velX[idx(x + 1, y, w)] - velX[idx(x - 1, y, w)] +
        velY[idx(x, y + 1, w)] - velY[idx(x, y - 1, w)]
      );
    }
  }

  // Solve pressure Poisson
  for (let k = 0; k < iterations; k++) {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = idx(x, y, w);
        p[i] = (div_arr[i] +
          p[idx(x - 1, y, w)] + p[idx(x + 1, y, w)] +
          p[idx(x, y - 1, w)] + p[idx(x, y + 1, w)]
        ) / 4;
      }
    }
  }

  // Subtract pressure gradient
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = idx(x, y, w);
      velX[i] -= 0.5 * (p[idx(x + 1, y, w)] - p[idx(x - 1, y, w)]);
      velY[i] -= 0.5 * (p[idx(x, y + 1, w)] - p[idx(x, y - 1, w)]);
    }
  }
}

/**
 * Full advection step: diffuse → advect → project for both velocity and density.
 */
export function advectFluid(grid: FluidGrid, dt: number, config?: Partial<FluidConfig>) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const { width: w, height: h } = grid;

  // Swap buffers
  grid._velX0.set(grid.velX);
  grid._velY0.set(grid.velY);
  grid._density0.set(grid.density);
  grid._temp0.set(grid.temperature);

  // Velocity: diffuse → advect → project
  diffuse(grid.velX, grid._velX0, w, h, cfg.diffusion, dt);
  diffuse(grid.velY, grid._velY0, w, h, cfg.diffusion, dt);
  project(grid.velX, grid.velY, w, h);

  grid._velX0.set(grid.velX);
  grid._velY0.set(grid.velY);

  advect(grid.velX, grid._velX0, grid._velX0, grid._velY0, w, h, dt, 1.0);
  advect(grid.velY, grid._velY0, grid._velX0, grid._velY0, w, h, dt, 1.0);
  project(grid.velX, grid.velY, w, h);

  // Buoyancy
  applyBuoyancy(grid.velY, grid.temperature, grid.density, w, h, cfg.buoyancy, dt);

  // Density: diffuse → advect (with dissipation)
  diffuse(grid.density, grid._density0, w, h, cfg.diffusion, dt);
  grid._density0.set(grid.density);
  advect(grid.density, grid._density0, grid.velX, grid.velY, w, h, dt, cfg.dissipation);

  // Temperature: advect with dissipation
  advect(grid.temperature, grid._temp0, grid.velX, grid.velY, w, h, dt, cfg.tempDissipation);
}

/** Inject density at a world position (mapped to grid coords) */
export function injectDensity(
  grid: FluidGrid, worldX: number, worldZ: number,
  amount: number, radius: number, cellSize = 2.0
) {
  const cx = Math.floor(worldX / cellSize + grid.width / 2);
  const cy = Math.floor(worldZ / cellSize + grid.height / 2);
  const r = Math.ceil(radius / cellSize);

  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const gx = clampIdx(cx + dx, grid.width);
      const gy = clampIdx(cy + dy, grid.height);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= r) {
        const falloff = 1 - dist / (r + 0.01);
        grid.density[idx(gx, gy, grid.width)] += amount * falloff * falloff;
      }
    }
  }
}

/** Inject velocity impulse at a world position */
export function injectVelocity(
  grid: FluidGrid, worldX: number, worldZ: number,
  vx: number, vy: number, radius: number, cellSize = 2.0
) {
  const cx = Math.floor(worldX / cellSize + grid.width / 2);
  const cy = Math.floor(worldZ / cellSize + grid.height / 2);
  const r = Math.ceil(radius / cellSize);

  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const gx = clampIdx(cx + dx, grid.width);
      const gy = clampIdx(cy + dy, grid.height);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= r) {
        const falloff = 1 - dist / (r + 0.01);
        const i = idx(gx, gy, grid.width);
        grid.velX[i] += vx * falloff;
        grid.velY[i] += vy * falloff;
      }
    }
  }
}

/** Inject temperature at a position (drives buoyancy → upward smoke drift) */
export function injectTemperature(
  grid: FluidGrid, worldX: number, worldZ: number,
  temp: number, radius: number, cellSize = 2.0
) {
  const cx = Math.floor(worldX / cellSize + grid.width / 2);
  const cy = Math.floor(worldZ / cellSize + grid.height / 2);
  const r = Math.ceil(radius / cellSize);

  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const gx = clampIdx(cx + dx, grid.width);
      const gy = clampIdx(cy + dy, grid.height);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= r) {
        const falloff = 1 - dist / (r + 0.01);
        grid.temperature[idx(gx, gy, grid.width)] += temp * falloff;
      }
    }
  }
}

/** Read density at a world position (for fog/smoke opacity queries) */
export function readDensityAt(grid: FluidGrid, worldX: number, worldZ: number, cellSize = 2.0): number {
  const gx = Math.floor(worldX / cellSize + grid.width / 2);
  const gy = Math.floor(worldZ / cellSize + grid.height / 2);
  if (gx < 0 || gx >= grid.width || gy < 0 || gy >= grid.height) return 0;
  return grid.density[idx(gx, gy, grid.width)];
}

/** Apply uniform wind force across entire grid */
export function applyWindForce(grid: FluidGrid, windX: number, windZ: number, dt: number) {
  const n = grid.width * grid.height;
  for (let i = 0; i < n; i++) {
    grid.velX[i] += windX * dt;
    grid.velY[i] += windZ * dt;
  }
}

/** Reset grid to zero state */
export function clearFluidGrid(grid: FluidGrid) {
  grid.velX.fill(0);
  grid.velY.fill(0);
  grid.density.fill(0);
  grid.temperature.fill(0);
}
