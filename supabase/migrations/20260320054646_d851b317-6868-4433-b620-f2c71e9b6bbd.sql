
CREATE TABLE public.layout_presets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  preset_base text NOT NULL DEFAULT 'stage',
  category_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.layout_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own layout presets"
ON public.layout_presets
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
