CREATE TABLE public.market_briefings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  briefing_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  contexto_input TEXT,
  briefing_text TEXT NOT NULL,
  regimen TEXT NOT NULL,
  posiciones_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.market_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own briefings"
ON public.market_briefings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own briefings"
ON public.market_briefings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own briefings"
ON public.market_briefings FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own briefings"
ON public.market_briefings FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_market_briefings_updated_at
BEFORE UPDATE ON public.market_briefings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_market_briefings_user_date ON public.market_briefings(user_id, briefing_date DESC);