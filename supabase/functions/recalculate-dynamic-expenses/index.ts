import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DynamicExpense {
  id: string;
  team_id: string;
  description: string;
  amount: number;
  formula_description: string | null;
  is_dynamic: boolean;
}

interface RecalculationResult {
  id: string;
  description: string;
  old_amount: number;
  new_amount: number;
  changed: boolean;
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse optional team_id filter from request body
    let teamIdFilter: string | null = null;
    try {
      const body = await req.json();
      teamIdFilter = body?.team_id || null;
    } catch {
      // No body or invalid JSON - recalculate all
    }

    console.log(`Starting recalculation of dynamic expenses${teamIdFilter ? ` for team ${teamIdFilter}` : ''}`);

    // Fetch all dynamic expenses
    let query = supabase
      .from("team_expenses")
      .select("id, team_id, description, amount, formula_description, is_dynamic")
      .eq("is_dynamic", true);

    if (teamIdFilter) {
      query = query.eq("team_id", teamIdFilter);
    }

    const { data: dynamicExpenses, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching dynamic expenses:", fetchError);
      throw new Error(`Failed to fetch dynamic expenses: ${fetchError.message}`);
    }

    if (!dynamicExpenses || dynamicExpenses.length === 0) {
      console.log("No dynamic expenses found to recalculate");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No dynamic expenses found",
          results: [],
          summary: { total: 0, updated: 0, unchanged: 0, errors: 0 }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${dynamicExpenses.length} dynamic expenses to recalculate`);

    const results: RecalculationResult[] = [];
    let updatedCount = 0;
    let errorCount = 0;

    // Process each dynamic expense
    for (const expense of dynamicExpenses as DynamicExpense[]) {
      const result: RecalculationResult = {
        id: expense.id,
        description: expense.description,
        old_amount: expense.amount,
        new_amount: expense.amount,
        changed: false,
      };

      try {
        // Use the formula_description to get updated amount
        const formulaDescription = expense.formula_description || expense.description;
        
        console.log(`Recalculating expense "${expense.description}" for team ${expense.team_id}`);

        // Call the parse-expense-formula function
        const parseResponse = await fetch(`${supabaseUrl}/functions/v1/parse-expense-formula`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            description: formulaDescription,
            team_id: expense.team_id,
          }),
        });

        if (!parseResponse.ok) {
          const errorText = await parseResponse.text();
          throw new Error(`parse-expense-formula failed: ${errorText}`);
        }

        const parseResult = await parseResponse.json();

        if (!parseResult.success || !parseResult.result) {
          throw new Error(parseResult.error || "Invalid response from parse-expense-formula");
        }

        const newAmount = parseResult.result.calculated_amount;
        
        // Only update if amount has changed
        if (Math.abs(newAmount - expense.amount) > 0.01) {
          const { error: updateError } = await supabase
            .from("team_expenses")
            .update({ 
              amount: newAmount,
              updated_at: new Date().toISOString(),
            })
            .eq("id", expense.id);

          if (updateError) {
            throw new Error(`Failed to update expense: ${updateError.message}`);
          }

          result.new_amount = newAmount;
          result.changed = true;
          updatedCount++;
          console.log(`Updated expense "${expense.description}": ${expense.amount} → ${newAmount}`);
        } else {
          console.log(`Expense "${expense.description}" unchanged: ${expense.amount}`);
        }
      } catch (error) {
        console.error(`Error processing expense ${expense.id}:`, error);
        result.error = error instanceof Error ? error.message : String(error);
        errorCount++;
      }

      results.push(result);
    }

    const summary = {
      total: dynamicExpenses.length,
      updated: updatedCount,
      unchanged: dynamicExpenses.length - updatedCount - errorCount,
      errors: errorCount,
    };

    console.log(`Recalculation complete:`, summary);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Recalculated ${dynamicExpenses.length} dynamic expenses. ${updatedCount} updated, ${errorCount} errors.`,
        results,
        summary,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in recalculate-dynamic-expenses:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
