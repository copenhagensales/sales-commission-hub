import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { StandardSale } from './types.ts';

export class IngestionEngine {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
  }

  private log(type: 'INFO' | 'ERROR', msg: string, data?: any) {
    console.log(JSON.stringify({ type, msg, data, timestamp: new Date().toISOString() }));
  }

  async processBatch(sales: StandardSale[], source: string) {
    if (sales.length === 0) return { processed: 0, errors: 0 };

    this.log('INFO', `Processing batch from ${source}`, { count: sales.length });

    const { data: agents } = await this.supabase.from('agents').select('id, email, external_adversus_id');
    const { data: products } = await this.supabase.from('products').select('id, name, commission_dkk, revenue_dkk');
    
    const agentMap = new Map(agents?.map(a => [a.email?.toLowerCase(), a.id]));
    const productMap = new Map(products?.map(p => [p.name.toLowerCase(), p]));

    let processed = 0;
    let errors = 0;

    for (const sale of sales) {
      try {
        const agentId = agentMap.get(sale.agentEmail.toLowerCase());

        const { data: saleRecord, error: saleError } = await this.supabase
          .from('sales')
          .upsert({
            adversus_external_id: sale.externalId,
            sale_datetime: sale.saleDate,
            agent_id: agentId,
            agent_name: sale.agentEmail,
            customer_company: sale.customerName,
            customer_phone: sale.customerPhone,
            updated_at: new Date().toISOString()
          }, { onConflict: 'adversus_external_id' })
          .select('id')
          .single();

        if (saleError) throw saleError;

        await this.supabase.from('sale_items').delete().eq('sale_id', saleRecord.id);

        const itemsToInsert = sale.products.map(p => {
          const matchedProd = productMap.get(p.name.toLowerCase());
          
          let commission = 0;
          let revenue = 0;

          if (matchedProd) {
            commission = (matchedProd.commission_dkk || 0) * p.quantity;
            revenue = (matchedProd.revenue_dkk || 0) * p.quantity;
          }

          return {
            sale_id: saleRecord.id,
            product_id: matchedProd?.id || null,
            adversus_external_id: p.externalId,
            adversus_product_title: p.name,
            quantity: p.quantity,
            unit_price: p.unitPrice,
            mapped_commission: commission,
            mapped_revenue: revenue,
            needs_mapping: !matchedProd,
            raw_data: p
          };
        });

        if (itemsToInsert.length > 0) {
          const { error: itemsError } = await this.supabase.from('sale_items').insert(itemsToInsert);
          if (itemsError) throw itemsError;
        }

        processed++;
      } catch (e: any) {
        errors++;
        this.log('ERROR', `Failed to process sale ${sale.externalId}`, e.message);
      }
    }

    return { processed, errors };
  }
}
