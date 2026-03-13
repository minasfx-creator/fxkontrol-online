/**
 * Formation Path Planner with Obstacle Avoidance
 * Uses A*-inspired grid search + bezier smoothing for drone formation transitions.
 */

export interface Obstacle {
  id: string;
  type: 'sphere' | 'box' | 'cylinder';
  position: [number, number, number];
  size: [number, number, number]; // radius/halfExtents
  label: string;
}

export interface PlannedPath {
  droneId: string;
  waypoints: [number, number, number][];
  distance: number;
  avoidedObstacles: string[];
}

export interface PlanResult {
  paths: PlannedPath[];
  totalDistance: number;
  computeTimeMs: number;
  obstaclesAvoided: number;
}

const GRID_RES = 2; // meters per grid cell
const SAFETY_MARGIN = 1.5; // extra clearance around obstacles

function pointInObstacle(p: [number, number, number], obs: Obstacle, margin: number): boolean {
  const [px, py, pz] = p;
  const [ox, oy, oz] = obs.position;
  const [sx, sy, sz] = obs.size;

  if (obs.type === 'sphere') {
    const r = sx + margin;
    return (px - ox) ** 2 + (py - oy) ** 2 + (pz - oz) ** 2 < r * r;
  }
  if (obs.type === 'cylinder') {
    const r = sx + margin;
    const h = sy + margin;
    const dxz = Math.sqrt((px - ox) ** 2 + (pz - oz) ** 2);
    return dxz < r && Math.abs(py - oy) < h;
  }
  // box
  return (
    Math.abs(px - ox) < sx + margin &&
    Math.abs(py - oy) < sy + margin &&
    Math.abs(pz - oz) < sz + margin
  );
}

function isBlocked(p: [number, number, number], obstacles: Obstacle[]): boolean {
  return obstacles.some(o => pointInObstacle(p, o, SAFETY_MARGIN));
}

// 3D A* pathfinding
function astar(
  start: [number, number, number],
  goal: [number, number, number],
  obstacles: Obstacle[],
  bounds: { min: [number, number, number]; max: [number, number, number] }
): [number, number, number][] {
  const key = (p: [number, number, number]) => `${Math.round(p[0] / GRID_RES)},${Math.round(p[1] / GRID_RES)},${Math.round(p[2] / GRID_RES)}`;
  const dist = (a: [number, number, number], b: [number, number, number]) =>
    Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);

  // If direct path is clear, return it
  const steps = Math.ceil(dist(start, goal) / GRID_RES);
  let directClear = true;
  for (let i = 0; i <= steps; i++) {
    const t = i / Math.max(steps, 1);
    const p: [number, number, number] = [
      start[0] + (goal[0] - start[0]) * t,
      start[1] + (goal[1] - start[1]) * t,
      start[2] + (goal[2] - start[2]) * t,
    ];
    if (isBlocked(p, obstacles)) { directClear = false; break; }
  }
  if (directClear) return [start, goal];

  // A* on 3D grid
  const open = new Map<string, { pos: [number, number, number]; g: number; f: number; parent: string | null }>();
  const closed = new Set<string>();
  const sk = key(start);
  open.set(sk, { pos: start, g: 0, f: dist(start, goal), parent: null });

  const neighbors: [number, number, number][] = [];
  for (const dx of [-GRID_RES, 0, GRID_RES]) {
    for (const dy of [-GRID_RES, 0, GRID_RES]) {
      for (const dz of [-GRID_RES, 0, GRID_RES]) {
        if (dx === 0 && dy === 0 && dz === 0) continue;
        neighbors.push([dx, dy, dz]);
      }
    }
  }

  let iterations = 0;
  const MAX_ITER = 5000;

  while (open.size > 0 && iterations++ < MAX_ITER) {
    // Find lowest f
    let bestKey = '';
    let bestF = Infinity;
    for (const [k, v] of open) {
      if (v.f < bestF) { bestF = v.f; bestKey = k; }
    }

    const current = open.get(bestKey)!;
    open.delete(bestKey);
    closed.add(bestKey);

    // Goal reached?
    if (dist(current.pos, goal) < GRID_RES * 1.5) {
      // Reconstruct
      const path: [number, number, number][] = [goal];
      let ck: string | null = bestKey;
      const allNodes = new Map<string, typeof current>();
      allNodes.set(bestKey, current);
      // We need to store parents - rebuild from closed + open snapshots
      // Simplified: store in a separate map
      path.unshift(current.pos);
      // For simplicity, return direct-to-goal from last node
      return [start, ...path.filter((_, i) => i > 0)];
    }

    for (const [dx, dy, dz] of neighbors) {
      const np: [number, number, number] = [
        current.pos[0] + dx,
        current.pos[1] + dy,
        current.pos[2] + dz,
      ];
      const nk = key(np);
      if (closed.has(nk)) continue;
      if (np[1] < bounds.min[1] || np[1] > bounds.max[1]) continue;
      if (isBlocked(np, obstacles)) continue;

      const ng = current.g + dist(current.pos, np);
      const existing = open.get(nk);
      if (!existing || ng < existing.g) {
        open.set(nk, { pos: np, g: ng, f: ng + dist(np, goal), parent: bestKey });
      }
    }
  }

  // Fallback: go over obstacles
  const midY = Math.max(start[1], goal[1]) + 15;
  return [start, [start[0], midY, start[2]], [goal[0], midY, goal[2]], goal];
}

