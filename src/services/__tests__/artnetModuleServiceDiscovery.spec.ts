import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }) } },
}));

vi.mock('@/core/protocols/ArtNetBridge', () => {
  const nodes = [
    { ip: '192.168.1.42', port: 6454, shortName: 'FXK-M1 NODE', longName: 'FXK-M1 Field Module', universes: [0], lastSeen: Date.now() },
    { ip: '192.168.1.99', port: 6454, shortName: 'IFMx i32Q', longName: 'IFMx-i32Q Pyro', universes: [1], lastSeen: Date.now() },
  ];
  return { artNetBridge: { sendPoll: vi.fn(), getNodes: () => nodes } };
});

import { artnetModuleService } from '@/services/artnetModuleService';
import { moduleAggregator } from '@/lib/moduleAggregator';

describe('artnetModuleService.discoverModules → moduleAggregator', () => {
  beforeEach(() => moduleAggregator._resetForTests());

  it('upserts each ArtPollReply node with inferred model + artnet transport', async () => {
    artnetModuleService.initController({ name: 'Test Controller' });
    await artnetModuleService.discoverModules({ waitMs: 0 });

    const rows = moduleAggregator.list();
    expect(rows.length).toBe(2);
    expect(rows.every(r => r.transport === 'artnet')).toBe(true);
    expect(rows.map(r => r.model).sort()).toEqual(['FXK-M1', 'IFMx-i32Q']);
    expect(rows.find(r => r.address === 42)?.model).toBe('FXK-M1');
    expect(rows.find(r => r.address === 99)?.model).toBe('IFMx-i32Q');
    expect(rows.every(r => r.controllerLabel === 'Test Controller')).toBe(true);
  });
});
