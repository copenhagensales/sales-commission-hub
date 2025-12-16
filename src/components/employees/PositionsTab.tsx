import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Shield } from "lucide-react";
import { Json } from "@/integrations/supabase/types";

interface Permission {
  key: string;
  label: string;
  description: string;
}

const AVAILABLE_PERMISSIONS: Permission[] = [
  { key: "can_see_own_revenue", label: "Se egen omsætning", description: "Kan se omsætningstal for eget team" },
  { key: "can_see_other_teams_revenue", label: "Se andre teams omsætning", description: "Kan se omsætningstal for andre teams" },
  { key: "can_manage_employees", label: "Administrere medarbejdere", description: "Kan oprette og redigere medarbejdere" },
  { key: "can_manage_teams", label: "Administrere teams", description: "Kan oprette og redigere teams" },
  { key: "can_manage_contracts", label: "Administrere kontrakter", description: "Kan sende og administrere kontrakter" },
  { key: "can_view_all_data", label: "Se alle data", description: "Har adgang til alle data i systemet" },
];

interface JobPosition {
  id: string;
  name: string;
  description: string | null;
  permissions: Record<string, boolean>;
  is_active: boolean;
  created_at: string;
}

interface FormData {
  name: string;
  description: string;
  permissions: Record<string, boolean>;
}

export function PositionsTab() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<JobPosition | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    description: "",
    permissions: {},
  });

  // Fetch positions
  const { data: positions = [], isLoading } = useQuery({
    queryKey: ["job-positions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_positions")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data.map(p => ({
        ...p,
        permissions: (p.permissions as Record<string, boolean>) || {}
      })) as JobPosition[];
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase
        .from("job_positions")
        .insert({
          name: data.name,
          description: data.description || null,
          permissions: data.permissions as unknown as Json,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-positions"] });
      toast.success("Stilling oprettet");
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error("Fejl ved oprettelse: " + error.message);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      const { error } = await supabase
        .from("job_positions")
        .update({
          name: data.name,
          description: data.description || null,
          permissions: data.permissions as unknown as Json,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-positions"] });
      toast.success("Stilling opdateret");
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error("Fejl ved opdatering: " + error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("job_positions")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-positions"] });
      toast.success("Stilling slettet");
    },
    onError: (error: Error) => {
      toast.error("Fejl ved sletning: " + error.message);
    },
  });

  const handleOpenCreate = () => {
    setEditingPosition(null);
    setFormData({
      name: "",
      description: "",
      permissions: AVAILABLE_PERMISSIONS.reduce((acc, p) => ({ ...acc, [p.key]: false }), {}),
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (position: JobPosition) => {
    setEditingPosition(position);
    setFormData({
      name: position.name,
      description: position.description || "",
      permissions: position.permissions,
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingPosition(null);
    setFormData({ name: "", description: "", permissions: {} });
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error("Navn er påkrævet");
      return;
    }

    if (editingPosition) {
      updateMutation.mutate({ id: editingPosition.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handlePermissionChange = (key: string, value: boolean) => {
    setFormData({
      ...formData,
      permissions: { ...formData.permissions, [key]: value },
    });
  };

  const countActivePermissions = (permissions: Record<string, boolean>) => {
    return Object.values(permissions).filter(Boolean).length;
  };

  if (isLoading) {
    return <div className="p-4">Indlæser...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Stillinger</h2>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Opret stilling
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Navn</TableHead>
            <TableHead>Beskrivelse</TableHead>
            <TableHead>Rettigheder</TableHead>
            <TableHead className="w-[100px]">Handlinger</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Ingen stillinger oprettet endnu
              </TableCell>
            </TableRow>
          ) : (
            positions.map((position) => (
              <TableRow key={position.id}>
                <TableCell className="font-medium">{position.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {position.description || "-"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {countActivePermissions(position.permissions)} af {AVAILABLE_PERMISSIONS.length}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEdit(position)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm("Er du sikker på at du vil slette denne stilling?")) {
                          deleteMutation.mutate(position.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPosition ? "Rediger stilling" : "Opret stilling"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Navn *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="F.eks. Teamleder"
              />
            </div>

            <div className="space-y-2">
              <Label>Beskrivelse</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Kort beskrivelse af stillingen"
                rows={2}
              />
            </div>

            <div className="space-y-3">
              <Label className="text-base font-medium">Rettigheder</Label>
              <div className="space-y-3 border rounded-lg p-4">
                {AVAILABLE_PERMISSIONS.map((permission) => (
                  <div
                    key={permission.key}
                    className="flex items-center justify-between gap-4"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm">{permission.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {permission.description}
                      </div>
                    </div>
                    <Switch
                      checked={formData.permissions[permission.key] || false}
                      onCheckedChange={(checked) =>
                        handlePermissionChange(permission.key, checked)
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Annuller
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingPosition ? "Gem ændringer" : "Opret"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
