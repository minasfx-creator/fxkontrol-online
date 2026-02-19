
-- Projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Untitled Show',
  duration NUMERIC NOT NULL DEFAULT 120,
  audio_url TEXT,
  bpm NUMERIC,
  playback_speed NUMERIC NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own projects" ON public.projects FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Helper function (after table exists)
CREATE OR REPLACE FUNCTION public.is_project_owner(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects WHERE id = p_project_id AND user_id = auth.uid()
  );
$$;

-- Positions table
CREATE TABLE public.positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'drone-pad',
  x NUMERIC NOT NULL DEFAULT 0,
  y NUMERIC NOT NULL DEFAULT 0,
  z NUMERIC NOT NULL DEFAULT 0,
  heading NUMERIC NOT NULL DEFAULT 0,
  pitch NUMERIC NOT NULL DEFAULT 0,
  roll NUMERIC NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#00B4D8',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own positions" ON public.positions FOR ALL USING (public.is_project_owner(project_id)) WITH CHECK (public.is_project_owner(project_id));

-- Trajectories table
CREATE TABLE public.trajectories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  position_id UUID NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Trajectory',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.trajectories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own trajectories" ON public.trajectories FOR ALL USING (public.is_project_owner(project_id)) WITH CHECK (public.is_project_owner(project_id));

-- Waypoints table
CREATE TABLE public.waypoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trajectory_id UUID NOT NULL REFERENCES public.trajectories(id) ON DELETE CASCADE,
  x NUMERIC NOT NULL DEFAULT 0,
  y NUMERIC NOT NULL DEFAULT 0,
  z NUMERIC NOT NULL DEFAULT 0,
  time_seconds NUMERIC NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.waypoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own waypoints" ON public.waypoints FOR ALL
USING (EXISTS (SELECT 1 FROM public.trajectories t WHERE t.id = trajectory_id AND public.is_project_owner(t.project_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.trajectories t WHERE t.id = trajectory_id AND public.is_project_owner(t.project_id)));

-- Timeline items table
CREATE TABLE public.timeline_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  effect_id TEXT NOT NULL,
  start_time NUMERIC NOT NULL DEFAULT 0,
  track_index INT NOT NULL DEFAULT 0,
  pos_x NUMERIC NOT NULL DEFAULT 0,
  pos_y NUMERIC NOT NULL DEFAULT 0,
  pos_z NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.timeline_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own timeline items" ON public.timeline_items FOR ALL USING (public.is_project_owner(project_id)) WITH CHECK (public.is_project_owner(project_id));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audio storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('audio', 'audio', false);

CREATE POLICY "Users upload own audio" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own audio" ON storage.objects FOR SELECT
USING (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own audio" ON storage.objects FOR DELETE
USING (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]);
