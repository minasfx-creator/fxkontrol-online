/**
 * ─── SkyCanvas Diagnostics ──────────────────────────────────────────
 * Captures exceptions thrown by SkyCanvas subsystems (R3F boundaries,
 * WebGL boundary, context loss, render watchdog) and stores a summary
 * with stack trace + a snapshot of the current scene/render state.
 *
 * Surfaced in the editor's debug area via SkyCanvasDiagnosticsPanel.
 */
import { useSceneStore } from '@/store/useSceneStore';

export interface SkyCanvasDiagnosticEntry {
  id: string;
  ts: number;
  source: string;          // e.g. "SubsystemBoundary:Pyrotechnics", "WebGL", "ContextLoss"
  message: string;
  stack?: string;
  componentStack?: string;
  state: Record<string, unknown>;
}

const MAX = 50;
let entries: SkyCanvasDiagnosticEntry[] = [];
const listeners = new Set<() => void>();

function snapshotSceneState(): Record<string, unknown> {
  try {
    const s = useSceneStore.getState();
    return {
      lowQualityMode: s.environment?.lowQualityMode,
      hdrMultiplier: s.settings?.hdrMultiplier,
      bloomStrength: s.settings?.bloomStrength,
      particleDensity: s.settings?.particleDensity,
      effectBrightness: s.settings?.effectBrightness,
      activeBursts: (s as unknown as { activeBursts?: unknown[] }).activeBursts?.length ?? 0,
    };
  } catch {
    return { error: 'state-unavailable' };
  }
}

export function captureSkyCanvasError(
  source: string,
  error: unknown,
  componentStack?: string,
): void {
  const err = error instanceof Error ? error : new Error(String(error));
  const entry: SkyCanvasDiagnosticEntry = {
    id: `sky-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    source,
    message: err.message || 'Unknown error',
    stack: err.stack,
    componentStack,
    state: snapshotSceneState(),
  };
  entries = [entry, ...entries].slice(0, MAX);
  listeners.forEach(fn => fn());
  // Also mirror to console for devtools visibility
  console.error(`[SkyCanvasDiagnostics:${source}]`, err, componentStack ?? '');
}

export function getSkyCanvasDiagnostics(): SkyCanvasDiagnosticEntry[] {
  return [...entries];
}

export function clearSkyCanvasDiagnostics(): void {
  entries = [];
  listeners.forEach(fn => fn());
}

export function subscribeSkyCanvasDiagnostics(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
