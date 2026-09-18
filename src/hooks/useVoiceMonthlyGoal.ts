import { useQuery } from "@tanstack/react-query";
import { tvEdgeFetch } from "@/utils/tvEdgeFetch";

export interface MonthlyVoiceGoalSeller {
  employeeId: string;
  name: string;
  count: number;
  goal: number;
  progress: number;
}

export interface MonthlyVoiceGoalDay {
  /** YYYY-MM-DD */
  date: string;
  day: number;
  count: number;
  isWeekend: boolean;
  isToday: boolean;
  isFuture: boolean;
}

export interface MonthlyVoiceGoalData {
  monthKey: string;
  monthLabel: string;
  teamCount: number;
  teamGoal: number;
  teamProgress: number;
  sellers: MonthlyVoiceGoalSeller[];
  days: MonthlyVoiceGoalDay[];
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

interface MonthlyVoiceGoalPayload {
  sellers: { id: string; firstName: string | null; lastName: string | null; workEmail: string | null; emails?: string[] }[];
  items: { agentEmail: string | null; productId: string | null; productName?: string | null; quantity: number; saleDate?: string | null }[];
  goals: { employeeId: string | null; target: number }[];
  warning?: string;
}

export function voiceMonthKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export interface VoiceMonthlyGoalOptions {
  /** Board-nøgle i `board_monthly_goals` — bruges også som query-key. */
  boardKey: string;
  /** Action i `tv-dashboard-data`. */
  action: string;
  /** Afgør om en salgslinje tæller som voice-salg. */
  isVoiceItem: (productId: string | null, productName?: string | null) => boolean;
  enabled?: boolean;
}

/**
 * Voice-salg i indeværende måned for et månedsmål-board, fordelt på de sælgere
 * der har salg — eller har fået et mål.
 *
 * Data hentes via `tv-dashboard-data` edge functionen, så boardet også virker
 * på TV-skærme uden login (RLS-bypass med TV-adgangskode).
 */
export function useVoiceMonthlyGoal({ boardKey, action, isVoiceItem, enabled = true }: VoiceMonthlyGoalOptions) {
  const now = new Date();
  const { start, end } = monthBounds(now);
  const monthKey = voiceMonthKey(now);

  return useQuery({
    queryKey: [boardKey, monthKey],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<MonthlyVoiceGoalData> => {
      const warnings: string[] = [];

      let payload: MonthlyVoiceGoalPayload = { sellers: [], items: [], goals: [] };
      try {
        const res = await tvEdgeFetch(
          `tv-dashboard-data?action=${action}&monthKey=${monthKey}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
        );
        if (!res.ok) throw new Error(`Hentning fejlede (${res.status})`);
        const json = (await res.json()) as MonthlyVoiceGoalPayload & { error?: string };
        if (json.error) throw new Error(json.error);
        payload = { sellers: json.sellers || [], items: json.items || [], goals: json.goals || [] };
        if (json.warning) warnings.push(json.warning);
      } catch (e) {
        warnings.push((e as Error).message);
      }

      let teamCount = 0;
      const countByEmail = new Map<string, number>();
      const countByDate = new Map<string, number>();
      for (const item of payload.items) {
        // Kun voice-salg: 5G internet tælles ikke med
        if (!isVoiceItem(item.productId, item.productName)) continue;
        const qty = item.quantity ?? 1;
        teamCount += qty;
        const email = (item.agentEmail || "").toLowerCase();
        if (email) countByEmail.set(email, (countByEmail.get(email) || 0) + qty);
        if (item.saleDate) countByDate.set(item.saleDate, (countByDate.get(item.saleDate) || 0) + qty);
      }

      // Én boks pr. dag i måneden
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const todayDay = now.getDate();
      const days: MonthlyVoiceGoalDay[] = Array.from({ length: daysInMonth }, (_, i) => {
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

      const goalByEmployee = new Map<string, number>();
      let teamGoal = 0;
      for (const g of payload.goals) {
        if (g.employeeId) goalByEmployee.set(g.employeeId, Number(g.target ?? 0));
        else teamGoal = Number(g.target ?? 0);
      }

      const sellers: MonthlyVoiceGoalSeller[] = payload.sellers
        .map((e) => {
          const name =
            [e.firstName, e.lastName].filter(Boolean).join(" ").trim() || (e.workEmail ?? "Ukendt");
          // Salg matches på alle sælgerens mails (dialer-mails via agent-mapping + work_email)
          const emails = new Set<string>(
            [...(e.emails ?? []), e.workEmail ?? ""].filter(Boolean).map((m) => m.toLowerCase()),
          );
          let count = 0;
          for (const m of emails) count += countByEmail.get(m) || 0;
          const sellerGoal = goalByEmployee.get(e.id) ?? 0;
          return {
            employeeId: e.id,
            name,
            count,
            goal: sellerGoal,
            progress: sellerGoal > 0 ? (count / sellerGoal) * 100 : 0,
          };
        })
        .filter((s) => s.count > 0 || s.goal > 0)
        .sort((a, b) => b.progress - a.progress || b.count - a.count || a.name.localeCompare(b.name, "da-DK"));

      return {
        monthKey,
        monthLabel: `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`,
        teamCount,
        teamGoal,
        teamProgress: teamGoal > 0 ? (teamCount / teamGoal) * 100 : 0,
        sellers,
        days,
        warning: warnings.length > 0 ? warnings.join(" · ") : undefined,
      };
    },
  });
}
