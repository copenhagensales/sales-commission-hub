import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Plus, Pencil, Percent, MapPin, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface DiscountRule {
  id: string;
  location_type: string;
  min_placements: number;
  discount_percent: number;
  description: string | null;
  is_active: boolean;
  discount_type: string;
  min_revenue: number | null;
  min_days_per_location: number;
}

interface LocationException {
  id: string;
  location_type: string;
  location_name: string;
  exception_type: string;
  max_discount_percent: number | null;
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
    discount_type: "placements" as string,
    min_revenue: "",
    min_days_per_location: "1",
  });

  // Exception state
  const [exceptionDialogOpen, setExceptionDialogOpen] = useState(false);
  const [editingException, setEditingException] = useState<LocationException | null>(null);
  const [exceptionForm, setExceptionForm] = useState({
    location_type: "",
    location_name: "",
    exception_type: "max_discount",
    max_discount_percent: "",
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

  const { data: exceptions } = useQuery({
    queryKey: ["all-location-exceptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_location_exceptions")
        .select("*")
        .order("location_type")
        .order("location_name");
      if (error) throw error;
      return data as LocationException[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        location_type: formData.location_type,
        discount_percent: parseFloat(formData.discount_percent),
        description: formData.description || null,
        discount_type: formData.discount_type,
        min_days_per_location: parseInt(formData.min_days_per_location) || 1,
      };

      if (formData.discount_type === "placements") {
        payload.min_placements = parseInt(formData.min_placements);
        payload.min_revenue = null;
      } else {
        // annual_revenue or monthly_revenue
        payload.min_placements = 0;
        payload.min_revenue = parseFloat(formData.min_revenue);
      }

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

  // Exception mutations
  const saveExceptionMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        location_type: exceptionForm.location_type,
        location_name: exceptionForm.location_name,
        exception_type: exceptionForm.exception_type,
        max_discount_percent: exceptionForm.exception_type === "max_discount"
          ? parseFloat(exceptionForm.max_discount_percent)
          : null,
      };

      if (editingException) {
        const { error } = await supabase
          .from("supplier_location_exceptions")
          .update(payload)
          .eq("id", editingException.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("supplier_location_exceptions")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingException ? "Undtagelse opdateret" : "Undtagelse oprettet");
      queryClient.invalidateQueries({ queryKey: ["all-location-exceptions"] });
      setExceptionDialogOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleExceptionMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("supplier_location_exceptions")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-location-exceptions"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const openCreate = () => {
    setEditingRule(null);
    setFormData({ location_type: "", min_placements: "", discount_percent: "", description: "", discount_type: "placements", min_revenue: "", min_days_per_location: "1" });
    setDialogOpen(true);
  };

  const openEdit = (rule: DiscountRule) => {
    setEditingRule(rule);
    setFormData({
      location_type: rule.location_type,
      min_placements: String(rule.min_placements),
      discount_percent: String(rule.discount_percent),
      description: rule.description || "",
      discount_type: rule.discount_type || "placements",
      min_revenue: rule.min_revenue != null ? String(rule.min_revenue) : "",
      min_days_per_location: String(rule.min_days_per_location ?? 1),
    });
    setDialogOpen(true);
  };

  const openCreateException = () => {
    setEditingException(null);
    setExceptionForm({ location_type: "", location_name: "", exception_type: "max_discount", max_discount_percent: "" });
    setExceptionDialogOpen(true);
  };

  const openEditException = (exc: LocationException) => {
    setEditingException(exc);
    setExceptionForm({
      location_type: exc.location_type,
      location_name: exc.location_name,
      exception_type: exc.exception_type,
      max_discount_percent: exc.max_discount_percent != null ? String(exc.max_discount_percent) : "",
    });
    setExceptionDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Discount Rules Section */}
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
                  <TableHead>Rabattype</TableHead>
                  <TableHead className="text-right">Tærskel</TableHead>
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
                    <TableCell>
                      <Badge variant="outline">
                        {rule.discount_type === "annual_revenue" ? "Årsomsætning" : rule.discount_type === "monthly_revenue" ? "Månedsomsætning" : "Placeringer"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {rule.discount_type === "annual_revenue" || rule.discount_type === "monthly_revenue"
                        ? `${(rule.min_revenue ?? 0).toLocaleString("da-DK")} kr`
                        : `${rule.min_placements} stk`}
                    </TableCell>
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

      {/* Location Exceptions Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Lokationsundtagelser</h2>
        </div>
        <Button onClick={openCreateException} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Tilføj undtagelse
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {!exceptions?.length ? (
            <p className="text-center text-muted-foreground py-8">Ingen undtagelser oprettet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lokationstype</TableHead>
                  <TableHead>Lokation</TableHead>
                  <TableHead>Undtagelsestype</TableHead>
                  <TableHead className="text-right">Max rabat %</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Handling</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exceptions.map((exc) => (
                  <TableRow key={exc.id}>
                    <TableCell className="font-medium">{exc.location_type}</TableCell>
                    <TableCell>{exc.location_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {exc.exception_type === "excluded" ? "Udelukket" : "Max rabat"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {exc.exception_type === "max_discount" ? `${exc.max_discount_percent}%` : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={exc.is_active ? "default" : "secondary"}>
                        {exc.is_active ? "Aktiv" : "Inaktiv"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Switch
                          checked={exc.is_active}
                          onCheckedChange={(checked) =>
                            toggleExceptionMutation.mutate({ id: exc.id, is_active: checked })
                          }
                        />
                        <Button variant="ghost" size="icon" onClick={() => openEditException(exc)}>
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

      {/* Rule Dialog */}
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
            <div>
              <Label>Rabattype</Label>
              <Select
                value={formData.discount_type}
                onValueChange={(v) => setFormData((p) => ({ ...p, discount_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="placements">Placeringer (antal/måned)</SelectItem>
                  <SelectItem value="annual_revenue">Årsomsætning (kr)</SelectItem>
                  <SelectItem value="monthly_revenue">Månedsomsætning (kr)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {formData.discount_type === "placements" ? (
                <div>
                  <Label>Min. placeringer</Label>
                  <Input
                    type="number"
                    value={formData.min_placements}
                    onChange={(e) => setFormData((p) => ({ ...p, min_placements: e.target.value }))}
                    placeholder="11"
                  />
                </div>
              ) : (
                <div>
                  <Label>{formData.discount_type === "monthly_revenue" ? "Min. månedsomsætning (kr)" : "Min. årsomsætning (kr)"}</Label>
                  <Input
                    type="number"
                    value={formData.min_revenue}
                    onChange={(e) => setFormData((p) => ({ ...p, min_revenue: e.target.value }))}
                    placeholder={formData.discount_type === "monthly_revenue" ? "100000" : "200000"}
                  />
                </div>
              )}
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
            {formData.discount_type === "placements" && (
              <div>
                <Label>Min. dage pr. lokation</Label>
                <Input
                  type="number"
                  value={formData.min_days_per_location}
                  onChange={(e) => setFormData((p) => ({ ...p, min_days_per_location: e.target.value }))}
                  placeholder="1"
                />
              </div>
            )}
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

      {/* Exception Dialog */}
      <Dialog open={exceptionDialogOpen} onOpenChange={setExceptionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingException ? "Rediger undtagelse" : "Ny lokationsundtagelse"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Lokationstype</Label>
              <Input
                value={exceptionForm.location_type}
                onChange={(e) => setExceptionForm((p) => ({ ...p, location_type: e.target.value }))}
                placeholder="Fx Ocean Outdoor"
              />
            </div>
            <div>
              <Label>Lokationsnavn</Label>
              <Input
                value={exceptionForm.location_name}
                onChange={(e) => setExceptionForm((p) => ({ ...p, location_name: e.target.value }))}
                placeholder="Fx Bruuns Galleri"
              />
            </div>
            <div>
              <Label>Undtagelsestype</Label>
              <Select
                value={exceptionForm.exception_type}
                onValueChange={(v) => setExceptionForm((p) => ({ ...p, exception_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="max_discount">Max rabat</SelectItem>
                  <SelectItem value="excluded">Udelukket (pris aftales separat)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {exceptionForm.exception_type === "max_discount" && (
              <div>
                <Label>Max rabat %</Label>
                <Input
                  type="number"
                  value={exceptionForm.max_discount_percent}
                  onChange={(e) => setExceptionForm((p) => ({ ...p, max_discount_percent: e.target.value }))}
                  placeholder="25"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExceptionDialogOpen(false)}>
              Annuller
            </Button>
            <Button onClick={() => saveExceptionMutation.mutate()} disabled={saveExceptionMutation.isPending}>
              {saveExceptionMutation.isPending ? "Gemmer..." : editingException ? "Opdater" : "Opret"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
