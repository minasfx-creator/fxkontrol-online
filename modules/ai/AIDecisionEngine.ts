export type AICoPilotMode = 'MANUAL' | 'ASSISTED' | 'AI_CONTROL' | 'CINEMATIC';

export interface Vector3 { x: number; y: number; z: number }
export interface Obstacle { id: string; position: Vector3; radius: number }
export interface DroneState {
  position: Vector3;
  velocity: Vector3;
  batteryPct: number;
  windMps: number;
  signalQuality: number;
}
export interface MissionGoal {
  mode: 'FOLLOW_SUBJECT' | 'HOLD_FRAME' | 'TRANSIT' | 'SAFE_RETURN';
  target?: Vector3;
  intensity?: number;
  dropComing?: boolean;
}

export interface DecisionOutput {
  safeTrajectory: Vector3[];
  riskDetected: boolean;
  riskReasons: string[];
  confidence: number;
  assistantHint?: string;
}

const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const distance = (a: Vector3, b: Vector3): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

export class AIDecisionEngine {
  computeSafeTrajectory(state: DroneState, obstacles: Obstacle[], goal: MissionGoal): DecisionOutput {
    const riskReasons: string[] = [];

    const imminentCollision = obstacles.some((obs) => distance(state.position, obs.position) < obs.radius + 2);
    if (imminentCollision) riskReasons.push('collision_imminent');
    if (state.position.z < 3) riskReasons.push('altitude_danger');
    if (state.signalQuality < 0.2) riskReasons.push('signal_low');
    if (state.batteryPct < 15) riskReasons.push('battery_low');

    const riskDetected = riskReasons.length > 0;

    const target = goal.target || state.position;
    const cinematicBias = goal.mode === 'HOLD_FRAME' || goal.dropComing;
    const smoothFactor = cinematicBias ? 0.12 : 0.2;

    const p1: Vector3 = {
      x: lerp(state.position.x, target.x, smoothFactor),
      y: lerp(state.position.y, target.y, smoothFactor),
      z: clamp(lerp(state.position.z, target.z ?? state.position.z, smoothFactor), 4, 120),
    };

    const p2: Vector3 = {
      x: lerp(p1.x, target.x, smoothFactor),
      y: lerp(p1.y, target.y, smoothFactor),
      z: clamp(lerp(p1.z, target.z ?? p1.z, smoothFactor), 4, 120),
    };

    const hint = goal.dropComing ? 'wide_framing' : riskDetected ? 'safety_override' : 'trajectory_optimized';

    return {
      safeTrajectory: [state.position, p1, p2],
      riskDetected,
      riskReasons,
      confidence: clamp(1 - riskReasons.length * 0.2, 0.2, 0.98),
      assistantHint: hint,
    };
  }
}