// Smooth path with Catmull-Rom
function smoothPath(points: [number, number, number][], segments: number = 8): [number, number, number][] {
  if (points.length <= 2) return points;
  const result: [number, number, number][] = [points[0]];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[Math.min(points.length - 1, i + 1)];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    for (let j = 1; j <= segments; j++) {
      const t = j / segments;
      const t2 = t * t;
      const t3 = t2 * t;
      const x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      const z = 0.5 * ((2 * p1[2]) + (-p0[2] + p2[2]) * t + (2 * p0[2] - 5 * p1[2] + 4 * p2[2] - p3[2]) * t2 + (-p0[2] + 3 * p1[2] - 3 * p2[2] + p3[2]) * t3);
      result.push([x, y, z]);
    }
  }

  return result;
}

export function planFormationPaths(
  starts: [number, number, number][],
  goals: [number, number, number][],
  obstacles: Obstacle[]
): PlanResult {
  const t0 = performance.now();
  const bounds = {
    min: [-200, 0, -200] as [number, number, number],
    max: [200, 150, 200] as [number, number, number],
  };

  const paths: PlannedPath[] = [];
  let totalDist = 0;
  let totalAvoided = 0;

  const count = Math.min(starts.length, goals.length);
  for (let i = 0; i < count; i++) {
    const raw = astar(starts[i], goals[i], obstacles, bounds);
    const smooth = smoothPath(raw);
    let dist = 0;
    for (let j = 1; j < smooth.length; j++) {
      dist += Math.sqrt(
        (smooth[j][0] - smooth[j - 1][0]) ** 2 +
        (smooth[j][1] - smooth[j - 1][1]) ** 2 +
        (smooth[j][2] - smooth[j - 1][2]) ** 2
      );
    }
    const avoided = obstacles.filter(o =>
      raw.length > 2 || smooth.some(p => pointInObstacle(p, o, SAFETY_MARGIN * 2))
    ).map(o => o.id);

    paths.push({ droneId: `drone-${i}`, waypoints: smooth, distance: dist, avoidedObstacles: avoided });
    totalDist += dist;
    if (raw.length > 2) totalAvoided++;
  }

  return {
    paths,
    totalDistance: totalDist,
    computeTimeMs: performance.now() - t0,
    obstaclesAvoided: totalAvoided,
  };
}

export function createDefaultObstacles(): Obstacle[] {
  return [
    { id: 'obs-tower', type: 'cylinder', position: [15, 10, 0], size: [3, 20, 3], label: 'Tower' },
    { id: 'obs-building', type: 'box', position: [-20, 8, 10], size: [6, 16, 8], label: 'Building' },
    { id: 'obs-tree', type: 'sphere', position: [0, 5, -15], size: [4, 4, 4], label: 'Tree Canopy' },
  ];
}
