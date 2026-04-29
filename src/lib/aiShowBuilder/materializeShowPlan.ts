/**
 * Aplica um ShowPlan validado ao `useProjectStore`.
 *
 * Único ponto que altera o store. O plano deve ter sido validado antes
 * (validateShowPlan). Adição não-destrutiva: se o projeto já tem
 * conteúdo, novos itens são empilhados; nada é apagado.
 */
import { useProjectStore } from '@/store/useProjectStore';
import type {
  Position,
  PositionType,
  TimelineItem,
  Trajectory,
  Waypoint,
} from '@/types/projectTypes';
import type {
  PlannedPosition,
  PlannedTimelineItem,
  PlannedTrajectory,
  ShowPlan,
} from './types';

function plannedTypeToStoreType(t: PlannedPosition['type']): PositionType {
  if (t === 'drone') return 'drone-pad';
  if (t === 'pyro')  return 'pyro';
  return 'light'; // anchor → marker visual via tipo light
}

function toPosition(p: PlannedPosition): Position {
  return {
    id: p.id,
    name: p.name,
    type: plannedTypeToStoreType(p.type),
    x: p.x,
    y: p.y,
    z: p.z,
    heading: p.heading,
    pitch: p.pitch,
    roll: p.roll,
    color: p.color,
  };
}

function toTimelineItem(item: PlannedTimelineItem): TimelineItem {
  const trackIndex =
    item.type === 'drone_move' ? 0 :
    item.type === 'pyro_effect' ? 1 :
    item.type === 'finale' ? 2 : 3;
  return {
    id: item.id,
    effectId: item.effectId ?? `ai-${item.type}`,
    startTime: Math.max(0, item.startTime),
    trackIndex,
    position: { x: 0, y: 0, z: 0 },
    positionId: item.positionId,
    positionName: item.positionName,
    notes: item.notes ?? `${item.label} (gerado por IA)`,
    durationOverride: item.duration,
  };
}

function toTrajectory(t: PlannedTrajectory): Trajectory | null {
  if (!t.positionId) return null;
  const waypoints: Waypoint[] = t.waypoints.map((wp, i) => ({
    id: `${t.id}-wp-${i}`,
    position: { x: wp.x, y: wp.y, z: wp.z },
    time: wp.time,
  }));
  return {
    id: t.id,
    positionId: t.positionId,
    waypoints,
    name: t.name,
  };
}

export interface MaterializeOptions {
  /**
   * Se `true`, apaga positions/timelineItems/trajectories existentes ANTES
   * de aplicar o plano. Só deve ser passado após confirmação explícita do
   * usuário (ex.: dialog "Substituir conteúdo atual?").
   * Default: `false` (sempre aditivo).
   */
  replaceExisting?: boolean;
}

export interface MaterializeResult {
  positionsAdded: number;
  timelineItemsAdded: number;
  trajectoriesAdded: number;
  duration: number;
  replacedExisting: boolean;
  hadExistingContent: boolean;
}

export function materializeShowPlan(
  plan: ShowPlan,
  options: MaterializeOptions = {},
): MaterializeResult {
  const store = useProjectStore.getState();
  const hadExistingContent =
    store.positions.length > 0 ||
    store.timelineItems.length > 0 ||
    store.trajectories.length > 0;
  const isEmpty = !hadExistingContent;
  const replace = options.replaceExisting === true && hadExistingContent;

  // Mapeia coordenadas das positions para encaixar nos timeline items
  const posIndex = new Map<string, PlannedPosition>();
  for (const p of plan.positions) posIndex.set(p.id, p);

  const newPositions: Position[] = plan.positions.map(toPosition);
  const newItems: TimelineItem[] = plan.timelineItems.map((item) => {
    const base = toTimelineItem(item);
    const linked = item.positionId ? posIndex.get(item.positionId) : undefined;
    if (linked) {
      base.position = { x: linked.x, y: linked.y, z: linked.z };
    }
    return base;
  });
  const newTrajectories: Trajectory[] = plan.trajectories
    .map(toTrajectory)
    .filter((t): t is Trajectory => t !== null);

  // Substituição APENAS quando explicitamente confirmada
  if (replace) {
    // Remove em snapshot pra não mutar arrays durante iteração
    const existingTrajectoryIds = store.trajectories.map((t) => t.id);
    const existingTimelineIds   = store.timelineItems.map((t) => t.id);
    const existingPositionIds   = store.positions.map((p) => p.id);
    for (const id of existingTrajectoryIds) store.removeTrajectory?.(id);
    for (const id of existingTimelineIds)   store.removeTimelineItem?.(id);
    for (const id of existingPositionIds)   store.removePosition?.(id);
  }

  // Update project name apenas se vazio (ou recém-limpo)
  if (isEmpty || replace) {
    store.setProjectName(plan.title);
  }

  // Duração: estende caso o plano peça mais (ou aplica direto se replace)
  const targetDuration = replace
    ? plan.duration
    : Math.max(store.duration ?? 0, plan.duration);
  if (targetDuration !== store.duration) {
    store.setDuration(targetDuration);
  }

  // Adições (sempre aditivas a partir daqui)
  for (const p of newPositions) store.addPosition(p);
  for (const it of newItems) store.addTimelineItem(it);
  for (const tr of newTrajectories) store.addTrajectory(tr);

  return {
    positionsAdded: newPositions.length,
    timelineItemsAdded: newItems.length,
    trajectoriesAdded: newTrajectories.length,
    duration: targetDuration,
    replacedExisting: replace,
    hadExistingContent,
  };
}

/**
 * Helper para a UI decidir se precisa pedir confirmação antes de aplicar.
 * Use junto com um diálogo "Já existe conteúdo no projeto. Adicionar ou
 * substituir?".
 */
export function projectHasExistingContent(): boolean {
  const s = useProjectStore.getState();
  return s.positions.length > 0 || s.timelineItems.length > 0 || s.trajectories.length > 0;
}

