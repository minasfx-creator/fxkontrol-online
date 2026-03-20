
-- Create user_library_assets table
CREATE TABLE public.user_library_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  source text NOT NULL DEFAULT 'local',
  file_format text NOT NULL DEFAULT 'glb',
  file_size bigint DEFAULT 0,
  file_path text NOT NULL,
  thumbnail_base64 text,
  tags text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_library_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own library assets"
  ON public.user_library_assets FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create assets storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', false);

-- Storage RLS: users can manage their own files (path starts with user_id)
CREATE POLICY "Users upload own assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users read own assets"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'assets' AND (storage.foldername(name))[1] = auth.uid()::text);
