/**
 * Viewport Tools — Plugin Registry
 * ────────────────────────────────────────────────────────────
 * Central, write-once registry. Plugins call `registerSegmentPlugin` at
 * module load time. The toolbar / panel / dispatcher read from here.
 *
 * Not a Zustand store on purpose: registration is a build-time side-effect,
 * not user state. Listeners are notified once on register so the UI can
 * mount lazily.
 */

import type { SegmentType, ViewportSegmentPlugin } from './types';

type Listener = () => void;

class ViewportToolRegistry {
  private _plugins = new Map<SegmentType, ViewportSegmentPlugin>();
  private _listeners = new Set<Listener>();

  register(plugin: ViewportSegmentPlugin): void {
    if (this._plugins.has(plugin.segment)) {
      // Hot-reload friendly: replace silently.
      this._plugins.set(plugin.segment, plugin);
    } else {
      this._plugins.set(plugin.segment, plugin);
    }
    this._emit();
  }

  get(segment: SegmentType): ViewportSegmentPlugin | undefined {
    return this._plugins.get(segment);
  }

  list(): ViewportSegmentPlugin[] {
    return Array.from(this._plugins.values());
  }

  subscribe(fn: Listener): () => void {
    this._listeners.add(fn);
    return () => {
      this._listeners.delete(fn);
    };
  }

  private _emit(): void {
    for (const fn of this._listeners) {
      try {
        fn();
      } catch {
        /* listener errors must not break the registry */
      }
    }
  }
}

export const viewportToolRegistry = new ViewportToolRegistry();

export function registerSegmentPlugin(plugin: ViewportSegmentPlugin): void {
  viewportToolRegistry.register(plugin);
}
