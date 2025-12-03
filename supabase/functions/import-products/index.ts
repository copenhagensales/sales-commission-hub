import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CSVProduct {
  name: string;
  commission_dkk: number;
  revenue_dkk: number;
}

function parseCSV(csvText: string): CSVProduct[] {
  const lines = csvText.split('\n').map(line => line.trim()).filter(line => line);
  const products: CSVProduct[] = [];

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Handle CSV with potential quoted values
    const values = line.split(';').map(v => v.trim().replace(/^"|"$/g, ''));
    
    const name = values[0] || '';
    const commissionStr = values[1] || '0';
    const revenueStr = values[2] || '0';

    // Skip rows with "opstartsbonus" or blank names
    if (!name || name.toLowerCase().includes('opstartsbonus')) {
      continue;
    }

    // Parse numbers (handle Danish number format with comma as decimal separator)
    const commission = parseFloat(commissionStr.replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
    const revenue = parseFloat(revenueStr.replace(',', '.').replace(/[^\d.-]/g, '')) || 0;

    products.push({
      name,
      commission_dkk: commission,
      revenue_dkk: revenue,
    });
  }

  return products;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const clientName = formData.get('client_name') as string || 'TDC Erhverv';
    const campaignName = formData.get('campaign_name') as string || 'Standard';

    if (!file) {
      return new Response(
        JSON.stringify({ success: false, error: 'No file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const csvText = await file.text();
    const products = parseCSV(csvText);

    console.log(`Parsed ${products.length} products from CSV`);

    // 1. Get or create client
    let { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('name', clientName)
      .maybeSingle();

    if (!client) {
      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert({ name: clientName })
        .select()
        .single();
      
      if (clientError) throw clientError;
      client = newClient;
    }

    if (!client) {
      throw new Error('Failed to create or find client');
    }

    // 2. Get or create campaign
    let { data: campaign } = await supabase
      .from('client_campaigns')
      .select('id')
      .eq('client_id', client.id)
      .eq('name', campaignName)
      .maybeSingle();

    if (!campaign) {
      const { data: newCampaign, error: campaignError } = await supabase
        .from('client_campaigns')
        .insert({ client_id: client.id, name: campaignName })
        .select()
        .single();
      
      if (campaignError) throw campaignError;
      campaign = newCampaign;
    }

    if (!campaign) {
      throw new Error('Failed to create or find campaign');
    }

    // 3. Insert products (upsert by name within campaign)
    let inserted = 0;
    let updated = 0;
    let errors = 0;

    for (const product of products) {
      // Check if product exists
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('client_campaign_id', campaign.id)
        .eq('name', product.name)
        .maybeSingle();

      if (existing) {
        // Update existing product
        const { error } = await supabase
          .from('products')
          .update({
            commission_dkk: product.commission_dkk,
            revenue_dkk: product.revenue_dkk,
          })
          .eq('id', existing.id);

        if (error) {
          console.error('Error updating product:', product.name, error);
          errors++;
        } else {
          updated++;
        }
      } else {
        // Insert new product
        const { error } = await supabase
          .from('products')
          .insert({
            client_campaign_id: campaign.id,
            name: product.name,
            commission_dkk: product.commission_dkk,
            revenue_dkk: product.revenue_dkk,
          });

        if (error) {
          console.error('Error inserting product:', product.name, error);
          errors++;
        } else {
          inserted++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        client_id: client.id,
        campaign_id: campaign.id,
        total_parsed: products.length,
        inserted,
        updated,
        errors,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Import error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
