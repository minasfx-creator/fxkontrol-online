/**
 * ─── Firework Physics Engine ────────────────────────────────────────
 * Real ballistic simulation: gravity + quadratic air drag + wind influence.
 * 1 unit = 1 meter. Feeds visual renderer with active shell positions.
 * 
 * Calibrated against NFPA 1123 / pyroPhysics.ts lookup tables.
 */

import { getMortarVelocity, getLiftTime, GRAVITY, AIR_DRAG } from '@/lib/pyroPhysics';

export interface FireworkShell {
  id: number;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  alive: boolean;
  fuseRemaining: number;  // seconds until burst
  caliber: number;        // mm
  caliberInches: number;  // inches (derived)
  color: [number, number, number];
}

const FUSE_VARIANCE = 0.05;  // ±5% fuse randomness (real pyro tolerance)
const SHELL_WIND_FACTOR = 0.20; // shells receive 20% wind influence (heavy mass)
const SHELL_DRAG = 0.025;    // shell body drag coefficient (heavy, aerodynamic)

let nextId = 0;

class FireworkEngine {
  private shells: FireworkShell[] = [];
  private pool: FireworkShell[] = []; // object pool to reduce GC
  private listeners = new Set<(shell: FireworkShell) => void>();

  /** Launch a shell from position with given fuse time and caliber */
  spawn(
    x: number, y: number, z: number,
    opts: { fuse?: number; caliber?: number; launchSpeed?: number; color?: [number, number, number] } = {},
  ): FireworkShell {
    const caliberMm = opts.caliber ?? 75;
    const caliberInches = caliberMm / 25.4;

    // Use caliber-based velocity from NFPA tables if no explicit speed
    const baseSpeed = opts.launchSpeed ?? getMortarVelocity(caliberInches);

    // Fuse time: use caliber-based lift time if not explicit, ±5% variance
    const baseFuse = opts.fuse ?? getLiftTime(caliberInches);
    const fuse = baseFuse * (1 + (Math.random() - 0.5) * 2 * FUSE_VARIANCE);

    const shell = this.pool.pop() ?? {} as FireworkShell;

    shell.id = nextId++;
    shell.x = x; shell.y = y; shell.z = z;
    // Slight lateral drift (real mortar imperfection)
    shell.vx = (Math.random() - 0.5) * 1.5;
    shell.vy = baseSpeed;
    shell.vz = (Math.random() - 0.5) * 1.5;
    shell.alive = true;
    shell.fuseRemaining = fuse;
    shell.caliber = caliberMm;
    shell.caliberInches = caliberInches;
    shell.color = opts.color ?? [1, 0.8, 0.2];

    this.shells.push(shell);
    return shell;
  }

  /** Step physics — called from FXKEngine.tick() */
  tick(dt: number, wind: [number, number, number]): void {
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      if (!s.alive) {
        this.shells.splice(i, 1);
        this.pool.push(s); // recycle
        continue;
      }

      // Wind influence (shells = 20%, heavy mass)
      s.vx += wind[0] * SHELL_WIND_FACTOR * dt;
      s.vz += wind[2] * SHELL_WIND_FACTOR * dt;

      // Gravity
      s.vy += GRAVITY * dt;

      // Quadratic air drag: F_drag = k * v², applied as deceleration
      const speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy + s.vz * s.vz);
      if (speed > 0.01) {
        const dragForce = SHELL_DRAG * speed * speed;
        const decel = Math.min(dragForce * dt / speed, 0.95); // cap to prevent sign flip
        s.vx -= s.vx * decel;
        s.vy -= s.vy * decel;
        s.vz -= s.vz * decel;
      }

      // Integrate position
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;

      // Fuse countdown
      s.fuseRemaining -= dt;
      if (s.fuseRemaining <= 0) {
        this.explode(s);
      }
    }
  }

  private explode(shell: FireworkShell): void {
    shell.alive = false;
    for (const cb of this.listeners) {
      try { cb(shell); } catch { /* no-op */ }
    }
  }

  /** Subscribe to burst events */
  onExplode(cb: (shell: FireworkShell) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  getActive(): FireworkShell[] {
    return this.shells.filter(s => s.alive);
  }

  getAll(): readonly FireworkShell[] {
    return this.shells;
  }

  clear(): void {
    for (const s of this.shells) this.pool.push(s);
    this.shells.length = 0;
  }
}

export const fireworkEngine = new FireworkEngine();
