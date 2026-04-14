import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { authenticateApiKey } from '@/lib/api-auth';
import { CORS_HEADERS, withCors } from '@/lib/cors';

const tradeSchema = z.object({
  ticket: z.number().int(),
  symbol: z.string().min(1).max(20),
  direction: z.enum(['BUY', 'SELL']),
  entry_date: z.string().min(1).max(50),
  exit_date: z.string().max(50).nullable().optional(),
  entry_price: z.number(),
  exit_price: z.number().nullable().optional(),
  sl_price: z.number().nullable().optional(),
  tp_price: z.number().nullable().optional(),
  lot_size: z.number().min(0),
  gross_pnl: z.number().optional(),
  commission: z.number().optional(),
  swap: z.number().optional(),
  net_pnl: z.number().optional(),
  duration_hours: z.number().optional(),
  magic_number: z.number().int().optional(),
  ea_comment: z.string().max(500).nullable().optional(),
  is_open: z.boolean().optional(),
  is_win: z.boolean().optional(),
  adx_value: z.number().nullable().optional(),
  adx_state: z.string().max(50).nullable().optional(),
  distance_to_ma50: z.number().nullable().optional(),
  distance_to_ma50_label: z.string().max(50).nullable().optional(),
  momentum_20d: z.number().nullable().optional(),
  momentum_aligned: z.boolean().nullable().optional(),
  stochastic_k: z.number().nullable().optional(),
  scanner_rank: z.number().int().nullable().optional(),
  vix_at_entry: z.number().nullable().optional(),
  broker: z.enum(['darwinex', 'fxpro']).optional().default('darwinex'),
});

const requestSchema = z.object({
  trades: z.array(tradeSchema).min(1).max(500),
});

export const Route = createFileRoute('/api/sync-trades')({
  server: {
    handlers: {
      OPTIONS: async () => {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      },

      POST: async ({ request }) => {
        try {
          const userId = await authenticateApiKey(request);
          const body = await request.json();
          const parsed = requestSchema.safeParse(body);

          if (!parsed.success) {
            return withCors(new Response(JSON.stringify({
              error: 'Validation failed',
              details: parsed.error.flatten().fieldErrors,
            }), { status: 400, headers: { 'Content-Type': 'application/json' } }));
          }

          const rows = parsed.data.trades.map((t) => ({
            ...t,
            user_id: userId,
          }));

          const { data, error } = await supabaseAdmin
            .from('trades')
            .upsert(rows, { onConflict: 'user_id,ticket', ignoreDuplicates: false })
            .select('id, ticket');

          if (error) {
            return withCors(new Response(JSON.stringify({ error: 'Database error', details: error.message }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }));
          }

          return withCors(Response.json({
            success: true,
            upserted: data?.length ?? 0,
            trades: data,
          }));
        } catch (e) {
          if (e instanceof Response) return withCors(e);
          return withCors(new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }));
        }
      },
    },
  },
});
