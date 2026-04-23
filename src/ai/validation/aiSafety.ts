/**
 * aiSafety — Guardrails entre o output do Joi e o runtime.
 *
 * Toda timeline compilada DEVE passar por estes guards antes
 * de ser apresentada para HIL e, eventualmente, importada.
 */

import type { DeterministicTimeline } from '../showCompiler';

export interface SafetyCheck {
  readonly passed: boolean;
  readonly violations: ReadonlyArray<string>;
}

/**
 * Checagens defensivas mínimas. NÃO substituem HIL ou certificação —
 * apenas barram timelines obviamente inválidas antes do gasto de HIL.
 */
export function runAISafetyChecks(timeline: DeterministicTimeline): SafetyCheck {
  const violations: string[] = [];

  if (timeline.events.length === 0) {
    violations.push('timeline has no events');
  }

  if (timeline.duration <= 0) {
    violations.push('timeline duration <= 0');
  }

  // Sem eventos fora da janela
  for (const e of timeline.events) {
    if (e.startTime < 0) violations.push(`event ${e.id} startTime < 0`);
    if (e.startTime + e.duration > timeline.duration + 0.001) {
      violations.push(`event ${e.id} extends beyond duration`);
    }
  }

  // Sem IDs duplicados (re-check defensivo)
  const ids = new Set<string>();
  for (const e of timeline.events) {
    if (ids.has(e.id)) violations.push(`duplicate event id ${e.id}`);
    ids.add(e.id);
  }

  // Ordem monotônica
  for (let i = 1; i < timeline.events.length; i++) {
    if (timeline.events[i].startTime < timeline.events[i - 1].startTime) {
      violations.push(`event ordering violation at index ${i}`);
      break;
    }
  }

  return { passed: violations.length === 0, violations: Object.freeze(violations) };
}
