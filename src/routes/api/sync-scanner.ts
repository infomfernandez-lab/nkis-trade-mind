import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { authenticateApiKey } from '@/lib/api-auth';
import { CORS_HEADERS, withCors } from '@/lib/cors';

const scannerSchema = z.object({
  session_date: z.string().min(1).max(50).optional(),
  top_instruments: z.array(z.record(z.unknown())).max(50).optional(),
  correlations_detected: z.array(z.record(z.unknown())).max(50).optional(),
  notes: z.string().max(5000).nullable().optional(),
  broker: z.string().max(50).optional(),
});

export const Route = createFileRoute('/api/sync-scanner')({
  server: {
    handlers: {
      OPTIONS: async () => {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      },

      POST: async ({ request }) => {
        try {
          const userId = await authenticateApiKey(request);
          const body = await request.json();
          const parsed = scannerSchema.safeParse(body);

          if (!parsed.success) {
            return withCors(new Response(JSON.stringify({
              error: 'Validation failed',
              details: parsed.error.flatten().fieldErrors,
            }), { status: 400, headers: { 'Content-Type': 'application/json' } }));
          }

          // Normalize broker value
          const rawBroker = (parsed.data.broker ?? '').trim().toLowerCase();
          const broker = rawBroker.includes('fxpro') ? 'fxpro' : 'darwinex';

          const row = {
            user_id: userId,
            session_date: parsed.data.session_date ?? new Date().toISOString(),
            top_instruments: (parsed.data.top_instruments ?? []) as unknown as import('@/integrations/supabase/types').Json,
            correlations_detected: (parsed.data.correlations_detected ?? []) as unknown as import('@/integrations/supabase/types').Json,
            notes: parsed.data.notes ?? null,
            broker,
          };

          const { data, error } = await supabaseAdmin
            .from('scanner_sessions')
            .insert(row)
            .select('id, session_date')
            .single();

          if (error) {
            return withCors(new Response(JSON.stringify({ error: 'Database error', details: error.message }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }));
          }

          return withCors(Response.json({ success: true, session: data }));
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
