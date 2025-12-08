import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Phone, Play, Loader2 } from "lucide-react";

interface DialerIntegration {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  last_sync_at: string | null;
}

export function DialerIntegrations() {
  const queryClient = useQueryClient();
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Fetch Dialer Integrations
  const { data: integrations, isLoading } = useQuery({
    queryKey: ["dialer-integrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_integrations")
        .select("id, name, type, is_active, last_sync_at")
        .in("type", ["adversus", "enreach"])
        .order("name");

      if (error) throw error;
      return data as DialerIntegration[];
    },
  });

  // Trigger Sync
  const syncMutation = useMutation({
    mutationFn: async ({ integrationId, source }: { integrationId: string; source: string }) => {
      setSyncingId(integrationId);
      const { data, error } = await supabase.functions.invoke("integration-engine", {
        body: {
          source: source,
          action: "sync",
          days: 7,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Synkronisering gennemført", {
        description: `Resultat: ${JSON.stringify(data.results?.length || 0)} konti behandlet`,
      });
      queryClient.invalidateQueries({ queryKey: ["dialer-integrations"] });
    },
    onError: (error) => {
      toast.error(`Synkronisering fejlede: ${error.message}`);
    },
    onSettled: () => {
      setSyncingId(null);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Dialer Integrationer
        </CardTitle>
        <CardDescription>Synkroniser data fra dialers som Adversus og Enreach.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">Indlæser integrationer...</div>
        ) : !integrations || integrations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Ingen dialer integrationer konfigureret.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Navn</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sidst synkroniseret</TableHead>
                <TableHead className="text-right">Handlinger</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {integrations.map((integration) => (
                <TableRow key={integration.id}>
                  <TableCell className="font-medium">{integration.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {integration.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={integration.is_active ? "default" : "secondary"}>
                      {integration.is_active ? "Aktiv" : "Inaktiv"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {integration.last_sync_at ? (
                      <span className="text-sm">{new Date(integration.last_sync_at).toLocaleString("da-DK")}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">Aldrig</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!integration.is_active || syncingId === integration.id}
                      onClick={() => syncMutation.mutate({ integrationId: integration.id, source: integration.type })}
                    >
                      {syncingId === integration.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Play className="h-4 w-4 mr-1" />
                      )}
                      Synkroniser
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
