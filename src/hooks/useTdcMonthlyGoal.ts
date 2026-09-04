import { useQuery } from "@tanstack/react-query";
import { tvEdgeFetch } from "@/utils/tvEdgeFetch";
import {
  getTdcMonthlyGoal,
  getTdcSellerGoal,
  MONTHLY_GOAL_EXCLUDED_PRODUCT_IDS,
  type TdcMonthlyGoal,
} from "@/config/tdcMonthlyGoals";
import { FIBER_BOARD_POINTS } from "@/config/fiberBoardPoints";


export interface TdcMonthlyGoalSeller {
  employeeId: string;
  name: string;
  count: number;
  goal: number;
  progress: number;
  /** Første sælger i måneden der nåede sit individuelle mål (låst i databasen). */
  isFirstAchiever?: boolean;
  /** Deltager ikke i kronekonkurrencen og vises altid nederst. */
  isCrownExempt?: boolean;
}


export interface TdcMonthlyGoalDay {
  /** YYYY-MM-DD */
  date: string;
  day: number;
  count: number;
  isWeekend: boolean;
  isToday: boolean;
  isFuture: boolean;
}

export interface TdcMonthlyGoalData {
  monthLabel: string;
  goal: TdcMonthlyGoal | null;
  teamCount: number;
  teamGoal: number;
  teamProgress: number;
  sellers: TdcMonthlyGoalSeller[];
  days: TdcMonthlyGoalDay[];
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

interface TdcMonthlyGoalPayload {
  sellers: { id: string; firstName: string | null; lastName: string | null; workEmail: string | null; emails?: string[] }[];
  items: { agentEmail: string | null; productId: string | null; quantity: number; saleDate?: string | null }[];
  warning?: string;
}

/**
 * Antal solgte produktlinjer (sum af sale_items.quantity, fiber HAP/VOK vægtet)
 * på TDC Erhverv i indeværende måned, fordelt på aktive sælgere i TDC Erhverv-teamet.
 *
 * Data hentes via `tv-dashboard-data` edge functionen, så boardet også virker
 * på TV-skærme uden login (RLS-bypass med TV-adgangskode).
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

      let payload: TdcMonthlyGoalPayload = { sellers: [], items: [] };
      try {
        const res = await tvEdgeFetch(
          `tv-dashboard-data?action=tdc-monthly-goal&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
        );
        if (!res.ok) throw new Error(`Hentning fejlede (${res.status})`);
        const json = (await res.json()) as TdcMonthlyGoalPayload & { error?: string };
        if (json.error) throw new Error(json.error);
        payload = { sellers: json.sellers || [], items: json.items || [] };
        if (json.warning) warnings.push(json.warning);
      } catch (e) {
        warnings.push((e as Error).message);
      }

      const employees = payload.sellers.map((s) => ({
        id: s.id,
        first_name: s.firstName,
        last_name: s.lastName,
        work_email: s.workEmail,
        emails: s.emails ?? [],
      }));

      let teamCount = 0;
      const countByEmail = new Map<string, number>();
      const countByDate = new Map<string, number>();
      for (const item of payload.items) {
        // Ekskluderede produkter (fx Internetfilter) tælles ikke med i månedsmålet
        if (item.productId && MONTHLY_GOAL_EXCLUDED_PRODUCT_IDS.has(item.productId)) continue;
        // Fiber (HAP/VOK) vægtes som på TDC Erhverv-boardet; alle andre linjer tæller 1 pr. stk.
        const weight = (item.productId && FIBER_BOARD_POINTS[item.productId]) ?? 1;
        const qty = (item.quantity ?? 1) * weight;
        teamCount += qty;
        const email = (item.agentEmail || "").toLowerCase();
        if (email) countByEmail.set(email, (countByEmail.get(email) || 0) + qty);
        if (item.saleDate) countByDate.set(item.saleDate, (countByDate.get(item.saleDate) || 0) + qty);
      }

      // Én boks pr. dag i måneden
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const todayDay = now.getDate();
      const days: TdcMonthlyGoalDay[] = Array.from({ length: daysInMonth }, (_, i) => {
        const dayNum = i + 1;
        const d = new Date(now.getFullYear(), now.getMonth(), dayNum);
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
        const dow = d.getDay();
        return {
          date: iso,
          day: dayNum,
          count: countByDate.get(iso) || 0,
          isWeekend: dow === 0 || dow === 6,
          isToday: dayNum === todayDay,
          isFuture: dayNum > todayDay,
        };
      });



      const excluded = new Set(goal?.excludeEmployeeIds ?? []);
      const crownExempt = new Set(goal?.crownExemptEmployeeIds ?? []);

      const sellers: TdcMonthlyGoalSeller[] = employees
        .filter((e) => !excluded.has(e.id))
        .map((e) => {
          const name = [e.first_name, e.last_name].filter(Boolean).join(" ").trim() || (e.work_email ?? "Ukendt");
          // Salg matches på alle sælgerens mails (dialer-mails via agent-mapping + work_email)
          const emails = new Set<string>(
            [...(e.emails ?? []), e.work_email ?? ""].filter(Boolean).map((m) => m.toLowerCase()),
          );
          let count = 0;
          for (const m of emails) count += countByEmail.get(m) || 0;
          const sellerGoal = getTdcSellerGoal(goal, name);
          return {
            employeeId: e.id,
            name,
            count,
            goal: sellerGoal,
            progress: sellerGoal > 0 ? (count / sellerGoal) * 100 : 0,
            isCrownExempt: crownExempt.has(e.id),
          };
        })
        // Kronefritagne sælgere låses nederst, uanset procent
        .sort(
          (a, b) =>
            Number(!!a.isCrownExempt) - Number(!!b.isCrownExempt) ||
            b.progress - a.progress ||
            b.count - a.count ||
            a.name.localeCompare(b.name, "da-DK"),
        );

      // Første målopnåer låses server-side, så pladsen ikke kan overhales senere
      let firstAchieverId: string | null = null;
      try {
        const res = await tvEdgeFetch("tv-dashboard-data?action=monthly-goal-first-achiever", {
          method: "POST",
          body: JSON.stringify({
            boardKey: "tdc-monthly-goal",
            monthKey,
            candidates: sellers
              .filter((s) => !s.isCrownExempt && s.goal > 0 && s.count >= s.goal)
              .map((s) => ({ employeeId: s.employeeId, employeeName: s.name, count: s.count, goal: s.goal })),
          }),
        });
        if (res.ok) {
          const json = (await res.json()) as { firstAchiever?: { employeeId: string } | null };
          firstAchieverId = json.firstAchiever?.employeeId ?? null;
        } else {
          // Fejlen skal være synlig på boardet — ellers forsvinder medaljen lydløst
          warnings.push(`Medalje-status kunne ikke hentes (${res.status})`);
        }
      } catch (e) {
        warnings.push(`Medalje-status kunne ikke hentes: ${(e as Error).message}`);
      }


      const sellersWithMedal = sellers.map((s) => ({
        ...s,
        isFirstAchiever: !s.isCrownExempt && firstAchieverId != null && s.employeeId === firstAchieverId,
      }));

      const teamGoal = goal?.team ?? 0;

      return {
        monthLabel: `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`,
        goal,
        teamCount,
        teamGoal,
        teamProgress: teamGoal > 0 ? (teamCount / teamGoal) * 100 : 0,
        sellers: sellersWithMedal,
        days,
        warning: warnings.length > 0 ? warnings.join(" · ") : undefined,
      };

    },
  });
}
