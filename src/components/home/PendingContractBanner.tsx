import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { FileSignature, ArrowRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface PendingContractBannerProps {
  employeeId?: string | null;
}

/**
 * Viser et tydeligt link på forsiden når medarbejderen har en eller flere
 * kontrakter der afventer underskrift.
 */
export function PendingContractBanner({ employeeId }: PendingContractBannerProps) {
  const navigate = useNavigate();

  const { data: contracts = [] } = useQuery({
    queryKey: ["my-pending-contracts", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("id, title, sent_at, created_at")
        .eq("employee_id", employeeId!)
        .eq("status", "pending_employee")
        .order("sent_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!employeeId,
    staleTime: 60 * 1000,
  });

  if (contracts.length === 0) return null;

  return (
    <Card className="relative overflow-hidden border-0 ring-2 ring-warning/60 bg-gradient-to-r from-warning/20 via-warning/10 to-transparent shadow-[0_10px_40px_-12px_hsl(var(--warning)/0.45)] animate-fade-in">
      {/* Kontrastfarvet kant der trækker øjet til boksen */}
      <div className="absolute inset-y-0 left-0 w-1.5 bg-warning" />

      <CardContent className="py-5 pl-6 pr-4 md:pl-7 space-y-4">
        <div className="flex items-start gap-3">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning text-warning-foreground shadow-md">
            <FileSignature className="w-5 h-5" />
            <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-destructive ring-2 ring-card animate-pulse" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-warning">
              Handling påkrævet
            </p>
            <p className="font-bold text-base md:text-lg leading-snug text-foreground">
              {contracts.length === 1
                ? "Du har en kontrakt der afventer din underskrift"
                : `Du har ${contracts.length} kontrakter der afventer din underskrift`}
            </p>
            <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
              Læs kontrakten igennem og underskriv den digitalt — det tager kun et øjeblik.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {contracts.map((contract) => {
            const dateStr = contract.sent_at ?? contract.created_at;
            return (
              <div
                key={contract.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card/90 border border-warning/30 px-4 py-3 shadow-sm"
              >
                <div>
                  <p className="font-semibold text-sm">{contract.title}</p>
                  {dateStr && (
                    <p className="text-xs text-muted-foreground">
                      Sendt {format(parseISO(dateStr), "d. MMMM yyyy", { locale: da })}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => navigate(`/contract/${contract.id}`)}
                  className="bg-warning text-warning-foreground hover:bg-warning/90 font-semibold shadow-md"
                >
                  Læs og underskriv
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
