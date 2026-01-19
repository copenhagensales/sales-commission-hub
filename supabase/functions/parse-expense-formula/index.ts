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

    // Fetch team employees
    const { data: teamEmployees } = await supabase
      .from("employee_master_data")
      .select("id")
      .eq("team_id", team_id)
      .eq("is_active", true);

    const employeeIds = teamEmployees?.map(e => e.id) || [];
    const teamMemberCount = employeeIds.length;

    // Get current month date range
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startDateStr = startOfMonth.toISOString().split("T")[0];
    const endDateStr = endOfMonth.toISOString().split("T")[0];

    // Get team sales count for current month
    const { data: salesData } = await supabase
      .from("sales")
      .select("id, amount")
      .in("employee_id", employeeIds)
      .gte("sale_date", startDateStr)
      .lte("sale_date", endDateStr);

    const teamSalesCount = salesData?.length || 0;
    const teamRevenue = salesData?.reduce((sum, s) => sum + (s.amount || 0), 0) || 0;

    // Fetch booking assignments for the team in current month
    let bookingCount = 0;
    let bookedLocationsCount = 0;
    let bookingDaysCount = 0;

    if (employeeIds.length > 0) {
      const { data: assignments } = await supabase
        .from("booking_assignment")
        .select("booking_id, date")
        .in("employee_id", employeeIds)
        .gte("date", startDateStr)
        .lte("date", endDateStr);

      bookingDaysCount = assignments?.length || 0;

      // Get unique booking IDs
      const bookingIds = [...new Set(assignments?.map(a => a.booking_id) || [])];
      bookingCount = bookingIds.length;

      // Fetch bookings to get location info
      if (bookingIds.length > 0) {
        const { data: bookings } = await supabase
          .from("booking")
          .select("id, location_id")
          .in("id", bookingIds);

        const uniqueLocations = [...new Set(bookings?.map(b => b.location_id).filter(Boolean) || [])];
        bookedLocationsCount = uniqueLocations.length;
      }
    }

    const contextData = {
      team_name: teamData?.name || "Ukendt team",
      team_member_count: teamMemberCount,
      team_sales_count: teamSalesCount,
      team_revenue: teamRevenue,
      booking_count: bookingCount,
      booked_locations_count: bookedLocationsCount,
      booking_days_count: bookingDaysCount,
    };

    console.log("Context data:", contextData);

    const systemPrompt = `Du er en assistent der hjælper med at parse udgiftsbeskrivelser til matematiske formler.

Du modtager en beskrivelse af en teamudgift på dansk og skal returnere en struktureret formel.

TILGÆNGELIGE VARIABLER:
- team_member_count: Antal aktive sælgere i teamet (aktuelt: ${contextData.team_member_count})
- team_sales_count: Antal salg i teamet denne måned (aktuelt: ${contextData.team_sales_count})
- team_revenue: Teamets omsætning denne måned i DKK (aktuelt: ${contextData.team_revenue})
- booking_count: Antal bookinger i perioden (aktuelt: ${contextData.booking_count})
- booked_locations_count: Antal unikke bookede lokationer (aktuelt: ${contextData.booked_locations_count})
- booking_days_count: Total antal bookingdage (aktuelt: ${contextData.booking_days_count})

EKSEMPLER:
- "500 kr per sælger" → formula: "base_amount * team_member_count", variables: {"base_amount": 500}
- "1% af omsætningen" → formula: "percentage * team_revenue", variables: {"percentage": 0.01}
- "2000 kr flat" → formula: "fixed_amount", variables: {"fixed_amount": 2000}
- "100 kr per salg over 50" → formula: "per_unit * max(0, team_sales_count - threshold)", variables: {"per_unit": 100, "threshold": 50}
- "500 kr per lokation" → formula: "base_amount * booked_locations_count", variables: {"base_amount": 500}
- "100 kr per bookingdag" → formula: "base_amount * booking_days_count", variables: {"base_amount": 100}
- "Lokationsudgift baseret på bookinger" → formula: "base_amount * booked_locations_count", variables: {"base_amount": 500}

VIGTIGE REGLER:
- Når brugeren nævner "lokation" eller "lokationer", brug altid booked_locations_count
- Når brugeren nævner "booking" eller "bookinger", brug booking_count
- Når brugeren nævner "bookingdage" eller "dage", brug booking_days_count

KATEGORIER (vælg den mest passende):
- kantineordning, firmabil, parkering, telefon, internet, forsikring, uddannelse, udstyr, software, transport, repræsentation, lokation, andet

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
