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
  account: z.union([z.string(), z.number()]).optional(),
  login: z.union([z.string(), z.number()]).optional(),
}).passthrough();

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

          const { broker, balance } = parsed.data;
          // Cuenta única CWND: solo se acepta el balance de la cuenta MT5 configurada.
          const { data: st } = await supabaseAdmin.from('user_settings').select('account_number').eq('user_id', userId).maybeSingle();
          const expected = String(st?.account_number || '4000100512').trim();
          const sentAccount = parsed.data.account ?? parsed.data.login;
          if (broker === 'octx' || (sentAccount != null && String(sentAccount).trim() !== expected)) {
            return withCors(Response.json({ success: true, ignored: true, reason: 'cuenta distinta de CWND' }));
          }
          const column = 'balance_nkis' as const;
          const updates = { balance_nkis: balance };

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
