ALTER TABLE public.artnet_modules 
  ADD COLUMN clone_of uuid REFERENCES public.artnet_modules(id) ON DELETE SET NULL,
  ADD COLUMN redundancy_mode text NOT NULL DEFAULT 'failover';