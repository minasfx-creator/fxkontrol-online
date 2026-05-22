import { describe, it, expect } from 'vitest';
import { pickAdaptiveSampleRate } from './adaptiveSampling';
import { matchPointsByCost } from './matchPointsByCost';
import { compilePhysicalTrajectory } from './compileTrajectory';
import { validateBounds, validateCollisions, validateKinematics } from './validators';
import { buildAltitudeLanes } from './altitudeLanes';
import { buildPhysicsReport } from './physicsReport';
import { repairPhysicalTransition } from './repairPhysicalTransition';
import { pickEasing } from './easing';
import type { Vec3 } from '../types';

const linear = (t: number) => t;

describe('pickAdaptiveSampleRate', () => {
  it('honors the tier table', () => {
    expect(pickAdaptiveSampleRate({ droneCount: 50, duration: 4 }).sampleRate).toBe(20);
    expect(pickAdaptiveSampleRate({ droneCount: 300, duration: 4 }).sampleRate).toBe(10);
    expect(pickAdaptiveSampleRate({ droneCount: 1500, duration: 4, mode: 'preview' }).sampleRate).toBe(5);
    expect(pickAdaptiveSampleRate({ droneCount: 1500, duration: 4, mode: 'final' }).sampleRate).toBe(10);
  });
  it('respects maxSamples cap', () => {
    const r = pickAdaptiveSampleRate({ droneCount: 50, duration: 1000, maxSamples: 32 });
    expect(r.sampleCount).toBeLessThanOrEqual(32);
  });
});

describe('matchPointsByCost', () => {
  const sources: Vec3[] = [
    { x: 0, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 },
  ];
  const targets: Vec3[] = [
    { x: 9, y: 0, z: 0 },
    { x: 0.5, y: 0, z: 0 },
  ];
  it('greedy returns a valid permutation', () => {
    const r = matchPointsByCost(sources, targets);
    expect(r.to).toHaveLength(2);
    expect(new Set(r.to).size).toBe(2);
    expect(r.totalCost).toBeGreaterThan(0);
    expect(r.strategy).toBe('greedy');
  });
  it('hungarian beats greedy on the swap-trap', () => {
    const greedy = matchPointsByCost(sources, targets, { strategy: 'greedy' });
    const opt = matchPointsByCost(sources, targets, { strategy: 'hungarian' });
    expect(opt.totalCost).toBeLessThanOrEqual(greedy.totalCost);
  });
  it('handles empty input', () => {
    expect(matchPointsByCost([], targets).to).toEqual([]);
    expect(matchPointsByCost(sources, []).to).toEqual([]);
  });
});

describe('compilePhysicalTrajectory + validateKinematics', () => {
  it('produces sample arrays of consistent length', () => {
    const sources: Vec3[] = [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }];
    const targets: Vec3[] = [{ x: 0, y: 0, z: 5 }, { x: 10, y: 0, z: 5 }];
    const m = matchPointsByCost(sources, targets);
    const traj = compilePhysicalTrajectory(sources, targets, m, { duration: 2, sampleRate: 10 });
    expect(traj.dronePaths.length).toBe(2);
    expect(traj.dronePaths[0].length).toBe(traj.times.length);
    const k = validateKinematics(traj, { maxSpeed: 100, minSeparation: 0.5 });
    expect(k.metrics.maxSpeedUsed).toBeGreaterThan(0);
  });
  it('flags speed violations', () => {
    const sources: Vec3[] = [{ x: 0, y: 0, z: 0 }];
    const targets: Vec3[] = [{ x: 100, y: 0, z: 0 }];
    const m = matchPointsByCost(sources, targets);
    const traj = compilePhysicalTrajectory(sources, targets, m, { duration: 1, sampleRate: 10 });
    const k = validateKinematics(traj, { maxSpeed: 5, minSeparation: 0.5 });
    expect(k.issues.some((i) => i.kind === 'speed')).toBe(true);
  });
});

describe('validateCollisions', () => {
  it('detects head-on cross', () => {
    // Two drones swap positions; they cross at the midpoint without lane offsets.
    const sources: Vec3[] = [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }];
    const targets: Vec3[] = [{ x: 10, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }];
    const traj = compilePhysicalTrajectory(sources, targets, { to: [0, 1], totalCost: 0, strategy: 'greedy' }, {
      duration: 4, sampleRate: 10,
    });
    const r = validateCollisions(traj, 1);
    expect(r.metrics.collisionCount).toBeGreaterThan(0);
    expect(r.issues.some((i) => i.kind === 'collision')).toBe(true);
  });
  it('reports no collisions for parallel paths', () => {
    const sources: Vec3[] = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 5 }];
    const targets: Vec3[] = [{ x: 10, y: 0, z: 0 }, { x: 10, y: 0, z: 5 }];
    const traj = compilePhysicalTrajectory(sources, targets, { to: [0, 1], totalCost: 0, strategy: 'greedy' }, {
      duration: 2, sampleRate: 10,
    });
    const r = validateCollisions(traj, 1);
    expect(r.metrics.collisionCount).toBe(0);
  });
});

