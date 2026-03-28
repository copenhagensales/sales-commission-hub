
import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays } from "date-fns";
import { da } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Receipt, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const EXPENSE_CATEGORIES = [
  { key: "brobizz", label: "Brobizz" },
  { key: "benzin", label: "Benzin (Cirkel K)" },
  { key: "parkering", label: "P-pladser", recurring: true },
  { key: "bil", label: "Bil udgifter", recurring: true },
  { key: "dsb", label: "DSB" },
  { key: "lokationer", label: "Lokationer", auto: true },
  { key: "hotel", label: "Hotel", auto: true },
  { key: "corpay", label: "Corpay" },
  { key: "ipads", label: "iPads (eesy betaler 50%)" },
  { key: "team_arrangement", label: "Team arrangement" },
  { key: "banken", label: "Banken" },
  { key: "boeder", label: "Bøder" },
];

const AUTO_CATEGORIES = new Set(EXPENSE_CATEGORIES.filter(c => c.auto).map(c => c.key));
const RECURRING_CATEGORIES = new Set(EXPENSE_CATEGORIES.filter(c => (c as any).recurring).map(c => c.key));

type ExpenseRow = {
  category: string;
  amount: number;
  note: string;
};

/** Parse selectedMonth "yyyy-MM" into payroll period: 15th of prev month → 14th of selected month */
function getPayrollPeriodFromMonth(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  const periodStart = format(new Date(y, m - 2, 15), "yyyy-MM-dd");
  const periodEnd = format(new Date(y, m - 1, 14), "yyyy-MM-dd");
  return { periodStart, periodEnd };
}

function countBookedDays(booking: any): number {
  const bookedDays = booking.booked_days as number[] | null;
  if (!bookedDays || bookedDays.length === 0) {
    return differenceInDays(new Date(booking.end_date), new Date(booking.start_date)) + 1;
  }
  let count = 0;
  const start = new Date(booking.start_date);
  const end = new Date(booking.end_date);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const isoDay = d.getDay() === 0 ? 6 : d.getDay() - 1;
    if (bookedDays.includes(isoDay)) count++;
  }
  return count || 1;
}

