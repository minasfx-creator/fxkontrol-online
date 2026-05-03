/**
 * extensionHistoryStorage — persistência leve do histórico de "Estender show".
 *
 * Por planId, salva no localStorage o stack de undo + redo. Pure helpers,
 * sem dependência de React/store. Limitado a 20 entradas para evitar bloat.
 *
 * Snapshots de ShowPlan podem ser grandes; usamos try/catch e best-effort:
 * se o quota estourar, esvaziamos o slot daquele plano e seguimos sem ruído.
 */
import type { ShowPlan } from './types';
import type { ShowPlanDiff } from './showPlanDiff';

export interface PersistedExtensionEntry {
  id: string;
  timestamp: number;
  prompt: string;
  anchorLabel: string;
  resumeAt: number;
  providerId: string;
  fellBack: boolean;
  prevPlan: ShowPlan;
  diff: ShowPlanDiff;
}

export interface PersistedRedoEntry {
  entry: PersistedExtensionEntry;
  nextPlan: ShowPlan;
}

export interface PersistedExtensionState {
  history: PersistedExtensionEntry[];
  redo: PersistedRedoEntry[];
}

const PREFIX = 'fxk.aiShowBuilder.extHistory.v1.';
const MAX_ENTRIES = 20;

function key(planId: string): string {
  return `${PREFIX}${planId}`;
}

export function loadExtensionHistory(planId: string): PersistedExtensionState | null {
  if (typeof window === 'undefined' || !planId) return null;
  try {
    const raw = window.localStorage.getItem(key(planId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedExtensionState;
    if (!parsed || !Array.isArray(parsed.history) || !Array.isArray(parsed.redo)) return null;
    return {
      history: parsed.history.slice(0, MAX_ENTRIES),
      redo: parsed.redo.slice(0, MAX_ENTRIES),
    };
  } catch {
    return null;
  }
}

export function saveExtensionHistory(
  planId: string,
  state: PersistedExtensionState,
): void {
  if (typeof window === 'undefined' || !planId) return;
  try {
    const trimmed: PersistedExtensionState = {
      history: state.history.slice(0, MAX_ENTRIES),
      redo: state.redo.slice(0, MAX_ENTRIES),
    };
    window.localStorage.setItem(key(planId), JSON.stringify(trimmed));
  } catch {
    // Quota stourou ou serialização falhou — limpa slot e segue.
    try { window.localStorage.removeItem(key(planId)); } catch { /* noop */ }
  }
}

export function clearExtensionHistory(planId: string): void {
  if (typeof window === 'undefined' || !planId) return;
  try { window.localStorage.removeItem(key(planId)); } catch { /* noop */ }
}
