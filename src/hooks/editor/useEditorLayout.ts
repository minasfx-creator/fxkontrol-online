/**
 * useEditorLayout — Persists Editor DS shell geometry per project.
 *
 * Storage: localStorage, keyed by `fxk:editor-layout:v1:<projectId>`.
 * Only UI/presentation state — never ShowPlan, never safety/hardware.
 *
 * Persisted fields:
 *   - leftWidth     (px)  default 280, range [0, 480], 0 ⇔ leftCollapsed
 *   - rightWidth    (px)  default 320, range [0, 520], 0 ⇔ rightCollapsed
 *   - timelineHeight(px)  default 180, range [0, 480], 0 ⇔ timelineCollapsed
 *   - leftCollapsed / rightCollapsed / timelineCollapsed (booleans)
 *
 * Collapsed state is independent from width: when toggling open we restore
 * the last non-zero width (so the user's preferred panel size survives).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface EditorLayoutState {
  leftWidth: number;
  rightWidth: number;
  timelineHeight: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  timelineCollapsed: boolean;
}

export const EDITOR_LAYOUT_DEFAULTS: EditorLayoutState = {
  leftWidth: 280,
  rightWidth: 320,
  timelineHeight: 180,
  leftCollapsed: false,
  rightCollapsed: false,
  timelineCollapsed: false,
};

export const EDITOR_LAYOUT_LIMITS = {
  left: { min: 200, max: 480, collapsed: 0 },
  right: { min: 240, max: 520, collapsed: 0 },
  timeline: { min: 96, max: 480, collapsed: 0 },
} as const;

const STORAGE_PREFIX = 'fxk:editor-layout:v1:';

function storageKey(projectId: string) {
  return `${STORAGE_PREFIX}${projectId || 'default'}`;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function readPersisted(projectId: string): EditorLayoutState {
  if (typeof window === 'undefined') return EDITOR_LAYOUT_DEFAULTS;
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (!raw) return EDITOR_LAYOUT_DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<EditorLayoutState>;
    return {
      leftWidth: clamp(
        Number(parsed.leftWidth ?? EDITOR_LAYOUT_DEFAULTS.leftWidth),
        EDITOR_LAYOUT_LIMITS.left.min,
        EDITOR_LAYOUT_LIMITS.left.max,
      ),
      rightWidth: clamp(
        Number(parsed.rightWidth ?? EDITOR_LAYOUT_DEFAULTS.rightWidth),
        EDITOR_LAYOUT_LIMITS.right.min,
        EDITOR_LAYOUT_LIMITS.right.max,
      ),
      timelineHeight: clamp(
        Number(parsed.timelineHeight ?? EDITOR_LAYOUT_DEFAULTS.timelineHeight),
        EDITOR_LAYOUT_LIMITS.timeline.min,
        EDITOR_LAYOUT_LIMITS.timeline.max,
      ),
      leftCollapsed: Boolean(parsed.leftCollapsed),
      rightCollapsed: Boolean(parsed.rightCollapsed),
      timelineCollapsed: Boolean(parsed.timelineCollapsed),
    };
  } catch {
    return EDITOR_LAYOUT_DEFAULTS;
  }
}

export interface UseEditorLayoutResult extends EditorLayoutState {
  /** Effective px values respecting collapsed flags (collapsed → 0). */
  effective: { leftWidth: number; rightWidth: number; timelineHeight: number };
  setLeftWidth: (px: number) => void;
  setRightWidth: (px: number) => void;
  setTimelineHeight: (px: number) => void;
  toggleLeft: () => void;
  toggleRight: () => void;
  toggleTimeline: () => void;
  reset: () => void;
}

/**
 * @param projectId Stable project identifier. Use 'default' for shared/dev shells.
 */
export function useEditorLayout(projectId: string): UseEditorLayoutResult {
  const [state, setState] = useState<EditorLayoutState>(() => readPersisted(projectId));

  // Re-hydrate when projectId changes (different project ⇒ different layout).
  const lastProjectRef = useRef(projectId);
  useEffect(() => {
    if (lastProjectRef.current !== projectId) {
      lastProjectRef.current = projectId;
      setState(readPersisted(projectId));
    }
  }, [projectId]);

  // Debounced persist — coalesces drag bursts into a single write.
  const writeTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (writeTimerRef.current != null) window.clearTimeout(writeTimerRef.current);
    writeTimerRef.current = window.setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey(projectId), JSON.stringify(state));
      } catch {
        // Quota or private mode — ignore; in-memory state still works.
      }
    }, 120);
    return () => {
      if (writeTimerRef.current != null) {
        window.clearTimeout(writeTimerRef.current);
        writeTimerRef.current = null;
      }
    };
  }, [state, projectId]);

  const setLeftWidth = useCallback((px: number) => {
    setState((s) => ({
      ...s,
      leftWidth: clamp(px, EDITOR_LAYOUT_LIMITS.left.min, EDITOR_LAYOUT_LIMITS.left.max),
      leftCollapsed: false,
    }));
  }, []);
  const setRightWidth = useCallback((px: number) => {
    setState((s) => ({
      ...s,
      rightWidth: clamp(px, EDITOR_LAYOUT_LIMITS.right.min, EDITOR_LAYOUT_LIMITS.right.max),
      rightCollapsed: false,
    }));
  }, []);
  const setTimelineHeight = useCallback((px: number) => {
    setState((s) => ({
      ...s,
      timelineHeight: clamp(px, EDITOR_LAYOUT_LIMITS.timeline.min, EDITOR_LAYOUT_LIMITS.timeline.max),
      timelineCollapsed: false,
    }));
  }, []);

  const toggleLeft = useCallback(() => {
    setState((s) => ({ ...s, leftCollapsed: !s.leftCollapsed }));
  }, []);
  const toggleRight = useCallback(() => {
    setState((s) => ({ ...s, rightCollapsed: !s.rightCollapsed }));
  }, []);
  const toggleTimeline = useCallback(() => {
    setState((s) => ({ ...s, timelineCollapsed: !s.timelineCollapsed }));
  }, []);

  const reset = useCallback(() => {
    setState(EDITOR_LAYOUT_DEFAULTS);
  }, []);

  return {
    ...state,
    effective: {
      leftWidth: state.leftCollapsed ? 0 : state.leftWidth,
      rightWidth: state.rightCollapsed ? 0 : state.rightWidth,
      timelineHeight: state.timelineCollapsed ? 0 : state.timelineHeight,
    },
    setLeftWidth,
    setRightWidth,
    setTimelineHeight,
    toggleLeft,
    toggleRight,
    toggleTimeline,
    reset,
  };
}
