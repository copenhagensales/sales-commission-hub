import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ClientRow {
  id: string;
  name: string | null;
}

function getDefaultPayrollPeriod() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-indexed
  const day = today.getDate();

  if (day >= 15) {
    return {
      from: new Date(year, month, 15),
      to: new Date(year, month + 1, 14),
    };
  }

  return {
    from: new Date(year, month - 1, 15),
    to: new Date(year, month, 14),
  };
}

export default function Payroll() {
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>(undefined);
  const defaultPeriod = getDefaultPayrollPeriod();
  const [fromDate, setFromDate] = useState<Date | undefined>(defaultPeriod.from);
  const [toDate, setToDate] = useState<Date | undefined>(defaultPeriod.to);

  const { data: clients, isLoading: loadingClients } = useQuery<ClientRow[]>({
    queryKey: ["payroll-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");

      if (error) throw error;
      return data as ClientRow[];
    },
  });

  useEffect(() => {
    if (!clients || clients.length === 0 || selectedClientId) return;
    setSelectedClientId(clients[0]?.id);
  }, [clients, selectedClientId]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="w-full md:w-[260px]">
            <Select
              value={selectedClientId}
              onValueChange={setSelectedClientId}
              disabled={loadingClients || !clients || clients.length === 0}
            >
              <SelectTrigger className="w-full bg-background">
                <SelectValue
                  placeholder={loadingClients ? "Indlæser kunder..." : "Vælg kunde (fra MG test)"}
                />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {clients?.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name ?? "Ukendt kunde"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center">
            <span className="text-sm text-muted-foreground md:w-28">Lønperiode</span>
            <div className="flex flex-1 flex-col gap-2 sm:flex-row">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !fromDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fromDate ? format(fromDate, "dd.MM.yyyy") : <span>Fra (15.)</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fromDate}
                    onSelect={setFromDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !toDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {toDate ? format(toDate, "dd.MM.yyyy") : <span>Til (14.)</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={toDate}
                    onSelect={setToDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Lønkørsler
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              Lønkørsels-beregning bliver implementeret i fase 2.
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
