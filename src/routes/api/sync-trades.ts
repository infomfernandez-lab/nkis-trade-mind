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
  broker: z.enum(['darwinex', 'octx', 'nkis', 'fxpro']).optional().default('darwinex')
    .transform((v) => (v === 'nkis' ? 'darwinex' : v === 'fxpro' ? 'octx' : v)),
});

const requestSchema = z.object({
  // Use passthrough so individual rows can be re-validated per-row below.
  // This lets us reject single bad rows instead of failing the whole batch.
  trades: z.array(z.any()).min(1).max(2000),
  close_stale: z.boolean().optional().default(false),
  broker: z.enum(['darwinex', 'octx', 'nkis', 'fxpro']).optional()
    .transform((v) => (v === 'nkis' ? 'darwinex' : v === 'fxpro' ? 'octx' : v)),
  open_tickets: z.array(z.number().int()).optional(),
  expected_tickets: z.array(z.number().int()).max(10000).optional(),
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

          // Per-row validation so one bad row doesn't kill the whole batch.
          // Track which tickets were rejected and why.
          const validRows: any[] = [];
          const rejected: { ticket: number | null; reason: string; field_errors?: any }[] = [];
          const rawTrades = Array.isArray((body as any)?.trades) ? (body as any).trades : [];
          for (const raw of rawTrades) {
            const single = tradeSchema.safeParse(raw);
            if (single.success) {
              validRows.push({ ...single.data, user_id: userId });
            } else {
              rejected.push({
                ticket: typeof raw?.ticket === 'number' ? raw.ticket : null,
                reason: 'zod_validation_failed',
                field_errors: single.error.flatten().fieldErrors,
              });
            }
          }

          // Upsert in chunks to avoid silent failures on very large payloads.
          const CHUNK = 500;
          const upsertedTickets: number[] = [];
          const upsertErrors: { chunk_index: number; tickets: number[]; error: string }[] = [];
          for (let i = 0; i < validRows.length; i += CHUNK) {
            const chunk = validRows.slice(i, i + CHUNK);
            const { data, error } = await supabaseAdmin
              .from('trades')
              .upsert(chunk, { onConflict: 'user_id,ticket', ignoreDuplicates: false })
              .select('ticket');
            if (error) {
              upsertErrors.push({
                chunk_index: i / CHUNK,
                tickets: chunk.map((r: any) => Number(r.ticket)),
                error: error.message,
              });
              // Mark these as rejected too
              for (const r of chunk) {
                rejected.push({
                  ticket: Number(r.ticket),
                  reason: 'db_upsert_failed',
                  field_errors: { db: [error.message] },
                });
              }
            } else if (data) {
              for (const r of data) upsertedTickets.push(Number(r.ticket));
            }
          }

          // Handle close_stale: close positions no longer open in MT5
          let stalesClosed = 0;
          if (parsed.data.close_stale && parsed.data.broker && parsed.data.open_tickets) {
            const brokerVal = parsed.data.broker;
            const openTickets = parsed.data.open_tickets;

            const { data: openDbTrades } = await supabaseAdmin
              .from('trades')
              .select('id, ticket')
              .eq('user_id', userId)
              .eq('broker', brokerVal)
              .eq('is_open', true);

            if (openDbTrades && openDbTrades.length > 0) {
              const staleIds = openDbTrades
                .filter(t => t.ticket != null && !openTickets.includes(Number(t.ticket)))
                .map(t => t.id);

              if (staleIds.length > 0) {
                await supabaseAdmin
                  .from('trades')
                  .update({ is_open: false })
                  .in('id', staleIds);
                stalesClosed = staleIds.length;
              }
            }
          }

          // Verification mode: full reconciliation against expected_tickets
          let verification: any = null;
          if (parsed.data.expected_tickets && parsed.data.expected_tickets.length > 0) {
            const expected = parsed.data.expected_tickets.map(Number);
            const expectedSet = new Set(expected);

            // Pull ALL tickets in DB for this user (paginated by .range)
            let query = supabaseAdmin
              .from('trades')
              .select('ticket')
              .eq('user_id', userId);
            if (parsed.data.broker) query = query.eq('broker', parsed.data.broker);
            const { data: existing, error: vErr } = await query.range(0, 9999);

            const existingSet = new Set((existing ?? []).map((r: any) => Number(r.ticket)));
            const sentSet = new Set(rawTrades.map((t: any) => Number(t?.ticket)).filter((n: number) => Number.isFinite(n)));
            const rejectedSet = new Set(rejected.map(r => r.ticket).filter((n): n is number => n != null));

            // Categorize each missing ticket
            const missing = expected.filter((t) => !existingSet.has(t));
            const missingDetails = missing.map((ticket) => {
              if (rejectedSet.has(ticket)) {
                const r = rejected.find(x => x.ticket === ticket);
                return { ticket, reason: r?.reason ?? 'rejected', details: r?.field_errors };
              }
              if (!sentSet.has(ticket)) {
                return { ticket, reason: 'not_sent_in_payload' };
              }
              return { ticket, reason: 'sent_but_not_persisted' };
            });

            verification = {
              expected_count: expected.length,
              sent_count: sentSet.size,
              db_count: existingSet.size,
              upserted_count: upsertedTickets.length,
              rejected_count: rejected.length,
              missing_count: missing.length,
              missing: missingDetails,
              query_error: vErr?.message ?? null,
            };
          }

          return withCors(Response.json({
            success: true,
            received: rawTrades.length,
            upserted: upsertedTickets.length,
            rejected_count: rejected.length,
            rejected: rejected.slice(0, 100), // cap response size
            upsert_errors: upsertErrors,
            stales_closed: stalesClosed,
            verification,
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
