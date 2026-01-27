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
    staleTime: 60000, // 1 minut
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
    staleTime: 60000, // 1 minut
    queryFn: async () => {
      // Use Copenhagen timezone for accurate date boundaries
      const now = new Date();
      
      // Format dates as ISO strings with Copenhagen timezone offset
      // Get today at midnight Copenhagen time
      const todayDate = now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Copenhagen' }); // YYYY-MM-DD format
      const todayStart = `${todayDate}T00:00:00+01:00`;
      
      // Get start of week (Monday) Copenhagen time
      const dayOfWeek = now.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const weekStartDate = new Date(now);
      weekStartDate.setDate(now.getDate() - daysToMonday);
      const weekStartStr = weekStartDate.toLocaleDateString('sv-SE', { timeZone: 'Europe/Copenhagen' });
      const weekStart = `${weekStartStr}T00:00:00+01:00`;
      
      // Get start of month Copenhagen time
      const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const monthStart = `${monthStartStr}T00:00:00+01:00`;

      // Build base query with client filter
      const buildQuery = () => {
        let q = supabase.from("fieldmarketing_sales").select("id, registered_at, product_name, seller_id");
        if (clientId) q = q.eq("client_id", clientId);
        return q;
      };

      // Fetch counts using database-level filtering (bypasses 1000-row limit)
      const [todayResult, weekResult, monthResult, totalResult] = await Promise.all([
        buildQuery().gte("registered_at", todayStart),
        buildQuery().gte("registered_at", weekStart),
        buildQuery().gte("registered_at", monthStart),
        buildQuery(),
      ]);

      if (todayResult.error) throw todayResult.error;
      if (weekResult.error) throw weekResult.error;
      if (monthResult.error) throw monthResult.error;
      if (totalResult.error) throw totalResult.error;

      const salesToday = todayResult.data?.length || 0;
      const salesThisWeek = weekResult.data?.length || 0;
      const salesThisMonth = monthResult.data?.length || 0;
      const totalSales = totalResult.data?.length || 0;

      // Top sellers and product distribution from month data
      const monthSales = monthResult.data || [];
      
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
