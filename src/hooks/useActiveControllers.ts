/**
 * ─── useActiveControllers — Auto-open controller on device recognition ─
 * Subscribes to `deviceAggregator` and maintains a reactive list of
 * "active controllers" — one entry per online `PhysicalDevice` whose
 * family resolves to a known controller kind. Drives the
 * `AutoControllerLauncher` overlay.
 *
 * Rules:
 *   • A device entering `online: true` (event 'added' or 'link-recovered'
 *     or 'promoted') AND having a recognised family → entry created.
 *   • Device going offline ('removed' or all links lost) → entry dropped.
 *   • The operator can dismiss an entry (acknowledged: true) — it stays
 *     in the list but the launcher overlay hides it. A new
 *     'link-recovered' event re-shows it.
 *
 * No I/O here: this hook is a pure observer over the aggregator + a
 * small per-controller state map kept in module scope so multiple
 * components see the same dismissal state.
 */
import { useEffect, useState } from 'react';
import { deviceAggregator } from '@/core/discovery/DeviceAggregator';
import type { PhysicalDevice, PhysicalDeviceEvent } from '@/core/discovery/types';
import {
  resolveControllerProfile,
  isAutoOpenable,
  type ControllerProfile,
  type ControllerKind,
} from '@/core/discovery/controllerRegistry';

export interface ActiveController {
  aggregateId: string;
  device: PhysicalDevice;
  profile: ControllerProfile;
  /** When the controller became active (first online + recognised). */
  openedAt: number;
  /** Last time we saw any link event for this device. */
  lastSeen: number;
  /** True once the operator dismissed the launcher card. */
  acknowledged: boolean;
}

// ─── Module-scoped state shared by all hook consumers ─────────────
const _active = new Map<string, ActiveController>();
const _listeners = new Set<() => void>();
let _started = false;

function snapshot(): ActiveController[] {
  return [..._active.values()].sort((a, b) => b.openedAt - a.openedAt);
}

function notify(): void {
  for (const fn of _listeners) {
    try { fn(); } catch { /* never break safety on listener errors */ }
  }
}

function upsert(dev: PhysicalDevice, reason: 'opened' | 'recovered'): void {
  if (!isAutoOpenable(dev)) return;
  const existing = _active.get(dev.aggregateId);
  const profile = resolveControllerProfile(dev);
  if (existing) {
    existing.device = dev;
    existing.profile = profile;
    existing.lastSeen = Date.now();
    if (reason === 'recovered') existing.acknowledged = false; // re-surface
  } else {
    _active.set(dev.aggregateId, {
      aggregateId: dev.aggregateId,
      device: dev,
      profile,
      openedAt: Date.now(),
      lastSeen: Date.now(),
      acknowledged: false,
    });
  }
  notify();
}

function drop(aggregateId: string): void {
  if (_active.delete(aggregateId)) notify();
}

function handleEvent(ev: PhysicalDeviceEvent): void {
  switch (ev.type) {
    case 'added':
    case 'link-added':
    case 'promoted':
      if (ev.device.online) upsert(ev.device, 'opened');
      break;
    case 'link-recovered':
      if (ev.device.online) upsert(ev.device, 'recovered');
      break;
    case 'link-updated':
      // Refresh metadata only — never resurface a dismissed card.
      if (_active.has(ev.device.aggregateId) && ev.device.online) {
        const cur = _active.get(ev.device.aggregateId)!;
        cur.device = ev.device;
        cur.profile = resolveControllerProfile(ev.device);
        cur.lastSeen = Date.now();
        notify();
      }
      break;
    case 'link-lost':
    case 'link-quarantined':
      // Only drop when device is fully offline.
      if (!ev.device.online) drop(ev.device.aggregateId);
      break;
    case 'removed':
      drop(ev.device.aggregateId);
      break;
  }
}

function ensureStarted(): void {
  if (_started) return;
  _started = true;
  // Seed with already-online recognised devices.
  for (const dev of deviceAggregator.getDevices()) {
    if (dev.online && isAutoOpenable(dev)) upsert(dev, 'opened');
  }
  deviceAggregator.watch(handleEvent);
}

// ─── Public API ───────────────────────────────────────────────────

export interface UseActiveControllersApi {
  controllers: ActiveController[];
  /** Visible (non-acknowledged) controllers — for the overlay. */
  pending: ActiveController[];
  acknowledge: (aggregateId: string) => void;
  /** Force-close a controller card (and forget it until re-discovery). */
  close: (aggregateId: string) => void;
}

export function useActiveControllers(): UseActiveControllersApi {
  const [, force] = useState(0);

  useEffect(() => {
    ensureStarted();
    const tick = () => force((n) => n + 1);
    _listeners.add(tick);
    return () => { _listeners.delete(tick); };
  }, []);

  const controllers = snapshot();
  const pending = controllers.filter((c) => !c.acknowledged && c.device.online);

  return {
    controllers,
    pending,
    acknowledge: (id: string) => {
      const c = _active.get(id);
      if (c && !c.acknowledged) { c.acknowledged = true; notify(); }
    },
    close: (id: string) => drop(id),
  };
}

/** Non-React accessor for tests / debug. */
export function getActiveControllers(): ActiveController[] {
  ensureStarted();
  return snapshot();
}

export type { ControllerKind };
