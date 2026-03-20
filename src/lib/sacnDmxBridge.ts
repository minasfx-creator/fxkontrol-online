/**
 * sACN → DMX Engine Bridge
 * Maps sACN universe/channel data from grandMA3 to SFX channels in real-time.
 */

import { getSACNReceiver, type SACNUniverse } from '@/lib/sacnEngine';
import { useSfxChannelStore } from '@/store/useSfxChannelStore';

export interface SACNMapping {
  universe: number;
  startChannel: number;  // 1-based sACN channel
  sfxChannelId: string;
  paramMap: 'intensity' | 'full';  // intensity = single ch, full = multi-ch
}

interface BridgeState {
  running: boolean;
  mappings: SACNMapping[];
  pollInterval: ReturnType<typeof setInterval> | null;
  lastValues: Map<string, number>;
  fps: number;
}

const state: BridgeState = {
  running: false,
  mappings: [],
  pollInterval: null,
  lastValues: new Map(),
  fps: 0,
};

const POLL_RATE_MS = 33; // ~30fps

function processSACNData() {
  const receiver = getSACNReceiver();
  const store = useSfxChannelStore.getState();
  const channels = store.channels;
  let changed = false;

  for (const mapping of state.mappings) {
    const universe = receiver.subscribedUniverses.find(u => u.universe === mapping.universe);
    if (!universe) continue;

    const ch = channels.find(c => c.id === mapping.sfxChannelId);
    if (!ch) continue;

    const val = universe.channels[mapping.startChannel - 1] ?? 0;
    const prevVal = state.lastValues.get(mapping.sfxChannelId) ?? -1;

    if (val === prevVal) continue;
    state.lastValues.set(mapping.sfxChannelId, val);

    if (mapping.paramMap === 'intensity') {
      // Map 0-255 to intensity
      store.updateChannels(prev =>
        prev.map(c => c.id === mapping.sfxChannelId ? { ...c, intensity: val } : c)
      );
      changed = true;

      // Auto-fire when intensity > 0, stop when 0
      if (val > 10 && !ch.firing) {
        store.updateChannels(prev =>
          prev.map(c => c.id === mapping.sfxChannelId ? { ...c, firing: true } : c)
        );
      } else if (val <= 10 && ch.firing) {
        store.updateChannels(prev =>
          prev.map(c => c.id === mapping.sfxChannelId ? { ...c, firing: false } : c)
        );
      }
    }
  }

  if (changed) state.fps++;
}

export function startBridge(): void {
  if (state.running) return;
  state.running = true;
  state.pollInterval = setInterval(processSACNData, POLL_RATE_MS);
}

export function stopBridge(): void {
  state.running = false;
  if (state.pollInterval) {
    clearInterval(state.pollInterval);
    state.pollInterval = null;
  }
  state.lastValues.clear();
  state.fps = 0;
}

export function addMapping(mapping: SACNMapping): void {
  // Remove existing mapping for same sfxChannelId
  state.mappings = state.mappings.filter(m => m.sfxChannelId !== mapping.sfxChannelId);
  state.mappings.push(mapping);
}

export function removeMapping(sfxChannelId: string): void {
  state.mappings = state.mappings.filter(m => m.sfxChannelId !== sfxChannelId);
  state.lastValues.delete(sfxChannelId);
}

export function clearMappings(): void {
  state.mappings = [];
  state.lastValues.clear();
}

export function getMappings(): SACNMapping[] {
  return [...state.mappings];
}

export function isBridgeRunning(): boolean {
  return state.running;
}

export function autoMapUniverseToChannels(universe: number): number {
  const store = useSfxChannelStore.getState();
  let mapped = 0;
  for (const ch of store.channels) {
    if (ch.dmxUniverse === universe) {
      addMapping({
        universe,
        startChannel: ch.dmxAddress,
        sfxChannelId: ch.id,
        paramMap: 'intensity',
      });
      mapped++;
    }
  }
  return mapped;
}
