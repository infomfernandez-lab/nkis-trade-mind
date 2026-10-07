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
          const params = new URLSearchParams(incoming.search);
          // Transformar broker=nkis → broker=eq.nkis (PostgREST)
          // Cuenta única CWND: solo futuros (broker = 'nkis'). Lo de 'octx' se oculta siempre.
          params.set('broker', 'eq.nkis');
          if (!params.has('select')) params.set('select', '*');
          const target = `${EXTERNAL_URL}/rest/v1/assets?${params.toString()}`;

          const res = await fetch(target, {
            headers: {
              apikey: EXTERNAL_KEY,
              Authorization: `Bearer ${EXTERNAL_KEY}`,
              Accept: 'application/json',
              // Override PostgREST default max-rows (often 1000) by requesting
              // an explicit byte/row range. 0-9999 covers ~10k rows.
              Range: '0-9999',
              'Range-Unit': 'items',
              Prefer: request.headers.get('prefer') ?? 'count=exact',
            },
          });


          let body = await res.text();
          // Una fila por mercado (raíz), quedándonos con el contrato visto más recientemente.
          try {
            const rows = JSON.parse(body);
            if (Array.isArray(rows)) {
              const best = new Map<string, any>();
              for (const r of rows) {
                const sym = String(r?.symbol ?? '').toUpperCase();
                const root = sym.includes('_') ? sym.split('_')[0] : sym;
                const cur = best.get(root);
                const ts = (x: any) => new Date(x?.last_seen_scanner ?? x?.first_seen ?? 0).getTime() || 0;
                if (!cur || ts(r) > ts(cur)) best.set(root, { ...r, raiz: root, contrato: sym });
              }
              body = JSON.stringify([...best.values()]);
            }
          } catch { /* no JSON: devolver tal cual */ }
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
