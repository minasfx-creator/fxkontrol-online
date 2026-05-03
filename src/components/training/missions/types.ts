/**
 * Training v2 — Cinematic Mission types.
 *
 * Pure data. Zero THREE/React imports. Drives MissionRunner FSM.
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

export interface DialogueLine {
  /** NPC catalog id (see npcs/npcCatalog.ts). */
  npcId: string;
  /** Line of speech. Plain text (no markdown). */
  text: string;
  /** Display duration in ms. Auto-derived from text length if omitted. */
  durationMs?: number;
}

export interface NPCEvent {
  kind: 'spawn' | 'despawn' | 'speak' | 'move';
  npcId: string;
  /** For 'speak'. */
  line?: string;
  /** For 'move' / 'spawn'. World position (StageEnvironment3D space). */
  position?: [number, number, number];
}

export interface StageObjective {
  /** Snap point id (matches MISSION_SNAP_POINTS). */
  snapPointId?: string;
  /** Required equipment id. */
  equipmentId?: string;
  /** Free-form objective label (when not a snap-point task). */
  label: string;
  /** Real-world fact shown in the debrief. */
  realWorldFact?: string;
  /** Manual reference id (links to MANUALS array in Training.tsx). */
  manualRef?: string;
}

export interface MissionStage {
  id: string;
  kind: StageKind;
  title: string;
  /** Hint shown if player idles >15s. */
  hint?: string;
  /** Soft time budget for star scoring. Hard fail = mission timeLimit. */
  budgetSeconds?: number;
  objectives: StageObjective[];
  /** NPCs entering / speaking when stage starts. */
  onEnter?: NPCEvent[];
  /** NPCs leaving / final lines when stage completes. */
  onComplete?: NPCEvent[];
  /** Pure dialogue stages skip placement. */
  dialogue?: DialogueLine[];
}

export interface MissionScoreRules {
  /** Base XP awarded on completion. */
  baseXP: number;
  /** XP per second remaining at end. */
  timeBonusPerSecond: number;
  /** Penalty per safety violation (NPC contact, wrong order, etc). */
  safetyPenalty: number;
  /** Max stars (typically 5). */
  maxStars: number;
}

export interface MissionScript {
  id: string;
  chapter: string;
  title: string;
  /** One-line synopsis shown in mission card. */
  synopsis: string;
  /** Mission scenario flavour (briefing context). */
  scenario: string;
  difficulty: DifficultyTier;
  /** Hard time limit (mission fails on 0). */
  timeLimitSeconds: number;
  /** Equipment ids available in tray. */
  equipment: string[];
  stages: MissionStage[];
  briefing: {
    /** NPC who delivers the briefing. */
    npcId: string;
    lines: DialogueLine[];
  };
  debrief: {
    /** Title shown over star rating. */
    title: string;
    /** Bullet takeaways shown post-mission. */
    takeaways: string[];
  };
  scoreRules: MissionScoreRules;
  /** Whether mission starts unlocked or requires progression. */
  locked: boolean;
}

export interface MissionRuntimeState {
  scriptId: string;
  /** Index in script.stages. */
  stageIndex: number;
  /** Snap points completed in current stage. */
  completedObjectiveIds: ReadonlySet<string>;
  /** Score accumulated. */
  score: number;
  /** Safety violations counted. */
  safetyViolations: number;
  /** Total time elapsed (seconds). */
  elapsedSeconds: number;
  /** Time remaining (seconds). */
  remainingSeconds: number;
  /** 'briefing' | 'running' | 'cutscene' | 'complete' | 'failed' */
  phase: 'briefing' | 'running' | 'cutscene' | 'complete' | 'failed';
}
