import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay } from "date-fns";

export interface ClientKpiData {
  clientId: string;
  clientName: string;
  antalSalg: number;        // Product lines count (quantity)
  antalKunder: number;      // Unique sales count
  timer: number;            // Hours from booking_assignment
  antalMedarbejdere: number; // Unique employees with sales data
}

interface UseClientKpisOptions {
  date: Date;
  clientIds?: string[];
}

// Client IDs for different data sources
const FIELDMARKETING_CLIENT_IDS = [
  "9a92ea4c-6404-4b58-be08-065e7552d552", // Eesy FM
  "5011a7cd-bf07-4838-a63f-55a12c604b40", // Yousee
];

const TELESALES_CLIENT_IDS = [
  "20744525-7466-4b2c-afa7-6ee09a9112b0", // TDC Erhverv
];

export function useClientKpis({ date, clientIds }: UseClientKpisOptions) {
  const dateStr = format(date, "yyyy-MM-dd");
  const dayStart = startOfDay(date).toISOString();
  const dayEnd = endOfDay(date).toISOString();

  return useQuery({
    queryKey: ["client-kpis", dateStr, clientIds],
    queryFn: async (): Promise<ClientKpiData[]> => {
      // Fetch all clients first
      const { data: allClients } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");

      const clients = allClients || [];
      const targetClientIds = clientIds || clients.map((c) => c.id);

      // Separate clients by data source
      const fmClients = targetClientIds.filter((id) =>
        FIELDMARKETING_CLIENT_IDS.includes(id)
      );
      const teleClients = targetClientIds.filter((id) =>
        TELESALES_CLIENT_IDS.includes(id)
      );

      // 1. Fetch fieldmarketing_sales data (Eesy FM, Yousee)
      const { data: fmSales } = await supabase
        .from("fieldmarketing_sales")
        .select("id, client_id, seller_id")
        .gte("registered_at", dayStart)
        .lte("registered_at", dayEnd)
        .in("client_id", fmClients.length > 0 ? fmClients : ["__none__"]);

      // Group FM sales by client
      const fmDataByClient: Record<
        string,
        { salesCount: number; uniqueSellers: Set<string> }
      > = {};
      (fmSales || []).forEach((sale) => {
        if (!fmDataByClient[sale.client_id]) {
          fmDataByClient[sale.client_id] = {
            salesCount: 0,
            uniqueSellers: new Set(),
          };
        }
        fmDataByClient[sale.client_id].salesCount += 1;
        fmDataByClient[sale.client_id].uniqueSellers.add(sale.seller_id);
      });

      // 2. Fetch telesales data (TDC Erhverv etc) - sales + sale_items
      const { data: teleSales } = await supabase
        .from("sales")
        .select(
          `
          id,
          agent_email,
          client_campaign:client_campaign_id(client_id),
          campaign_mapping:dialer_campaign_id(
            client_campaign:client_campaign_id(client_id)
          )
        `
        )
        .gte("sale_datetime", dayStart)
        .lte("sale_datetime", dayEnd);

      // Get sale IDs for fetching items
      const saleIds = (teleSales || []).map((s) => s.id);
      
      const { data: saleItems } = saleIds.length > 0
        ? await supabase
            .from("sale_items")
            .select("sale_id, quantity")
            .in("sale_id", saleIds)
        : { data: [] };

      // Map sale_id to quantity
      const saleItemQuantities: Record<string, number> = {};
      (saleItems || []).forEach((item) => {
        saleItemQuantities[item.sale_id] =
          (saleItemQuantities[item.sale_id] || 0) + (item.quantity || 1);
      });

      // Group tele sales by client
      const teleDataByClient: Record<
        string,
        { productCount: number; uniqueSales: number; uniqueAgents: Set<string> }
      > = {};
      (teleSales || []).forEach((sale: any) => {
        const clientId =
          sale.client_campaign?.client_id ||
          sale.campaign_mapping?.client_campaign?.client_id;
        
        if (!clientId || !teleClients.includes(clientId)) return;

        if (!teleDataByClient[clientId]) {
          teleDataByClient[clientId] = {
            productCount: 0,
            uniqueSales: 0,
            uniqueAgents: new Set(),
          };
        }
        teleDataByClient[clientId].uniqueSales += 1;
        teleDataByClient[clientId].productCount +=
          saleItemQuantities[sale.id] || 1;
        if (sale.agent_email) {
          teleDataByClient[clientId].uniqueAgents.add(sale.agent_email);
        }
      });

      // 3. Fetch booking_assignment hours for FM clients
      const { data: bookingAssignments } = await supabase
        .from("booking_assignment")
        .select(
          `
          employee_id,
          start_time,
          end_time,
          booking:booking_id(client_id)
        `
        )
        .eq("date", dateStr);

      // Calculate hours by client
      const hoursByClient: Record<
        string,
        { hours: number; employees: Set<string> }
      > = {};
      (bookingAssignments || []).forEach((assignment: any) => {
        const clientId = assignment.booking?.client_id;
        if (!clientId) return;

        if (!hoursByClient[clientId]) {
          hoursByClient[clientId] = { hours: 0, employees: new Set() };
        }

        // Parse times and calculate hours
        const startParts = assignment.start_time?.split(":") || [0, 0];
        const endParts = assignment.end_time?.split(":") || [0, 0];
        const startMinutes =
          parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
        const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
        const hours = (endMinutes - startMinutes) / 60;

        hoursByClient[clientId].hours += hours;
        hoursByClient[clientId].employees.add(assignment.employee_id);
      });

      // 4. Build final KPI data
      const kpiData: ClientKpiData[] = clients
        .filter((c) => targetClientIds.includes(c.id))
        .map((client) => {
          const isFieldmarketing = FIELDMARKETING_CLIENT_IDS.includes(client.id);
          const fmData = fmDataByClient[client.id];
          const teleData = teleDataByClient[client.id];
          const hourData = hoursByClient[client.id];

          if (isFieldmarketing) {
            // For FM: each sale = 1 product, so antalSalg = antalKunder
            return {
              clientId: client.id,
              clientName: client.name,
              antalSalg: fmData?.salesCount || 0,
              antalKunder: fmData?.salesCount || 0,
              timer: hourData?.hours || 0,
              antalMedarbejdere: fmData?.uniqueSellers.size || 0,
            };
          } else {
            // For telesales: product lines vs unique sales
            return {
              clientId: client.id,
              clientName: client.name,
              antalSalg: teleData?.productCount || 0,
              antalKunder: teleData?.uniqueSales || 0,
              timer: hourData?.hours || 0,
              antalMedarbejdere: teleData?.uniqueAgents.size || 0,
            };
          }
        });

      return kpiData;
    },
  });
}

// Hook to get KPIs for a single client
export function useClientKpi(clientId: string, date: Date) {
  const { data, ...rest } = useClientKpis({ date, clientIds: [clientId] });
  return {
    data: data?.[0],
    ...rest,
  };
}
