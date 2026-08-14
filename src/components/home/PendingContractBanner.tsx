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
    <Card className="border-0 border-l-4 border-l-destructive shadow-lg bg-destructive/5 animate-fade-in">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileSignature className="w-4 h-4 text-destructive" />
          <p className="font-semibold text-sm md:text-base">
            {contracts.length === 1
              ? "Du har en kontrakt der afventer din underskrift"
              : `Du har ${contracts.length} kontrakter der afventer din underskrift`}
          </p>
        </div>

        <div className="space-y-2">
          {contracts.map((contract) => {
            const dateStr = contract.sent_at ?? contract.created_at;
            return (
              <div
                key={contract.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-background/80 border border-destructive/20 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-sm">{contract.title}</p>
                  {dateStr && (
                    <p className="text-xs text-muted-foreground">
                      Sendt {format(parseISO(dateStr), "d. MMMM yyyy", { locale: da })}
                    </p>
                  )}
                </div>
                <Button size="sm" onClick={() => navigate(`/contract/${contract.id}`)}>
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
