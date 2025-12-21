import { useState } from "react";
import { Plus, Trash2, TrendingUp, DollarSign, Phone, Users, Target, UserCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useKpiTypes, SUGGESTED_KPIS } from "@/hooks/useKpiTypes";

const getCategoryIcon = (category: string) => {
  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    "Salg": DollarSign,
    "Opkald": Phone,
    "Team": Users,
    "Leads": Target,
    "Kunder": UserCheck,
    "Produktivitet": TrendingUp,
  };
  const IconComponent = icons[category] || TrendingUp;
  return <IconComponent className="h-4 w-4" />;
};

const CATEGORIES = ["Salg", "Opkald", "Team", "Leads", "Kunder", "Produktivitet", "Andet"];

export const KpiSettingsTab = () => {
  const { toast } = useToast();
  const { kpiTypes, kpisByCategory, toggleKpiType, addCustomKpi, removeKpi } = useKpiTypes();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newKpi, setNewKpi] = useState({ id: "", name: "", description: "", category: "Salg" });

  const handleToggle = (id: string) => {
    const kpi = kpiTypes.find(k => k.id === id);
    toggleKpiType(id);
    toast({
      title: kpi?.isActive ? "KPI deaktiveret" : "KPI aktiveret",
      description: `${kpi?.name} er nu ${kpi?.isActive ? "deaktiveret" : "aktiveret"}.`,
    });
  };

  const handleAddKpi = () => {
    if (!newKpi.name.trim()) {
      toast({ title: "Indtast et navn", variant: "destructive" });
      return;
    }
    const id = newKpi.id || `custom-${Date.now()}`;
    addCustomKpi({ ...newKpi, id });
    toast({ title: "KPI tilføjet", description: `${newKpi.name} er nu tilgængelig.` });
    setNewKpi({ id: "", name: "", description: "", category: "Salg" });
    setIsAddDialogOpen(false);
  };

  const handleRemoveKpi = (id: string, name: string) => {
    removeKpi(id);
    toast({ title: "KPI fjernet", description: `${name} er blevet fjernet.` });
  };

  const activeCount = kpiTypes.filter(k => k.isActive).length;

  return (
    <div className="space-y-6">
      {/* Foreslåede KPI'er */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>KPI Typer</CardTitle>
              <CardDescription>
                Vælg hvilke KPI'er der kan bruges i Design Dashboard. {activeCount} aktive.
              </CardDescription>
            </div>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Tilføj egen KPI
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(kpisByCategory).map(([category, kpis]) => (
            <div key={category}>
              <div className="flex items-center gap-2 mb-3">
                {getCategoryIcon(category)}
                <h3 className="font-semibold text-sm">{category}</h3>
                <Badge variant="secondary" className="text-xs">
                  {kpis.filter(k => k.isActive).length}/{kpis.length}
                </Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {kpis.map((kpi) => (
                  <div
                    key={kpi.id}
                    className={`relative group p-3 border rounded-lg cursor-pointer transition-all ${
                      kpi.isActive 
                        ? "bg-primary/10 border-primary hover:bg-primary/20" 
                        : "bg-muted/30 border-muted opacity-60 hover:opacity-80"
                    }`}
                  >
                    <div onClick={() => handleToggle(kpi.id)} className="flex-1">
                      <p className={`font-medium text-sm ${kpi.isActive ? "" : "text-muted-foreground"}`}>
                        {kpi.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{kpi.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge 
                          variant={kpi.isActive ? "default" : "secondary"} 
                          className="text-xs"
                        >
                          {kpi.isActive ? "Aktiv" : "Inaktiv"}
                        </Badge>
                        {kpi.isSuggested && (
                          <Badge variant="outline" className="text-xs">Foreslået</Badge>
                        )}
                      </div>
                    </div>
                    {!kpi.isSuggested && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveKpi(kpi.id, kpi.name);
                        }}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Foreslåede KPI'er box */}
      <Card className="border-dashed border-primary/50 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Foreslåede KPI'er
          </CardTitle>
          <CardDescription>
            Her er nogle populære KPI'er du kan aktivere med et klik
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SUGGESTED_KPIS.filter(s => !kpiTypes.find(k => k.id === s.id)?.isActive).slice(0, 8).map((suggestion) => (
              <div
                key={suggestion.id}
                onClick={() => handleToggle(suggestion.id)}
                className="p-3 bg-background border rounded-lg cursor-pointer hover:border-primary transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  {getCategoryIcon(suggestion.category)}
                  <span className="text-xs text-muted-foreground">{suggestion.category}</span>
                </div>
                <p className="font-medium text-sm">{suggestion.name}</p>
                <p className="text-xs text-muted-foreground">{suggestion.description}</p>
                <Button variant="ghost" size="sm" className="w-full mt-2 h-7 text-xs">
                  <Plus className="h-3 w-3 mr-1" />
                  Aktiver
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Add Custom KPI Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tilføj egen KPI</DialogTitle>
            <DialogDescription>
              Opret en brugerdefineret KPI til dine dashboards
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Navn</Label>
              <Input
                placeholder="f.eks. 'Genforsikringer'"
                value={newKpi.name}
                onChange={(e) => setNewKpi(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Beskrivelse</Label>
              <Input
                placeholder="f.eks. 'Antal genforsikringer solgt'"
                value={newKpi.description}
                onChange={(e) => setNewKpi(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select value={newKpi.category} onValueChange={(v) => setNewKpi(prev => ({ ...prev, category: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Annuller</Button>
            <Button onClick={handleAddKpi}>Tilføj KPI</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
