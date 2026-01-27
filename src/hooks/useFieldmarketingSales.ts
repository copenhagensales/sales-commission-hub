import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/utils/supabasePagination";

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

export function useFieldmarketingSales(clientId?: string) {
  return useQuery({
    queryKey: ["fieldmarketing-sales", clientId],
    staleTime: 60000, // 1 minut
    queryFn: async () => {
      return fetchAllRows<FieldmarketingSale>(
        "fieldmarketing_sales",
        `*, seller:employee_master_data!seller_id(first_name, last_name), location:location!location_id(name), client:clients!client_id(name)`,
        (q) => {
          let query = q.order("registered_at", { ascending: false });
          if (clientId) query = query.eq("client_id", clientId);
          return query;
        },
        { orderBy: "registered_at", ascending: false }
      );
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

      // Fetch all month sales using pagination utility
      const monthSales = await fetchAllRows<{ id: string; registered_at: string; product_name: string; seller_id: string }>(
        "fieldmarketing_sales",
        "id, registered_at, product_name, seller_id",
        (q) => {
          let query = q.gte("registered_at", monthStart);
          if (clientId) query = query.eq("client_id", clientId);
          return query;
        },
        { orderBy: "registered_at", ascending: false }
      );

      // Calculate stats from fetched data
      const salesToday = monthSales.filter(s => s.registered_at >= todayStart).length;
      const salesThisWeek = monthSales.filter(s => s.registered_at >= weekStart).length;
      const salesThisMonth = monthSales.length;

      // Get total count (all time) - use count for efficiency
      const totalQuery = supabase.from("fieldmarketing_sales").select("id", { count: "exact", head: true });
      if (clientId) totalQuery.eq("client_id", clientId);
      const { count: totalSales } = await totalQuery;

      const sellerCounts: Record<string, number> = {};
      monthSales.forEach(s => {
        sellerCounts[s.seller_id] = (sellerCounts[s.seller_id] || 0) + 1;
      });

      const productCounts: Record<string, number> = {};
      monthSales.forEach(s => {
        productCounts[s.product_name] = (productCounts[s.product_name] || 0) + 1;
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
      const { data, error } = await supabase
        .from("fieldmarketing_sales")
        .insert(sales)
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
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
