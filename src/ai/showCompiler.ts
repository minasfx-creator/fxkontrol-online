/**
 * ShowCompiler — Função pura: ShowGraph → DeterministicTimeline.
 *
 * Não toca runtime. Não acessa hardware. Não usa estado global.
 * Saída é determinística: mesma entrada → mesma saída, byte-a-byte.
 *
 * A timeline gerada aqui é candidata. Só vira execução real após:
 *   compile → HIL run → certification → manual approval → import.
 */

import type { ShowGraph, ShowGraphNode } from './showGraph';

export interface CompiledTimelineEvent {
  readonly id: string;
  readonly sourceNodeId: string;
  readonly type: ShowGraphNode['type'];
  readonly startTime: number;
  readonly duration: number;
  readonly positionId?: string;
  readonly effectId?: string;
  readonly params: Readonly<Record<string, number | string | boolean>>;
}

export interface DeterministicTimeline {
  readonly graphId: string;
  readonly compiledAt: number; // monotonic, relativo ao compile (sempre 0 — pure)
  readonly duration: number;
  readonly events: ReadonlyArray<CompiledTimelineEvent>;
  readonly hash: string; // identificador de integridade (FNV-1a determinístico)
}

export interface CompileResult {
  readonly success: boolean;
  readonly timeline?: DeterministicTimeline;
  readonly errors: ReadonlyArray<string>;
}

/** FNV-1a 32-bit determinístico. */
function fnv1a(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Compila um ShowGraph em uma DeterministicTimeline.
 * 100% puro — sem Date.now, sem performance.now, sem aleatoriedade.
 */
export function compileShowGraph(graph: ShowGraph): CompileResult {
  const errors: string[] = [];

  if (graph.nodes.length === 0) {
    return { success: false, errors: ['empty graph'] };
  }

  const events: CompiledTimelineEvent[] = [];

  // Garante ordem determinística: startTime asc, depois id asc para tie-break
  const ordered = [...graph.nodes].sort((a, b) => {
    if (a.startTime !== b.startTime) return a.startTime - b.startTime;
    return a.id < b.id ? -1 : 1;
  });

  for (const node of ordered) {
    if (node.duration < 0) {
      errors.push(`node ${node.id}: negative duration`);
      continue;
    }
    events.push(
      Object.freeze({
        id: `evt-${node.id}`,
        sourceNodeId: node.id,
        type: node.type,
        startTime: node.startTime,
        duration: node.duration,
        positionId: node.positionId,
        effectId: node.effectId,
        params: Object.freeze({ ...(node.params ?? {}) }),
      }),
    );
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  // Hash determinístico baseado em conteúdo (não em tempo de wall clock)
  const hashInput = events
    .map(
      (e) =>
        `${e.id}|${e.type}|${e.startTime}|${e.duration}|${e.positionId ?? ''}|${e.effectId ?? ''}`,
    )
    .join('\n');

  const timeline: DeterministicTimeline = Object.freeze({
    graphId: graph.metadata.id,
    compiledAt: 0,
    duration: graph.duration,
    events: Object.freeze(events),
    hash: fnv1a(hashInput),
  });

  return { success: true, timeline, errors: [] };
}

/**
 * Re-compila e compara hashes — usado para verificar determinismo.
 * Mesma entrada DEVE produzir mesmo hash.
 */
export function verifyCompileDeterminism(graph: ShowGraph): boolean {
  const a = compileShowGraph(graph);
  const b = compileShowGraph(graph);
  return a.success && b.success && a.timeline!.hash === b.timeline!.hash;
}
