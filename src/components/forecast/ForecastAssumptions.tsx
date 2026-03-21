import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings2 } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { ForecastRampProfile, ForecastSurvivalProfile } from "@/types/forecast";

interface Props {
  rampProfile: ForecastRampProfile;
  survivalProfile: ForecastSurvivalProfile;
  avgAttendance: number;
  baselineSph: number;
}

export function ForecastAssumptions({ rampProfile, survivalProfile, avgAttendance, baselineSph }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          Antagelser & parametre
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Accordion type="single" collapsible>
          <AccordionItem value="ramp">
            <AccordionTrigger className="text-sm py-2">Ramp-up profil: {rampProfile.name}</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between p-2 rounded bg-muted/30">
                  <span>Dag 1-7</span>
                  <span className="font-medium">{Math.round(rampProfile.day_1_7_factor * 100)}%</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/30">
                  <span>Dag 8-14</span>
                  <span className="font-medium">{Math.round(rampProfile.day_8_14_factor * 100)}%</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/30">
                  <span>Dag 15-30</span>
                  <span className="font-medium">{Math.round(rampProfile.day_15_30_factor * 100)}%</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/30">
                  <span>Dag 31-60</span>
                  <span className="font-medium">{Math.round(rampProfile.day_31_60_factor * 100)}%</span>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="survival">
            <AccordionTrigger className="text-sm py-2">Churn-profil: {survivalProfile.name}</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between p-2 rounded bg-muted/30">
                  <span>Dag 7</span>
                  <span className="font-medium">{Math.round(survivalProfile.survival_day_7 * 100)}% overlever</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/30">
                  <span>Dag 14</span>
                  <span className="font-medium">{Math.round(survivalProfile.survival_day_14 * 100)}%</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/30">
                  <span>Dag 30</span>
                  <span className="font-medium">{Math.round(survivalProfile.survival_day_30 * 100)}%</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/30">
                  <span>Dag 60</span>
                  <span className="font-medium">{Math.round(survivalProfile.survival_day_60 * 100)}%</span>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="general">
            <AccordionTrigger className="text-sm py-2">Generelle parametre</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between p-2 rounded bg-muted/30">
                  <span>Gns. fremmøde</span>
                  <span className="font-medium">{Math.round(avgAttendance * 100)}%</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/30">
                  <span>Baseline salg/time (nye)</span>
                  <span className="font-medium">{baselineSph.toFixed(2)}</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/30">
                  <span>Performance-vægtning</span>
                  <span className="font-medium">EWMA (decay=0.85)</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/30">
                  <span>Forecast-interval</span>
                  <span className="font-medium">Low=×0.85, High=×1.12</span>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
