/**
 * FX KONTROL · Digital Twin — Wind Simulation
 * 3D vector field wind model with gusts, turbulence, and altitude gradient.
 */

export class WindSimulation {
  constructor() {
    this.baseSpeed = 3.0;       // m/s
    this.baseDirection = 0;     // radians (0 = North)
    this.gustIntensity = 0.3;   // 0-1
    this.turbulenceScale = 0.1;
    this.altitudeGradient = 0.05; // speed increase per meter
    this.time = 0;
  }

  configure(config) {
    Object.assign(this, config);
  }

  /** Get wind vector at position and time */
  getWindAt(x, y, z, time = this.time) {
    const altFactor = 1 + y * this.altitudeGradient;
    const baseVx = Math.sin(this.baseDirection) * this.baseSpeed * altFactor;
    const baseVz = Math.cos(this.baseDirection) * this.baseSpeed * altFactor;

    // Perlin-like turbulence approximation
    const turb = this.turbulenceScale;
    const gustX = Math.sin(time * 0.7 + x * turb) * this.gustIntensity * this.baseSpeed;
    const gustY = Math.sin(time * 0.5 + y * turb * 0.5) * this.gustIntensity * 0.5;
    const gustZ = Math.cos(time * 0.9 + z * turb) * this.gustIntensity * this.baseSpeed;

    return {
      x: baseVx + gustX,
      y: gustY,
      z: baseVz + gustZ,
      speed: Math.sqrt((baseVx + gustX) ** 2 + gustY ** 2 + (baseVz + gustZ) ** 2),
    };
  }

  update(dt) {
    this.time += dt;
  }

  /** Check if wind exceeds safety limits for drone operations */
  isSafe(maxWindSpeed = 12) {
    const surface = this.getWindAt(0, 0, 0);
    const altitude = this.getWindAt(0, 50, 0);
    return surface.speed < maxWindSpeed && altitude.speed < maxWindSpeed * 1.3;
  }
}
