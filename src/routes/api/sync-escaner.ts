import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { CORS_HEADERS, withCors } from '@/lib/cors';

const schema = z.object({
  version: z.unknown().optional(),
  generado: z.string().max(60).nullable().optional(),
  fecha_datos: z.string().min(8).max(40),
  fuente: z.unknown().optional(),
  cuenta: z.unknown().optional(),
  config: z.unknown().optional(),
  avisos: z.array(z.object({ tipo: z.string().optional(), texto: z.string().optional() }).passthrough()).max(500).optional(),
  filas: z.array(z.record(z.unknown())).max(2000),
}).passthrough();

const json = (body: unknown, status = 200) =>
  withCors(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

export const Route = createFileRoute('/api/sync-escaner')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => {
        try {
          const { authenticateApiKey } = await import('@/lib/api-auth');
          const userId = await authenticateApiKey(request);
          const body = await request.json();
          const parsed = schema.safeParse(body);
          if (!parsed.success) {
            return json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, 400);
          }
          const fecha = parsed.data.fecha_datos.slice(0, 10);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return json({ error: 'fecha_datos debe ser YYYY-MM-DD' }, 400);

          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
          const { data, error } = await (supabaseAdmin as any)
            .from('escaner_fotos')
            .upsert(
              { user_id: userId, fecha_datos: fecha, generado: parsed.data.generado ?? null, datos: body },
              { onConflict: 'user_id,fecha_datos' },
            )
            .select('id, fecha_datos')
            .single();
          if (error) return json({ error: 'Database error', details: error.message }, 500);
          return json({ success: true, foto: data, filas: parsed.data.filas.length });
        } catch (e) {
          if (e instanceof Response) return withCors(e);
          return json({ error: 'Internal server error' }, 500);
        }
      },
    },
  },
});
