import { createFileRoute } from '@tanstack/react-router';
import { CORS_HEADERS } from '@/lib/cors';

const FF_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

export const Route = createFileRoute('/api/ff-calendar')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async () => {
        try {
          const res = await fetch(FF_URL, {
            headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
          });
          const body = await res.text();
          return new Response(body, {
            status: res.status,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=1800',
              ...CORS_HEADERS,
            },
          });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e?.message ?? 'fetch_failed' }), {
            status: 502,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          });
        }
      },
    },
  },
});
