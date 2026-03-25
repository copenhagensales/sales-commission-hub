import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, MapPin, ShoppingBag, Pencil, X, Check } from "lucide-react";
import type { WeekForecast } from "@/hooks/useFmWeeklyForecast";

interface Props {
  weeks: WeekForecast[];
  onOverride: (weekNumber: number, year: number, sales: number | null) => void;
}

export function FmWeeklyForecastTable({ weeks, onOverride }: Props) {
  const [editingWeek, setEditingWeek] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingWeek && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editingWeek]);

  const handleSave = (wk: WeekForecast) => {
    const val = parseInt(editValue);
    if (!isNaN(val) && val >= 0) {
      onOverride(wk.weekNumber, wk.year, val);
    }
    setEditingWeek(null);
  };

  const handleRemove = (wk: WeekForecast) => {
    onOverride(wk.weekNumber, wk.year, null);
  };

  const totals = weeks.reduce(
    (acc, w) => ({
      daysCentre: acc.daysCentre + w.daysCentre,
      daysMarket: acc.daysMarket + w.daysMarket,
      totalDays: acc.totalDays + w.totalDays,
      staffCount: acc.staffCount + w.staffCount,
      expected: acc.expected + (w.overrideSales ?? w.expectedSales),
      actual: acc.actual + w.actualSales,
    }),
    { daysCentre: 0, daysMarket: 0, totalDays: 0, staffCount: 0, expected: 0, actual: 0 }
  );

  if (weeks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" />
            Ugefordeling
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Ingen bekræftede bookinger fundet for denne periode.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4" />
          Ugefordeling
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Uge</TableHead>
                <TableHead className="text-center">
                  <Tooltip>
                    <TooltipTrigger className="flex items-center gap-1 mx-auto">
                      <ShoppingBag className="h-3.5 w-3.5" />
                      Centre
                    </TooltipTrigger>
                    <TooltipContent>Bookede dage i butikker/centre</TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-center">
                  <Tooltip>
                    <TooltipTrigger className="flex items-center gap-1 mx-auto">
                      <MapPin className="h-3.5 w-3.5" />
                      Markeder
                    </TooltipTrigger>
                    <TooltipContent>Bookede dage på markeder/messer</TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-center">Total dage</TableHead>
                <TableHead className="text-center">Medarbj.</TableHead>
                <TableHead className="text-right">Forventet</TableHead>
                <TableHead className="text-right">Faktisk</TableHead>
                <TableHead className="text-right">Afvigelse</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {weeks.map((wk) => {
                const key = `${wk.year}-${wk.weekNumber}`;
                const isEditing = editingWeek === key;
                const displayExpected = wk.overrideSales ?? wk.expectedSales;
                const variance = wk.actualSales > 0 ? wk.actualSales - displayExpected : null;
                const variancePct = displayExpected > 0 && variance !== null
                  ? Math.round((variance / displayExpected) * 100)
                  : null;

                return (
                  <TableRow key={key}>
                    <TableCell className="font-medium">
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge variant="outline" className="text-xs">
                            {wk.weekNumber}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>{wk.weekStart} – {wk.weekEnd}</TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-center">{wk.daysCentre || "–"}</TableCell>
                    <TableCell className="text-center">{wk.daysMarket || "–"}</TableCell>
                    <TableCell className="text-center font-medium">{wk.totalDays}</TableCell>
                    <TableCell className="text-center">{wk.staffCount || "–"}</TableCell>
                    <TableCell className="text-right">
                      {isEditing ? (
                        <div className="flex items-center gap-1 justify-end">
                          <Input
                            ref={editRef}
                            type="number"
                            min={0}
                            className="w-16 h-7 text-right text-xs"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSave(wk);
                              if (e.key === "Escape") setEditingWeek(null);
                            }}
                          />
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleSave(wk)}>
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingWeek(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 justify-end">
                          {wk.overrideSales !== null ? (
                            <Tooltip>
                              <TooltipTrigger>
                                <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded px-1.5 py-0.5 text-xs font-medium">
                                  {displayExpected}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                Beregnet: {wk.expectedSales} | Manuel: {wk.overrideSales}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-xs">{displayExpected}</span>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-5 w-5 opacity-40 hover:opacity-100"
                            onClick={() => {
                              setEditingWeek(key);
                              setEditValue(String(displayExpected));
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          {wk.overrideSales !== null && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5 text-destructive opacity-60 hover:opacity-100"
                              onClick={() => handleRemove(wk)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {wk.actualSales > 0 ? wk.actualSales : "–"}
                    </TableCell>
                    <TableCell className="text-right">
                      {variance !== null ? (
                        <Badge
                          variant="outline"
                          className={
                            variance >= 0
                              ? "text-green-700 border-green-300 dark:text-green-400 dark:border-green-700"
                              : "text-red-700 border-red-300 dark:text-red-400 dark:border-red-700"
                          }
                        >
                          {variance >= 0 ? "+" : ""}{variance} ({variancePct}%)
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">–</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-bold">Total</TableCell>
                <TableCell className="text-center font-medium">{totals.daysCentre}</TableCell>
                <TableCell className="text-center font-medium">{totals.daysMarket}</TableCell>
                <TableCell className="text-center font-bold">{totals.totalDays}</TableCell>
                <TableCell className="text-center">–</TableCell>
                <TableCell className="text-right font-bold">{totals.expected}</TableCell>
                <TableCell className="text-right font-bold">{totals.actual || "–"}</TableCell>
                <TableCell className="text-right">
                  {totals.actual > 0 ? (
                    <Badge
                      variant="outline"
                      className={
                        totals.actual - totals.expected >= 0
                          ? "text-green-700 border-green-300 dark:text-green-400 dark:border-green-700"
                          : "text-red-700 border-red-300 dark:text-red-400 dark:border-red-700"
                      }
                    >
                      {totals.actual - totals.expected >= 0 ? "+" : ""}
                      {totals.actual - totals.expected}
                    </Badge>
                  ) : (
                    "–"
                  )}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
