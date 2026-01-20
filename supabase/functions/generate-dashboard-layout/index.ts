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

// Widget type mapping based on KPI category
const categoryWidgetSuggestions: Record<string, string[]> = {
  sales: ["line_chart", "goal_progress", "kpi_card"],
  hours: ["bar_chart", "kpi_card", "comparison_card"],
  calls: ["line_chart", "kpi_card", "bar_chart"],
  employees: ["kpi_card", "pie_chart", "bar_chart"],
  other: ["kpi_card", "comparison_card", "bar_chart"]
};

const DESIGN_PRINCIPLES = `
DU ER EN PROFESSIONEL DASHBOARD DESIGNER med ekspertise i data visualisering.

KRITISKE DESIGN PRINCIPPER:

1. VISUEL HIERARKI
   - Fokus KPI'er SKAL være store (width: 4-6, height: 2) og placeret øverst
   - Normale KPI'er er mindre (width: 2-3, height: 1)
   - Vigtigste information øverst til venstre

2. VARIATION OG BALANCE
   - ALDRIG alle widgets samme størrelse - mix store, medium og små
   - Brug forskellige widget typer for visuel interesse
   - Balancer venstre og højre side af layoutet

3. WIDGET TYPE VALG
   - "line_chart": Trends over tid - PERFEKT til fokus KPIs, salg, aktivitet (størrelse 4x2 eller 6x2)
   - "bar_chart": Sammenligning mellem kategorier - god til timer, distribution (størrelse 4x2 eller 3x2)
   - "kpi_card": Enkelt tal med trend pil - alle KPI typer (størrelse 2x1 eller 3x1)
   - "goal_progress": Fremgang mod mål med progress bar - salg, targets (størrelse 3x1 eller 4x1)
   - "comparison_card": Sammenlign med forrige periode - god til alle (størrelse 3x1)
   - "pie_chart": Fordeling/distribution - medarbejdere, kategorier (størrelse 3x2)
   - "leaderboard": Top performere liste - salg, aktivitet (størrelse 4x3 eller 6x3)
   - "multi_kpi_card": Flere relaterede KPIs samlet (størrelse 4x1 eller 6x1)

4. GRID SYSTEM
   - Griddet har 12 kolonner (x: 0-11)
   - Widgets må IKKE overlappe - beregn x + width <= 12
   - Start ny række når der ikke er plads

5. LAYOUT STRUKTUR
   Række 1 (y=0): Hero sektion
   - 1-2 store fokus charts (4x2 eller 6x2)
   - 2-4 små KPI cards i højre side (2x1 hver)
   
   Række 2-3 (y=2-3): Sekundære metrics
   - Medium widgets (3x1 eller 4x1)
   - Mix af goal_progress, comparison_card, kpi_card
   
   Række 4+ (y=4+): Detaljer
   - Leaderboard eller tabel i fuld bredde hvis relevant

EKSEMPEL PÅ PROFESSIONELT LAYOUT:
[
  {"widgetTypeId": "line_chart", "kpiSlug": "total-sales", "x": 0, "y": 0, "width": 5, "height": 2},
  {"widgetTypeId": "bar_chart", "kpiSlug": "calls-per-hour", "x": 5, "y": 0, "width": 4, "height": 2},
  {"widgetTypeId": "kpi_card", "kpiSlug": "conversion-rate", "x": 9, "y": 0, "width": 3, "height": 1},
  {"widgetTypeId": "kpi_card", "kpiSlug": "avg-sale-value", "x": 9, "y": 1, "width": 3, "height": 1},
  {"widgetTypeId": "goal_progress", "kpiSlug": "monthly-target", "x": 0, "y": 2, "width": 4, "height": 1},
  {"widgetTypeId": "comparison_card", "kpiSlug": "week-over-week", "x": 4, "y": 2, "width": 4, "height": 1},
  {"widgetTypeId": "kpi_card", "kpiSlug": "active-employees", "x": 8, "y": 2, "width": 4, "height": 1}
]
`;

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
    
    // Build detailed KPI context for the AI
    const kpiContext = kpis.map(k => {
      const isFocus = focusSlugs.has(k.slug);
      const suggestedWidgets = categoryWidgetSuggestions[k.category] || categoryWidgetSuggestions.other;
      return `- ${k.name} (slug: "${k.slug}", kategori: ${k.category})${isFocus ? ' [FOKUS - SKAL VÆRE STOR]' : ''} - Anbefalet: ${suggestedWidgets.join(', ')}`;
    }).join('\n');

    const prompt = `${DESIGN_PRINCIPLES}

MINE VALGTE KPI'ER:
${kpiContext}

OPGAVE:
Generer et professionelt, visuelt tiltalende dashboard layout.
- Fokus KPI'er (markeret med [FOKUS]) SKAL have store widgets (width 4-6, height 2) med line_chart eller bar_chart
- Normale KPI'er skal have varierede størrelser og typer
- Sørg for at widgets IKKE overlapper (x + width <= 12)
- Brug ALLE de valgte KPI'er
- Maksimalt 12 widgets total`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { 
            role: "system", 
            content: "Du er en ekspert dashboard designer. Returner KUN valid JSON via tool call. Lav ALTID visuelt interessante layouts med variation i widget størrelser og typer." 
          },
          { role: "user", content: prompt }
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_dashboard_widgets",
            description: "Genererer et professionelt dashboard layout med varierede widget størrelser og typer",
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
                        enum: [
                          "kpi_card",
                          "line_chart",
                          "bar_chart",
                          "pie_chart",
                          "goal_progress",
                          "comparison_card",
                          "leaderboard",
                          "multi_kpi_card"
                        ],
                        description: "Widget type - vælg baseret på KPI kategori og om det er fokus" 
                      },
                      kpiSlug: { 
                        type: "string", 
                        description: "KPI slug fra listen" 
                      },
                      x: { 
                        type: "number", 
                        description: "Grid x position (0-11). Grid har 12 kolonner. Sørg for x + width <= 12" 
                      },
                      y: { 
                        type: "number", 
                        description: "Grid y position. Række 0 = top. Fokus widgets på y=0" 
                      },
                      width: { 
                        type: "number", 
                        description: "Widget bredde (1-12). Fokus charts: 4-6, Normal cards: 2-3" 
                      },
                      height: { 
                        type: "number", 
                        description: "Widget højde (1-3). Charts: 2, Cards: 1, Leaderboards: 3" 
                      },
                      title: { 
                        type: "string", 
                        description: "Valgfri custom titel" 
                      }
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
            widgetTypeId: w.widgetTypeId || "kpi_card",
            x: Math.min(Math.max(0, w.x || 0), 11),
            y: w.y || 0,
            width: Math.min(Math.max(1, w.width || 2), 12),
            height: Math.min(Math.max(1, w.height || 1), 3),
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

    // Intelligent fallback if AI fails
    if (generatedWidgets.length === 0) {
      console.log("Using intelligent fallback widget generation");
      
      let currentX = 0;
      let currentY = 0;
      
      // Place focus KPIs as large charts at the top
      focusKpis.forEach((kpi, i) => {
        const widgetType = i === 0 ? "line_chart" : "bar_chart";
        const width = focusKpis.length === 1 ? 8 : 5;
        
        if (currentX + width > 12) {
          currentX = 0;
          currentY += 2;
        }
        
        generatedWidgets.push({
          id: `widget-fallback-${Date.now()}-focus-${i}`,
          widgetTypeId: widgetType,
          x: currentX,
          y: currentY,
          width: width,
          height: 2,
          dataSource: "kpi" as const,
          kpiTypeIds: [kpi.slug],
          timePeriodId: period,
          showTrend: true,
          ...(scopeType === "team" && teamId ? { limitToTeam: true, teamId } : {}),
          ...(scopeType === "client" && clientId ? { limitToClient: true, clientId } : {}),
        });
        
        currentX += width;
      });
      
      // Fill remaining space in hero row with small cards
      const normalKpis = kpis.filter(k => !focusSlugs.has(k.slug));
      let heroCardCount = 0;
      
      while (currentX < 12 && heroCardCount < normalKpis.length) {
        const remainingWidth = 12 - currentX;
        if (remainingWidth >= 3) {
          const kpi = normalKpis[heroCardCount];
          generatedWidgets.push({
            id: `widget-fallback-${Date.now()}-hero-${heroCardCount}`,
            widgetTypeId: "kpi_card",
            x: currentX,
            y: 0,
            width: 3,
            height: 1,
            dataSource: "kpi" as const,
            kpiTypeIds: [kpi.slug],
            timePeriodId: period,
            showTrend: true,
            ...(scopeType === "team" && teamId ? { limitToTeam: true, teamId } : {}),
            ...(scopeType === "client" && clientId ? { limitToClient: true, clientId } : {}),
          });
          
          // Add another small card below if we have focus charts
          if (focusKpis.length > 0 && heroCardCount + 1 < normalKpis.length) {
            heroCardCount++;
            const kpi2 = normalKpis[heroCardCount];
            generatedWidgets.push({
              id: `widget-fallback-${Date.now()}-hero-${heroCardCount}`,
              widgetTypeId: "kpi_card",
              x: currentX,
              y: 1,
              width: 3,
              height: 1,
              dataSource: "kpi" as const,
              kpiTypeIds: [kpi2.slug],
              timePeriodId: period,
              showTrend: true,
              ...(scopeType === "team" && teamId ? { limitToTeam: true, teamId } : {}),
              ...(scopeType === "client" && clientId ? { limitToClient: true, clientId } : {}),
            });
          }
          
          currentX += 3;
          heroCardCount++;
        } else {
          break;
        }
      }
      
      // Place remaining KPIs in a grid below
      currentY = focusKpis.length > 0 ? 2 : 0;
      currentX = 0;
      
      const remainingKpis = normalKpis.slice(heroCardCount);
      const widgetTypes = ["goal_progress", "comparison_card", "kpi_card", "kpi_card"];
      
      remainingKpis.forEach((kpi, i) => {
        const widgetType = widgetTypes[i % widgetTypes.length];
        const width = widgetType === "goal_progress" ? 4 : 3;
        
        if (currentX + width > 12) {
          currentX = 0;
          currentY += 1;
        }
        
        generatedWidgets.push({
          id: `widget-fallback-${Date.now()}-${i}`,
          widgetTypeId: widgetType,
          x: currentX,
          y: currentY,
          width: width,
          height: 1,
          dataSource: "kpi" as const,
          kpiTypeIds: [kpi.slug],
          timePeriodId: period,
          showTrend: true,
          ...(scopeType === "team" && teamId ? { limitToTeam: true, teamId } : {}),
          ...(scopeType === "client" && clientId ? { limitToClient: true, clientId } : {}),
        });
        
        currentX += width;
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
