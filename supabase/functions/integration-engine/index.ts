import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
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
    const { source, action, actions, days = 1 } = await req.json();
    
    // Inicializar Supabase para buscar configuraciones
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const engine = new IngestionEngine();
    
    // Buscar todas las integraciones activas del tipo solicitado
    const { data: integrations, error } = await supabase
      .from('api_integrations')
      .select('*')
      .eq('type', source)
      .eq('is_active', true);

    if (error) throw error;
    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: `No hay integraciones activas para ${source}` 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

    const results = [];

    // Iterar sobre cada cuenta (Multi-tenancy)
    for (const integration of integrations) {
      console.log(`Procesando cuenta: ${integration.name}`);
      
      let adapter;
      try {
        if (source === 'adversus') {
          adapter = new AdversusAdapter(integration.secrets);
        } else if (source === 'enreach') {
          adapter = new EnreachAdapter(integration.secrets);
        } else {
          throw new Error(`Fuente no soportada: ${source}`);
        }

        const runResults: Record<string, any> = {};
        
        // Soportar tanto 'action' (legacy) como 'actions' (nuevo array)
        const actionList = actions || (action === 'sync' ? ['sales'] : [action]);

        if (actionList.includes('campaigns')) {
          const campaigns = await adapter.fetchCampaigns();
          runResults['campaigns'] = await engine.processCampaigns(campaigns);
        }

        if (actionList.includes('users')) {
          const users = await adapter.fetchUsers();
          runResults['users'] = await engine.processUsers(users);
        }

        if (actionList.includes('sales') || action === 'sync') {
          const sales = await adapter.fetchSales(days);
          runResults['sales'] = await engine.processSales(sales, integration.name);
        }
        
        // Actualizar timestamp de última sincronización
        await supabase.from('api_integrations')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', integration.id);

        results.push({ name: integration.name, status: 'success', data: runResults });

      } catch (e: any) {
        console.error(`Error en integración ${integration.name}:`, e);
        results.push({ name: integration.name, status: 'error', error: e.message });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Integration engine error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
