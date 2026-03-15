/**
 * FX KONTROL · Reactive Obstacle Avoidance
 * Potential field + velocity obstacle hybrid for real-time avoidance.
 * by Minas FX
 */

export class ObstacleAvoidance {
  constructor(config = {}) {
    this.detectionRange = config.detectionRange || 10.0;
    this.safeDistance = config.safeDistance || 3.0;
    this.maxDeflection = config.maxDeflection || 2.0;
    this.verticalPreference = config.verticalPreference || 0.6;
  }

  /** Compute avoidance velocity for a single drone */
  computeAvoidance(dronePos, droneVel, obstacles, otherDrones) {
    let avoidForce = { x: 0, y: 0, z: 0 };

    // Static obstacle avoidance (potential field)
    for (const obs of obstacles) {
      const dx = dronePos.x - obs.position[0];
      const dy = dronePos.y - obs.position[1];
      const dz = dronePos.z - obs.position[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) - (obs.size[0] || 0);

      if (dist < this.detectionRange && dist > 0.01) {
        const urgency = Math.pow(1.0 - dist / this.detectionRange, 2);
        const scale = urgency * this.maxDeflection / dist;
        avoidForce.x += dx * scale;
        avoidForce.y += dy * scale * (1 + this.verticalPreference);
        avoidForce.z += dz * scale;
      }
    }

    // Drone-to-drone avoidance (velocity obstacle)
    for (const other of otherDrones) {
      const dx = dronePos.x - other.x;
      const dy = dronePos.y - other.y;
      const dz = dronePos.z - other.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < this.safeDistance * 2 && dist > 0.01) {
        const urgency = 1.0 - dist / (this.safeDistance * 2);
        avoidForce.x += (dx / dist) * urgency * this.maxDeflection;
        avoidForce.y += (dy / dist) * urgency * this.maxDeflection * (1 + this.verticalPreference);
        avoidForce.z += (dz / dist) * urgency * this.maxDeflection;
      }
    }

    return avoidForce;
  }

  /** Check if a path segment is clear */
  isPathClear(from, to, obstacles) {
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t;
      const z = from.z + (to.z - from.z) * t;

      for (const obs of obstacles) {
        const dx = x - obs.position[0];
        const dy = y - obs.position[1];
        const dz = z - obs.position[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < (obs.size[0] || 0) + this.safeDistance) return false;
      }
    }
    return true;
  }
}
