import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { IngestionEngine } from "./core.ts";
import { AdversusAdapter } from "./adapters/adversus.ts";
import { EnreachAdapter } from "./adapters/enreach.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { source, action, days = 1 } = await req.json();
    const engine = new IngestionEngine();
    
    let adapter;
    
    switch (source) {
      case 'adversus':
        adapter = new AdversusAdapter();
        break;
      case 'enreach':
        adapter = new EnreachAdapter();
        break;
      default:
        throw new Error(`Unknown source: ${source}`);
    }

    let result;

    if (action === 'sync') {
      const sales = await adapter.fetchSales(days);
      const stats = await engine.processSales(sales, source);
      
      result = {
        success: true,
        message: `${source} sync completed`,
        details: {
          fetched: sales.length,
          ...stats
        }
      };
    } else {
      throw new Error(`Unsupported action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Integration engine error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
