-- Scanner sessions metadata
ALTER TABLE public.scanner_sessions
  ADD COLUMN IF NOT EXISTS timeframe text,
  ADD COLUMN IF NOT EXISTS vix numeric,
  ADD COLUMN IF NOT EXISTS total_analyzed integer,
  ADD COLUMN IF NOT EXISTS discarded integer,
  ADD COLUMN IF NOT EXISTS tradeable integer;

-- Watchlist broker
ALTER TABLE public.watchlist
  ADD COLUMN IF NOT EXISTS broker text NOT NULL DEFAULT 'darwinex';

-- Trades SL phase management
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS sl_phase text NOT NULL DEFAULT 'inicial',
  ADD COLUMN IF NOT EXISTS sl_updated_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS atr_at_entry numeric;

-- Constraint sanity for sl_phase values
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trades_sl_phase_check'
  ) THEN
    ALTER TABLE public.trades
      ADD CONSTRAINT trades_sl_phase_check
      CHECK (sl_phase IN ('inicial','breakeven','trailing','cerrada'));
  END IF;
END $$;