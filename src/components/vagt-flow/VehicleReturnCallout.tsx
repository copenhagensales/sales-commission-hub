import { Car, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";

interface VehicleReturnCalloutProps {
  vehicleName: string;
  confirmed: { confirmed_at: string } | null;
  isConfirming: boolean;
  onConfirm: () => void;
}

export function VehicleReturnCallout({ vehicleName, confirmed, isConfirming, onConfirm }: VehicleReturnCalloutProps) {
  if (confirmed) {
    return (
      <div className="mt-1 px-2.5 py-2 rounded-md bg-green-600/10 border border-green-500/20 dark:bg-green-500/10 dark:border-green-400/20">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-700 dark:text-green-300 shrink-0" />
          <span className="text-[11px] font-semibold text-green-700 dark:text-green-300">
            {vehicleName} afleveret kl. {format(parseISO(confirmed.confirmed_at), "HH:mm")}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1 px-2.5 py-2 rounded-md bg-yellow-600/10 border border-yellow-500/20 dark:bg-yellow-500/10 dark:border-yellow-400/20 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Car className="w-3.5 h-3.5 text-yellow-700 dark:text-yellow-300 shrink-0" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-yellow-700 dark:text-yellow-300">
          Aflevering af bil i dag
        </span>
      </div>

      <div className="text-[11px] text-foreground space-y-1 ml-5">
        <p>Parker bilen på parkeringspladsen i de afmærkede båse med <strong>"Copenhagen Sales"</strong>.</p>
        <p>Hvis porten er låst, brug nøglebrik fra nøgleboksen til højre for porten <strong>(kode 2109)</strong>. Aflever nøglen på det lille kontor.</p>
      </div>

      <div className="flex items-start gap-1.5 ml-5">
        <AlertTriangle className="w-3 h-3 text-yellow-700 dark:text-yellow-300 shrink-0 mt-0.5" />
        <p className="text-[10px] text-yellow-800 dark:text-yellow-200">
          Afleveres nøglen ikke, kan kollegaer ikke bruge bilen. Parkerer du udenfor porten, er du selv ansvarlig for eventuelle parkeringsbøder.
        </p>
      </div>

      <div className="ml-5 pt-0.5">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[11px] px-3 bg-yellow-100 hover:bg-yellow-200 text-yellow-900 border-yellow-400 dark:bg-yellow-900/40 dark:hover:bg-yellow-900/60 dark:text-yellow-100 dark:border-yellow-600"
          disabled={isConfirming}
          onClick={onConfirm}
        >
          <CheckCircle2 className="w-3 h-3 mr-1" />
          {isConfirming ? "Bekræfter..." : "Bekræft aflevering"}
        </Button>
      </div>
    </div>
  );
}
