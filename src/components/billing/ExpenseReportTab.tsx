
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, Receipt } from "lucide-react";
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
  { key: "lokationer", label: "Lokationer" },
  { key: "corpay", label: "Corpay" },
  { key: "ipads", label: "iPads (eesy betaler 50%)" },
  { key: "team_arrangement", label: "Team arrangement" },
  { key: "banken", label: "Banken" },
  { key: "boeder", label: "Bøder" },
];

type ExpenseRow = {
  category: string;
  amount: number;
  note: string;
};

export function ExpenseReportTab() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(format(now, "yyyy-MM"));
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const queryClient = useQueryClient();

  const { data: expenses, isLoading } = useQuery({
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

  // Sync fetched data into local state
  useEffect(() => {
    const map = new Map(expenses?.map((e) => [e.category, e]) || []);
    setRows(
      EXPENSE_CATEGORIES.map((c) => ({
        category: c.key,
        amount: map.get(c.key)?.amount ?? 0,
        note: map.get(c.key)?.note ?? "",
      }))
    );
    setIsDirty(false);
  }, [expenses]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const upserts = rows.map((r) => ({
        year_month: selectedMonth,
        category: r.category,
        amount: r.amount || 0,
        note: r.note || null,
        updated_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await (supabase as any)
        .from("billing_manual_expenses")
        .upsert(upserts, { onConflict: "year_month,category" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Udgifter gemt");
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ["billing-manual-expenses", selectedMonth] });
    },
    onError: () => toast.error("Kunne ikke gemme udgifter"),
  });

  const updateRow = (index: number, field: "amount" | "note", value: string) => {
    setRows((prev) => {
      const next = [...prev];
      if (field === "amount") {
        next[index] = { ...next[index], amount: value === "" ? 0 : parseFloat(value) || 0 };
      } else {
        next[index] = { ...next[index], note: value };
      }
      return next;
    });
    setIsDirty(true);
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
        <Button onClick={() => saveMutation.mutate()} disabled={!isDirty || saveMutation.isPending}>
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? "Gemmer..." : "Gem"}
        </Button>
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
              {EXPENSE_CATEGORIES.map((cat, idx) => (
                <TableRow key={cat.key}>
                  <TableCell className="font-medium">{cat.label}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0"
                      value={rows[idx]?.amount || ""}
                      onChange={(e) => updateRow(idx, "amount", e.target.value)}
                      className="w-[150px]"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="text"
                      placeholder={cat.key === "ipads" ? "Eesy betaler 50%" : "Evt. bemærkning"}
                      value={rows[idx]?.note || ""}
                      onChange={(e) => updateRow(idx, "note", e.target.value)}
                    />
                  </TableCell>
                </TableRow>
              ))}
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
