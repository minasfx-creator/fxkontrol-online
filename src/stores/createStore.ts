/**
 * ─── Store Factory ────────────────────────────────────────────────
 * Standardized middleware stack for the consolidated macro-stores
 * (mission / hardwareSync / simulation / uiWorkspace).
 *
 * Stack (outer → inner):
 *   devtools → subscribeWithSelector → persist → immer
 *
 * Why this order:
 * - devtools wraps everything so Redux DevTools sees every transition.
 * - subscribeWithSelector enables fine-grained subscriptions for hot
 *   paths (timeline tick, viewport frame, hardware sync) without
 *   triggering full re-renders.
 * - persist serializes only the slice returned by `partialize` so we
 *   never bloat localStorage with transient runtime state.
 * - immer is innermost so producers always operate on a draft.
 *
 * Storage key convention: `fx-kontrol-<name>`.
 */
import { create, type StateCreator } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { useShallow } from 'zustand/react/shallow';

export interface CreateStoreOptions<T> {
  /** Subset of state to persist. Defaults to nothing (in-memory only). */
  partialize?: (state: T) => Partial<T>;
  /** Bump when the persisted shape changes to invalidate old caches. */
  version?: number;
  /** Disable persistence entirely (still keeps devtools/immer/subscribe). */
  skipPersist?: boolean;
}

export function createStore<T extends object>(
  name: string,
  initializer: StateCreator<
    T,
    [
      ['zustand/devtools', never],
      ['zustand/subscribeWithSelector', never],
      ['zustand/persist', unknown],
      ['zustand/immer', never],
    ],
    [],
    T
  >,
  options: CreateStoreOptions<T> = {},
) {
  const { partialize, version = 1, skipPersist = false } = options;
  const storageName = `fx-kontrol-${name}`;

  if (skipPersist) {
    return create<T>()(
      devtools(
        subscribeWithSelector(
          // @ts-expect-error — middleware tuple narrows when persist is omitted
          immer(initializer),
        ),
        { name: storageName, enabled: import.meta.env.DEV },
      ),
    );
  }

  return create<T>()(
    devtools(
      subscribeWithSelector(
        persist(
          immer(initializer),
          {
            name: storageName,
            version,
            partialize: partialize
              ? (state) => partialize(state) as T
              : () => ({}) as T,
          },
        ),
      ),
      { name: storageName, enabled: import.meta.env.DEV },
    ),
  );
}

export { useShallow };
