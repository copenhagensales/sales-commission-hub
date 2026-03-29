import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Pencil, Trash2, Search, Shield, Eye, EyeOff, Clock } from "lucide-react";
import { toast } from "sonner";
import { FieldDefinitionDialog } from "./FieldDefinitionDialog";

export interface FieldDefinition {
  id: string;
  field_key: string;
  display_name: string;
  category: "customer" | "sale" | "employee" | "campaign" | "product";
  data_type: "string" | "number" | "date" | "boolean";
  is_pii: boolean;
  is_required: boolean;
  is_hidden: boolean;
  retention_days: number | null;
  dialer_retention_days: number | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

const categoryLabels: Record<string, string> = {
  customer: "Kunde",
  sale: "Salg",
  employee: "Medarbejder",
  campaign: "Kampagne",
  product: "Produkt",
};

const categoryColors: Record<string, string> = {
  customer: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  sale: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  employee: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  campaign: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  product: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
};

export function FieldDefinitionsManager() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<FieldDefinition | null>(null);

  const { data: fields = [], isLoading } = useQuery({
    queryKey: ["data-field-definitions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_field_definitions")
        .select("*")
        .order("category")
        .order("display_name");
      if (error) throw error;
      return data as FieldDefinition[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("data_field_definitions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Felt slettet");
      queryClient.invalidateQueries({ queryKey: ["data-field-definitions"] });
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke slette felt: ${error.message}`);
    },
  });

  const filteredFields = fields.filter(
    (f) =>
      f.field_key.toLowerCase().includes(search.toLowerCase()) ||
      f.display_name.toLowerCase().includes(search.toLowerCase()) ||
      categoryLabels[f.category]?.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (field: FieldDefinition) => {
    setEditingField(field);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingField(null);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingField(null);
  };

  const formatRetention = (days: number | null) => {
    if (days === null) return "Permanent";
    if (days === 0) return "Straks";
    if (days === 365) return "1 år";
    return `${days} dage`;
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-xl font-semibold">Standard Feltdefinitioner</CardTitle>
          <Button onClick={handleCreate} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nyt felt
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Søg efter felt..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              Indlæser...
            </div>
          ) : filteredFields.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {search ? "Ingen felter matcher din søgning" : "Ingen feltdefinitioner fundet"}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[200px]">Felt</TableHead>
                    <TableHead className="w-[100px]">Kategori</TableHead>
                    <TableHead className="w-[80px]">Type</TableHead>
                    <TableHead className="w-[60px] text-center">PII</TableHead>
                    <TableHead className="w-[60px] text-center">Skjult</TableHead>
                    <TableHead className="w-[100px]">Retention</TableHead>
                    <TableHead className="w-[100px]">Dialer ret.</TableHead>
                    <TableHead className="w-[60px] text-center">Obl.</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFields.map((field) => (
                    <TableRow key={field.id} className="group hover:bg-muted/30">
                      <TableCell>
                        <div>
                          <p className="font-medium">{field.display_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{field.field_key}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={categoryColors[field.category]}>
                          {categoryLabels[field.category]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {field.data_type}
                      </TableCell>
                      <TableCell className="text-center">
                        {field.is_pii && (
                          <Shield className="h-4 w-4 mx-auto text-amber-500" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {field.is_hidden ? (
                          <EyeOff className="h-4 w-4 mx-auto text-muted-foreground" />
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {field.retention_days !== null && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatRetention(field.retention_days)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {field.dialer_retention_days !== null && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatRetention(field.dialer_retention_days)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {field.is_required && (
                          <Badge variant="secondary" className="text-xs">
                            Ja
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(field)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Rediger
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => deleteMutation.mutate(field.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Slet
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <FieldDefinitionDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        field={editingField}
      />
    </>
  );
}
