import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/utils/supabasePagination";
// buildFmPricingMap removed – pricing is handled by database triggers

export interface FieldmarketingSale {
  id: string;
  seller_id: string;
  location_id: string;
  client_id: string;
  product_name: string;
  phone_number: string;
  comment: string | null;
  registered_at: string;
  created_at: string;
  validation_status?: string;
  seller?: {
    first_name: string;
    last_name: string;
  };
  location?: {
    name: string;
  };
  client?: {
    name: string;
  };
}

// FM client_campaign_id mapping is now handled by the enrich_fm_sale database trigger

export function useFieldmarketingSales(clientId?: string) {
  return useQuery({
    queryKey: ["fieldmarketing-sales", clientId],
    staleTime: 60000, // 1 minut
    queryFn: async () => {
      // Fetch from centralized sales table with source = 'fieldmarketing'
      const data = await fetchAllRows<{
        id: string;
        sale_datetime: string;
        customer_phone: string;
        agent_name: string | null;
        validation_status: string | null;
        raw_payload: {
          fm_seller_id?: string;
          fm_location_id?: string;
          fm_client_id?: string;
          fm_product_name?: string;
          fm_comment?: string;
        } | null;
        created_at: string;
        client_campaign: {
          id: string;
          name: string;
          client: { id: string; name: string };
        } | null;
      }>(
        "sales",
        `
          id,
          sale_datetime,
          customer_phone,
          agent_name,
          validation_status,
          raw_payload,
          created_at,
          client_campaign:client_campaigns!client_campaign_id(
            id, name, client:clients(id, name)
          )
        `,
        (q) => {
          let query = q.eq("source", "fieldmarketing").order("sale_datetime", { ascending: false });
          if (clientId) {
            // Filter by fm_client_id in raw_payload using containment operator
            query = query.contains("raw_payload", { fm_client_id: clientId });
          }
          return query;
        },
        { orderBy: "sale_datetime", ascending: false }
      );

      // Transform to backwards-compatible interface
      return data.map((s): FieldmarketingSale => ({
        id: s.id,
        seller_id: s.raw_payload?.fm_seller_id || "",
        location_id: s.raw_payload?.fm_location_id || "",
        client_id: s.raw_payload?.fm_client_id || "",
        product_name: s.raw_payload?.fm_product_name || "",
        phone_number: s.customer_phone || "",
        comment: s.raw_payload?.fm_comment || null,
        registered_at: s.sale_datetime,
        created_at: s.created_at,
        validation_status: s.validation_status || "pending",
        seller: s.agent_name ? {
          first_name: s.agent_name.split(" ")[0] || "",
          last_name: s.agent_name.split(" ").slice(1).join(" ") || "",
        } : undefined,
        client: s.client_campaign?.client ? {
          name: s.client_campaign.client.name,
        } : undefined,
      }));
    },
  });
}

