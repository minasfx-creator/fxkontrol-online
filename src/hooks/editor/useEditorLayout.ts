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
import { supabase } from '@/integrations/supabase/client';

export interface EditorActiveTabs {
  left?: string;
  right?: string;
  timeline?: string;
}

export interface EditorLayoutState {
  leftWidth: number;
  rightWidth: number;
  timelineHeight: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  timelineCollapsed: boolean;
  /** Optional active tab id per dock slot (Round 2 — persisted). */
  activeTabs?: EditorActiveTabs;
}

export const EDITOR_LAYOUT_DEFAULTS: EditorLayoutState = {
  leftWidth: 280,
  rightWidth: 320,
  timelineHeight: 180,
  leftCollapsed: false,
  rightCollapsed: false,
  timelineCollapsed: false,
  activeTabs: {},
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
      activeTabs: (parsed.activeTabs && typeof parsed.activeTabs === 'object')
        ? {
            left: typeof parsed.activeTabs.left === 'string' ? parsed.activeTabs.left : undefined,
            right: typeof parsed.activeTabs.right === 'string' ? parsed.activeTabs.right : undefined,
            timeline: typeof parsed.activeTabs.timeline === 'string' ? parsed.activeTabs.timeline : undefined,
          }
        : {},
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
  // Skip the very next cloud write after we hydrate from cloud (avoids echo).
  const skipNextCloudWriteRef = useRef(false);

  // Re-hydrate when projectId changes (different project ⇒ different layout).
  const lastProjectRef = useRef(projectId);
  useEffect(() => {
    if (lastProjectRef.current !== projectId) {
      lastProjectRef.current = projectId;
      setState(readPersisted(projectId));
    }
  }, [projectId]);

  // ── Cloud hydrate (per user + project_key) ────────────────────────────────
  // Loads any saved layout from Supabase on mount/project change. localStorage
  // remains the offline-first cache; cloud value wins on hydrate.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) return;
        const { data, error } = await (supabase as any)
          .from('editor_layouts')
          .select('state')
          .eq('user_id', auth.user.id)
          .eq('project_key', projectId)
          .maybeSingle();
        if (cancelled || error || !data?.state) return;
        const cloud = data.state as Partial<EditorLayoutState>;
        skipNextCloudWriteRef.current = true;
        setState({
          leftWidth: clamp(
            Number(cloud.leftWidth ?? EDITOR_LAYOUT_DEFAULTS.leftWidth),
            EDITOR_LAYOUT_LIMITS.left.min,
            EDITOR_LAYOUT_LIMITS.left.max,
          ),
          rightWidth: clamp(
            Number(cloud.rightWidth ?? EDITOR_LAYOUT_DEFAULTS.rightWidth),
            EDITOR_LAYOUT_LIMITS.right.min,
            EDITOR_LAYOUT_LIMITS.right.max,
          ),
          timelineHeight: clamp(
            Number(cloud.timelineHeight ?? EDITOR_LAYOUT_DEFAULTS.timelineHeight),
            EDITOR_LAYOUT_LIMITS.timeline.min,
            EDITOR_LAYOUT_LIMITS.timeline.max,
          ),
          leftCollapsed: Boolean(cloud.leftCollapsed),
          rightCollapsed: Boolean(cloud.rightCollapsed),
          timelineCollapsed: Boolean(cloud.timelineCollapsed),
        });
      } catch {
        // Network/auth issues — silently fall back to localStorage cache.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Debounced persist — coalesces drag bursts into a single write to BOTH
  // localStorage (always) and Supabase (when authenticated).
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
      // Cloud upsert (debounced 600ms via outer timeout). Skip the echo right
      // after a cloud-driven hydrate to avoid pointless round-trips.
      if (skipNextCloudWriteRef.current) {
        skipNextCloudWriteRef.current = false;
        return;
      }
      void (async () => {
        try {
          const { data: auth } = await supabase.auth.getUser();
          if (!auth?.user) return;
          await (supabase as any)
            .from('editor_layouts')
            .upsert(
              {
                user_id: auth.user.id,
                project_key: projectId,
                state: state as unknown as Record<string, unknown>,
              },
              { onConflict: 'user_id,project_key' },
            );
        } catch {
          // Offline / auth missing — localStorage already covers this session.
        }
      })();
    }, 600);
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
