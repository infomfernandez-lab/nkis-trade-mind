
-- Migration 1: assets
CREATE TABLE public.assets (
  symbol text NOT NULL,
  broker text NOT NULL CHECK (broker IN ('nkis', 'octx')),
  description text,
  familia text,
  sector text,
  first_seen timestamptz DEFAULT now(),
  last_seen_scanner timestamptz,
  last_score numeric,
  last_direction text,
  last_atr_state text,
  last_adx numeric,
  last_stoch numeric,
  last_price numeric,
  is_active_scanner boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (symbol, broker)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assets visible para todos los usuarios autenticados"
  ON public.assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "assets insertable por usuarios autenticados"
  ON public.assets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "assets actualizable por usuarios autenticados"
  ON public.assets FOR UPDATE TO authenticated USING (true);

-- Migration 2: activities
CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol text,
  broker text,
  title text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('CERRAR','ABRIR','BACKTEST','REVISAR','NOTA','INFORME','GASTO','OTRO')),
  priority text NOT NULL DEFAULT 'MEDIA' CHECK (priority IN ('ALTA','MEDIA','BAJA')),
  status text NOT NULL DEFAULT 'PENDIENTE' CHECK (status IN ('PENDIENTE','HECHO','CANCELADO')),
  due_date date,
  done_at timestamptz,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activities TO authenticated;
GRANT ALL ON public.activities TO service_role;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usuarios ven sus propias actividades"
  ON public.activities FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Migration 3: expenses
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  category text NOT NULL CHECK (category IN ('BROKER','VPS','SOFTWARE','DATOS','OTRO')),
  frequency text NOT NULL CHECK (frequency IN ('MENSUAL','ANUAL','UNICO')),
  next_due_date date,
  active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usuarios ven sus propios gastos"
  ON public.expenses FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
