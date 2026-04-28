import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TradeBrief {
  symbol: string;
  direction: string;
  pnl: number;
  broker?: string;
}

interface OpenPositionBrief {
  symbol: string;
  direction: string;
  floatingPnl: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY no configurada");

    const body = await req.json() as {
      mode?: "daily" | "briefing";
      date: string;
      vix?: number | null;
      trades?: TradeBrief[];
      openPositions?: OpenPositionBrief[];
      contextNote?: string;
    };

    const mode = body.mode ?? "daily";

    let systemPrompt = "";
    let userPrompt = "";

    if (mode === "briefing") {
      systemPrompt = `Eres un analista de mercados profesional estilo Pablo Gil. Con el contexto proporcionado y los instrumentos actualmente en cartera, genera un briefing operativo del día en 5-6 líneas: régimen de mercado, qué esperar de los instrumentos en cartera, sesgo operativo recomendado (tendencia o rango), y un riesgo clave a vigilar. Directo, sin florituras, lenguaje técnico.`;

      const positions = body.openPositions ?? [];
      const positionsText = positions.length === 0
        ? "Sin posiciones abiertas actualmente."
        : positions.map(p => `- ${p.direction} ${p.symbol} (flotante: ${p.floatingPnl >= 0 ? "+" : ""}${p.floatingPnl.toFixed(2)}€)`).join("\n");

      userPrompt = `Fecha: ${body.date}
Contexto rápido del operador: ${body.contextNote || "(no proporcionado)"}

Posiciones abiertas en cartera:
${positionsText}

Genera el briefing operativo.`;
    } else {
      systemPrompt = `Eres un analista de mercados estilo Pablo Gil. Dado el VIX del día, los instrumentos operados, y los resultados del día, genera un párrafo breve (4-6 líneas) de contexto de mercado: qué estaba pasando macro ese día, por qué tiene sentido el resultado, qué régimen de mercado describe. Sé concreto, directo, sin florituras.`;

      const trades = body.trades ?? [];
      const totalPnl = trades.reduce((s, t) => s + (t.pnl ?? 0), 0);
      const tradesText = trades.length === 0
        ? "Sin trades cerrados hoy."
        : trades.map(t => `- ${t.direction} ${t.symbol}: ${t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}€`).join("\n");

      userPrompt = `Fecha: ${body.date}
VIX del día: ${body.vix != null ? body.vix.toFixed(2) : "no disponible"}
P&L total del día: ${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}€

Trades cerrados:
${tradesText}

Genera el contexto de mercado para esta sesión.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de uso alcanzado, inténtalo en unos minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Sin créditos de IA. Añade créditos en el workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Error del servicio de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-market-context error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
