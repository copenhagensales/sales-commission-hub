import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ClientRow {
  id: string;
  name: string | null;
}

export default function Payroll() {
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>(undefined);

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
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold">Lønkørsel</h1>
            <p className="text-muted-foreground">Overblik over lønkørsler (fase 2)</p>
          </div>
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
