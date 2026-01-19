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

interface LocationDetail {
  name: string;
  location_id: string;
  days: number;
  daily_rate: number;
  total: number;
  sales: number;
  revenue: number;
}

interface EmployeeDetail {
  id: string;
  name: string;
  sales: number;
  revenue: number;
  booking_days: number;
}

interface FormulaResult {
  formula: string;
  variables: Record<string, number | string | object>;
  calculated_amount: number;
  explanation: string;
  expense_name: string;
  category: string;
  formula_readable?: string;
}

interface RichContext {
  team_name: string;
  team_member_count: number;
  team_sales_count: number;
  team_revenue: number;
  booking_count: number;
  booked_locations_count: number;
  booking_days_count: number;
  // New detailed data
  location_costs_total: number;
  location_details: LocationDetail[];
  avg_location_daily_rate: number;
  fm_sales_count: number;
  avg_sales_per_employee: number;
  employee_details: EmployeeDetail[];
  working_days_in_month: number;
}

// Secure formula evaluator - only allows safe operations
function evaluateFormula(formula: string, context: RichContext): number {
  try {
    // Replace variable names with actual values
    let evalFormula = formula;
    
    // Simple variable replacements
    evalFormula = evalFormula.replace(/\bteam_member_count\b/g, String(context.team_member_count));
    evalFormula = evalFormula.replace(/\bteam_sales_count\b/g, String(context.team_sales_count));
    evalFormula = evalFormula.replace(/\bteam_revenue\b/g, String(context.team_revenue));
    evalFormula = evalFormula.replace(/\bbooking_count\b/g, String(context.booking_count));
    evalFormula = evalFormula.replace(/\bbooked_locations_count\b/g, String(context.booked_locations_count));
    evalFormula = evalFormula.replace(/\bbooking_days_count\b/g, String(context.booking_days_count));
    evalFormula = evalFormula.replace(/\blocation_costs_total\b/g, String(context.location_costs_total));
    evalFormula = evalFormula.replace(/\bavg_location_daily_rate\b/g, String(context.avg_location_daily_rate));
    evalFormula = evalFormula.replace(/\bfm_sales_count\b/g, String(context.fm_sales_count));
    evalFormula = evalFormula.replace(/\bavg_sales_per_employee\b/g, String(context.avg_sales_per_employee));
    evalFormula = evalFormula.replace(/\bworking_days_in_month\b/g, String(context.working_days_in_month));
    
    // Handle SUM(locations.X) pattern
    const sumLocationsMatch = evalFormula.match(/SUM\(locations\.(\w+)\)/gi);
    if (sumLocationsMatch) {
      for (const match of sumLocationsMatch) {
        const field = match.match(/locations\.(\w+)/i)?.[1] as keyof LocationDetail;
        if (field && context.location_details.length > 0) {
          const sum = context.location_details.reduce((acc, loc) => {
            const val = loc[field];
            return acc + (typeof val === 'number' ? val : 0);
          }, 0);
          evalFormula = evalFormula.replace(match, String(sum));
        } else {
          evalFormula = evalFormula.replace(match, "0");
        }
      }
    }
    
    // Handle SUM(employees.X) pattern
    const sumEmployeesMatch = evalFormula.match(/SUM\(employees\.(\w+)\)/gi);
    if (sumEmployeesMatch) {
      for (const match of sumEmployeesMatch) {
        const field = match.match(/employees\.(\w+)/i)?.[1] as keyof EmployeeDetail;
        if (field && context.employee_details.length > 0) {
          const sum = context.employee_details.reduce((acc, emp) => {
            const val = emp[field];
            return acc + (typeof val === 'number' ? val : 0);
          }, 0);
          evalFormula = evalFormula.replace(match, String(sum));
        } else {
          evalFormula = evalFormula.replace(match, "0");
        }
      }
    }
    
    // Handle AVG(locations.X) pattern
    const avgLocationsMatch = evalFormula.match(/AVG\(locations\.(\w+)\)/gi);
    if (avgLocationsMatch) {
      for (const match of avgLocationsMatch) {
        const field = match.match(/locations\.(\w+)/i)?.[1] as keyof LocationDetail;
        if (field && context.location_details.length > 0) {
          const sum = context.location_details.reduce((acc, loc) => {
            const val = loc[field];
            return acc + (typeof val === 'number' ? val : 0);
          }, 0);
          const avg = sum / context.location_details.length;
          evalFormula = evalFormula.replace(match, String(avg));
        } else {
          evalFormula = evalFormula.replace(match, "0");
        }
      }
    }
    
    // Handle COUNT(locations) pattern
    evalFormula = evalFormula.replace(/COUNT\(locations\)/gi, String(context.location_details.length));
    evalFormula = evalFormula.replace(/COUNT\(employees\)/gi, String(context.employee_details.length));
    
    // Handle COUNT(locations WHERE sales > X) pattern
    const countLocationsWhereMatch = evalFormula.match(/COUNT\(locations\s+WHERE\s+sales\s*>\s*(\d+)\)/gi);
    if (countLocationsWhereMatch) {
      for (const match of countLocationsWhereMatch) {
        const threshold = parseInt(match.match(/>\s*(\d+)/)?.[1] || "0");
        const count = context.location_details.filter(loc => loc.sales > threshold).length;
        evalFormula = evalFormula.replace(match, String(count));
      }
    }
    
    // Handle MAX function
    const maxMatch = evalFormula.match(/MAX\((\d+(?:\.\d+)?),\s*([^)]+)\)/gi);
    if (maxMatch) {
      for (const match of maxMatch) {
        const parts = match.match(/MAX\((\d+(?:\.\d+)?),\s*([^)]+)\)/i);
        if (parts) {
          const val1 = parseFloat(parts[1]);
          const val2 = parseFloat(parts[2]);
          evalFormula = evalFormula.replace(match, String(Math.max(val1, isNaN(val2) ? 0 : val2)));
        }
      }
    }
    
    // Handle max(...) lowercase
    evalFormula = evalFormula.replace(/max\(([^,]+),\s*([^)]+)\)/gi, (_, a, b) => {
      const valA = parseFloat(a);
      const valB = parseFloat(b);
      return String(Math.max(isNaN(valA) ? 0 : valA, isNaN(valB) ? 0 : valB));
    });
    
    // Handle MIN function
    evalFormula = evalFormula.replace(/min\(([^,]+),\s*([^)]+)\)/gi, (_, a, b) => {
      const valA = parseFloat(a);
      const valB = parseFloat(b);
      return String(Math.min(isNaN(valA) ? 0 : valA, isNaN(valB) ? 0 : valB));
    });
    
    // Handle IF(condition, then, else) - simplified version
    const ifMatch = evalFormula.match(/IF\(([^,]+)\s*([><=!]+)\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/gi);
    if (ifMatch) {
      for (const match of ifMatch) {
        const parts = match.match(/IF\(([^,]+)\s*([><=!]+)\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/i);
        if (parts) {
          const left = parseFloat(parts[1]);
          const op = parts[2];
          const right = parseFloat(parts[3]);
          const thenVal = parseFloat(parts[4]);
          const elseVal = parseFloat(parts[5]);
          
          let condition = false;
          switch (op) {
            case ">": condition = left > right; break;
            case "<": condition = left < right; break;
            case ">=": condition = left >= right; break;
            case "<=": condition = left <= right; break;
            case "==": condition = left === right; break;
            case "!=": condition = left !== right; break;
          }
          
          evalFormula = evalFormula.replace(match, String(condition ? thenVal : elseVal));
        }
      }
    }
    
    // Security: Only allow numbers and basic math operators
    const sanitized = evalFormula.replace(/[^0-9+\-*/().%\s]/g, "");
    
    // Evaluate the sanitized formula
    if (!sanitized.trim() || sanitized.trim() === "") {
      return 0;
    }
    
    // Use Function constructor for safe evaluation (no access to global scope)
    const result = new Function(`"use strict"; return (${sanitized})`)();
    
    if (typeof result !== "number" || isNaN(result) || !isFinite(result)) {
      return 0;
    }
    
    return Math.round(result * 100) / 100;
  } catch (error) {
    console.error("Formula evaluation error:", error, "Formula:", formula);
    return 0;
  }
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

    // Fetch team employees with details
    const { data: teamEmployees } = await supabase
      .from("employee_master_data")
      .select("id, first_name, last_name")
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
    
    // Calculate working days in month (weekdays)
    let workingDaysInMonth = 0;
    const tempDate = new Date(startOfMonth);
    while (tempDate <= endOfMonth) {
      const dayOfWeek = tempDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) workingDaysInMonth++;
      tempDate.setDate(tempDate.getDate() + 1);
    }

    // Get team sales for current month with employee breakdown
    const { data: salesData } = await supabase
      .from("sales")
      .select("id, amount, employee_id")
      .in("employee_id", employeeIds.length > 0 ? employeeIds : ["__none__"])
      .gte("sale_date", startDateStr)
      .lte("sale_date", endDateStr);

    const teamSalesCount = salesData?.length || 0;
    const teamRevenue = salesData?.reduce((sum, s) => sum + (s.amount || 0), 0) || 0;

    // Get fieldmarketing sales
    const { data: fmSalesData } = await supabase
      .from("fieldmarketing_sales")
      .select("id, quantity, amount, location_id")
      .gte("sale_date", startDateStr)
      .lte("sale_date", endDateStr);

    const fmSalesCount = fmSalesData?.reduce((sum, s) => sum + (s.quantity || 1), 0) || 0;

    // Build employee details with sales
    const employeeDetails: EmployeeDetail[] = (teamEmployees || []).map(emp => {
      const empSales = salesData?.filter(s => s.employee_id === emp.id) || [];
      return {
        id: emp.id,
        name: `${emp.first_name} ${emp.last_name}`,
        sales: empSales.length,
        revenue: empSales.reduce((sum, s) => sum + (s.amount || 0), 0),
        booking_days: 0, // Will be filled below
      };
    });

    // Fetch ALL bookings in the current month directly (not via team employees)
    let bookingCount = 0;
    let bookedLocationsCount = 0;
    let bookingDaysCount = 0;
    let locationCostsTotal = 0;
    const locationDetails: LocationDetail[] = [];

    // Fetch bookings directly - they overlap with current month if start_date <= endDateStr AND end_date >= startDateStr
    const { data: allBookings, error: bookingsError } = await supabase
      .from("booking")
      .select(`
        id,
        location_id,
        daily_rate_override,
        booked_days,
        start_date,
        end_date
      `)
      .lte("start_date", endDateStr)
      .gte("end_date", startDateStr);

    if (bookingsError) {
      console.error("Error fetching bookings:", bookingsError);
    }

    console.log(`Found ${allBookings?.length || 0} bookings in period ${startDateStr} to ${endDateStr}`);

    if (allBookings && allBookings.length > 0) {
      bookingCount = allBookings.length;

      // Get unique location IDs
      const locationIds = [...new Set(allBookings.map(b => b.location_id).filter(Boolean))];
      bookedLocationsCount = locationIds.length;

      // Fetch all location details
      const { data: locations } = await supabase
        .from("location")
        .select("id, name, daily_rate")
        .in("id", locationIds);

      // Get all booking assignments for day counting and employee data
      const bookingIds = allBookings.map(b => b.id);
      const { data: assignments } = await supabase
        .from("booking_assignment")
        .select("booking_id, date, employee_id")
        .in("booking_id", bookingIds)
        .gte("date", startDateStr)
        .lte("date", endDateStr);

      bookingDaysCount = assignments?.length || 0;

      // Update employee booking days (for employees in the selected team)
      for (const emp of employeeDetails) {
        emp.booking_days = assignments?.filter(a => a.employee_id === emp.id).length || 0;
      }

      // Build location details with calculations
      for (const loc of locations || []) {
        // Find bookings for this location
        const locBookings = allBookings.filter(b => b.location_id === loc.id);
        
        // Count days for this location from assignments
        let locDays = 0;
        for (const booking of locBookings) {
          const bookingAssignments = assignments?.filter(a => a.booking_id === booking.id) || [];
          locDays += bookingAssignments.length;
        }

        // Also count from booked_days array if no assignments
        if (locDays === 0) {
          for (const booking of locBookings) {
            if (booking.booked_days && Array.isArray(booking.booked_days)) {
              locDays += booking.booked_days.length;
            }
          }
        }

        // Determine daily rate (use override if available, otherwise location rate)
        const dailyRate = locBookings[0]?.daily_rate_override || loc.daily_rate || 0;
        
        // Calculate total for this location
        const locTotal = dailyRate * locDays;

        // Get FM sales for this location
        const locFmSales = fmSalesData?.filter(s => s.location_id === loc.id) || [];
        const locSalesCount = locFmSales.reduce((sum, s) => sum + (s.quantity || 1), 0);
        const locRevenue = locFmSales.reduce((sum, s) => sum + (s.amount || 0), 0);

        locationDetails.push({
          name: loc.name,
          location_id: loc.id,
          days: locDays,
          daily_rate: dailyRate,
          total: locTotal,
          sales: locSalesCount,
          revenue: locRevenue,
        });

        locationCostsTotal += locTotal;
      }

      console.log(`Calculated location_costs_total: ${locationCostsTotal}`);
      console.log(`Location details:`, JSON.stringify(locationDetails, null, 2));
    }

    const avgLocationDailyRate = locationDetails.length > 0
      ? locationDetails.reduce((sum, loc) => sum + loc.daily_rate, 0) / locationDetails.length
      : 0;

    const avgSalesPerEmployee = teamMemberCount > 0 ? teamSalesCount / teamMemberCount : 0;

    const contextData: RichContext = {
      team_name: teamData?.name || "Ukendt team",
      team_member_count: teamMemberCount,
      team_sales_count: teamSalesCount,
      team_revenue: teamRevenue,
      booking_count: bookingCount,
      booked_locations_count: bookedLocationsCount,
      booking_days_count: bookingDaysCount,
      location_costs_total: locationCostsTotal,
      location_details: locationDetails,
      avg_location_daily_rate: Math.round(avgLocationDailyRate),
      fm_sales_count: fmSalesCount,
      avg_sales_per_employee: Math.round(avgSalesPerEmployee * 10) / 10,
      employee_details: employeeDetails,
      working_days_in_month: workingDaysInMonth,
    };

    console.log("Rich context data:", JSON.stringify(contextData, null, 2));

    // Build location summary for AI
    const locationSummary = locationDetails.length > 0
      ? locationDetails.map(l => `- ${l.name}: ${l.days} dage × ${l.daily_rate} kr/dag = ${l.total} kr (${l.sales} salg)`).join("\n")
      : "Ingen lokationer booket i perioden";

    const employeeSummary = employeeDetails.length > 0
      ? employeeDetails.slice(0, 5).map(e => `- ${e.name}: ${e.sales} salg, ${e.booking_days} bookingdage`).join("\n")
      : "Ingen sælgere";

    const systemPrompt = `Du er en ekspert-assistent der hjælper med at parse komplekse udgiftsbeskrivelser til matematiske formler.

Du modtager en beskrivelse af en teamudgift på dansk og skal returnere en struktureret formel der kan beregnes.

## TILGÆNGELIGE SIMPLE VARIABLER:
| Variabel | Beskrivelse | Aktuel værdi |
|----------|-------------|--------------|
| team_member_count | Antal aktive sælgere | ${contextData.team_member_count} |
| team_sales_count | Antal salg denne måned | ${contextData.team_sales_count} |
| team_revenue | Omsætning i DKK | ${contextData.team_revenue} |
| booking_count | Antal bookinger | ${contextData.booking_count} |
| booked_locations_count | Antal unikke lokationer | ${contextData.booked_locations_count} |
| booking_days_count | Total antal bookingdage | ${contextData.booking_days_count} |
| location_costs_total | Sum af alle lokationsudgifter (dagspris × dage) | ${contextData.location_costs_total} |
| avg_location_daily_rate | Gennemsnitlig dagspris | ${contextData.avg_location_daily_rate} |
| fm_sales_count | Fieldmarketing salg | ${contextData.fm_sales_count} |
| avg_sales_per_employee | Gennemsnitlige salg per sælger | ${contextData.avg_sales_per_employee} |
| working_days_in_month | Arbejdsdage i måneden | ${contextData.working_days_in_month} |

## LOKATIONSDATA (detaljeret):
${locationSummary}

## SÆLGERDATA (top 5):
${employeeSummary}

## AGGREGERINGSFUNKTIONER:
- SUM(locations.daily_rate) - Summer dagspris for alle lokationer
- SUM(locations.days) - Summer dage for alle lokationer  
- SUM(locations.total) - Summer dagspris × dage for alle lokationer = location_costs_total
- SUM(locations.sales) - Summer salg for alle lokationer
- SUM(locations.revenue) - Summer omsætning for alle lokationer
- AVG(locations.daily_rate) - Gennemsnitlig dagspris
- COUNT(locations) - Antal lokationer
- COUNT(locations WHERE sales > X) - Antal lokationer med mere end X salg
- SUM(employees.sales) - Summer salg for alle sælgere
- SUM(employees.booking_days) - Summer bookingdage for alle sælgere
- MAX(0, X - Y) - Maksimum af 0 og X-Y (for "over X" beregninger)
- IF(X > Y, then, else) - Betinget beregning

## EKSEMPLER PÅ FORMLER:

| Beskrivelse | Formel | Forklaring |
|-------------|--------|------------|
| "500 kr per sælger" | base_amount * team_member_count | 500 × antal sælgere |
| "1% af omsætningen" | percentage * team_revenue | 0.01 × omsætning |
| "2000 kr flat" | fixed_amount | Fast beløb |
| "100 kr per salg over 50" | per_unit * MAX(0, team_sales_count - threshold) | 100 × (salg - 50) hvis over 50 |
| "500 kr per lokation" | base_amount * booked_locations_count | 500 × antal lokationer |
| "100 kr per bookingdag" | base_amount * booking_days_count | 100 × antal bookingdage |
| "Lokationsudgift baseret på dagspriser" | location_costs_total | Sum af dagspris × dage for hver lokation |
| "Dagspris × dage for alle lokationer" | SUM(locations.total) | Summer alle lokationsudgifter |
| "Gennemsnitlig dagspris gange antal lokationer" | avg_location_daily_rate * booked_locations_count | Gns. pris × antal |
| "500 kr ekstra per lokation med over 5 salg" | base_amount * COUNT(locations WHERE sales > 5) | 500 × lokationer med >5 salg |
| "10% rabat på lokationsudgifter" | location_costs_total * discount | Total × 0.9 |
| "Bonus på 50 kr per salg over gennemsnittet" | per_sale * MAX(0, team_sales_count - avg_sales_per_employee * team_member_count) | Ekstra salg × 50 |

## VIGTIGE REGLER:
1. Brug ALTID location_costs_total eller SUM(locations.total) når brugeren nævner "lokationsudgift baseret på dagspriser" eller lignende
2. Når brugeren nævner "per lokation" uden at nævne dagspriser, brug booked_locations_count
3. Når brugeren nævner rabat/discount, gang med (1 - rabatprocent)
4. Formlen skal være evaluerbar - brug kun de variabler og funktioner der er defineret ovenfor
5. Beregn calculated_amount baseret på de aktuelle data

## KATEGORIER (vælg den mest passende):
kantineordning, firmabil, parkering, telefon, internet, forsikring, uddannelse, udstyr, software, transport, repræsentation, lokation, bonus, provision, andet

## OUTPUT FORMAT:
Returnér ALTID valid JSON med denne struktur:
{
  "formula": "matematisk formel med variabelnavne",
  "variables": {"variabelnavn": numerisk_værdi},
  "calculated_amount": beregnet beløb baseret på aktuelle data,
  "explanation": "kort forklaring på dansk af hvad formlen gør",
  "expense_name": "kort navn til udgiften (max 50 tegn)",
  "category": "kategori fra listen ovenfor",
  "formula_readable": "læsbar version af formlen på dansk"
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

    // Re-calculate amount using our secure evaluator for verification
    const recalculatedAmount = evaluateFormula(result.formula, contextData);
    
    // Use AI's calculated amount if our evaluator returns 0 but AI has a value
    const finalAmount = recalculatedAmount > 0 ? recalculatedAmount : (result.calculated_amount || 0);

    // Validate and ensure all fields exist
    const validatedResult: FormulaResult = {
      formula: result.formula || "fixed_amount",
      variables: result.variables || { fixed_amount: 0 },
      calculated_amount: finalAmount,
      explanation: result.explanation || "Kunne ikke fortolke beskrivelsen",
      expense_name: result.expense_name || description.slice(0, 50),
      category: result.category || "andet",
      formula_readable: result.formula_readable || result.explanation,
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