export function useFieldmarketingSalesStats(clientId?: string) {
  return useQuery({
    queryKey: ["fieldmarketing-sales-stats", clientId],
    staleTime: 60000, // 1 minut
    queryFn: async () => {
      // Use Copenhagen timezone for accurate date boundaries
      const now = new Date();
      const todayDate = now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Copenhagen' });
      const todayStart = `${todayDate}T00:00:00+01:00`;
      
      const dayOfWeek = now.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const weekStartDate = new Date(now);
      weekStartDate.setDate(now.getDate() - daysToMonday);
      const weekStartStr = weekStartDate.toLocaleDateString('sv-SE', { timeZone: 'Europe/Copenhagen' });
      const weekStart = `${weekStartStr}T00:00:00+01:00`;
      
      const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const monthStart = `${monthStartStr}T00:00:00+01:00`;

      // Fetch FM sales from centralized sales table
      const monthSales = await fetchAllRows<{ 
        id: string; 
        sale_datetime: string; 
        raw_payload: { fm_product_name?: string; fm_seller_id?: string } | null;
      }>(
        "sales",
        "id, sale_datetime, raw_payload",
        (q) => {
          let query = q
            .eq("source", "fieldmarketing")
            .gte("sale_datetime", monthStart);
          if (clientId) {
            query = query.contains("raw_payload", { fm_client_id: clientId });
          }
          return query;
        },
        { orderBy: "sale_datetime", ascending: false }
      );

      // Calculate stats from fetched data
      const salesToday = monthSales.filter(s => s.sale_datetime >= todayStart).length;
      const salesThisWeek = monthSales.filter(s => s.sale_datetime >= weekStart).length;
      const salesThisMonth = monthSales.length;

      // Get total count (all time)
      let totalQuery = supabase
        .from("sales")
        .select("id", { count: "exact", head: true })
        .eq("source", "fieldmarketing");
      if (clientId) {
        totalQuery = totalQuery.contains("raw_payload", { fm_client_id: clientId });
      }
      const { count: totalSales } = await totalQuery;

      const sellerCounts: Record<string, number> = {};
      monthSales.forEach(s => {
        const sellerId = s.raw_payload?.fm_seller_id;
        if (sellerId) {
          sellerCounts[sellerId] = (sellerCounts[sellerId] || 0) + 1;
        }
      });

      const productCounts: Record<string, number> = {};
      monthSales.forEach(s => {
        const productName = s.raw_payload?.fm_product_name;
        if (productName) {
          productCounts[productName] = (productCounts[productName] || 0) + 1;
        }
      });

      return {
        salesToday,
        salesThisWeek,
        salesThisMonth,
        totalSales: totalSales || 0,
        topSellerIds: Object.entries(sellerCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([id, count]) => ({ sellerId: id, count })),
        productDistribution: Object.entries(productCounts)
          .sort(([, a], [, b]) => b - a)
          .map(([name, count]) => ({ productName: name, count })),
      };
    },
  });
}

interface CreateSaleParams {
  seller_id: string;
  location_id: string;
  client_id: string;
  product_name: string;
  phone_number: string;
  comment?: string;
  registered_at?: string;
}

export function useCreateFieldmarketingSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sales: CreateSaleParams[]) => {
      console.log("[FM-SALES] Starting mutation with", sales.length, "sales", JSON.stringify(sales));
      // Enrich sales with employee data and insert into centralized sales table
      const enrichedSales = await Promise.all(sales.map(async (sale) => {
        // Get employee name/email
        const { data: employee, error: empError } = await supabase
          .from("employee_master_data")
          .select("first_name, last_name, work_email")
          .eq("id", sale.seller_id)
          .maybeSingle();

        if (empError) {
          console.error("[FM-SALES] Employee lookup error:", empError);
        }
        console.log("[FM-SALES] Employee lookup result:", employee?.first_name, employee?.last_name);

        // client_campaign_id is set automatically by the enrich_fm_sale trigger

        return {
          source: 'fieldmarketing' as const,
          integration_type: 'manual' as const,
          sale_datetime: sale.registered_at || new Date().toISOString(),
          customer_phone: sale.phone_number,
          agent_name: employee ? `${employee.first_name} ${employee.last_name}` : null,
          agent_email: employee?.work_email || null,
          client_campaign_id: null, // Set by enrich_fm_sale trigger
          validation_status: 'pending',
          raw_payload: {
            fm_seller_id: sale.seller_id,
            fm_location_id: sale.location_id,
            fm_client_id: sale.client_id,
            fm_product_name: sale.product_name,
            fm_comment: sale.comment || null,
          }
        };
      }));

      console.log("[FM-SALES] Inserting enriched sales:", JSON.stringify(enrichedSales));
      const { data: insertedSales, error } = await supabase
        .from("sales")
        .insert(enrichedSales)
        .select("id");
      
      if (error) {
        console.error("[FM-SALES] Insert error:", JSON.stringify(error));
        throw error;
      }
      console.log("[FM-SALES] Insert successful!", insertedSales?.length, "rows");

      // sale_items are created automatically by the create_fm_sale_items trigger
      // with correct campaign-aware pricing – no manual creation needed
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["fieldmarketing-sales"] });
      queryClient.invalidateQueries({ queryKey: ["fieldmarketing-sales-stats"] });
    },
  });
}

// Fieldmarketing clients for the team
export const FIELDMARKETING_CLIENTS = {
  EESY_FM: "9a92ea4c-6404-4b58-be08-065e7552d552",
  YOUSEE: "5011a7cd-bf07-4838-a63f-55a12c604b40",
} as const;
