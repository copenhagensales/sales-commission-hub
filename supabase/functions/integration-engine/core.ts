import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { StandardSale, StandardUser, StandardCampaign } from "./types.ts";

export class IngestionEngine {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  }

  private log(type: "INFO" | "ERROR" | "WARN", msg: string, data?: any) {
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
        // Safe Sync: Buscar primero para evitar errores de constraint
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
      } catch (e: any) {
        errors++;
        this.log("ERROR", `Error guardando usuario ${user.name}`, e.message);
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
      } catch (e: any) {
        errors++;
        this.log("ERROR", `Error campaña ${camp.name}`, e.message);
      }
    }
    return { processed, errors };
  }

  // --- 3. PROCESAR VENTAS (La lógica pesada) ---
  async processSales(sales: StandardSale[], sourceSystem: string) {
    if (sales.length === 0) return { processed: 0, errors: 0 };
    this.log("INFO", `Procesando ${sales.length} ventas de ${sourceSystem}...`);

    // A. Cargar Cachés (Optimización de rendimiento)
    const { data: dbAgents } = await this.supabase.from("agents").select("id, external_adversus_id");
    const { data: dbProducts } = await this.supabase.from("products").select("id, name, commission_dkk, revenue_dkk");
    const { data: dbMappings } = await this.supabase.from("adversus_product_mappings").select("*");

    // Mapas para búsqueda O(1)
    const agentMap = new Map(dbAgents?.map((a) => [String(a.external_adversus_id), a.id]));
    const productMapByName = new Map(dbProducts?.map((p) => [p.name.toLowerCase(), p]));
    const productMapByExtId = new Map(dbMappings?.map((m) => [m.adversus_external_id, m.product_id]));

    let processed = 0;
    let errors = 0;

    for (const sale of sales) {
      try {
        // Resolver Agente Interno
        // Intentamos por ID externo (más seguro), si no, lo dejamos null o usamos lógica futura de email
        // El StandardSale trae el 'agentExternalId' si el adaptador lo soporta (lo agregué en types abajo)
        const agentId = agentMap.get(sale.agentExternalId || "") || null;

        const saleData = {
          adversus_external_id: sale.externalId,
          sale_datetime: sale.saleDate,
          agent_external_id: sale.agentExternalId,
          agent_name: sale.agentName, // Nombre que viene del CRM
          agent_id: agentId, // ID interno de nuestra tabla agents
          customer_company: sale.customerName,
          customer_phone: sale.customerPhone,
          updated_at: new Date().toISOString(),
        };

        // B. Safe Sync Venta
        let saleId = null;
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
        const itemsToInsert = sale.products.map((p) => {
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

          if (productId) {
            const fullProduct = dbProducts?.find((x) => x.id === productId);
            if (fullProduct) {
              commission = (fullProduct.commission_dkk || 0) * p.quantity;
              revenue = (fullProduct.revenue_dkk || 0) * p.quantity;
            }
          }

          return {
            sale_id: saleId,
            product_id: productId || null,
            adversus_external_id: p.externalId,
            adversus_product_title: p.name,
            quantity: p.quantity,
            unit_price: p.unitPrice,
            mapped_commission: commission,
            mapped_revenue: revenue,
            needs_mapping: !productId,
            raw_data: p.metadata, // Guardamos raw data si existe
          };
        });

        if (itemsToInsert.length > 0) {
          const { error: itemsError } = await this.supabase.from("sale_items").insert(itemsToInsert);
          if (itemsError) throw itemsError;
        }

        processed++;
      } catch (e: any) {
        errors++;
        this.log("ERROR", `Fallo venta ${sale.externalId}`, e.message);
      }
    }

    return { processed, errors };
  }
}
