import { useState } from "react";
import { useCreateKpiDefinition, KpiCategory } from "@/hooks/useKpiDefinitions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface KpiDefinitionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const categoryOptions: { value: KpiCategory; label: string }[] = [
  { value: "sales", label: "Salg" },
  { value: "hours", label: "Timer" },
  { value: "calls", label: "Opkald" },
  { value: "employees", label: "Medarbejdere" },
  { value: "other", label: "Andet" },
];

export function KpiDefinitionForm({ open, onOpenChange, onSuccess }: KpiDefinitionFormProps) {
  const createMutation = useCreateKpiDefinition();
  const [formData, setFormData] = useState({
    slug: "",
    name: "",
    category: "sales" as KpiCategory,
    description: "",
    calculation_formula: "",
    sql_query: "",
    data_sources: "",
    important_notes: "",
    example_value: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMutation.mutateAsync({
      slug: formData.slug,
      name: formData.name,
      category: formData.category,
      description: formData.description || null,
      calculation_formula: formData.calculation_formula || null,
      sql_query: formData.sql_query || null,
      data_sources: formData.data_sources.split(",").map((s) => s.trim()).filter(Boolean),
      important_notes: formData.important_notes.split("\n").filter(Boolean),
      example_value: formData.example_value || null,
      is_active: true,
      dashboard_slugs: [],
    });
    setFormData({
      slug: "",
      name: "",
      category: "sales",
      description: "",
      calculation_formula: "",
      sql_query: "",
      data_sources: "",
      important_notes: "",
      example_value: "",
    });
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Opret ny KPI-definition</DialogTitle>
          <DialogDescription>
            Tilføj en ny KPI-definition til dokumentationen.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Navn *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="f.eks. Antal salg"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                placeholder="f.eks. sales_count"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Kategori</Label>
            <Select
              value={formData.category}
              onValueChange={(v) => setFormData({ ...formData, category: v as KpiCategory })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Beskrivelse</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Beskriv hvad denne KPI måler..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="calculation_formula">Beregningsformel</Label>
            <Textarea
              id="calculation_formula"
              value={formData.calculation_formula}
              onChange={(e) => setFormData({ ...formData, calculation_formula: e.target.value })}
              placeholder="f.eks. SUM(sale_items.quantity) WHERE ..."
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sql_query">SQL Query (reference)</Label>
            <Textarea
              id="sql_query"
              value={formData.sql_query}
              onChange={(e) => setFormData({ ...formData, sql_query: e.target.value })}
              placeholder="SELECT ..."
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="data_sources">Datakilder (kommasepareret)</Label>
            <Input
              id="data_sources"
              value={formData.data_sources}
              onChange={(e) => setFormData({ ...formData, data_sources: e.target.value })}
              placeholder="sales, sale_items, products"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="important_notes">Vigtige noter (én per linje)</Label>
            <Textarea
              id="important_notes"
              value={formData.important_notes}
              onChange={(e) => setFormData({ ...formData, important_notes: e.target.value })}
              placeholder="Vigtige kanttilfælde og noter..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="example_value">Eksempelværdi</Label>
            <Input
              id="example_value"
              value={formData.example_value}
              onChange={(e) => setFormData({ ...formData, example_value: e.target.value })}
              placeholder="f.eks. 127 salg"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuller
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Opret KPI
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
