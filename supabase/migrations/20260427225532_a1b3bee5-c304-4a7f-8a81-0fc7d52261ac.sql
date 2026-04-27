ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS balance_nkis numeric NOT NULL DEFAULT 1000000,
  ADD COLUMN IF NOT EXISTS balance_octx numeric NOT NULL DEFAULT 26.39;