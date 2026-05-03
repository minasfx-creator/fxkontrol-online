/**
 * Training v2.1 — Cinematic Mission types.
 *
 * Pure data. Zero THREE/React imports. Drives MissionRunner FSM
 * + CinematicCameraDirector + AmbientChoreographer.
 */

export type StageKind =
  | 'briefing'
  | 'place'
  | 'inspect'
  | 'evacuate'
  | 'fire-check'
  | 'patch'
  | 'dialogue'
  | 'debrief';

export type DifficultyTier = 'easy' | 'medium' | 'hard' | 'legendary';

export type DialogueIntent = 'urgent' | 'calm' | 'excited' | 'serious' | 'sarcastic';

export interface DialogueLine {
  npcId: string;
  text: string;
  durationMs?: number;
  intent?: DialogueIntent;
  /** Optional world point the NPC will point at while speaking. */
  pointAt?: [number, number, number];
}

export interface NPCEvent {
  kind: 'spawn' | 'despawn' | 'speak' | 'move';
  npcId: string;
  line?: string;
  intent?: DialogueIntent;
  position?: [number, number, number];
}

export interface StageObjective {
  snapPointId?: string;
  equipmentId?: string;
  label: string;
  realWorldFact?: string;
  /** Manual id (matches MANUALS[] in Training.tsx). */
  manualRef?: string;
}

export type CinematicShot =
  | 'wide-establishing'
  | 'medium-2shot'
  | 'over-the-shoulder'
  | 'close-up-reaction'
  | 'crane-down'
  | 'dolly-in'
  | 'low-angle-hero'
  | 'orbit-slow';

export interface CinematicBeat {
  id: string;
  /** Triggers when this stage starts. Use 'briefing' or 'debrief' for global beats. */
  triggerOn: 'briefing' | 'stage-start' | 'stage-complete' | 'debrief';
  /** Stage id this beat targets (ignored for briefing/debrief). */
  stageId?: string;
  shot: CinematicShot;
  /** ms — defaults to shot library duration. */
  durationMs?: number;
  /** Focus target world position (overrides shot default). */
  focus?: [number, number, number];
  /** Optional NPC id used to anchor the shot (e.g. close-up-reaction). */
  npcId?: string;
}

export interface FailureScenario {
  /** Why the mission failed. */
  trigger: 'timeout' | 'safety-violations-exceeded' | 'wrong-order' | 'manual';
  title: string;
  /** GTA-V "Wasted"-style line. */
  flavor: string;
  /** Tactical lesson shown post-fail. */
  lesson: string;
}

export interface MissionStage {
  id: string;
  kind: StageKind;
  title: string;
  hint?: string;
  budgetSeconds?: number;
  objectives: StageObjective[];
  onEnter?: NPCEvent[];
  onComplete?: NPCEvent[];
  /** Pure dialogue stages skip placement; auto-advance on last line. */
  dialogue?: DialogueLine[];
  /** Manual reference key shown on the stage card. */
  manualRef?: string;
}

export interface MissionScoreRules {
  baseXP: number;
  timeBonusPerSecond: number;
  safetyPenalty: number;
  maxStars: number;
}

export type AmbientPreset = 'calm' | 'busy' | 'frantic';

export interface MissionScript {
  id: string;
  chapter: string;
  title: string;
  synopsis: string;
  scenario: string;
  difficulty: DifficultyTier;
  timeLimitSeconds: number;
  equipment: string[];
  stages: MissionStage[];
  briefing: {
    npcId: string;
    lines: DialogueLine[];
  };
  debrief: {
    title: string;
    takeaways: string[];
  };
  scoreRules: MissionScoreRules;
  locked: boolean;
  /** Cinematic camera beats — empty array = pure player POV. */
  cinematicBeats?: CinematicBeat[];
  /** Ambient NPC density preset. */
  ambient?: AmbientPreset;
  /** Mission-specific failure scenarios. */
  failureScenarios?: FailureScenario[];
}

export interface MissionRuntimeState {
  scriptId: string;
  stageIndex: number;
  completedObjectiveIds: ReadonlySet<string>;
  score: number;
  safetyViolations: number;
  elapsedSeconds: number;
  remainingSeconds: number;
  phase: 'briefing' | 'running' | 'cutscene' | 'complete' | 'failed';
}
