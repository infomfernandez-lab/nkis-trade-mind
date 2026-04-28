import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { authenticateApiKey } from '@/lib/api-auth';
import { CORS_HEADERS, withCors } from '@/lib/cors';

const requestSchema = z.object({
  broker: z.enum(['darwinex', 'octx', 'nkis', 'fxpro'])
    .transform((v) => (v === 'nkis' ? 'darwinex' : v === 'fxpro' ? 'octx' : v)),
  balance: z.number(),
  // Opcional: forzar la columna destino. Si se omite, se deriva de `broker`.
  field: z.enum(['balance_nkis', 'balance_octx']).optional(),
});

export const Route = createFileRoute('/api/sync-balance')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),

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

          const { broker, balance, field } = parsed.data;
          const column: 'balance_nkis' | 'balance_octx' =
            field ?? (broker === 'darwinex' ? 'balance_nkis' : 'balance_octx');
          const updates = column === 'balance_nkis'
            ? { balance_nkis: balance }
            : { balance_octx: balance };

          const { error } = await supabaseAdmin
            .from('user_settings')
            .update(updates)
            .eq('user_id', userId);

          if (error) {
            return withCors(new Response(JSON.stringify({ error: 'Database error', details: error.message }), {
              status: 500, headers: { 'Content-Type': 'application/json' },
            }));
          }

          return withCors(Response.json({ success: true, broker, balance, column }));
        } catch (e) {
          if (e instanceof Response) return withCors(e);
          return withCors(new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500, headers: { 'Content-Type': 'application/json' },
          }));
        }
      },
    },
  },
});