export function ExpenseReportTab() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(format(now, "yyyy-MM"));
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const queryClient = useQueryClient();

  const { periodStart, periodEnd } = useMemo(
    () => getPayrollPeriodFromMonth(selectedMonth),
    [selectedMonth]
  );

  // Saved manual expenses
  const { data: expenses } = useQuery({
    queryKey: ["billing-manual-expenses", selectedMonth],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("billing_manual_expenses")
        .select("*")
        .eq("year_month", selectedMonth);
      if (error) throw error;
      return data as { category: string; amount: number; note: string | null }[];
    },
  });

  // Recurring: fetch latest previous values for recurring categories
  const recurringKeys = Array.from(RECURRING_CATEGORIES);
  const { data: previousRecurring } = useQuery({
    queryKey: ["billing-previous-recurring", selectedMonth, recurringKeys],
    queryFn: async () => {
      const results: Record<string, { amount: number; note: string }> = {};
      for (const cat of recurringKeys) {
        const { data, error } = await (supabase as any)
          .from("billing_manual_expenses")
          .select("amount, note")
          .eq("category", cat)
          .lt("year_month", selectedMonth)
          .gt("amount", 0)
          .order("year_month", { ascending: false })
          .limit(1);
        if (!error && data && data.length > 0) {
          results[cat] = { amount: data[0].amount, note: data[0].note || "" };
        }
      }
      return results;
    },
  });

  // Auto: Location costs in payroll period
  const { data: bookings } = useQuery({
    queryKey: ["billing-location-costs", periodStart, periodEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking")
        .select("id, booked_days, daily_rate_override, total_price, start_date, end_date, location:location_id(id, name, daily_rate, type)")
        .eq("status", "confirmed")
        .gte("start_date", periodStart)
        .lte("start_date", periodEnd);
      if (error) throw error;
      return data as any[];
    },
  });

  // Discount rules
  const { data: discountRules } = useQuery({
    queryKey: ["billing-all-discount-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_discount_rules")
        .select("*")
        .eq("is_active", true)
        .order("min_placements", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Location exceptions
  const { data: locationExceptions } = useQuery({
    queryKey: ["billing-all-location-exceptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_location_exceptions")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  // Auto: Hotel costs in payroll period
  const { data: hotelBookings } = useQuery({
    queryKey: ["billing-hotel-costs", periodStart, periodEnd],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("booking_hotel")
        .select("id, price_per_night, check_in")
        .gte("check_in", periodStart)
        .lte("check_in", periodEnd);
      if (error) throw error;
      return data as { id: string; price_per_night: number | null; check_in: string }[];
    },
  });

  // Calculate netto location total using same logic as Billing.tsx
  const autoLocationTotal = useMemo(() => {
    if (!bookings) return 0;

    // Group bookings by location
    const bookingsByLocation: Record<string, any> = {};
    bookings.forEach((b: any) => {
      const locationId = b.location?.id || b.location_id || "unknown";
      const days = countBookedDays(b);
      let bookingTotal: number;

      if (b.total_price != null) {
        bookingTotal = b.total_price;
      } else {
        const rate = b.daily_rate_override ?? b.location?.daily_rate ?? 1000;
        bookingTotal = rate * days;
      }

      if (!bookingsByLocation[locationId]) {
        bookingsByLocation[locationId] = {
          location: b.location,
          totalDays: 0,
          totalAmount: 0,
        };
      }
      bookingsByLocation[locationId].totalDays += days;
      bookingsByLocation[locationId].totalAmount += bookingTotal;
    });

    if (!discountRules) {
      return Object.values(bookingsByLocation).reduce((s: number, l: any) => s + l.totalAmount, 0);
    }

    const locationEntries = Object.values(bookingsByLocation) as any[];

    // Group by type
    const byType: Record<string, any[]> = {};
    locationEntries.forEach((loc: any) => {
      const type = loc.location?.type || "unknown";
      if (!byType[type]) byType[type] = [];
      byType[type].push(loc);
    });

    // Exception lookup
    const exceptionMap = new Map<string, any>();
    locationExceptions?.forEach((exc: any) => {
      exceptionMap.set(exc.location_name.toLowerCase(), exc);
    });

    let totalNetto = 0;

    Object.entries(byType).forEach(([type, locs]) => {
      const rulesForType = discountRules.filter((r: any) => r.location_type === type);

      if (rulesForType.length === 0) {
        totalNetto += locs.reduce((s: number, l: any) => s + l.totalAmount, 0);
        return;
      }

      const discountType = rulesForType[0]?.discount_type || "placement";
      const minDaysPerLoc = rulesForType[0]?.min_days_per_location ?? 1;

      const placements = locs.reduce((s: number, l: any) => s + Math.floor(l.totalDays / minDaysPerLoc), 0);

      const typeGroupTotal = locs.reduce((s: number, l: any) => {
        const locName = l.location?.name?.toLowerCase() || "";
        const exc = exceptionMap.get(locName);
        if (exc?.exception_type === "excluded") return s;
        return s + l.totalAmount;
      }, 0);

      let appliedDiscount = 0;
      if (discountType === "monthly_revenue") {
        const sorted = [...rulesForType].sort((a: any, b: any) => (b.min_revenue ?? 0) - (a.min_revenue ?? 0));
        for (const rule of sorted) {
          if (typeGroupTotal >= (rule.min_revenue ?? 0)) {
            appliedDiscount = Number(rule.discount_percent);
            break;
          }
        }
      } else if (discountType === "annual_revenue") {
        const sorted = [...rulesForType].sort((a: any, b: any) => (b.min_revenue ?? 0) - (a.min_revenue ?? 0));
        appliedDiscount = sorted[sorted.length - 1]?.discount_percent ?? 0;
      } else {
        const sorted = [...rulesForType].sort((a: any, b: any) => b.min_placements - a.min_placements);
        for (const rule of sorted) {
          if (placements >= rule.min_placements) {
            appliedDiscount = Number(rule.discount_percent);
            break;
          }
        }
      }

      locs.forEach((loc: any) => {
        const locName = loc.location?.name?.toLowerCase() || "";
        const exc = exceptionMap.get(locName);

        if (exc?.exception_type === "excluded") {
          totalNetto += loc.totalAmount;
          return;
        }

        let effectiveDiscount = appliedDiscount;
        if (exc?.exception_type === "max_discount" && exc.max_discount_percent != null) {
          effectiveDiscount = Math.min(appliedDiscount, Number(exc.max_discount_percent));
        }

        totalNetto += loc.totalAmount * (1 - effectiveDiscount / 100);
      });
    });

    return totalNetto;
  }, [bookings, discountRules, locationExceptions]);

  const autoHotelTotal = useMemo(() => {
    if (!hotelBookings) return 0;
    return hotelBookings.reduce((sum: number, bh: any) => sum + (bh.price_per_night || 0), 0);
  }, [hotelBookings]);

  // Sync fetched data + auto values into local state
  useEffect(() => {
    const map = new Map(expenses?.map((e) => [e.category, e]) || []);
    setRows(
      EXPENSE_CATEGORIES.map((c) => {
        if (c.key === "lokationer") {
          return { category: c.key, amount: autoLocationTotal, note: "Auto-beregnet (netto efter rabat)" };
        }
        if (c.key === "hotel") {
          return { category: c.key, amount: autoHotelTotal, note: "Auto-beregnet fra hotelovernatninger" };
        }
        return {
          category: c.key,
          amount: map.get(c.key)?.amount ?? 0,
          note: map.get(c.key)?.note ?? "",
        };
      })
    );
    
  }, [expenses, autoLocationTotal, autoHotelTotal]);

  const saveSingleMutation = useMutation({
    mutationFn: async ({ category, amount, note }: { category: string; amount: number; note: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("billing_manual_expenses")
        .upsert({
          year_month: selectedMonth,
          category,
          amount: amount || 0,
          note: note || null,
          updated_by: user?.id ?? null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "year_month,category" });
      if (error) throw error;
    },
    onError: () => toast.error("Kunne ikke gemme udgift"),
  });

  const updateRow = (index: number, field: "amount" | "note", value: string) => {
    setRows((prev) => {
      const next = [...prev];
      if (field === "amount") {
        next[index] = { ...next[index], amount: value === "" ? 0 : parseFloat(value) || 0 };
      } else {
        next[index] = { ...next[index], note: value };
      }
      const row = next[index];
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveSingleMutation.mutate({ category: row.category, amount: row.amount, note: row.note });
      }, 800);
      return next;
    });
  };

  const total = rows.reduce((sum, r) => sum + (r.amount || 0), 0);

  const monthOptions = [];
  for (let i = -6; i <= 6; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    monthOptions.push({
      value: format(date, "yyyy-MM"),
      label: format(date, "MMMM yyyy", { locale: da }),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          Lønperiode: {periodStart} → {periodEnd}
        </span>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Samlet udgift</p>
                <p className="text-3xl font-bold mt-1">{total.toLocaleString("da-DK")} kr</p>
                <p className="text-xs text-muted-foreground mt-1">{EXPENSE_CATEGORIES.length} poster</p>
              </div>
              <div className="p-2 bg-muted rounded-lg">
                <Receipt className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">Udgiftspost</TableHead>
                <TableHead className="w-[180px]">Beløb (kr)</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {EXPENSE_CATEGORIES.map((cat, idx) => {
                const isAuto = AUTO_CATEGORIES.has(cat.key);
                return (
                  <TableRow key={cat.key} className={isAuto ? "bg-muted/30" : undefined}>
                    <TableCell className="font-medium">
                      {cat.label}
                      {isAuto && <span className="ml-2 text-xs text-muted-foreground">(auto)</span>}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0"
                        value={rows[idx]?.amount || ""}
                        onChange={(e) => updateRow(idx, "amount", e.target.value)}
                        className="w-[150px]"
                        disabled={isAuto}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="text"
                        placeholder={cat.key === "ipads" ? "Eesy betaler 50%" : "Evt. bemærkning"}
                        value={rows[idx]?.note || ""}
                        onChange={(e) => updateRow(idx, "note", e.target.value)}
                        disabled={isAuto}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {/* Total row */}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell>Total</TableCell>
                <TableCell>{total.toLocaleString("da-DK")} kr</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
