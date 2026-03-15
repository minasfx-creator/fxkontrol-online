import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProjectStore } from '@/store/useProjectStore';
import { toast } from 'sonner';

export interface ShowSettings {
  // Finale 3D / Pyro
  nfpa_category: string;
  safety_radius: number;
  fallout_radius: number;
  firing_system: string;
  module_count: number;
  channel_count: number;
  // Skybrush / Drone
  fleet_size: number;
  protocol: string;
  start_method: string;
  geofence_radius: number;
  led_fps: number;
  max_velocity: number;
  max_altitude: number;
  // Environment
  gps_lat: number;
  gps_lng: number;
  gps_alt: number;
  timezone: string;
  venue_name: string;
  // Weather
  temperature: number;
  humidity: number;
  wind_speed: number;
  wind_direction: number;
  // Metadata
  client_name: string;
  show_date: string | null;
  license_number: string;
  notes: string;
}

const DEFAULT_SETTINGS: ShowSettings = {
  nfpa_category: '1.4G',
  safety_radius: 70,
  fallout_radius: 100,
  firing_system: 'cobra',
  module_count: 1,
  channel_count: 32,
  fleet_size: 100,
  protocol: 'flockwave',
  start_method: 'rc',
  geofence_radius: 200,
  led_fps: 30,
  max_velocity: 8,
  max_altitude: 120,
  gps_lat: 0,
  gps_lng: 0,
  gps_alt: 0,
  timezone: 'UTC',
  venue_name: '',
  temperature: 22,
  humidity: 0.4,
  wind_speed: 0,
  wind_direction: 0,
  client_name: '',
  show_date: null,
  license_number: '',
  notes: '',
};

export function useShowSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ShowSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);

  const loadSettings = useCallback(async () => {
    const projectId = useProjectStore.getState().projectId;
    if (!user || !projectId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('show_settings')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setSettings({
          nfpa_category: data.nfpa_category || '1.4G',
          safety_radius: Number(data.safety_radius) || 70,
          fallout_radius: Number(data.fallout_radius) || 100,
          firing_system: data.firing_system || 'cobra',
          module_count: data.module_count || 1,
          channel_count: data.channel_count || 32,
          fleet_size: data.fleet_size || 100,
          protocol: data.protocol || 'flockwave',
          start_method: data.start_method || 'rc',
          geofence_radius: Number(data.geofence_radius) || 200,
          led_fps: data.led_fps || 30,
          max_velocity: Number(data.max_velocity) || 8,
          max_altitude: Number(data.max_altitude) || 120,
          gps_lat: Number(data.gps_lat) || 0,
          gps_lng: Number(data.gps_lng) || 0,
          gps_alt: Number(data.gps_alt) || 0,
          timezone: data.timezone || 'UTC',
          venue_name: data.venue_name || '',
          temperature: Number(data.temperature) || 22,
          humidity: Number(data.humidity) || 0.4,
          wind_speed: Number(data.wind_speed) || 0,
          wind_direction: Number(data.wind_direction) || 0,
          client_name: data.client_name || '',
          show_date: data.show_date,
          license_number: data.license_number || '',
          notes: data.notes || '',
        });
      }
    } catch (err: any) {
      console.error('Load show settings error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const saveSettings = useCallback(async (newSettings: Partial<ShowSettings>) => {
    const projectId = useProjectStore.getState().projectId;
    if (!user || !projectId) {
      toast.error('Salve o projeto antes de configurar');
      return false;
    }

    const merged = { ...settings, ...newSettings };
    setSettings(merged);

    try {
      const { error } = await supabase
        .from('show_settings')
        .upsert({
          project_id: projectId,
          ...merged,
        }, { onConflict: 'project_id' });

      if (error) throw error;
      return true;
    } catch (err: any) {
      console.error('Save show settings error:', err);
      toast.error('Erro ao salvar configurações');
      return false;
    }
  }, [user, settings]);

  // Auto-load when project changes
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Also reload when projectId changes
  useEffect(() => {
    const unsub = useProjectStore.subscribe(loadSettings);
    return unsub;
  }, [loadSettings]);

  return { settings, saveSettings, loading, loadSettings };
}
