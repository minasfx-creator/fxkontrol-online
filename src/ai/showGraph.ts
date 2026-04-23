/**
 * ShowGraph — Imutável. Estrutura intermediária gerada pelo Joi.
 *
 * Princípio: Joi NUNCA toca runtime. Ele apenas produz ShowGraph.
 * Um ShowGraph é uma descrição declarativa, pura, congelada (Object.freeze)
 * que será traduzida pelo compiler em uma DeterministicTimeline.
 *
 * Sem efeitos colaterais. Sem acesso a hardware. Sem estado global.
 */

export type ShowGraphNodeType = 'pyro' | 'drone' | 'dmx' | 'laser' | 'marker';

export interface ShowGraphNode {
  readonly id: string;
  readonly type: ShowGraphNodeType;
  readonly startTime: number; // segundos absolutos no show
  readonly duration: number;  // segundos
  readonly positionId?: string;
  readonly effectId?: string;
  readonly params?: Readonly<Record<string, number | string | boolean>>;
  readonly notes?: string;
}

export interface ShowGraphMetadata {
  readonly id: string;
  readonly title: string;
  readonly createdAt: number;
  readonly source: 'joi' | 'manual' | 'imported';
  readonly model?: string;
  readonly prompt?: string;
}

export interface ShowGraph {
  readonly metadata: ShowGraphMetadata;
  readonly nodes: ReadonlyArray<ShowGraphNode>;
  readonly duration: number;
}

/** Cria um ShowGraph profundamente imutável. */
export function createShowGraph(input: {
  metadata: Omit<ShowGraphMetadata, 'createdAt'> & { createdAt?: number };
  nodes: ShowGraphNode[];
  duration: number;
}): ShowGraph {
  const metadata: ShowGraphMetadata = Object.freeze({
    ...input.metadata,
    createdAt: input.metadata.createdAt ?? Date.now(),
  });

  const nodes = Object.freeze(
    input.nodes
      .map((n) =>
        Object.freeze({
          ...n,
          params: n.params ? Object.freeze({ ...n.params }) : undefined,
        }),
      )
      .sort((a, b) => a.startTime - b.startTime),
  );

  return Object.freeze({
    metadata,
    nodes,
    duration: input.duration,
  });
}

/** Verifica integridade estrutural básica do ShowGraph (sem validação semântica). */
export function validateShowGraphStructure(graph: ShowGraph): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!graph.metadata.id) errors.push('missing metadata.id');
  if (graph.duration <= 0) errors.push('duration must be > 0');
  if (graph.nodes.length === 0) errors.push('nodes empty');

  const ids = new Set<string>();
  for (const node of graph.nodes) {
    if (ids.has(node.id)) errors.push(`duplicate node id: ${node.id}`);
    ids.add(node.id);
    if (node.startTime < 0) errors.push(`node ${node.id} negative startTime`);
    if (node.startTime + node.duration > graph.duration + 0.001) {
      errors.push(`node ${node.id} exceeds graph duration`);
    }
  }

  return { valid: errors.length === 0, errors };
}
