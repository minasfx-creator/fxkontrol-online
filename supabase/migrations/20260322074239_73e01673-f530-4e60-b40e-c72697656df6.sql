CREATE TABLE public.artnet_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'MODULE',
  module_address integer NOT NULL DEFAULT 0,
  dmx_universe integer NOT NULL DEFAULT 0,
  dmx_subnet integer NOT NULL DEFAULT 0,
  dmx_net integer NOT NULL DEFAULT 0,
  dmx_start_address integer NOT NULL DEFAULT 1,
  dmx_channel_count integer NOT NULL DEFAULT 32,
  ip text NOT NULL DEFAULT '192.168.1.100',
  port integer NOT NULL DEFAULT 6454,
  transport text NOT NULL DEFAULT 'lan',
  relay_token text,
  channel_count integer NOT NULL DEFAULT 32,
  label text,
  relay_server_url text,
  gps_lat numeric,
  gps_lng numeric,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.artnet_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own artnet modules"
  ON public.artnet_modules FOR ALL TO authenticated
  USING (is_project_owner(project_id))
  WITH CHECK (is_project_owner(project_id));