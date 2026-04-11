
-- Utility: update_updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================================
-- TRADES TABLE
-- ============================================================
CREATE TABLE public.trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- MT5 auto-populated
  ticket BIGINT,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('BUY', 'SELL')),
  entry_date TIMESTAMP WITH TIME ZONE NOT NULL,
  exit_date TIMESTAMP WITH TIME ZONE,
  entry_price NUMERIC NOT NULL,
  exit_price NUMERIC,
  sl_price NUMERIC,
  tp_price NUMERIC,
  lot_size NUMERIC NOT NULL DEFAULT 0.01,
  gross_pnl NUMERIC DEFAULT 0,
  commission NUMERIC DEFAULT 0,
  swap NUMERIC DEFAULT 0,
  net_pnl NUMERIC DEFAULT 0,
  duration_hours NUMERIC DEFAULT 0,
  magic_number BIGINT,
  ea_comment TEXT,
  how_closed TEXT,
  is_win BOOLEAN DEFAULT false,
  is_open BOOLEAN DEFAULT false,

  -- Indicator snapshot at entry
  adx_value NUMERIC,
  adx_state TEXT,
  distance_to_ma50 NUMERIC,
  distance_to_ma50_label TEXT,
  momentum_20d NUMERIC,
  momentum_aligned BOOLEAN,
  stochastic_k NUMERIC,
  scanner_rank INTEGER,
  vix_at_entry NUMERIC,

  -- Psychological layer: before entry
  emotional_state TEXT,
  reason_for_entry TEXT,
  system_compliance TEXT,
  setup_doubts TEXT,
  pre_trade_notes TEXT,

  -- During trade
  managing_wait TEXT,
  manual_intervention TEXT,
  during_trade_notes TEXT,

  -- After close
  feeling_result TEXT,
  what_do_differently TEXT,
  post_trade_notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE UNIQUE INDEX idx_trades_ticket_user ON public.trades (user_id, ticket) WHERE ticket IS NOT NULL;
CREATE INDEX idx_trades_user_entry ON public.trades (user_id, entry_date DESC);
CREATE INDEX idx_trades_user_open ON public.trades (user_id) WHERE is_open = true;

-- RLS
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trades"
  ON public.trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trades"
  ON public.trades FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own trades"
  ON public.trades FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own trades"
  ON public.trades FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_trades_updated_at
  BEFORE UPDATE ON public.trades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- SCANNER SESSIONS TABLE
-- ============================================================
CREATE TABLE public.scanner_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  top_instruments JSONB DEFAULT '[]'::jsonb,
  correlations_detected JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_scanner_user_date ON public.scanner_sessions (user_id, session_date DESC);

ALTER TABLE public.scanner_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scanner sessions"
  ON public.scanner_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own scanner sessions"
  ON public.scanner_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own scanner sessions"
  ON public.scanner_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own scanner sessions"
  ON public.scanner_sessions FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_scanner_sessions_updated_at
  BEFORE UPDATE ON public.scanner_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- USER SETTINGS TABLE
-- ============================================================
CREATE TABLE public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  broker TEXT DEFAULT 'Darwinex Zero',
  account_number TEXT,
  balance NUMERIC DEFAULT 0,
  risk_per_trade NUMERIC DEFAULT 1.0,
  max_open_positions INTEGER DEFAULT 2,
  vix_block_threshold NUMERIC DEFAULT 45,
  vix_caution_threshold NUMERIC DEFAULT 25,
  api_key TEXT DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
  ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings"
  ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings"
  ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
