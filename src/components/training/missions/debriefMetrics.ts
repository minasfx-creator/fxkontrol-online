/**
 * Training v2.1 — Pure debrief metrics + recommendation engine.
 *
 * No React, no THREE. Fully testable. Consumed by MissionDebriefPanel.
 *
 * Inputs are drawn from RunnerSnapshot + a lightweight per-attempt log
 * collected by CinematicTrainingSimulator (placement attempts and errors).
 */
import type { MissionScript } from './types';
import type { RunnerSnapshot } from './missionRunner';

export interface PlacementAttempt {
  /** ms since mission start (monotonic) */
  tMs: number;
  snapPointId: string;
  equipmentId: string;
  /** correct = equipment matched the snap point type */
  correct: boolean;
}

export interface DebriefMetricsInput {
  script: MissionScript;
  snap: RunnerSnapshot;
  attempts: ReadonlyArray<PlacementAttempt>;
}

export type MetricGrade = 'S' | 'A' | 'B' | 'C' | 'D';

export interface MetricRow {
  /** Stable id so UIs can key & test deterministically. */
  id: 'time' | 'accuracy3p' | 'positioning' | 'errors';
  label: string;
  /** Display value (already formatted). */
  value: string;
  /** 0..1 normalised score for the bar. */
  score: number;
  grade: MetricGrade;
  /** Optional sublabel (e.g. "12/14 objetivos"). */
  detail?: string;
}

export interface DebriefMetrics {
  rows: MetricRow[];
  /** 0..1 overall score (mean of row scores). */
  overallScore: number;
  overallGrade: MetricGrade;
  recommendations: string[];
}

const gradeFor = (score: number): MetricGrade => {
  if (score >= 0.92) return 'S';
  if (score >= 0.8) return 'A';
  if (score >= 0.65) return 'B';
  if (score >= 0.45) return 'C';
  return 'D';
};

const fmtSec = (s: number) => `${Math.max(0, Math.round(s))}s`;

export function computeDebriefMetrics(input: DebriefMetricsInput): DebriefMetrics {
  const { script, snap, attempts } = input;

  const totalObjectives = script.stages.reduce((acc, s) => acc + s.objectives.length, 0);
  const completedObjectives = Math.min(totalObjectives, attempts.filter((a) => a.correct).length);
  const wrongAttempts = attempts.filter((a) => !a.correct).length;
  const totalAttempts = attempts.length;

  // Time — efficiency vs budget (faster = better, but completion required).
  const timeUsed = Math.max(0, script.timeLimitSeconds - snap.remainingSeconds);
  const timeRatioRemaining = snap.remainingSeconds / Math.max(1, script.timeLimitSeconds);
  const timeScore = snap.phase === 'complete'
    ? Math.max(0, Math.min(1, 0.4 + 0.6 * timeRatioRemaining))
    : Math.max(0, Math.min(1, 0.3 * timeRatioRemaining));

  // 3-point accuracy = correct placements / total attempts.
  const accuracy = totalAttempts === 0 ? (snap.phase === 'complete' ? 1 : 0) : completedObjectives / totalAttempts;

  // Positioning = % of objectives covered (snap points are exact, so coverage drives this).
  const positioning = totalObjectives === 0 ? 1 : completedObjectives / totalObjectives;

  // Errors = safety violations + wrong-type attempts. Score decays with each error.
  const errorCount = snap.safetyViolations + wrongAttempts;
  const errorScore = Math.max(0, 1 - errorCount * 0.18);

  const rows: MetricRow[] = [
    {
      id: 'time',
      label: 'Tempo',
      value: `${fmtSec(timeUsed)} / ${fmtSec(script.timeLimitSeconds)}`,
      score: timeScore,
      grade: gradeFor(timeScore),
      detail: `${fmtSec(snap.remainingSeconds)} de margem`,
    },
    {
      id: 'accuracy3p',
      label: 'Acurácia 3-point',
      value: `${Math.round(accuracy * 100)}%`,
      score: accuracy,
      grade: gradeFor(accuracy),
      detail: `${completedObjectives} acertos / ${totalAttempts || completedObjectives} tentativas`,
    },
    {
      id: 'positioning',
      label: 'Posicionamento',
      value: `${Math.round(positioning * 100)}%`,
      score: positioning,
      grade: gradeFor(positioning),
      detail: `${completedObjectives}/${totalObjectives} snap points`,
    },
    {
      id: 'errors',
      label: 'Erros',
      value: `${errorCount}`,
      score: errorScore,
      grade: gradeFor(errorScore),
      detail: `${snap.safetyViolations} segurança · ${wrongAttempts} colocação`,
    },
  ];

  const overallScore = rows.reduce((acc, r) => acc + r.score, 0) / rows.length;
  const overallGrade = gradeFor(overallScore);

  const recommendations = buildRecommendations({
    rows,
    timeRatioRemaining,
    accuracy,
    positioning,
    errorCount,
    safetyViolations: snap.safetyViolations,
    wrongAttempts,
    completed: snap.phase === 'complete',
  });

  return { rows, overallScore, overallGrade, recommendations };
}

interface RecoCtx {
  rows: MetricRow[];
  timeRatioRemaining: number;
  accuracy: number;
  positioning: number;
  errorCount: number;
  safetyViolations: number;
  wrongAttempts: number;
  completed: boolean;
}

function buildRecommendations(ctx: RecoCtx): string[] {
  const out: string[] = [];

  if (!ctx.completed) {
    out.push('Repetir a missão focando em concluir todos os snap points dentro do tempo.');
  }
  if (ctx.timeRatioRemaining < 0.15 && ctx.completed) {
    out.push('Acelere o briefing inicial — você terminou no limite de tempo.');
  }
  if (ctx.timeRatioRemaining > 0.6 && ctx.completed && ctx.accuracy >= 0.9) {
    out.push('Performance excelente — pronto para subir a dificuldade.');
  }
  if (ctx.accuracy < 0.7) {
    out.push('Confirme tipo de equipamento antes de fixar — acurácia 3-point baixa indica seleção apressada.');
  }
  if (ctx.positioning < 0.85 && ctx.completed === false) {
    out.push('Cobertura incompleta: revise o mapa de snap points no briefing antes de iniciar.');
  }
  if (ctx.safetyViolations >= 2) {
    out.push('Reveja o checklist de segurança — mais de uma violação por missão é inaceitável em campo.');
  }
  if (ctx.wrongAttempts >= 3) {
    out.push('Use o tray de equipamentos com calma — múltiplas tentativas erradas no mesmo snap aumentam risco operacional.');
  }
  if (ctx.errorCount === 0 && ctx.completed) {
    out.push('Zero erros registrados. Documente esta execução como referência.');
  }

  // Fallback so the panel never renders empty.
  if (out.length === 0) {
    out.push('Mantenha o ritmo — métricas equilibradas, sem ajustes prioritários.');
  }
  return out;
}
