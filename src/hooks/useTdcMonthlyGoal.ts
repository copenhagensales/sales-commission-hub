import { useQuery } from "@tanstack/react-query";
import { tvEdgeFetch } from "@/utils/tvEdgeFetch";
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
  /** Sat hvis en delforespørgsel fejlede — målene vises stadig. */
  warning?: string;
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

interface SaleRow {
  agent_email: string | null;
  validation_status: string | null;
  sale_items: { quantity: number | null; product_id: string | null }[] | null;
}

/**
 * Antal solgte produktlinjer (sum af sale_items.quantity, fiber HAP/VOK vægtet)
 * på TDC Erhverv i indeværende måned, fordelt på aktive sælgere i TDC Erhverv-teamet.
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
      const warnings: string[] = [];

      // 1) Aktive medarbejdere på TDC Erhverv-teamet
      let employees: { id: string; first_name: string | null; last_name: string | null; work_email: string | null }[] = [];
      try {
        const { data: members, error: memberError } = await supabase
          .from("team_members")
          .select("employee_id")
          .eq("team_id", TDC_ERHVERV_TEAM_ID);
        if (memberError) throw memberError;

        const employeeIds = (members || []).map((m) => m.employee_id).filter(Boolean) as string[];
        if (employeeIds.length > 0) {
          const { data, error } = await supabase
            .from("employee_master_data")
            .select("id, first_name, last_name, work_email")
            .in("id", employeeIds)
            .eq("is_active", true);
          if (error) throw error;
          employees = data || [];
        }
      } catch (e) {
        warnings.push(`Sælgerliste: ${(e as Error).message}`);
      }

      // 2) Salg på TDC Erhverv i måneden (samme mønster som TDC Erhverv-boardet)
      let rows: SaleRow[] = [];
      try {
        const { data, error } = await supabase
          .from("sales")
          .select(
            "agent_email, validation_status, sale_datetime, client_campaigns!inner(client_id), sale_items(quantity, product_id)"
          )
          .eq("client_campaigns.client_id", TDC_ERHVERV_CLIENT_ID)
          .gte("sale_datetime", start)
          .lte("sale_datetime", end);
        if (error) throw error;
        rows = (data || []) as unknown as SaleRow[];
      } catch (e) {
        warnings.push(`Salgsdata: ${(e as Error).message}`);
      }

      let teamCount = 0;
      const countByEmail = new Map<string, number>();
      for (const row of rows) {
        const status = row.validation_status;
        if (status === "cancelled" || status === "rejected") continue;
        const email = (row.agent_email || "").toLowerCase();
        for (const item of row.sale_items || []) {
          // Fiber (HAP/VOK) vægtes som på TDC Erhverv-boardet; alle andre linjer tæller 1 pr. stk.
          const weight = (item.product_id && FIBER_BOARD_POINTS[item.product_id]) ?? 1;
          const qty = (item.quantity ?? 1) * weight;
          teamCount += qty;
          if (email) countByEmail.set(email, (countByEmail.get(email) || 0) + qty);
        }
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
        warning: warnings.length > 0 ? warnings.join(" · ") : undefined,
      };
    },
  });
}
