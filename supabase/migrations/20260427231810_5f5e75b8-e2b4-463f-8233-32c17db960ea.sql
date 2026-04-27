-- Reset balance_octx to 0 until sync updates it
UPDATE public.user_settings SET balance_octx = 0;
ALTER TABLE public.user_settings ALTER COLUMN balance_octx SET DEFAULT 0;

-- Enable realtime for user_settings so the calculator updates live
ALTER TABLE public.user_settings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_settings;