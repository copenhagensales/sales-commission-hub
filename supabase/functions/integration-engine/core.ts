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

  // Auto-create campaign mappings for any new campaigns encountered in sales
  private async ensureCampaignMappings(sales: StandardSale[]) {
    // Extract unique campaigns from sales
    const uniqueCampaigns = new Map<string, { id: string; name: string }>();
    for (const sale of sales) {
      if (sale.campaignId && !uniqueCampaigns.has(sale.campaignId)) {
        uniqueCampaigns.set(sale.campaignId, {
          id: sale.campaignId,
          name: sale.campaignName || sale.campaignId,
        });
      }
    }

    if (uniqueCampaigns.size === 0) return;

    this.log("INFO", `Verificando ${uniqueCampaigns.size} campañas únicas...`);

    // Check which campaigns already exist
    const campaignIds = Array.from(uniqueCampaigns.keys());
    const { data: existingMappings } = await this.supabase
      .from("adversus_campaign_mappings")
      .select("adversus_campaign_id")
      .in("adversus_campaign_id", campaignIds);

    const existingIds = new Set(existingMappings?.map(m => m.adversus_campaign_id) || []);

    // Insert new campaign mappings
    const newCampaigns = Array.from(uniqueCampaigns.values())
      .filter(c => !existingIds.has(c.id));

    if (newCampaigns.length > 0) {
      this.log("INFO", `Creando ${newCampaigns.length} nuevos mapeos de campaña...`);
      
      const { error } = await this.supabase.from("adversus_campaign_mappings").insert(
        newCampaigns.map(c => ({
          adversus_campaign_id: c.id,
          adversus_campaign_name: c.name,
        }))
      );

      if (error) {
        this.log("WARN", `Error creando mapeos de campaña: ${error.message}`);
      } else {
        this.log("INFO", `Creados ${newCampaigns.length} mapeos de campaña: ${newCampaigns.map(c => c.name).join(", ")}`);
      }
    }
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

    // AUTO-CREATE CAMPAIGN MAPPINGS for any new campaigns encountered
    await this.ensureCampaignMappings(sales);

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

  // Process a single batch of sales using BULK UPSERT for maximum speed
  private async processSalesBatch(
    sales: StandardSale[], 
    productMapByName: Map<string, any>,
    productMapByExtId: Map<string, string>,
    dbProducts: any[] | null
  ) {
    let processed = 0;
    let errors = 0;

    // OPTIMIZATION: Fetch all existing sales in ONE query (to preserve OPP numbers)
    const externalIds = sales.map(s => s.externalId);
    const { data: existingSales } = await this.supabase
      .from("sales")
      .select("id, adversus_external_id, adversus_opp_number")
      .in("adversus_external_id", externalIds);
    
    const existingSalesMap = new Map(existingSales?.map(s => [s.adversus_external_id, s]) || []);

    // Prepare ALL sales for UPSERT
    const allSalesData: any[] = [];
    const saleItemsToInsert: any[] = [];
    const existingSaleIds: string[] = [];

    for (const sale of sales) {
      try {
        const existingSale = existingSalesMap.get(sale.externalId);
        
        // NON-DESTRUCTIVE: Keep existing OPP if new one is empty
        let oppNumber = sale.externalReference || null;
        if (existingSale?.adversus_opp_number && !sale.externalReference) {
          oppNumber = existingSale.adversus_opp_number;
        }

        const saleData = {
          adversus_external_id: sale.externalId,
          sale_datetime: sale.saleDate,
          agent_name: sale.agentName || sale.agentEmail,
          customer_company: sale.customerName,
          customer_phone: sale.customerPhone,
          adversus_opp_number: oppNumber,
          client_campaign_id: sale.clientCampaignId || null,
          dialer_campaign_id: sale.campaignId || null,
          source: sale.dialerName,
          integration_type: sale.integrationType,
          updated_at: new Date().toISOString(),
        };

        allSalesData.push(saleData);
        
        if (existingSale) {
          existingSaleIds.push(existingSale.id);
        }
        
        processed++;
      } catch (e) {
        errors++;
        const errMsg = e instanceof Error ? e.message : String(e);
        this.log("ERROR", `Error preparando venta ${sale.externalId}`, errMsg);
      }
    }

    // BULK OPERATIONS - minimal queries
    try {
      // 1. Delete old items for existing sales (1 query)
      if (existingSaleIds.length > 0) {
        await this.supabase.from("sale_items").delete().in("sale_id", existingSaleIds);
      }

      // 2. BULK UPSERT all sales (1 query instead of N queries!)
      if (allSalesData.length > 0) {
        const { data: upsertedSales, error: upsertError } = await this.supabase
          .from("sales")
          .upsert(allSalesData, { 
            onConflict: "adversus_external_id",
            ignoreDuplicates: false 
          })
          .select("id, adversus_external_id");
        
        if (upsertError) throw upsertError;

        // Build ID map for sale items
        const saleIdMap = new Map(upsertedSales?.map(s => [s.adversus_external_id, s.id]) || []);
        
        // Prepare all sale items
        for (const sale of sales) {
          const saleId = saleIdMap.get(sale.externalId);
          if (saleId) {
            this.prepareSaleItems(sale, saleId, productMapByExtId, productMapByName, dbProducts, saleItemsToInsert);
          }
        }
      }

      // 3. Bulk insert all sale items (1 query)
      if (saleItemsToInsert.length > 0) {
        const { error: itemsError } = await this.supabase.from("sale_items").insert(saleItemsToInsert);
        if (itemsError) throw itemsError;
      }

    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      this.log("ERROR", `Error en operaciones bulk`, errMsg);
      errors += sales.length;
      processed = 0;
    }

    return { processed, errors };
  }

  // Helper to prepare sale items
  private prepareSaleItems(
    sale: StandardSale,
    saleId: string,
    productMapByExtId: Map<string, string>,
    productMapByName: Map<string, any>,
    dbProducts: any[] | null,
    itemsArray: any[]
  ) {
    for (const p of sale.products) {
      let productId = productMapByExtId.get(p.externalId);
      if (!productId && p.name) {
        const prod = productMapByName.get(p.name.toLowerCase());
        if (prod) productId = prod.id;
      }

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

      itemsArray.push({
        sale_id: saleId,
        product_id: productId || null,
        adversus_external_id: p.externalId,
        adversus_product_title: p.name,
        quantity: qty,
        unit_price: p.unitPrice,
        mapped_commission: commission,
        mapped_revenue: revenue,
        needs_mapping: !productId,
      });
    }
  }
}
