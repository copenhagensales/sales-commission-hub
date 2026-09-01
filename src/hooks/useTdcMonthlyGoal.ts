import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TDC_ERHVERV_CLIENT_ID, TDC_ERHVERV_TEAM_ID } from "@/hooks/useTdcErhvervSales";
import { getTdcMonthlyGoal, getTdcSellerGoal, type TdcMonthlyGoal } from "@/config/tdcMonthlyGoals";
import { FIBER_BOARD_POINTS } from "@/config/fiberBoardPoints";

export interface TdcMonthlyGoalSeller {
  employeeId: string;
  name: string;
  count: number;
  goal: number;
  progress: number;
}

export interface TdcMonthlyGoalData {
  monthLabel: string;
  goal: TdcMonthlyGoal | null;
  teamCount: number;
  teamGoal: number;
  teamProgress: number;
  sellers: TdcMonthlyGoalSeller[];
}

const MONTH_NAMES = [
  "Januar", "Februar", "Marts", "April", "Maj", "Juni",
  "Juli", "August", "September", "Oktober", "November", "December",
];

function monthBounds(now: Date) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

interface SaleItemRow {
  quantity: number | null;
  product_id: string | null;
  sales: {
    agent_email: string | null;
    validation_status: string | null;
  } | null;
}

/**
 * Antal solgte produktlinjer (sum af sale_items.quantity) på TDC Erhverv i
 * indeværende måned, fordelt på aktive sælgere i TDC Erhverv-teamet.
 */
export function useTdcMonthlyGoal(enabled = true) {
  const now = new Date();
  const { start, end } = monthBounds(now);
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return useQuery({
    queryKey: ["tdc-monthly-goal", monthKey],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<TdcMonthlyGoalData> => {
      const goal = getTdcMonthlyGoal(now);

      // 1) Aktive medarbejdere på TDC Erhverv-teamet
      const { data: members, error: memberError } = await supabase
        .from("team_members")
        .select("employee_id")
        .eq("team_id", TDC_ERHVERV_TEAM_ID);
      if (memberError) throw memberError;

      const employeeIds = (members || []).map((m) => m.employee_id).filter(Boolean) as string[];

      let employees: { id: string; first_name: string | null; last_name: string | null; work_email: string | null }[] = [];
      if (employeeIds.length > 0) {
        const { data, error } = await supabase
          .from("employee_master_data")
          .select("id, first_name, last_name, work_email")
          .in("id", employeeIds)
          .eq("is_active", true);
        if (error) throw error;
        employees = data || [];
      }

      // 2) Salgslinjer på TDC Erhverv i måneden
      const { data: items, error: itemError } = await supabase
        .from("sale_items")
        .select(
          "quantity, product_id, sales!inner(agent_email, validation_status, sale_datetime, client_campaigns!inner(client_id))"
        )
        .eq("sales.client_campaigns.client_id", TDC_ERHVERV_CLIENT_ID)
        .gte("sales.sale_datetime", start)
        .lte("sales.sale_datetime", end);
      if (itemError) throw itemError;

      const rows = (items || []) as unknown as SaleItemRow[];

      let teamCount = 0;
      const countByEmail = new Map<string, number>();
      for (const row of rows) {
        const status = row.sales?.validation_status;
        if (status === "cancelled") continue;
        // Fiber (HAP/VOK) vægtes som på TDC Erhverv-boardet; alle andre linjer tæller 1 pr. stk.
        const weight = (row.product_id && FIBER_BOARD_POINTS[row.product_id]) ?? 1;
        const qty = (row.quantity ?? 1) * weight;
        teamCount += qty;
        const email = (row.sales?.agent_email || "").toLowerCase();
        if (email) countByEmail.set(email, (countByEmail.get(email) || 0) + qty);
      }

      const excluded = new Set(goal?.excludeEmployeeIds ?? []);

      const sellers: TdcMonthlyGoalSeller[] = employees
        .filter((e) => !excluded.has(e.id))
        .map((e) => {
          const name = [e.first_name, e.last_name].filter(Boolean).join(" ").trim() || (e.work_email ?? "Ukendt");
          const count = countByEmail.get((e.work_email || "").toLowerCase()) || 0;
          const sellerGoal = getTdcSellerGoal(goal, name);
          return {
            employeeId: e.id,
            name,
            count,
            goal: sellerGoal,
            progress: sellerGoal > 0 ? (count / sellerGoal) * 100 : 0,
          };
        })
        .sort((a, b) => b.progress - a.progress || b.count - a.count || a.name.localeCompare(b.name, "da-DK"));

      const teamGoal = goal?.team ?? 0;

      return {
        monthLabel: `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`,
        goal,
        teamCount,
        teamGoal,
        teamProgress: teamGoal > 0 ? (teamCount / teamGoal) * 100 : 0,
        sellers,
      };
    },
  });
}
