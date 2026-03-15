/**
 * FX KONTROL · Digital Twin — Obstacle Manager
 * Manages static and dynamic obstacles for path planning and collision avoidance.
 */

export class ObstacleManager {
  constructor() {
    this.obstacles = [];
  }

  addObstacle(obstacle) {
    this.obstacles.push({
      id: obstacle.id || `obs_${Date.now()}`,
      type: obstacle.type || "sphere", // sphere | box | cylinder
      position: obstacle.position,     // [x, y, z]
      size: obstacle.size,             // [rx, ry, rz] or [radius]
      label: obstacle.label || "Obstacle",
      dynamic: obstacle.dynamic || false,
    });
  }

  removeObstacle(id) {
    this.obstacles = this.obstacles.filter(o => o.id !== id);
  }

  /** Check if a point is inside any obstacle (with safety margin) */
  isInsideObstacle(x, y, z, margin = 1.5) {
    for (const obs of this.obstacles) {
      const [ox, oy, oz] = obs.position;
      if (obs.type === "sphere") {
        const r = obs.size[0] + margin;
        if ((x - ox) ** 2 + (y - oy) ** 2 + (z - oz) ** 2 < r * r) return obs;
      } else if (obs.type === "box") {
        const [hx, hy, hz] = obs.size.map(s => s + margin);
        if (Math.abs(x - ox) < hx && Math.abs(y - oy) < hy && Math.abs(z - oz) < hz) return obs;
      } else if (obs.type === "cylinder") {
        const [r, h] = [obs.size[0] + margin, obs.size[1] + margin];
        const dist2D = Math.sqrt((x - ox) ** 2 + (z - oz) ** 2);
        if (dist2D < r && Math.abs(y - oy) < h) return obs;
      }
    }
    return null;
  }

  /** Get all obstacles near a position */
  getNearby(x, y, z, radius = 20) {
    return this.obstacles.filter(obs => {
      const [ox, oy, oz] = obs.position;
      return Math.sqrt((x - ox) ** 2 + (y - oy) ** 2 + (z - oz) ** 2) < radius + (obs.size[0] || 0);
    });
  }
}
