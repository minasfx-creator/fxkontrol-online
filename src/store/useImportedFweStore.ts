/**
 * ─── Imported .fwe Effects store ──────────────────────────────────
 * Holds runtime-imported `Effect` records produced by `parseFweXml`.
 *
 * Persistence layers:
 *  1) localStorage — offline cache, instant boot, survives reload.
 *  2) Supabase (`imported_fwe_effects`, RLS by user_id) — syncs the
 *     library across devices/sessions when the user is signed in.
 *
 * Stable key: each Effect's `id` (derived from filename via
 * `fweEffectId`) — re-importing the same file replaces the entry
 * rather than duplicating it.
 *
 * Sync model: local writes are optimistic; cloud upsert/delete runs
 * fire-and-forget. On sign-in we hydrate from cloud and merge into
 * the local cache. Offline edits are pushed on next `syncFromCloud`
 * via simple last-write-wins per effect_id.
 */

import { create } from 'zustand';
import type { Effect } from '@/data/effectLibrary';
import { supabase } from '@/integrations/supabase/client';

// Table created via migration; supabase types may lag a refresh, so we
// access this table through an untyped handle to keep the store decoupled
// from the generated Database schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fweTable = () => (supabase as any).from('imported_fwe_effects');

const LS_KEY = 'fxk.imported-fwe-effects.v1';

function loadFromStorage(): Effect[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is Effect => !!e && typeof e.id === 'string');
  } catch {
    return [];
  }
}

function saveToStorage(items: Effect[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  } catch {
    /* quota / private mode — ignore */
  }
}

async function getUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

interface ImportedFweState {
  effects: Effect[];
  hydrated: boolean;
  syncing: boolean;
  addOrReplace: (fx: Effect) => void;
  remove: (id: string) => void;
  clear: () => void;
  /** Pull cloud rows + merge with local cache (last-write-wins by presence). */
  syncFromCloud: () => Promise<void>;
  /** Push entire local set to cloud (used after sign-in if cloud was empty). */
  pushAllToCloud: () => Promise<void>;
}

export const useImportedFweStore = create<ImportedFweState>((set, get) => ({
  effects: loadFromStorage(),
  hydrated: false,
  syncing: false,

  addOrReplace: (fx) => {
    const next = [...get().effects.filter((e) => e.id !== fx.id), fx];
    saveToStorage(next);
    set({ effects: next });
    // Fire-and-forget cloud upsert
    void (async () => {
      const userId = await getUserId();
      if (!userId) return;
      try {
        await fweTable().upsert(
          { user_id: userId, effect_id: fx.id, effect: fx as unknown as Record<string, unknown> },
          { onConflict: 'user_id,effect_id' },
        );
      } catch {
        /* offline — local cache will reconcile on next syncFromCloud */
      }
    })();
  },

  remove: (id) => {
    const next = get().effects.filter((e) => e.id !== id);
    saveToStorage(next);
    set({ effects: next });
    void (async () => {
      const userId = await getUserId();
      if (!userId) return;
      try {
        await fweTable().delete().eq('user_id', userId).eq('effect_id', id);
      } catch {
        /* ignore */
      }
    })();
  },

  clear: () => {
    saveToStorage([]);
    set({ effects: [] });
    void (async () => {
      const userId = await getUserId();
      if (!userId) return;
      try {
        await fweTable().delete().eq('user_id', userId);
      } catch {
        /* ignore */
      }
    })();
  },

  syncFromCloud: async () => {
    const userId = await getUserId();
    if (!userId) {
      set({ hydrated: true });
      return;
    }
    set({ syncing: true });
    try {
      const { data, error } = await fweTable()
        .select('effect_id, effect')
        .eq('user_id', userId);
      if (error) throw error;

      const cloudMap = new Map<string, Effect>();
      for (const row of (data ?? []) as Array<{ effect_id: string; effect: unknown }>) {
        const fx = row.effect as Effect;
        if (fx && typeof fx.id === 'string') cloudMap.set(row.effect_id, fx);
      }
      const localOnly = get().effects.filter((e) => !cloudMap.has(e.id));

      // Merge: cloud wins for shared ids; locals not in cloud get pushed up.
      const merged = [...cloudMap.values(), ...localOnly];
      saveToStorage(merged);
      set({ effects: merged, hydrated: true });

      if (localOnly.length > 0) {
        try {
          await fweTable().upsert(
            localOnly.map((fx) => ({
              user_id: userId,
              effect_id: fx.id,
              effect: fx as unknown as Record<string, unknown>,
            })),
            { onConflict: 'user_id,effect_id' },
          );
        } catch {
          /* ignore — will retry next sync */
        }
      }
    } catch {
      set({ hydrated: true });
    } finally {
      set({ syncing: false });
    }
  },

  pushAllToCloud: async () => {
    const userId = await getUserId();
    if (!userId) return;
    const items = get().effects;
    if (items.length === 0) return;
    try {
      await fweTable().upsert(
        items.map((fx) => ({
          user_id: userId,
          effect_id: fx.id,
          effect: fx as unknown as Record<string, unknown>,
        })),
        { onConflict: 'user_id,effect_id' },
      );
    } catch {
      /* ignore */
    }
  },
}));

// ─── Auth-driven hydration ──────────────────────────────────────
// Sync once on module load (covers refresh with active session) and
// re-sync whenever the user signs in. Sign-out keeps the local cache
// untouched so the user can keep working offline.
if (typeof window !== 'undefined') {
  void useImportedFweStore.getState().syncFromCloud();
  try {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        void useImportedFweStore.getState().syncFromCloud();
      }
    });
  } catch {
    /* supabase client not ready — fine */
  }
}
