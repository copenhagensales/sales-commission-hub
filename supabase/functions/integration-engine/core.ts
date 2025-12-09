import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { StandardSale, StandardUser, StandardCampaign, StandardProduct } from "./types.ts";

export class IngestionEngine {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  }

  private log(type: "INFO" | "ERROR" | "WARN", msg: string, data?: unknown) {
    console.log(JSON.stringify({ type, msg, data, timestamp: new Date().toISOString() }));
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
  async processSales(sales: StandardSale[], sourceSystem: string) {
    if (sales.length === 0) return { processed: 0, errors: 0 };
    this.log("INFO", `Procesando ${sales.length} ventas de ${sourceSystem}...`);

    // A. Cargar Cachés (Optimización de rendimiento)
    const { data: dbProducts } = await this.supabase.from("products").select("id, name, commission_dkk, revenue_dkk");
    const { data: dbMappings } = await this.supabase.from("adversus_product_mappings").select("*");
    
    // Fetch campaign mappings with external_reference_field_id for dynamic OPP extraction
    const { data: campaignMappings } = await this.supabase
      .from("adversus_campaign_mappings")
      .select("adversus_campaign_id, external_reference_field_id, client_campaign_id");

    // Mapas para búsqueda O(1)
    const productMapByName = new Map(dbProducts?.map((p) => [p.name.toLowerCase(), p]));
    const productMapByExtId = new Map(dbMappings?.map((m) => [m.adversus_external_id, m.product_id]));
    
    // Campaign field mapping for dynamic OPP extraction
    const campaignFieldMap = new Map(
      campaignMappings?.filter(c => c.external_reference_field_id)
        .map(c => [c.adversus_campaign_id, { fieldId: c.external_reference_field_id, clientCampaignId: c.client_campaign_id }])
    );

    let processed = 0;
    let errors = 0;

    for (const sale of sales) {
      try {
        // Extract OPP number dynamically based on campaign field mapping
        let oppNumber: string | null = null;
        
        if (sale.campaignId && campaignFieldMap.has(sale.campaignId)) {
          const mapping = campaignFieldMap.get(sale.campaignId);
          if (mapping?.fieldId && sale.metadata?.resultData) {
            const resultData = sale.metadata.resultData as Record<string, unknown>;
            // Try direct field ID lookup
            const fieldValue = resultData[mapping.fieldId];
            if (fieldValue !== undefined && fieldValue !== null) {
              oppNumber = String(fieldValue);
              this.log("INFO", `Found OPP ${oppNumber} via field ${mapping.fieldId} for campaign ${sale.campaignId}`);
            }
          }
        }
        
        // Fallback: search for common OPP patterns in resultData
        if (!oppNumber && sale.metadata?.resultData) {
          const resultData = sale.metadata.resultData as Record<string, unknown>;
          oppNumber = this.searchForOppInResultData(resultData);
        }

        // Get client_campaign_id from mapping
        let clientCampaignId: string | null = null;
        if (sale.campaignId) {
          const mapping = campaignMappings?.find(c => c.adversus_campaign_id === sale.campaignId);
          if (mapping?.client_campaign_id) {
            clientCampaignId = mapping.client_campaign_id;
          }
        }

        const saleData = {
          adversus_external_id: sale.externalId,
          sale_datetime: sale.saleDate,
          agent_name: sale.agentName || sale.agentEmail,
          customer_company: sale.customerName,
          customer_phone: sale.customerPhone,
          adversus_opp_number: oppNumber,
          client_campaign_id: clientCampaignId,
          updated_at: new Date().toISOString(),
        };

        // B. Safe Sync Venta
        let saleId: string | null = null;
        const { data: existingSale } = await this.supabase
          .from("sales")
          .select("id")
          .eq("adversus_external_id", sale.externalId)
          .maybeSingle();

        if (existingSale) {
          await this.supabase.from("sales").update(saleData).eq("id", existingSale.id);
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

  // Helper: Search for OPP-like values in resultData
  private searchForOppInResultData(resultData: Record<string, unknown>): string | null {
    // Common field patterns for order/reference IDs
    const oppPatterns = ['opp', 'order', 'ordre', 'reference', 'policy', 'ref'];
    
    for (const [key, value] of Object.entries(resultData)) {
      if (value === null || value === undefined) continue;
      
      const keyLower = key.toLowerCase();
      
      // Check if key matches common patterns
      for (const pattern of oppPatterns) {
        if (keyLower.includes(pattern)) {
          const strValue = String(value).trim();
          if (strValue && strValue !== 'null' && strValue !== 'undefined') {
            return strValue;
          }
        }
      }
      
      // Check if value looks like an OPP (starts with OPP- or is numeric reference)
      const strValue = String(value).trim();
      if (strValue.toUpperCase().startsWith('OPP-') || strValue.toUpperCase().startsWith('OPP')) {
        return strValue;
      }
    }
    
    return null;
  }
}
