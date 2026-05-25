
-- 1. calculadora_registro: add user_id, scope policies
ALTER TABLE public.calculadora_registro ADD COLUMN IF NOT EXISTS user_id uuid;
DROP POLICY IF EXISTS "Public read" ON public.calculadora_registro;
DROP POLICY IF EXISTS "Public insert" ON public.calculadora_registro;
DROP POLICY IF EXISTS "Public delete" ON public.calculadora_registro;
CREATE POLICY "Users view own calc" ON public.calculadora_registro FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own calc" ON public.calculadora_registro FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own calc" ON public.calculadora_registro FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 2. momentum_sessions: add user_id, scope policies
ALTER TABLE public.momentum_sessions ADD COLUMN IF NOT EXISTS user_id uuid;
DROP POLICY IF EXISTS "Public read" ON public.momentum_sessions;
DROP POLICY IF EXISTS "Public insert" ON public.momentum_sessions;
CREATE POLICY "Users view own momentum" ON public.momentum_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own momentum" ON public.momentum_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own momentum" ON public.momentum_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own momentum" ON public.momentum_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3. trade-charts: make private and enforce ownership via path prefix = auth.uid()
UPDATE storage.buckets SET public = false WHERE id = 'trade-charts';
DROP POLICY IF EXISTS "trade-charts public read" ON storage.objects;
DROP POLICY IF EXISTS "trade-charts auth insert" ON storage.objects;
DROP POLICY IF EXISTS "trade-charts auth update" ON storage.objects;
DROP POLICY IF EXISTS "trade-charts auth delete" ON storage.objects;
CREATE POLICY "trade-charts owner read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'trade-charts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "trade-charts owner insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'trade-charts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "trade-charts owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'trade-charts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "trade-charts owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'trade-charts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 4. Remove user_settings from realtime publication (api_key/account_number exposure)
ALTER PUBLICATION supabase_realtime DROP TABLE public.user_settings;

-- 5. Lock down SECURITY DEFINER trigger function
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
