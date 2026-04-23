CREATE TABLE public.calculadora_registro (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  instrumento text,
  broker text,
  direccion text,
  precio_entrada numeric(12,6),
  stop_loss numeric(12,6),
  distancia_stop numeric(12,6),
  lotes numeric(8,2),
  riesgo_real numeric(10,2),
  breakeven_precio numeric(12,6),
  breakeven_sl numeric(12,6),
  trailing_sl numeric(12,6),
  atr numeric(12,6),
  valor_punto numeric(10,4),
  cuenta_balance numeric(14,2),
  vix numeric(6,2)
);

ALTER TABLE public.calculadora_registro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON public.calculadora_registro FOR SELECT USING (true);
CREATE POLICY "Public insert" ON public.calculadora_registro FOR INSERT WITH CHECK (true);