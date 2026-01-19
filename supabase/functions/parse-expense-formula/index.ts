import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ParseRequest {
  description: string;
  team_id: string;
}

interface FormulaResult {
  formula: string;
  variables: Record<string, number>;
  calculated_amount: number;
  explanation: string;
  expense_name: string;
  category: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { description, team_id }: ParseRequest = await req.json();

    if (!description || !team_id) {
      return new Response(
        JSON.stringify({ error: "description and team_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Parsing expense formula for team ${team_id}: "${description}"`);

    // Fetch team data for context
    const { data: teamData } = await supabase
      .from("teams")
      .select("id, name")
      .eq("id", team_id)
      .single();

    // Count active team members
    const { count: memberCount } = await supabase
      .from("employee_master_data")
      .select("id", { count: "exact", head: true })
      .eq("team_id", team_id)
      .eq("is_active", true);

    const teamMemberCount = memberCount || 0;

    // Get team sales count for current month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const { count: salesCount } = await supabase
      .from("sales")
      .select("id", { count: "exact", head: true })
      .eq("team_id", team_id)
      .gte("sale_date", startOfMonth.toISOString());

    const teamSalesCount = salesCount || 0;

    // Get team revenue for current month
    const { data: revenueData } = await supabase
      .from("sales")
      .select("revenue")
      .eq("team_id", team_id)
      .gte("sale_date", startOfMonth.toISOString());

    const teamRevenue = revenueData?.reduce((sum, s) => sum + (s.revenue || 0), 0) || 0;

    const contextData = {
      team_name: teamData?.name || "Ukendt team",
      team_member_count: teamMemberCount,
      team_sales_count: teamSalesCount,
      team_revenue: teamRevenue,
    };

    console.log("Context data:", contextData);

    const systemPrompt = `Du er en assistent der hjælper med at parse udgiftsbeskrivelser til matematiske formler.

Du modtager en beskrivelse af en teamudgift på dansk og skal returnere en struktureret formel.

TILGÆNGELIGE VARIABLER:
- team_member_count: Antal aktive sælgere i teamet (aktuelt: ${contextData.team_member_count})
- team_sales_count: Antal salg i teamet denne måned (aktuelt: ${contextData.team_sales_count})
- team_revenue: Teamets omsætning denne måned i DKK (aktuelt: ${contextData.team_revenue})

EKSEMPLER:
- "500 kr per sælger" → formula: "base_amount * team_member_count", variables: {"base_amount": 500}
- "1% af omsætningen" → formula: "percentage * team_revenue", variables: {"percentage": 0.01}
- "2000 kr flat" → formula: "fixed_amount", variables: {"fixed_amount": 2000}
- "100 kr per salg over 50" → formula: "per_unit * max(0, team_sales_count - threshold)", variables: {"per_unit": 100, "threshold": 50}

KATEGORIER (vælg den mest passende):
- kantineordning, firmabil, parkering, telefon, internet, forsikring, uddannelse, udstyr, software, transport, repræsentation, andet

Returnér ALTID valid JSON med denne struktur:
{
  "formula": "matematisk formel med variabelnavne",
  "variables": {"variabelnavn": numerisk_værdi},
  "calculated_amount": beregnet beløb baseret på aktuelle data,
  "explanation": "kort forklaring på dansk af hvad formlen gør",
  "expense_name": "kort navn til udgiften",
  "category": "kategori fra listen ovenfor"
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Beskrivelse: "${description}"\nTeam: ${contextData.team_name}` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "For mange forespørgsler. Prøv igen om lidt." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI-kreditter opbrugt. Kontakt administrator." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    console.log("AI response:", content);

    let result: FormulaResult;
    try {
      result = JSON.parse(content);
    } catch {
      throw new Error("Failed to parse AI response as JSON");
    }

    // Validate and ensure all fields exist
    const validatedResult: FormulaResult = {
      formula: result.formula || "fixed_amount",
      variables: result.variables || { fixed_amount: 0 },
      calculated_amount: result.calculated_amount || 0,
      explanation: result.explanation || "Kunne ikke fortolke beskrivelsen",
      expense_name: result.expense_name || description.slice(0, 50),
      category: result.category || "andet",
    };

    console.log("Validated result:", validatedResult);

    return new Response(
      JSON.stringify({
        success: true,
        result: validatedResult,
        context: contextData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in parse-expense-formula:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
