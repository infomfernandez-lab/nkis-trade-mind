-- Ensure full row payload on changes
ALTER TABLE public.trades REPLICA IDENTITY FULL;
ALTER TABLE public.watchlist REPLICA IDENTITY FULL;
ALTER TABLE public.scanner_sessions REPLICA IDENTITY FULL;

-- Add tables to realtime publication (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'trades'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trades;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'watchlist'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.watchlist;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'scanner_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scanner_sessions;
  END IF;
END $$;