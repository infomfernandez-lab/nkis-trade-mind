DELETE FROM trades WHERE symbol ILIKE '%filecoin%';
UPDATE scanner_sessions
SET top_instruments = COALESCE(
  (SELECT jsonb_agg(elem) FROM jsonb_array_elements(top_instruments) elem
   WHERE COALESCE(elem->>'symbol','') NOT ILIKE '%filecoin%'),
  '[]'::jsonb
)
WHERE top_instruments::text ILIKE '%filecoin%';