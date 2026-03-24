import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Trash2, Users, Loader2 } from "lucide-react";

interface SellerMappingTabProps {
  clientId: string;
}

export function SellerMappingTab({ clientId }: SellerMappingTabProps) {
  const queryClient = useQueryClient();

  const { data: mappings = [], isLoading } = useQuery({
    queryKey: ["cancellation-seller-mappings", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cancellation_seller_mappings")
        .select("id, excel_seller_name, employee_id, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-for-mapping-display"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return data || [];
    },
  });

  const employeeMap = new Map(employees.map(e => [e.id, `${e.first_name || ""} ${e.last_name || ""}`.trim()]));

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("cancellation_seller_mappings")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Slettet", description: "Mapping er fjernet." });
      queryClient.invalidateQueries({ queryKey: ["cancellation-seller-mappings", clientId] });
    },
    onError: (err: Error) => {
      toast({ title: "Fejl", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Sælger-mappings
        </CardTitle>
        <CardDescription>
          Oversigt over gemte koblinger mellem Excel-sælgernavne og medarbejdere. Disse bruges til automatisk matching ved upload.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {mappings.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p className="font-medium">Ingen mappings endnu</p>
            <p className="text-sm mt-1">Mappings oprettes automatisk når du vælger en medarbejder under upload-preview.</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Excel-sælgernavn</TableHead>
                  <TableHead>Mappet medarbejder</TableHead>
                  <TableHead>Oprettet</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((mapping) => (
                  <TableRow key={mapping.id}>
                    <TableCell>
                      <Badge variant="outline">{mapping.excel_seller_name}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {employeeMap.get(mapping.employee_id) || mapping.employee_id}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(mapping.created_at).toLocaleDateString("da-DK")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(mapping.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
