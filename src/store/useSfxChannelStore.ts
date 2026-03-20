/**
 * Shared SFX Channel Store — bridges Showven Equipment Panel ↔ FX Commander
 * Auto-links positions to SFX channels and tests Art-Net connectivity.
 */
import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { SFXChannel, SFXType } from '@/components/editor/live-firing/types';
import { SFX_TYPES, DEFAULT_CHANNELS } from '@/components/editor/live-firing/constants';

interface ArtNetTestResult {
  connected: boolean;
  latencyMs: number;
  error?: string;
}

interface SfxChannelStore {
  channels: SFXChannel[];
  artNetStatus: ArtNetTestResult | null;
  artNetTesting: boolean;

  // Channel CRUD
  setChannels: (channels: SFXChannel[]) => void;
  updateChannels: (updater: (prev: SFXChannel[]) => SFXChannel[]) => void;
  addChannel: (channel: SFXChannel) => void;
  removeChannel: (id: string) => void;
  removeChannels: (ids: Set<string>) => void;

  // Auto-link from equipment panel
  addChannelFromPosition: (opts: {
    positionId: string;
    name: string;
    sfxType: SFXType;
    dmxChannels?: number;
    manufacturer?: string;
  }) => SFXChannel;

  // Art-Net
  testArtNetConnection: () => Promise<ArtNetTestResult>;

  // Helpers
  getNextDmxAddress: () => number;
}

export const useSfxChannelStore = create<SfxChannelStore>((set, get) => ({
  channels: DEFAULT_CHANNELS,
  artNetStatus: null,
  artNetTesting: false,

  setChannels: (channels) => set({ channels }),

  updateChannels: (updater) => set((s) => ({ channels: updater(s.channels) })),

  addChannel: (channel) => set((s) => ({ channels: [...s.channels, channel] })),

  removeChannel: (id) => set((s) => ({ channels: s.channels.filter(c => c.id !== id) })),

  removeChannels: (ids) => set((s) => ({ channels: s.channels.filter(c => !ids.has(c.id)) })),

  getNextDmxAddress: () => {
    const { channels } = get();
    if (channels.length === 0) return 1;
    return Math.max(...channels.map(c => c.dmxAddress + c.dmxChannels));
  },

  addChannelFromPosition: ({ positionId, name, sfxType, dmxChannels, manufacturer }) => {
    const state = get();
    const typeInfo = SFX_TYPES.find(t => t.key === sfxType);
    const chCount = dmxChannels ?? typeInfo?.defaultChannels ?? 2;
    const nextAddr = state.getNextDmxAddress();

    const channel: SFXChannel = {
      id: `sfx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.toUpperCase(),
      type: sfxType,
      dmxUniverse: 1,
      dmxAddress: nextAddr,
      dmxChannels: chCount,
      armed: false,
      firing: false,
      duration: typeInfo?.defaultDuration ?? 2000,
      intensity: 200,
      color: typeInfo?.color ?? '#FFFFFF',
      locked: false,
      enabled: true,
      positionId,
      manufacturer: manufacturer ?? 'SHOWVEN',
    };

    set((s) => ({ channels: [...s.channels, channel] }));
    return channel;
  },

  testArtNetConnection: async () => {
    set({ artNetTesting: true });
    const start = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke('artnet-bridge', {
        body: {
          action: 'validate',
          universes: [{ universe: 0, subnet: 0, net: 0, channels: [0], sequence: 0 }],
        },
      });

      const latencyMs = Math.round(performance.now() - start);

      if (error) {
        const result: ArtNetTestResult = { connected: false, latencyMs, error: error.message };
        set({ artNetStatus: result, artNetTesting: false });
        return result;
      }

      const result: ArtNetTestResult = { connected: true, latencyMs };
      set({ artNetStatus: result, artNetTesting: false });
      return result;
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - start);
      const result: ArtNetTestResult = { connected: false, latencyMs, error: err?.message ?? 'Unknown error' };
      set({ artNetStatus: result, artNetTesting: false });
      return result;
    }
  },
}));
