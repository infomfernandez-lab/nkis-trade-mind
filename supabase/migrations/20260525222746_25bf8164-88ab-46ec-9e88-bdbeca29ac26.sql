
CREATE TABLE public.backtest_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  broker text NOT NULL,
  direction text NOT NULL,
  date_from date,
  date_to date,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  equity_curve jsonb NOT NULL DEFAULT '[]'::jsonb,
  trades jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_backtest_sessions_user_created ON public.backtest_sessions(user_id, created_at DESC);

ALTER TABLE public.backtest_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own backtests" ON public.backtest_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own backtests" ON public.backtest_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own backtests" ON public.backtest_sessions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users delete own backtests" ON public.backtest_sessions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
