import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { authenticateApiKey } from '@/lib/api-auth';
import { CORS_HEADERS, withCors } from '@/lib/cors';

const numLike = z.union([z.number(), z.string()]).nullable().optional().transform((v) => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
});

const instrumentSchema = z.object({
  symbol: z.string().min(1).max(50),
  direction: z.string().min(1).max(20),
  atr_estado: z.string().max(50).nullable().optional(),
  score: numLike,
  broker: z.string().max(50).optional(),
  status: z.string().max(50).optional(),
}).passthrough();

const bodySchema = z.object({
  broker: z.string().min(1).max(50),
  instrumentos: z.array(instrumentSchema).max(1000),
});

function normalizeBroker(raw: string): string {
  const v = (raw ?? '').trim().toLowerCase();
  if (v.includes('octx') || v.includes('fxpro')) return 'octx';
  if (v.includes('nkis') || v.includes('darwinex')) return 'darwinex';
  return v;
}

function normalizeDirection(raw: string): string {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'buy' || v === 'alcista' || v === 'long') return 'alcista';
  if (v === 'sell' || v === 'bajista' || v === 'short') return 'bajista';
  return v || 'alcista';
}

export const Route = createFileRoute('/api/sync-ea-watchlist')({
  server: {
    handlers: {
      OPTIONS: async () => {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      },

      POST: async ({ request }) => {
        try {
          const userId = await authenticateApiKey(request);
          const body = await request.json();
          const parsed = bodySchema.safeParse(body);

          if (!parsed.success) {
            return withCors(new Response(JSON.stringify({
              error: 'Validation failed',
              details: parsed.error.flatten().fieldErrors,
            }), { status: 400, headers: { 'Content-Type': 'application/json' } }));
          }

          const broker = normalizeBroker(parsed.data.broker);

          const { error: delError } = await supabaseAdmin
            .from('watchlist')
            .delete()
            .eq('user_id', userId)
            .eq('broker', broker)
            .eq('watch_reason', 'EA');

          if (delError) {
            return withCors(new Response(JSON.stringify({ error: 'Database error', details: delError.message }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }));
          }

          const rows = parsed.data.instrumentos.map((inst) => ({
            user_id: userId,
            symbol: inst.symbol,
            direction: normalizeDirection(inst.direction),
            broker,
            status: 'Vigilancia',
            scanner_score: inst.score ?? null,
            adx_state: inst.atr_estado ?? null,
            added_from_scanner: true,
            watch_reason: 'EA',
          }));

          let upserted = 0;
          if (rows.length > 0) {
            const { data, error } = await supabaseAdmin
              .from('watchlist')
              .insert(rows)
              .select('id');
            if (error) {
              return withCors(new Response(JSON.stringify({ error: 'Database error', details: error.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              }));
            }
            upserted = data?.length ?? 0;
          }

          return withCors(Response.json({ success: true, upserted }));
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
