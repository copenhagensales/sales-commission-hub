import { TableCell } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { SalaryAdditionItem } from "@/hooks/useSellerSalariesCached";
import { formatCurrency } from "@/lib/calculations";

interface SalaryAdditionCellProps {
  value: number | string;
  columnKey: string;
  items?: { total: number; items: SalaryAdditionItem[] };
  isCurrency?: boolean;
}

export function SalaryAdditionCell({ value, columnKey, items, isCurrency = true }: SalaryAdditionCellProps) {
  const queryClient = useQueryClient();
  const hasAdditions = items && items.items.length > 0;
  const displayValue = isCurrency ? formatCurrency(value as number) : value;

  const handleDelete = async (id: string) => {
    const { error } = await (supabase.from("salary_additions") as any).delete().eq("id", id);
    if (error) {
      toast.error("Kunne ikke slette tilføjelse");
      return;
    }
    toast.success("Tilføjelse slettet");
    queryClient.invalidateQueries({ queryKey: ["salary-additions"] });
  };

  if (!hasAdditions) {
    return <TableCell className="text-right">{displayValue}</TableCell>;
  }

  return (
    <TableCell className="text-right">
      <Popover>
        <PopoverTrigger asChild>
          <button className="inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity">
            {displayValue}
            <span className="inline-block w-2 h-2 rounded-full bg-primary shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="end">
          <p className="text-xs font-medium text-muted-foreground mb-2">Løntilføjelser</p>
          <div className="space-y-2">
            {items.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <span className={item.amount >= 0 ? "text-green-600" : "text-destructive"}>
                    {item.amount >= 0 ? "+" : ""}{isCurrency ? formatCurrency(item.amount) : item.amount}
                  </span>
                  {item.note && (
                    <p className="text-xs text-muted-foreground truncate">{item.note}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(item.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </TableCell>
  );
}
