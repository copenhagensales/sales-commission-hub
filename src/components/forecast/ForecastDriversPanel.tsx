import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import type { ForecastDriver } from "@/types/forecast";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface Props {
  drivers: ForecastDriver[];
}

const impactConfig = {
  positive: { icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-700' },
  negative: { icon: TrendingDown, color: 'text-destructive', bg: 'bg-destructive/5', badge: 'bg-destructive/10 text-destructive' },
  neutral: { icon: Minus, color: 'text-muted-foreground', bg: 'bg-muted/50', badge: 'bg-muted text-muted-foreground' },
};

export function ForecastDriversPanel({ drivers }: Props) {
  if (drivers.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          Hvad driver forecastet
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Accordion type="multiple" className="w-full">
          {drivers.map((driver) => {
            const config = impactConfig[driver.impact];
            const Icon = config.icon;
            return (
              <AccordionItem key={driver.key} value={driver.key} className="border-b last:border-0">
                <AccordionTrigger className="py-3 hover:no-underline">
                  <div className="flex items-center gap-3 text-left">
                    <div className={`p-1.5 rounded ${config.bg}`}>
                      <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                    </div>
                    <span className="text-sm font-medium">{driver.label}</span>
                    <Badge variant="outline" className={`text-xs ml-auto mr-2 ${config.badge}`}>
                      {driver.value}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground pl-10">{driver.description}</p>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}
