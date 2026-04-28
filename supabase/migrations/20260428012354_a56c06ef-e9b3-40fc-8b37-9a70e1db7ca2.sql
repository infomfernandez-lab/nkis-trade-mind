ALTER TABLE public.user_settings ALTER COLUMN balance_nkis SET DEFAULT 0;
UPDATE public.user_settings SET balance_nkis = 0 WHERE balance_nkis = 1000000;