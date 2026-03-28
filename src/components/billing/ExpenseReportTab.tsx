
import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Receipt } from "lucide-react";
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
  { key: "parkering", label: "P-pladser" },
  { key: "bil", label: "Bil udgifter" },
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

  // Auto: Location costs in payroll period
  const { data: bookings } = useQuery({
    queryKey: ["billing-location-costs", periodStart, periodEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking")
        .select("id, booked_days, daily_rate_override, total_price, start_date, end_date, location:location_id(daily_rate)")
        .eq("status", "confirmed")
        .gte("start_date", periodStart)
        .lte("start_date", periodEnd)
        .not("booked_days", "is", null);
      if (error) throw error;
      return data as any[];
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

  const autoLocationTotal = useMemo(() => {
    if (!bookings) return 0;
    return bookings.reduce((sum: number, b: any) => {
      if (b.total_price != null) return sum + b.total_price;
      const rate = b.daily_rate_override ?? b.location?.daily_rate ?? 0;
      const days = b.booked_days?.length || 0;
      return sum + rate * days;
    }, 0);
  }, [bookings]);

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
          return { category: c.key, amount: autoLocationTotal, note: "Auto-beregnet fra bookinger" };
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
