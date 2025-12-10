import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { StandardSale, StandardUser, StandardCampaign, StandardProduct, CampaignMappingConfig, ReferenceExtractionConfig } from "./types.ts";

export class IngestionEngine {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  }

  private log(type: "INFO" | "ERROR" | "WARN", msg: string, data?: unknown) {
    console.log(JSON.stringify({ type, msg, data, timestamp: new Date().toISOString() }));
  }

  // Fetch campaign mappings for adapters to use during extraction
  async getCampaignMappings(): Promise<CampaignMappingConfig[]> {
    const { data: mappings } = await this.supabase
      .from("adversus_campaign_mappings")
      .select("adversus_campaign_id, client_campaign_id, reference_extraction_config");

    if (!mappings) return [];

    return mappings.map((m: any) => ({
      adversusCampaignId: m.adversus_campaign_id,
      clientCampaignId: m.client_campaign_id,
      referenceConfig: m.reference_extraction_config as ReferenceExtractionConfig | null,
    }));
  }

  // --- 1. PROCESAR USUARIOS (Agentes) ---
  async processUsers(users: StandardUser[]) {
    if (users.length === 0) return { processed: 0, errors: 0 };
    this.log("INFO", `Procesando ${users.length} usuarios...`);

    let processed = 0;
    let errors = 0;

    for (const user of users) {
      try {
        const { data: existing } = await this.supabase
          .from("agents")
          .select("id")
          .eq("external_adversus_id", user.externalId)
          .maybeSingle();

        const agentData = {
          external_adversus_id: user.externalId,
          name: user.name,
          email: user.email,
          is_active: user.isActive,
        };

        if (existing) {
          await this.supabase.from("agents").update(agentData).eq("id", existing.id);
        } else {
          await this.supabase.from("agents").insert(agentData);
        }
        processed++;
      } catch (e) {
        errors++;
        const errMsg = e instanceof Error ? e.message : String(e);
        this.log("ERROR", `Error guardando usuario ${user.name}`, errMsg);
      }
    }
    return { processed, errors };
  }

  // --- 2. PROCESAR CAMPAÑAS ---
  async processCampaigns(campaigns: StandardCampaign[]) {
    if (campaigns.length === 0) return { processed: 0, errors: 0 };
    this.log("INFO", `Procesando ${campaigns.length} campañas...`);

    let processed = 0;
    let errors = 0;

    for (const camp of campaigns) {
      try {
        const { data: existing } = await this.supabase
          .from("adversus_campaign_mappings")
          .select("id")
          .eq("adversus_campaign_id", camp.externalId)
          .maybeSingle();

        if (existing) {
          await this.supabase
            .from("adversus_campaign_mappings")
            .update({ adversus_campaign_name: camp.name })
            .eq("id", existing.id);
        } else {
          await this.supabase.from("adversus_campaign_mappings").insert({
            adversus_campaign_id: camp.externalId,
            adversus_campaign_name: camp.name,
          });
        }
        processed++;
      } catch (e) {
        errors++;
        const errMsg = e instanceof Error ? e.message : String(e);
        this.log("ERROR", `Error campaña ${camp.name}`, errMsg);
      }
    }
    return { processed, errors };
  }

  // --- 3. PROCESAR VENTAS (La lógica pesada) ---
  // Core is now adapter-agnostic: it receives StandardSale with externalReference already extracted
  // Processes in batches to avoid CPU timeout on large datasets
  async processSales(sales: StandardSale[], batchSize = 500) {
    if (sales.length === 0) return { processed: 0, errors: 0 };
    
    const sampleSale = sales[0];
    this.log("INFO", `Procesando ${sales.length} ventas de ${sampleSale.dialerName} (${sampleSale.integrationType}) en lotes de ${batchSize}...`);

    // A. Cargar Cachés (Optimización de rendimiento)
    const { data: dbProducts } = await this.supabase.from("products").select("id, name, commission_dkk, revenue_dkk");
    const { data: dbMappings } = await this.supabase.from("adversus_product_mappings").select("*");

    // Mapas para búsqueda O(1)
    const productMapByName = new Map(dbProducts?.map((p) => [p.name.toLowerCase(), p]));
    const productMapByExtId = new Map(dbMappings?.map((m) => [m.adversus_external_id, m.product_id]));

    let totalProcessed = 0;
    let totalErrors = 0;

    // Process in batches
    const totalBatches = Math.ceil(sales.length / batchSize);
    
    for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
      const start = batchNum * batchSize;
      const end = Math.min(start + batchSize, sales.length);
      const batch = sales.slice(start, end);
      
      this.log("INFO", `Procesando lote ${batchNum + 1}/${totalBatches} (${batch.length} ventas)...`);
      
      const { processed, errors } = await this.processSalesBatch(batch, productMapByName, productMapByExtId, dbProducts);
      totalProcessed += processed;
      totalErrors += errors;
      
      this.log("INFO", `Lote ${batchNum + 1} completado: ${processed} procesadas, ${errors} errores. Total: ${totalProcessed}/${sales.length}`);
    }

    return { processed: totalProcessed, errors: totalErrors };
  }

  // Process a single batch of sales
  private async processSalesBatch(
    sales: StandardSale[], 
    productMapByName: Map<string, any>,
    productMapByExtId: Map<string, string>,
    dbProducts: any[] | null
  ) {
    let processed = 0;
    let errors = 0;

    for (const sale of sales) {
      try {
        // External reference (OPP) is now pre-extracted by the adapter
        const saleData = {
          adversus_external_id: sale.externalId,
          sale_datetime: sale.saleDate,
          agent_name: sale.agentName || sale.agentEmail,
          customer_company: sale.customerName,
          customer_phone: sale.customerPhone,
          adversus_opp_number: sale.externalReference || null,
          client_campaign_id: sale.clientCampaignId || null,
          source: sale.dialerName, // The dialer/account name (e.g., "Lovablecph", "tryg")
          integration_type: sale.integrationType, // The integration system (adversus, enreach)
          updated_at: new Date().toISOString(),
        };

        // B. Safe Sync Venta (Non-Destructive Update for OPP)
        let saleId: string | null = null;
        const { data: existingSale } = await this.supabase
          .from("sales")
          .select("id, adversus_opp_number")
          .eq("adversus_external_id", sale.externalId)
          .maybeSingle();

        if (existingSale) {
          // NON-DESTRUCTIVE: Only update OPP if new value is valid AND old is null
          // This prevents overwriting good OPP data with null/invalid data
          const updateData = { ...saleData };
          if (existingSale.adversus_opp_number && !sale.externalReference) {
            // Keep existing OPP if new one is empty
            updateData.adversus_opp_number = existingSale.adversus_opp_number;
          }
          
          await this.supabase.from("sales").update(updateData).eq("id", existingSale.id);
          saleId = existingSale.id;
          // Limpiar items viejos para evitar duplicados
          await this.supabase.from("sale_items").delete().eq("sale_id", saleId);
        } else {
          const { data: newSale, error: insertError } = await this.supabase
            .from("sales")
            .insert(saleData)
            .select("id")
            .single();

          if (insertError) throw insertError;
          saleId = newSale.id;
        }

        // C. Procesar Productos
        const itemsToInsert = sale.products.map((p: StandardProduct) => {
          // 1. Intentar match por ID Externo
          let productId = productMapByExtId.get(p.externalId);

          // 2. Intentar match por Nombre (Fallback)
          if (!productId && p.name) {
            const prod = productMapByName.get(p.name.toLowerCase());
            if (prod) productId = prod.id;
          }

          // 3. Calcular Finanzas
          let commission = 0;
          let revenue = 0;
          const qty = p.quantity || 1;

          if (productId) {
            const fullProduct = dbProducts?.find((x) => x.id === productId);
            if (fullProduct) {
              commission = (fullProduct.commission_dkk || 0) * qty;
              revenue = (fullProduct.revenue_dkk || 0) * qty;
            }
          }

          return {
            sale_id: saleId,
            product_id: productId || null,
            adversus_external_id: p.externalId,
            adversus_product_title: p.name,
            quantity: qty,
            unit_price: p.unitPrice,
            mapped_commission: commission,
            mapped_revenue: revenue,
            needs_mapping: !productId,
          };
        });

        if (itemsToInsert.length > 0) {
          const { error: itemsError } = await this.supabase.from("sale_items").insert(itemsToInsert);
          if (itemsError) throw itemsError;
        }

        processed++;
      } catch (e) {
        errors++;
        const errMsg = e instanceof Error ? e.message : String(e);
        this.log("ERROR", `Fallo venta ${sale.externalId}`, errMsg);
      }
    }

    return { processed, errors };
  }
}
