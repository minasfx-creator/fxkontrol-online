ALTER TABLE public.timeline_items 
  ADD COLUMN IF NOT EXISTS position_id TEXT,
  ADD COLUMN IF NOT EXISTS position_name TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;