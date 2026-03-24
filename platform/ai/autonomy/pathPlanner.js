/**
 * FX KONTROL · Autonomous Path Planner
 * A*-based 3D path planning with Bezier smoothing.
 * Enhanced version integrating with existing FXK path planner logic.
 * by Minas FX
 */

export class PathPlanner {
  constructor(obstacleManager) {
    this.obstacles = obstacleManager;
    this.gridResolution = 2.0; // meters
    this.safetyMargin = 1.5;
  }

  /** Plan path from start to goal avoiding obstacles */
  planPath(start, goal, options = {}) {
    const { maxIterations = 10000, smoothing = true } = options;
    const startTime = performance.now();

    // A* on 3D grid
    const openSet = [{ pos: this.toGrid(start), g: 0, f: this.heuristic(start, goal), parent: null }];
    const closedSet = new Set();
    let iterations = 0;

    while (openSet.length > 0 && iterations < maxIterations) {
      iterations++;
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift();
      const key = this.gridKey(current.pos);

      if (closedSet.has(key)) continue;
      closedSet.add(key);

      // Goal check
      const worldPos = this.toWorld(current.pos);
      if (this.distance(worldPos, goal) < this.gridResolution * 1.5) {
        const path = this.reconstructPath(current);
        const worldPath = path.map(p => this.toWorld(p));
        const smoothed = smoothing ? this.smoothPath(worldPath) : worldPath;

        return {
          success: true,
          path: smoothed,
          distance: this.pathLength(smoothed),
          iterations,
          computeTimeMs: performance.now() - startTime,
        };
      }

      // Expand neighbors (26-connected)
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            if (dx === 0 && dy === 0 && dz === 0) continue;
            const neighbor = [current.pos[0] + dx, current.pos[1] + dy, current.pos[2] + dz];
            const nKey = this.gridKey(neighbor);
            if (closedSet.has(nKey)) continue;

            const nWorld = this.toWorld(neighbor);
            if (this.obstacles?.isInsideObstacle(nWorld[0], nWorld[1], nWorld[2], this.safetyMargin)) continue;
            if (nWorld[1] < 0) continue; // below ground

            const moveCost = Math.sqrt(dx * dx + dy * dy + dz * dz) * this.gridResolution;
            const g = current.g + moveCost;
            const h = this.heuristic(nWorld, goal);

            openSet.push({ pos: neighbor, g, f: g + h, parent: current });
          }
        }
      }
    }

    return { success: false, iterations, computeTimeMs: performance.now() - startTime };
  }

  /** Bezier smoothing pass */
  smoothPath(path) {
    if (path.length < 3) return path;
    const smoothed = [path[0]];
    for (let i = 1; i < path.length - 1; i++) {
      const prev = path[i - 1], curr = path[i], next = path[i + 1];
      smoothed.push([
        curr[0] * 0.5 + (prev[0] + next[0]) * 0.25,
        curr[1] * 0.5 + (prev[1] + next[1]) * 0.25,
        curr[2] * 0.5 + (prev[2] + next[2]) * 0.25,
      ]);
    }
    smoothed.push(path[path.length - 1]);
    return smoothed;
  }

  toGrid(pos) {
    return pos.map(v => Math.round(v / this.gridResolution));
  }

  toWorld(grid) {
    return grid.map(v => v * this.gridResolution);
  }

  gridKey(pos) {
    return `${pos[0]},${pos[1]},${pos[2]}`;
  }

  heuristic(a, b) {
    return Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2);
  }

  distance(a, b) {
    return this.heuristic(a, b);
  }

  pathLength(path) {
    let d = 0;
    for (let i = 1; i < path.length; i++) d += this.distance(path[i-1], path[i]);
    return d;
  }

  reconstructPath(node) {
    const path = [];
    while (node) { path.unshift(node.pos); node = node.parent; }
    return path;
  }
}
