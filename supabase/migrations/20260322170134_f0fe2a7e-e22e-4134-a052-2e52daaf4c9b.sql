CREATE TABLE public.dmx_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'Art-Net',
  protocol text NOT NULL DEFAULT 'Art-Net',
  universe integer NOT NULL DEFAULT 0,
  channel_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dmx_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own dmx logs" ON public.dmx_logs
  FOR ALL TO authenticated
  USING (is_project_owner(project_id))
  WITH CHECK (is_project_owner(project_id));

CREATE INDEX idx_dmx_logs_project_session ON public.dmx_logs(project_id, session_id);