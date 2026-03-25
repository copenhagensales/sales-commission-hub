import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getISOWeek, getISOWeekYear, startOfWeek, endOfWeek, eachDayOfInterval, format } from "date-fns";

export interface WeekForecast {
  weekNumber: number;
  year: number;
  weekStart: string;
  weekEnd: string;
  daysCentre: number;
  daysMarket: number;
  totalDays: number;
  staffCount: number;
  expectedSales: number;
  actualSales: number;
  overrideSales: number | null;
}

const MARKET_TYPES = ["Markeder", "Messer"];

function isMarketType(type: string | null): boolean {
  return MARKET_TYPES.includes(type || "");
}

export function useFmWeeklyForecast(clientId: string, month: number, year: number) {
  const queryClient = useQueryClient();
  const queryKey = ["fm-weekly-forecast", clientId, month, year];

  // Calculate the date range for this month
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;

  const { data: weeklyData = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!clientId || clientId === "all") return [];

      // 1. Fetch bookings with location type for this client in the month range
      const { data: bookings, error: bookErr } = await supabase
        .from("booking")
        .select("id, week_number, year, booked_days, start_date, end_date, location(id, name, type)")
        .eq("client_id", clientId)
        .eq("status", "confirmed")
        .gte("start_date", monthStart)
        .lte("start_date", monthEnd);

      if (bookErr) throw bookErr;

      // 2. Fetch assignments for these bookings
      const bookingIds = (bookings || []).map((b: any) => b.id);
      let assignments: any[] = [];
      if (bookingIds.length > 0) {
        const { data: assData, error: assErr } = await supabase
          .from("booking_assignment")
          .select("booking_id, employee_id, date")
          .in("booking_id", bookingIds);
        if (assErr) throw assErr;
        assignments = assData || [];
      }

      // 3. Fetch actual sales for this client in the month
      const { data: campaigns } = await supabase
        .from("client_campaigns")
        .select("id")
        .eq("client_id", clientId);
      const campaignIds = (campaigns || []).map((c: any) => c.id);

      let salesByWeek: Record<string, number> = {};
      if (campaignIds.length > 0) {
        const { data: sales } = await supabase
          .from("sales")
          .select("id, sale_datetime, client_campaign_id")
          .in("client_campaign_id", campaignIds)
          .gte("sale_datetime", `${monthStart}T00:00:00`)
          .lte("sale_datetime", `${monthEnd}T23:59:59`)
          .neq("validation_status", "rejected");

        // Count sales (need sale_items for counts_as_sale)
        if (sales && sales.length > 0) {
          const saleIds = sales.map((s: any) => s.id);
          const { data: saleItems } = await supabase
            .from("sale_items")
            .select("sale_id, quantity, product_id")
            .in("sale_id", saleIds);

          // Get product info for counts_as_sale
          const productIds = [...new Set((saleItems || []).map((si: any) => si.product_id).filter(Boolean))];
          let productsMap: Record<string, boolean> = {};
          if (productIds.length > 0) {
            const { data: products } = await supabase
              .from("products")
              .select("id, counts_as_sale")
              .in("id", productIds);
            (products || []).forEach((p: any) => {
              productsMap[p.id] = p.counts_as_sale !== false;
            });
          }

          // Map sales to weeks
          const saleWeekMap: Record<string, Record<string, boolean>> = {};
          (sales || []).forEach((s: any) => {
            const d = new Date(s.sale_datetime);
            const wk = getISOWeek(d);
            const wy = getISOWeekYear(d);
            const key = `${wy}-${wk}`;
            if (!saleWeekMap[key]) saleWeekMap[key] = {};
            saleWeekMap[key][s.id] = true;
          });

          (saleItems || []).forEach((si: any) => {
            const countsSale = si.product_id ? (productsMap[si.product_id] ?? true) : true;
            if (!countsSale) return;
            // Find which week this sale belongs to
            for (const [key, ids] of Object.entries(saleWeekMap)) {
              if (ids[si.sale_id]) {
                salesByWeek[key] = (salesByWeek[key] || 0) + (si.quantity || 1);
                break;
              }
            }
          });
        }
      }

      // 4. Fetch overrides
      const { data: overrides } = await supabase
        .from("fm_weekly_forecast_overrides")
        .select("*")
        .eq("client_id", clientId);

      const overrideMap: Record<string, number> = {};
      (overrides || []).forEach((o: any) => {
        overrideMap[`${o.year}-${o.week_number}`] = o.override_sales;
      });

      // 5. Group bookings by week
      const weekMap: Record<string, {
        weekNumber: number;
        year: number;
        daysCentre: number;
        daysMarket: number;
        totalDays: number;
        staffSet: Set<string>;
        weekStart: string;
        weekEnd: string;
      }> = {};

      (bookings || []).forEach((b: any) => {
        const wk = b.week_number;
        const yr = b.year;
        const key = `${yr}-${wk}`;
        const locType = b.location?.type || "";
        const bookedDaysCount = b.booked_days?.length || 0;
        const isMarket = isMarketType(locType);

        if (!weekMap[key]) {
          // Calculate week start/end dates
          const sDate = new Date(b.start_date);
          const ws = startOfWeek(sDate, { weekStartsOn: 1 });
          const we = endOfWeek(sDate, { weekStartsOn: 1 });
          weekMap[key] = {
            weekNumber: wk,
            year: yr,
            daysCentre: 0,
            daysMarket: 0,
            totalDays: 0,
            staffSet: new Set(),
            weekStart: format(ws, "yyyy-MM-dd"),
            weekEnd: format(we, "yyyy-MM-dd"),
          };
        }

        if (isMarket) {
          weekMap[key].daysMarket += bookedDaysCount;
        } else {
          weekMap[key].daysCentre += bookedDaysCount;
        }
        weekMap[key].totalDays += bookedDaysCount;
      });

      // Add staff counts from assignments
      assignments.forEach((a: any) => {
        const booking = (bookings || []).find((b: any) => b.id === a.booking_id);
        if (!booking) return;
        const key = `${booking.year}-${booking.week_number}`;
        if (weekMap[key]) {
          weekMap[key].staffSet.add(a.employee_id);
        }
      });

      // 6. Build result
      const weeks: WeekForecast[] = Object.entries(weekMap)
        .map(([key, w]) => {
          // Simple expected sales: ~2 sales per person per day (adjustable)
          const avgSalesPerPersonPerDay = 2;
          const expectedSales = w.staffSet.size > 0
            ? w.totalDays * avgSalesPerPersonPerDay
            : w.totalDays * avgSalesPerPersonPerDay;

          return {
            weekNumber: w.weekNumber,
            year: w.year,
            weekStart: w.weekStart,
            weekEnd: w.weekEnd,
            daysCentre: w.daysCentre,
            daysMarket: w.daysMarket,
            totalDays: w.totalDays,
            staffCount: w.staffSet.size,
            expectedSales,
            actualSales: salesByWeek[key] || 0,
            overrideSales: overrideMap[key] ?? null,
          };
        })
        .sort((a, b) => a.weekNumber - b.weekNumber);

      return weeks;
    },
    enabled: !!clientId && clientId !== "all",
  });

  const upsertOverride = useMutation({
    mutationFn: async ({ weekNumber, year: yr, sales }: { weekNumber: number; year: number; sales: number }) => {
      const { error } = await supabase
        .from("fm_weekly_forecast_overrides")
        .upsert({
          client_id: clientId,
          week_number: weekNumber,
          year: yr,
          override_sales: sales,
        }, { onConflict: "client_id,week_number,year" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Uge-override gemt");
    },
    onError: () => toast.error("Kunne ikke gemme override"),
  });

  const deleteOverride = useMutation({
    mutationFn: async ({ weekNumber, year: yr }: { weekNumber: number; year: number }) => {
      const { error } = await supabase
        .from("fm_weekly_forecast_overrides")
        .delete()
        .eq("client_id", clientId)
        .eq("week_number", weekNumber)
        .eq("year", yr);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Override fjernet");
    },
    onError: () => toast.error("Kunne ikke fjerne override"),
  });

  return { weeklyData, isLoading, upsertOverride, deleteOverride };
}
