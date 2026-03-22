import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { artnetModuleService, type ArtNetModuleConfig, type ModuleTransport, type RedundancyMode } from '@/services/artnetModuleService';

interface DbModule {
  id: string;
  project_id: string;
  name: string;
  module_address: number;
  dmx_universe: number;
  dmx_subnet: number;
  dmx_net: number;
  dmx_start_address: number;
  dmx_channel_count: number;
  ip: string;
  port: number;
  transport: string;
  relay_token: string | null;
  channel_count: number;
  label: string | null;
  relay_server_url: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  sort_order: number;
  clone_of: string | null;
  redundancy_mode: string;
}

function dbToConfig(row: DbModule): Partial<ArtNetModuleConfig> {
  return {
    id: row.id,
    name: row.name,
    moduleAddress: row.module_address,
    dmxUniverse: row.dmx_universe,
    dmxSubnet: row.dmx_subnet,
    dmxNet: row.dmx_net,
    dmxStartAddress: row.dmx_start_address,
    dmxChannelCount: row.dmx_channel_count,
    ip: row.ip,
    port: row.port,
    transport: row.transport as ModuleTransport,
    relayToken: row.relay_token ?? undefined,
    channelCount: row.channel_count,
    label: row.label ?? undefined,
    gpsLat: row.gps_lat ?? undefined,
    gpsLng: row.gps_lng ?? undefined,
    cloneOf: row.clone_of ?? undefined,
    redundancyMode: (row.redundancy_mode as RedundancyMode) ?? 'failover',
  };
}

function configToDb(mod: ArtNetModuleConfig, projectId: string, sortOrder: number) {
  return {
    id: mod.id,
    project_id: projectId,
    name: mod.name,
    module_address: mod.moduleAddress,
    dmx_universe: mod.dmxUniverse,
    dmx_subnet: mod.dmxSubnet,
    dmx_net: mod.dmxNet,
    dmx_start_address: mod.dmxStartAddress,
    dmx_channel_count: mod.dmxChannelCount,
    ip: mod.ip,
    port: mod.port,
    transport: mod.transport,
    relay_token: mod.relayToken || null,
    channel_count: mod.channelCount,
    label: mod.label || null,
    gps_lat: mod.gpsLat ?? null,
    gps_lng: mod.gpsLng ?? null,
    sort_order: sortOrder,
    clone_of: mod.cloneOf || null,
    redundancy_mode: mod.redundancyMode || 'failover',
  };
}

export function useArtNetModulePersistence(projectId: string | null) {
  const loadedRef = useRef(false);

  // Load modules from DB on mount
  useEffect(() => {
    if (!projectId || loadedRef.current) return;
    loadedRef.current = true;

    (async () => {
      const { data, error } = await supabase
        .from('artnet_modules')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order');

      if (error || !data || data.length === 0) return;

      // Init controller if needed
      if (!artnetModuleService.getController()) {
        artnetModuleService.initController({ name: 'FXK MASTER CONTROLLER' });
      }

      // Add each saved module
      const ctrl = artnetModuleService.getController();
      const existingIds = new Set(ctrl?.modules.map(m => m.id) || []);

      for (const row of data as unknown as DbModule[]) {
        if (existingIds.has(row.id)) continue;
        artnetModuleService.addModule(dbToConfig(row));
      }
    })();
  }, [projectId]);

  const saveModule = useCallback(async (mod: ArtNetModuleConfig, sortOrder = 0) => {
    if (!projectId) return;
    const row = configToDb(mod, projectId, sortOrder);
    await supabase.from('artnet_modules').upsert(row, { onConflict: 'id' });
  }, [projectId]);

  const deleteModule = useCallback(async (moduleId: string) => {
    if (!projectId) return;
    await supabase.from('artnet_modules').delete().eq('id', moduleId);
  }, [projectId]);

  const saveAllModules = useCallback(async () => {
    if (!projectId) return;
    const ctrl = artnetModuleService.getController();
    if (!ctrl) return;
    const rows = ctrl.modules.map((m, i) => configToDb(m, projectId, i));
    if (rows.length > 0) {
      await supabase.from('artnet_modules').upsert(rows, { onConflict: 'id' });
    }
  }, [projectId]);

  return { saveModule, deleteModule, saveAllModules };
}
