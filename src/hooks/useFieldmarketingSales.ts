import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
    queryFn: async () => {
      let query = supabase
        .from("fieldmarketing_sales")
        .select(`
          *,
          seller:employee_master_data!seller_id(first_name, last_name),
          location:location!location_id(name),
          client:clients!client_id(name)
        `)
        .order("registered_at", { ascending: false });

      if (clientId) {
        query = query.eq("client_id", clientId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as FieldmarketingSale[];
    },
  });
}

export function useFieldmarketingSalesStats(clientId?: string) {
  return useQuery({
    queryKey: ["fieldmarketing-sales-stats", clientId],
    queryFn: async () => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 1).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      let baseQuery = supabase.from("fieldmarketing_sales").select("id, registered_at, product_name, seller_id");
      
      if (clientId) {
        baseQuery = baseQuery.eq("client_id", clientId);
      }

      const { data, error } = await baseQuery;
      if (error) throw error;

      const sales = data || [];
      
      const salesToday = sales.filter(s => s.registered_at >= todayStart).length;
      const salesThisWeek = sales.filter(s => s.registered_at >= weekStart).length;
      const salesThisMonth = sales.filter(s => s.registered_at >= monthStart).length;
      const totalSales = sales.length;

      // Top sellers this month
      const sellerCounts: Record<string, number> = {};
      sales
        .filter(s => s.registered_at >= monthStart)
        .forEach(s => {
          sellerCounts[s.seller_id] = (sellerCounts[s.seller_id] || 0) + 1;
        });

      // Product distribution this month
      const productCounts: Record<string, number> = {};
      sales
        .filter(s => s.registered_at >= monthStart)
        .forEach(s => {
          productCounts[s.product_name] = (productCounts[s.product_name] || 0) + 1;
        });

      return {
        salesToday,
        salesThisWeek,
        salesThisMonth,
        totalSales,
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
