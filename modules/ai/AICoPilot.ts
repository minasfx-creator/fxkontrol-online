import { AIDecisionEngine, AICoPilotMode, DecisionOutput, DroneState, MissionGoal, Obstacle, Vector3 } from './AIDecisionEngine';

export interface PilotInput {
  pitch: number;
  roll: number;
  yaw: number;
  throttle: number;
}

export interface CoPilotOutput {
  mode: AICoPilotMode;
  smoothedInput: PilotInput;
  overrideActive: boolean;
  decision: DecisionOutput;
  suggestedCameraTarget: Vector3;
}

const clamp = (n: number, min = -1, max = 1): number => Math.max(min, Math.min(max, n));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export class AICoPilot {
  private mode: AICoPilotMode;
  private decisionEngine: AIDecisionEngine;

  constructor(mode: AICoPilotMode = 'ASSISTED') {
    this.mode = mode;
    this.decisionEngine = new AIDecisionEngine();
  }

  setMode(mode: AICoPilotMode): void {
    this.mode = mode;
  }

  getMode(): AICoPilotMode {
    return this.mode;
  }

  processInput(input: PilotInput, state: DroneState, obstacles: Obstacle[], goal: MissionGoal): CoPilotOutput {
    const decision = this.decisionEngine.computeSafeTrajectory(state, obstacles, goal);

    const safeInput: PilotInput = {
      pitch: clamp(input.pitch * 0.85),
      roll: clamp(input.roll * 0.85),
      yaw: clamp(input.yaw * 0.9),
      throttle: clamp(input.throttle * 0.9, 0, 1),
    };

    const assistedInput: PilotInput = {
      pitch: lerp(input.pitch, safeInput.pitch, 0.2),
      roll: lerp(input.roll, safeInput.roll, 0.2),
      yaw: lerp(input.yaw, safeInput.yaw, 0.2),
      throttle: lerp(input.throttle, safeInput.throttle, 0.2),
    };

    const overrideActive = decision.riskDetected && this.mode !== 'MANUAL';

    const modeInput: Record<AICoPilotMode, PilotInput> = {
      MANUAL: input,
      ASSISTED: assistedInput,
      AI_CONTROL: safeInput,
      CINEMATIC: {
        pitch: assistedInput.pitch * 0.7,
        roll: assistedInput.roll * 0.7,
        yaw: assistedInput.yaw * 0.65,
        throttle: clamp(assistedInput.throttle * 0.8, 0, 1),
      },
    };

    const finalInput = overrideActive ? safeInput : modeInput[this.mode];

    const suggestedCameraTarget = decision.safeTrajectory[decision.safeTrajectory.length - 1];

    return {
      mode: this.mode,
      smoothedInput: finalInput,
      overrideActive,
      decision,
      suggestedCameraTarget,
    };
  }
}
