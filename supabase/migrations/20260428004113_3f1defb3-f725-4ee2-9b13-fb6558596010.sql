ALTER TABLE public.trades
  ADD CONSTRAINT trades_user_ticket_unique UNIQUE (user_id, ticket);