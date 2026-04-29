
CREATE TABLE public.qualification_checklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  broker TEXT NOT NULL DEFAULT 'darwinex',
  direction TEXT NOT NULL,
  checklist_date DATE NOT NULL DEFAULT CURRENT_DATE,
  c1_elite BOOLEAN NOT NULL DEFAULT false,
  c2_direction BOOLEAN NOT NULL DEFAULT false,
  c3_signal_candle BOOLEAN NOT NULL DEFAULT false,
  c4_prev_candle BOOLEAN NOT NULL DEFAULT false,
  c5_adx BOOLEAN NOT NULL DEFAULT false,
  c6_sizing BOOLEAN NOT NULL DEFAULT false,
  c7_sl_mt5 BOOLEAN NOT NULL DEFAULT false,
  c1_at TIMESTAMPTZ,
  c2_at TIMESTAMPTZ,
  c3_at TIMESTAMPTZ,
  c4_at TIMESTAMPTZ,
  c5_at TIMESTAMPTZ,
  c6_at TIMESTAMPTZ,
  c7_at TIMESTAMPTZ,
  score INTEGER NOT NULL DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'escaneado',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX qualification_checklist_unique_day
  ON public.qualification_checklist (user_id, symbol, broker, checklist_date);

CREATE INDEX qualification_checklist_user_date_idx
  ON public.qualification_checklist (user_id, checklist_date DESC);

ALTER TABLE public.qualification_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own checklist"
  ON public.qualification_checklist FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own checklist"
  ON public.qualification_checklist FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own checklist"
  ON public.qualification_checklist FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own checklist"
  ON public.qualification_checklist FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_qualification_checklist_updated_at
  BEFORE UPDATE ON public.qualification_checklist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
