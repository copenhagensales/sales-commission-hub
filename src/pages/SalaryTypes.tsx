import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Pencil, Search, Receipt } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface SalaryType {
  id: string;
  name: string;
  description: string | null;
  code: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function SalaryTypes() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<SalaryType | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    code: "",
  });

  const { data: salaryTypes = [], isLoading } = useQuery({
    queryKey: ["salary-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salary_types")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as SalaryType[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; code: string }) => {
      const { error } = await supabase.from("salary_types").insert({
        name: data.name,
        description: data.description || null,
        code: data.code || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary-types"] });
      toast.success("Lønart oprettet");
      resetForm();
    },
    onError: () => {
      toast.error("Kunne ikke oprette lønart");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SalaryType> }) => {
      const { error } = await supabase
        .from("salary_types")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary-types"] });
      toast.success("Lønart opdateret");
      resetForm();
    },
    onError: () => {
      toast.error("Kunne ikke opdatere lønart");
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("salary_types")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary-types"] });
      toast.success("Status opdateret");
    },
    onError: () => {
      toast.error("Kunne ikke opdatere status");
    },
  });

  const resetForm = () => {
    setFormData({ name: "", description: "", code: "" });
    setEditingType(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (type: SalaryType) => {
    setEditingType(type);
    setFormData({
      name: type.name,
      description: type.description || "",
      code: type.code || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Navn er påkrævet");
      return;
    }

    if (editingType) {
      updateMutation.mutate({
        id: editingType.id,
        data: {
          name: formData.name,
          description: formData.description || null,
          code: formData.code || null,
        },
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredTypes = salaryTypes.filter(
    (type) =>
      type.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      type.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      type.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Receipt className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Lønarter</h1>
            <p className="text-muted-foreground">Administrer lønarter i systemet</p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          setIsDialogOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Ny lønart
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingType ? "Rediger lønart" : "Opret ny lønart"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Navn *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="F.eks. Grundløn, Overarbejde..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Beskrivelse</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Hvad dækker denne lønart?"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Kode (valgfri)</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="F.eks. 1000, OVR..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Annuller
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingType ? "Gem ændringer" : "Opret"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Søg efter lønart..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Badge variant="secondary">{filteredTypes.length} lønarter</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Indlæser...</div>
          ) : filteredTypes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "Ingen lønarter matcher din søgning" : "Ingen lønarter oprettet endnu"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Navn</TableHead>
                  <TableHead>Beskrivelse</TableHead>
                  <TableHead>Kode</TableHead>
                  <TableHead className="text-center">Aktiv</TableHead>
                  <TableHead className="text-right">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTypes.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell className="font-medium">{type.name}</TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {type.description || "-"}
                    </TableCell>
                    <TableCell>
                      {type.code ? (
                        <Badge variant="outline">{type.code}</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={type.is_active}
                        onCheckedChange={(checked) =>
                          toggleActiveMutation.mutate({ id: type.id, isActive: checked })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(type)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
