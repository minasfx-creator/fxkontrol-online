/**
 * Training v2.2 — Stage Props Store.
 *
 * Per-mission store of placed scenic props with position/rotation/scale.
 * Persists to localStorage under fxk.stageProps.v1.<missionId>.
 *
 * Tiny event-emitter pattern (no Zustand) to keep memory footprint minimal
 * and avoid coupling. SSR-safe — guards localStorage access.
 */

import { useCallback, useEffect, useState } from 'react';
import { STAGE_PROP_CATALOG, getStagePropDef, type StagePropKind } from './stagePropsCatalog';

export interface PlacedStageProp {
  id: string;
  kind: StagePropKind;
  position: [number, number, number];
  rotationY: number;
  scale: number;
}

const KEY_PREFIX = 'fxk.stageProps.v1.';

type Listener = (items: PlacedStageProp[]) => void;

interface MissionStore {
  items: PlacedStageProp[];
  listeners: Set<Listener>;
}

const stores = new Map<string, MissionStore>();

function getStore(missionId: string): MissionStore {
  let s = stores.get(missionId);
  if (s) return s;
  let initial: PlacedStageProp[] = [];
  try {
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(KEY_PREFIX + missionId);
      if (raw) initial = JSON.parse(raw) as PlacedStageProp[];
    }
  } catch {
    /* corrupt entry — start clean */
  }
  s = { items: initial, listeners: new Set() };
  stores.set(missionId, s);
  return s;
}

function persist(missionId: string, items: PlacedStageProp[]): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(KEY_PREFIX + missionId, JSON.stringify(items));
    }
  } catch {
    /* quota exceeded — ignore, in-memory still works */
  }
}

function emit(s: MissionStore): void {
  s.listeners.forEach((l) => l(s.items));
}

export function useStageProps(missionId: string) {
  const store = getStore(missionId);
  const [items, setItems] = useState<PlacedStageProp[]>(store.items);

  useEffect(() => {
    const s = getStore(missionId);
    setItems(s.items);
    const listener: Listener = (next) => setItems(next);
    s.listeners.add(listener);
    return () => {
      s.listeners.delete(listener);
    };
  }, [missionId]);

  const addProp = useCallback(
    (kind: StagePropKind) => {
      const def = getStagePropDef(kind);
      if (!def) return;
      const s = getStore(missionId);
      const item: PlacedStageProp = {
        id: `prop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        kind,
        position: [...def.defaultPosition] as [number, number, number],
        rotationY: def.defaultRotationY,
        scale: def.defaultScale,
      };
      s.items = [...s.items, item];
      persist(missionId, s.items);
      emit(s);
    },
    [missionId],
  );

  const updateProp = useCallback(
    (id: string, patch: Partial<Omit<PlacedStageProp, 'id' | 'kind'>>) => {
      const s = getStore(missionId);
      s.items = s.items.map((it) => (it.id === id ? { ...it, ...patch } : it));
      persist(missionId, s.items);
      emit(s);
    },
    [missionId],
  );

  const removeProp = useCallback(
    (id: string) => {
      const s = getStore(missionId);
      s.items = s.items.filter((it) => it.id !== id);
      persist(missionId, s.items);
      emit(s);
    },
    [missionId],
  );

  const clearAll = useCallback(() => {
    const s = getStore(missionId);
    s.items = [];
    persist(missionId, s.items);
    emit(s);
  }, [missionId]);

  const resetProp = useCallback(
    (id: string) => {
      const s = getStore(missionId);
      const target = s.items.find((it) => it.id === id);
      if (!target) return;
      const def = getStagePropDef(target.kind);
      if (!def) return;
      s.items = s.items.map((it) =>
        it.id === id
          ? {
              ...it,
              position: [...def.defaultPosition] as [number, number, number],
              rotationY: def.defaultRotationY,
              scale: def.defaultScale,
            }
          : it,
      );
      persist(missionId, s.items);
      emit(s);
    },
    [missionId],
  );

  return { items, addProp, updateProp, removeProp, clearAll, resetProp, catalog: STAGE_PROP_CATALOG };
}
