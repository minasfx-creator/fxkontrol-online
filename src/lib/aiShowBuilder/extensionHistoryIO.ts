/**
 * extensionHistoryIO — serialização versionada para export/import do
 * histórico de "Estender show". Pure helpers, sem React.
 *
 * Contrato JSON: { fmt: 'fxk.extHistory', v: 1, planId, exportedAt, history, redo }
 */
import type {
  PersistedExtensionEntry,
  PersistedExtensionState,
  PersistedRedoEntry,
} from './extensionHistoryStorage';

export const EXT_HISTORY_FMT = 'fxk.extHistory' as const;
export const EXT_HISTORY_VERSION = 1 as const;

export interface ExtensionHistoryExport {
  fmt: typeof EXT_HISTORY_FMT;
  v: typeof EXT_HISTORY_VERSION;
  planId: string;
  exportedAt: number;
  history: PersistedExtensionEntry[];
  redo: PersistedRedoEntry[];
}

export function serializeExtensionHistory(
  planId: string,
  state: PersistedExtensionState,
): ExtensionHistoryExport {
  return {
    fmt: EXT_HISTORY_FMT,
    v: EXT_HISTORY_VERSION,
    planId,
    exportedAt: Date.now(),
    history: state.history,
    redo: state.redo,
  };
}

export interface ParseResult {
  ok: boolean;
  data?: ExtensionHistoryExport;
  error?: string;
}

/** Parse defensivo: rejeita formato/versão errados ou shape inválido. */
export function parseExtensionHistoryExport(raw: unknown): ParseResult {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Payload vazio' };
  const obj = raw as Record<string, unknown>;
  if (obj.fmt !== EXT_HISTORY_FMT) return { ok: false, error: `fmt inválido: ${String(obj.fmt)}` };
  if (obj.v !== EXT_HISTORY_VERSION) return { ok: false, error: `versão não suportada: ${String(obj.v)}` };
  if (typeof obj.planId !== 'string' || !obj.planId) return { ok: false, error: 'planId ausente' };
  if (!Array.isArray(obj.history) || !Array.isArray(obj.redo)) {
    return { ok: false, error: 'history/redo não são arrays' };
  }
  return { ok: true, data: obj as unknown as ExtensionHistoryExport };
}
