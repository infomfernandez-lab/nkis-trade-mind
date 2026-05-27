import { createFileRoute } from '@tanstack/react-router';
import { CORS_HEADERS, withCors } from '@/lib/cors';

const EXTERNAL_URL = 'https://rddewywrhtnddzbtozwy.supabase.co';
const EXTERNAL_KEY = 'sb_publishable_YcIBPL9NCTuexuAqqCVCWA_GXNCWcZR';

export const Route = createFileRoute('/api/assets-proxy')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => {
        try {
          const incoming = new URL(request.url);
          // Forward query string to PostgREST (select, order, limit, filters, etc.)
          const qs = incoming.search || '?select=*';
          const target = `${EXTERNAL_URL}/rest/v1/assets${qs}`;

          const res = await fetch(target, {
            headers: {
              apikey: EXTERNAL_KEY,
              Authorization: `Bearer ${EXTERNAL_KEY}`,
              Accept: 'application/json',
              Prefer: request.headers.get('prefer') ?? '',
            },
          });

          const body = await res.text();
          const headers = new Headers({
            'Content-Type': res.headers.get('content-type') ?? 'application/json',
          });
          const cr = res.headers.get('content-range');
          if (cr) headers.set('Content-Range', cr);

          return withCors(new Response(body, { status: res.status, headers }));
        } catch (e) {
          return withCors(new Response(JSON.stringify({ error: String(e) }), {
            status: 500, headers: { 'Content-Type': 'application/json' },
          }));
        }
      },
    },
  },
});