describe('validateBounds', () => {
  it('flags samples outside the box', () => {
    const sources: Vec3[] = [{ x: 0, y: 0, z: 0 }];
    const targets: Vec3[] = [{ x: 0, y: 50, z: 0 }];
    const traj = compilePhysicalTrajectory(sources, targets, { to: [0], totalCost: 0, strategy: 'greedy' }, {
      duration: 2, sampleRate: 10,
    });
    const b = validateBounds(traj, { minX: -1, maxX: 1, minY: 0, maxY: 10, minZ: -1, maxZ: 1 });
    expect(b.issues.length).toBeGreaterThan(0);
    expect(b.issues[0].kind).toBe('bounds');
  });
});

describe('buildAltitudeLanes', () => {
  it('assigns drones to lane indices and bounded offsets', () => {
    const n = 9;
    const sources: Vec3[] = Array.from({ length: n }, (_, i) => ({ x: i, y: 0, z: 0 }));
    const targets: Vec3[] = Array.from({ length: n }, (_, i) => ({ x: i, y: 0, z: 5 }));
    const m = matchPointsByCost(sources, targets);
    const lanes = buildAltitudeLanes(sources, targets, m, { laneCount: 3, maxOffset: 6 });
    expect(lanes.laneOffsets).toHaveLength(n);
    for (const o of lanes.laneOffsets) expect(Math.abs(o)).toBeLessThanOrEqual(6);
    expect(new Set(lanes.laneIndex).size).toBeGreaterThan(1);
  });
});

describe('buildPhysicsReport', () => {
  it('aggregates ok=true for safe trajectory', () => {
    const sources: Vec3[] = [{ x: 0, y: 0, z: 0 }];
    const targets: Vec3[] = [{ x: 1, y: 0, z: 0 }];
    const traj = compilePhysicalTrajectory(sources, targets, { to: [0], totalCost: 0, strategy: 'greedy' }, {
      duration: 4, sampleRate: 10,
    });
    const r = buildPhysicsReport(traj, { limits: { maxSpeed: 5, minSeparation: 0.1 } });
    expect(r.ok).toBe(true);
    expect(r.metrics.collisionCount).toBe(0);
  });
});

describe('repairPhysicalTransition', () => {
  it('extends duration to fix a speed violation', () => {
    const sources: Vec3[] = [{ x: 0, y: 0, z: 0 }];
    const targets: Vec3[] = [{ x: 30, y: 0, z: 0 }]; // 30m in 1s = 30m/s, limit 5m/s
    const r = repairPhysicalTransition(sources, targets, {
      duration: 1,
      limits: { maxSpeed: 5, minSeparation: 0.5 },
      ease: linear,
      durationMultipliers: [2, 4, 8], // 8× → 1s/8 → 30/(1*8)=3.75 m/s, ok
    });
    expect(r.report.repairLog.length).toBeGreaterThan(0);
    expect(r.report.ok).toBe(true);
    expect(r.report.metrics.maxSpeedUsed).toBeLessThanOrEqual(5 + 1e-3);
  });
  it('returns a final blocker when repair fails', () => {
    const sources: Vec3[] = [{ x: 0, y: 0, z: 0 }];
    const targets: Vec3[] = [{ x: 1000, y: 0, z: 0 }]; // impossible at any tried duration
    const r = repairPhysicalTransition(sources, targets, {
      duration: 1,
      limits: { maxSpeed: 1, minSeparation: 0.5 },
      ease: linear,
      durationMultipliers: [1.1],
    });
    expect(r.report.ok).toBe(false);
    expect(r.report.issues.some((i) => i.severity === 'blocker')).toBe(true);
  });
});

describe('pickEasing', () => {
  it('returns a function that maps 0→0 and 1→1', () => {
    for (const style of ['cinematic', 'fast', 'soft', 'snap', 'organic'] as const) {
      const f = pickEasing(style);
      expect(f(0)).toBeCloseTo(0);
      expect(f(1)).toBeCloseTo(1);
    }
  });
});
