import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface KpiInfo {
  slug: string;
  name: string;
  category: string;
}

interface RequestBody {
  kpis: KpiInfo[];
  focusKpis: KpiInfo[];
  scopeType: "all" | "team" | "client";
  teamId?: string;
  clientId?: string;
  period: string;
  designId: string;
}

interface GeneratedWidget {
  id: string;
  widgetTypeId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  dataSource: "kpi";
  kpiTypeIds: string[];
  timePeriodId: string;
  title?: string;
  showTrend: boolean;
  limitToTeam?: boolean;
  teamId?: string;
  limitToClient?: boolean;
  clientId?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { kpis, focusKpis, scopeType, teamId, clientId, period } = body;

    console.log("Generating dashboard layout for:", { 
      kpiCount: kpis.length, 
      focusCount: focusKpis.length,
      scopeType,
      period 
    });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const focusSlugs = new Set(focusKpis.map(k => k.slug));
    
    const prompt = `Du er en dashboard designer. Generer et optimalt widget layout baseret på disse KPI'er.

VALGTE KPI'ER:
${kpis.map(k => `- ${k.name} (slug: ${k.slug}, kategori: ${k.category})${focusSlugs.has(k.slug) ? ' [FOKUS]' : ''}`).join('\n')}

REGLER:
1. Fokus-KPI'er (markeret med [FOKUS]) skal have størrelse 2x1 eller 2x2
2. Normale KPI'er skal have størrelse 1x1
3. Placer fokus-KPI'er øverst til venstre
4. Brug widget typer: "number" for enkle tal, "chart" for trends, "progress" for mål
5. Grid har 3 kolonner (x: 0-2)
6. Returner maksimalt 12 widgets

Generer et JSON array med widgets.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Du er en dashboard designer. Returner kun valid JSON." },
          { role: "user", content: prompt }
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_dashboard_widgets",
            description: "Genererer dashboard widgets baseret på KPI valg",
            parameters: {
              type: "object",
              properties: {
                widgets: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      widgetTypeId: { 
                        type: "string", 
                        enum: ["number", "chart", "progress", "bar-chart", "pie-chart"],
                        description: "Widget type" 
                      },
                      kpiSlug: { type: "string", description: "KPI slug" },
                      x: { type: "number", description: "Grid x position (0-2)" },
                      y: { type: "number", description: "Grid y position" },
                      width: { type: "number", description: "Widget width (1-3)" },
                      height: { type: "number", description: "Widget height (1-2)" },
                      title: { type: "string", description: "Optional custom title" }
                    },
                    required: ["widgetTypeId", "kpiSlug", "x", "y", "width", "height"]
                  }
                }
              },
              required: ["widgets"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "generate_dashboard_widgets" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit nået. Prøv igen om lidt." }), 
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Kredit opbrugt. Tilføj kreditter til din konto." }), 
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log("AI response:", JSON.stringify(aiResponse, null, 2));

    let generatedWidgets: GeneratedWidget[] = [];

    // Extract widgets from tool call response
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        if (args.widgets && Array.isArray(args.widgets)) {
          generatedWidgets = args.widgets.map((w: any, index: number) => ({
            id: `widget-ai-${Date.now()}-${index}`,
            widgetTypeId: w.widgetTypeId || "number",
            x: Math.min(Math.max(0, w.x || 0), 2),
            y: w.y || Math.floor(index / 3),
            width: Math.min(Math.max(1, w.width || 1), 3),
            height: Math.min(Math.max(1, w.height || 1), 2),
            dataSource: "kpi" as const,
            kpiTypeIds: [w.kpiSlug],
            timePeriodId: period,
            title: w.title,
            showTrend: true,
            ...(scopeType === "team" && teamId ? { limitToTeam: true, teamId } : {}),
            ...(scopeType === "client" && clientId ? { limitToClient: true, clientId } : {}),
          }));
        }
      } catch (parseError) {
        console.error("Failed to parse tool call arguments:", parseError);
      }
    }

    // Fallback: generate simple layout if AI fails
    if (generatedWidgets.length === 0) {
      console.log("Using fallback widget generation");
      generatedWidgets = kpis.map((kpi, index) => {
        const isFocus = focusSlugs.has(kpi.slug);
        return {
          id: `widget-fallback-${Date.now()}-${index}`,
          widgetTypeId: isFocus ? "chart" : "number",
          x: isFocus ? 0 : index % 3,
          y: isFocus ? 0 : Math.floor(index / 3) + (focusKpis.length > 0 ? 1 : 0),
          width: isFocus ? 2 : 1,
          height: isFocus ? 1 : 1,
          dataSource: "kpi" as const,
          kpiTypeIds: [kpi.slug],
          timePeriodId: period,
          showTrend: true,
          ...(scopeType === "team" && teamId ? { limitToTeam: true, teamId } : {}),
          ...(scopeType === "client" && clientId ? { limitToClient: true, clientId } : {}),
        };
      });
    }

    console.log(`Generated ${generatedWidgets.length} widgets`);

    return new Response(
      JSON.stringify({ widgets: generatedWidgets }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error generating dashboard:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
