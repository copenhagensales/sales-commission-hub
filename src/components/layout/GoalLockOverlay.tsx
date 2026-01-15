import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Target, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { da } from "date-fns/locale";

interface PayrollPeriod {
  start: Date;
  end: Date;
  startStr: string;
  endStr: string;
}

interface GoalLockOverlayProps {
  employeeId: string;
  payrollPeriod: PayrollPeriod;
  onComplete: () => void;
}

const QUICK_AMOUNTS = [15000, 20000, 25000, 30000];

export function GoalLockOverlay({ employeeId, payrollPeriod, onComplete }: GoalLockOverlayProps) {
  const [goalAmount, setGoalAmount] = useState<string>("");
  const queryClient = useQueryClient();
  
  const formatPeriod = () => {
    const startFormatted = format(payrollPeriod.start, "d. MMM", { locale: da });
    const endFormatted = format(payrollPeriod.end, "d. MMM yyyy", { locale: da });
    return `${startFormatted} - ${endFormatted}`;
  };
  
  const saveGoalMutation = useMutation({
    mutationFn: async (targetAmount: number) => {
      const { error } = await supabase
        .from("employee_sales_goals")
        .insert({
          employee_id: employeeId,
          target_amount: targetAmount,
          period_start: payrollPeriod.startStr,
          period_end: payrollPeriod.endStr,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dit mål er gemt!");
      queryClient.invalidateQueries({ queryKey: ["goal-lock-check"] });
      queryClient.invalidateQueries({ queryKey: ["sales-goal"] });
      queryClient.invalidateQueries({ queryKey: ["employee-goals"] });
      onComplete();
    },
    onError: (error) => {
      console.error("Error saving goal:", error);
      toast.error("Kunne ikke gemme målet. Prøv igen.");
    },
  });
  
  const handleSave = () => {
    const amount = parseInt(goalAmount.replace(/\D/g, ""), 10);
    if (!amount || amount < 1000) {
      toast.error("Indtast venligst et gyldigt mål (minimum 1.000 kr.)");
      return;
    }
    saveGoalMutation.mutate(amount);
  };
  
  const handleQuickSelect = (amount: number) => {
    setGoalAmount(amount.toLocaleString("da-DK"));
  };
  
  const formatInputValue = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (!numbers) return "";
    return parseInt(numbers, 10).toLocaleString("da-DK");
  };
  
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border rounded-2xl shadow-xl p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <Target className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Sæt dit mål for denne lønperiode
          </h1>
          <p className="text-muted-foreground">
            Lønperiode: <span className="font-medium text-foreground">{formatPeriod()}</span>
          </p>
        </div>
        
        {/* Goal Input */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground">
            Dit salgsmål (i kr.)
          </label>
          <div className="relative">
            <Input
              type="text"
              inputMode="numeric"
              placeholder="Fx 20.000"
              value={goalAmount}
              onChange={(e) => setGoalAmount(formatInputValue(e.target.value))}
              className="text-lg h-12 pr-12"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
              kr.
            </span>
          </div>
        </div>
        
        {/* Quick Select */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Hurtige valg:</p>
          <div className="grid grid-cols-4 gap-2">
            {QUICK_AMOUNTS.map((amount) => (
              <Button
                key={amount}
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect(amount)}
                className="text-xs"
              >
                {(amount / 1000).toLocaleString("da-DK")}k
              </Button>
            ))}
          </div>
        </div>
        
        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={!goalAmount || saveGoalMutation.isPending}
          className="w-full h-12 text-base font-semibold"
        >
          {saveGoalMutation.isPending ? (
            "Gemmer..."
          ) : (
            <>
              <TrendingUp className="w-5 h-5 mr-2" />
              Gem mit mål
            </>
          )}
        </Button>
        
        {/* Info Text */}
        <p className="text-center text-xs text-muted-foreground">
          ℹ️ Du kan altid ændre dit mål senere under "Mine Mål"
        </p>
      </div>
    </div>
  );
}
