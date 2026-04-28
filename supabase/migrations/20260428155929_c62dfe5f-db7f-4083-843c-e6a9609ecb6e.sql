CREATE TABLE public.daily_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  report_date date NOT NULL,
  broker_filter text NOT NULL DEFAULT 'all',
  market_context text,
  system_followed text,
  errors jsonb DEFAULT '[]'::jsonb,
  lesson text,
  plan_tomorrow text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, report_date, broker_filter)
);

ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own daily reports" ON public.daily_reports
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own daily reports" ON public.daily_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own daily reports" ON public.daily_reports
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own daily reports" ON public.daily_reports
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER daily_reports_updated_at
  BEFORE UPDATE ON public.daily_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();