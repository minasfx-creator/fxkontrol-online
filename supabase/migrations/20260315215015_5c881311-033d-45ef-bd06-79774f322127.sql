CREATE TABLE public.show_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  
  -- Finale 3D / Pyro
  nfpa_category text DEFAULT '1.4G',
  safety_radius numeric DEFAULT 70,
  fallout_radius numeric DEFAULT 100,
  firing_system text DEFAULT 'cobra',
  module_count integer DEFAULT 1,
  channel_count integer DEFAULT 32,
  
  -- Skybrush / Drone
  fleet_size integer DEFAULT 100,
  protocol text DEFAULT 'flockwave',
  start_method text DEFAULT 'rc',
  geofence_radius numeric DEFAULT 200,
  led_fps integer DEFAULT 30,
  max_velocity numeric DEFAULT 8,
  max_altitude numeric DEFAULT 120,
  
  -- Environment
  gps_lat numeric DEFAULT 0,
  gps_lng numeric DEFAULT 0,
  gps_alt numeric DEFAULT 0,
  timezone text DEFAULT 'UTC',
  venue_name text DEFAULT '',
  
  -- Weather
  temperature numeric DEFAULT 22,
  humidity numeric DEFAULT 0.4,
  wind_speed numeric DEFAULT 0,
  wind_direction numeric DEFAULT 0,
  
  -- Metadata
  client_name text DEFAULT '',
  show_date date,
  license_number text DEFAULT '',
  notes text DEFAULT '',
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(project_id)
);

ALTER TABLE public.show_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own show settings"
ON public.show_settings
FOR ALL
TO authenticated
USING (is_project_owner(project_id))
WITH CHECK (is_project_owner(project_id));

CREATE TRIGGER update_show_settings_updated_at
  BEFORE UPDATE ON public.show_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();