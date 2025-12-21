import { CheckCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { da } from "date-fns/locale";

export interface ReadReceipt {
  id: string;
  employee_id: string;
  read_at: string;
  employee?: {
    id: string;
    full_name: string;
  };
}

interface ReadReceiptsProps {
  receipts: ReadReceipt[];
  isOwn: boolean;
}

export function ReadReceipts({ receipts, isOwn }: ReadReceiptsProps) {
  if (!isOwn || receipts.length === 0) return null;

  const readByNames = receipts
    .filter(r => r.employee?.full_name)
    .map(r => `${r.employee!.full_name} (${format(new Date(r.read_at), "HH:mm", { locale: da })})`);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-0.5 text-xs text-primary-foreground/70 mt-1">
            <CheckCheck className="h-3 w-3" />
            <span>Læst af {receipts.length}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs">
            {readByNames.map((name, i) => (
              <div key={i}>{name}</div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
