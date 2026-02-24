import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Plus, Pencil, Percent } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface DiscountRule {
  id: string;
  location_type: string;
  min_placements: number;
  discount_percent: number;
  description: string | null;
  is_active: boolean;
}

export function DiscountRulesTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<DiscountRule | null>(null);
  const [formData, setFormData] = useState({
    location_type: "",
    min_placements: "",
    discount_percent: "",
    description: "",
  });

  const { data: rules, isLoading } = useQuery({
    queryKey: ["all-discount-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_discount_rules")
        .select("*")
        .order("location_type")
        .order("min_placements");
      if (error) throw error;
      return data as DiscountRule[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        location_type: formData.location_type,
        min_placements: parseInt(formData.min_placements),
        discount_percent: parseFloat(formData.discount_percent),
        description: formData.description || null,
      };

      if (editingRule) {
        const { error } = await supabase
          .from("supplier_discount_rules")
          .update(payload)
          .eq("id", editingRule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("supplier_discount_rules")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingRule ? "Regel opdateret" : "Regel oprettet");
      queryClient.invalidateQueries({ queryKey: ["all-discount-rules"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-discount-rules"] });
      setDialogOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("supplier_discount_rules")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-discount-rules"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-discount-rules"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const openCreate = () => {
    setEditingRule(null);
    setFormData({ location_type: "", min_placements: "", discount_percent: "", description: "" });
    setDialogOpen(true);
  };

  const openEdit = (rule: DiscountRule) => {
    setEditingRule(rule);
    setFormData({
      location_type: rule.location_type,
      min_placements: String(rule.min_placements),
      discount_percent: String(rule.discount_percent),
      description: rule.description || "",
    });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Percent className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Rabataftaler</h2>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Tilføj regel
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Indlæser...</p>
          ) : !rules?.length ? (
            <p className="text-center text-muted-foreground py-8">Ingen rabataftaler oprettet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lokationstype</TableHead>
                  <TableHead className="text-right">Min. placeringer</TableHead>
                  <TableHead className="text-right">Rabat %</TableHead>
                  <TableHead>Beskrivelse</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Handling</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.location_type}</TableCell>
                    <TableCell className="text-right">{rule.min_placements}</TableCell>
                    <TableCell className="text-right">{rule.discount_percent}%</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {rule.description || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={rule.is_active ? "default" : "secondary"}>
                        {rule.is_active ? "Aktiv" : "Inaktiv"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({ id: rule.id, is_active: checked })
                          }
                        />
                        <Button variant="ghost" size="icon" onClick={() => openEdit(rule)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRule ? "Rediger regel" : "Ny rabataftale"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Lokationstype</Label>
              <Input
                value={formData.location_type}
                onChange={(e) => setFormData((p) => ({ ...p, location_type: e.target.value }))}
                placeholder="Fx Danske Shoppingcentre"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Min. placeringer</Label>
                <Input
                  type="number"
                  value={formData.min_placements}
                  onChange={(e) => setFormData((p) => ({ ...p, min_placements: e.target.value }))}
                  placeholder="11"
                />
              </div>
              <div>
                <Label>Rabat %</Label>
                <Input
                  type="number"
                  value={formData.discount_percent}
                  onChange={(e) => setFormData((p) => ({ ...p, discount_percent: e.target.value }))}
                  placeholder="10"
                />
              </div>
            </div>
            <div>
              <Label>Beskrivelse</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                placeholder="Beskrivelse af aftalen"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuller
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Gemmer..." : editingRule ? "Opdater" : "Opret"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
