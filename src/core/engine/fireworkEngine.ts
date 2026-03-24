/**
 * ─── Firework Physics Engine ────────────────────────────────────────
 * Real ballistic simulation: gravity + air drag + wind influence.
 * 1 unit = 1 meter. Feeds visual renderer with active shell positions.
 */

export interface FireworkShell {
  id: number;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  alive: boolean;
  fuseRemaining: number;  // seconds until burst
  caliber: number;        // mm
  color: [number, number, number];
}

const GRAVITY = -9.81;       // m/s²
const DRAG_COEFF = 0.03;     // air drag per tick
const FUSE_VARIANCE = 0.15;  // ±15% fuse randomness

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
    const fuse = (opts.fuse ?? 3) * (1 + (Math.random() - 0.5) * 2 * FUSE_VARIANCE);
    const speed = opts.launchSpeed ?? (20 + Math.random() * 15);
    const shell = this.pool.pop() ?? {} as FireworkShell;

    shell.id = nextId++;
    shell.x = x; shell.y = y; shell.z = z;
    shell.vx = (Math.random() - 0.5) * 2;
    shell.vy = speed;
    shell.vz = (Math.random() - 0.5) * 2;
    shell.alive = true;
    shell.fuseRemaining = fuse;
    shell.caliber = opts.caliber ?? 75;
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

      // Wind influence
      s.vx += wind[0] * dt;
      s.vz += wind[2] * dt;

      // Gravity
      s.vy += GRAVITY * dt;

      // Air drag
      const drag = 1 - DRAG_COEFF * dt;
      s.vx *= drag;
      s.vy *= drag;
      s.vz *= drag;

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
