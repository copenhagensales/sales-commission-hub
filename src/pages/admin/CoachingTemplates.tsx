import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  useFeedbackTypes, 
  useObjections, 
  useCoachingTemplates, 
  useUpdateCoachingTemplate,
  useCreateCoachingTemplate,
  useDeleteCoachingTemplate,
  CoachingTemplate 
} from "@/hooks/useCoachingTemplates";
import { useOnboardingDrills } from "@/hooks/useOnboarding";
import { Plus, Pencil, Copy, Trash2, FileText, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

export default function CoachingTemplates() {
  const { data: feedbackTypes = [] } = useFeedbackTypes();
  const { data: objections = [] } = useObjections();
  const { data: templates = [], isLoading } = useCoachingTemplates({ activeOnly: false });
  const { data: drills = [] } = useOnboardingDrills();
  
  const updateTemplate = useUpdateCoachingTemplate();
  const createTemplate = useCreateCoachingTemplate();
  const deleteTemplate = useDeleteCoachingTemplate();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterActive, setFilterActive] = useState<string>("all");
  
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<CoachingTemplate> | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Filter templates
  const filteredTemplates = templates.filter(t => {
    if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterType !== "all" && t.type_key !== filterType) return false;
    if (filterActive === "active" && !t.is_active) return false;
    if (filterActive === "inactive" && t.is_active) return false;
    return true;
  });

  const getTypeName = (key: string) => feedbackTypes.find(t => t.key === key)?.label_da || key;
  const getObjectionName = (key: string | null) => key ? (objections.find(o => o.key === key)?.label_da || key) : null;

  const handleOpenCreate = () => {
    setIsCreating(true);
    setEditingTemplate({
      is_active: true,
      type_key: "",
      title: "",
      objection_key: null,
      variant: "Standard",
      default_score: null,
      strength_default: "",
      next_rep_default: "",
      say_this_default: "",
      success_criteria_default: "",
      drill_id: null,
      reps_default: 5,
      tags: [],
    });
    setShowEditDialog(true);
  };

  const handleOpenEdit = (template: CoachingTemplate) => {
    setIsCreating(false);
    setEditingTemplate({ ...template });
    setShowEditDialog(true);
  };

  const handleDuplicate = (template: CoachingTemplate) => {
    setIsCreating(true);
    setEditingTemplate({
      ...template,
      id: undefined,
      title: `${template.title} (Kopi)`,
    });
    setShowEditDialog(true);
  };

  const handleSave = async () => {
    if (!editingTemplate || !editingTemplate.type_key || !editingTemplate.title || !editingTemplate.strength_default || !editingTemplate.next_rep_default) {
      toast.error("Udfyld alle påkrævede felter");
      return;
    }

    if (isCreating) {
      await createTemplate.mutateAsync({
        is_active: editingTemplate.is_active ?? true,
        type_key: editingTemplate.type_key,
        title: editingTemplate.title,
        objection_key: editingTemplate.objection_key || null,
        variant: editingTemplate.variant || "Standard",
        default_score: editingTemplate.default_score ?? null,
        strength_default: editingTemplate.strength_default,
        next_rep_default: editingTemplate.next_rep_default,
        say_this_default: editingTemplate.say_this_default || null,
        success_criteria_default: editingTemplate.success_criteria_default || null,
        drill_id: editingTemplate.drill_id || null,
        reps_default: editingTemplate.reps_default ?? 5,
        tags: editingTemplate.tags || [],
      });
    } else if (editingTemplate.id) {
      await updateTemplate.mutateAsync({
        id: editingTemplate.id,
        updates: {
          is_active: editingTemplate.is_active,
          type_key: editingTemplate.type_key,
          title: editingTemplate.title,
          objection_key: editingTemplate.objection_key || null,
          variant: editingTemplate.variant,
          default_score: editingTemplate.default_score,
          strength_default: editingTemplate.strength_default,
          next_rep_default: editingTemplate.next_rep_default,
          say_this_default: editingTemplate.say_this_default,
          success_criteria_default: editingTemplate.success_criteria_default,
          drill_id: editingTemplate.drill_id,
          reps_default: editingTemplate.reps_default,
          tags: editingTemplate.tags,
        },
      });
    }

    setShowEditDialog(false);
    setEditingTemplate(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Er du sikker på du vil slette denne skabelon?")) return;
    await deleteTemplate.mutateAsync(id);
  };

  const handleToggleActive = async (template: CoachingTemplate) => {
    await updateTemplate.mutateAsync({
      id: template.id,
      updates: { is_active: !template.is_active },
    });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Coaching Skabeloner
            </h1>
            <p className="text-muted-foreground">
              Administrer feedback-skabeloner til coaching
            </p>
          </div>
          <Button onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Ny Skabelon
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Søg i skabeloner..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Alle typer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle typer</SelectItem>
                  {feedbackTypes.map(type => (
                    <SelectItem key={type.key} value={type.key}>
                      {type.label_da}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterActive} onValueChange={setFilterActive}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Alle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="active">Aktive</SelectItem>
                  <SelectItem value="inactive">Inaktive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Templates Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titel</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Indvending</TableHead>
                    <TableHead>Variant</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Aktiv</TableHead>
                    <TableHead className="text-right">Handlinger</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTemplates.map(template => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getTypeName(template.type_key)}</Badge>
                      </TableCell>
                      <TableCell>
                        {getObjectionName(template.objection_key) || "-"}
                      </TableCell>
                      <TableCell>{template.variant}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {template.tags.map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={template.is_active}
                          onCheckedChange={() => handleToggleActive(template)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(template)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDuplicate(template)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(template.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredTemplates.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Ingen skabeloner fundet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit/Create Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isCreating ? "Opret Skabelon" : "Rediger Skabelon"}</DialogTitle>
            </DialogHeader>

            {editingTemplate && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Type *</Label>
                    <Select
                      value={editingTemplate.type_key || ""}
                      onValueChange={v => setEditingTemplate(t => t ? { ...t, type_key: v, objection_key: v !== "indvending" ? null : t.objection_key } : null)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Vælg type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {feedbackTypes.map(type => (
                          <SelectItem key={type.key} value={type.key}>
                            {type.label_da}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {editingTemplate.type_key === "indvending" && (
                    <div>
                      <Label>Indvending</Label>
                      <Select
                        value={editingTemplate.objection_key || ""}
                        onValueChange={v => setEditingTemplate(t => t ? { ...t, objection_key: v || null } : null)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Vælg indvending..." />
                        </SelectTrigger>
                        <SelectContent>
                          {objections.map(obj => (
                            <SelectItem key={obj.key} value={obj.key}>
                              {obj.label_da}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Titel *</Label>
                    <Input
                      value={editingTemplate.title || ""}
                      onChange={e => setEditingTemplate(t => t ? { ...t, title: e.target.value } : null)}
                      placeholder="Skabelonens titel..."
                    />
                  </div>
                  <div>
                    <Label>Variant</Label>
                    <Input
                      value={editingTemplate.variant || "Standard"}
                      onChange={e => setEditingTemplate(t => t ? { ...t, variant: e.target.value } : null)}
                      placeholder="fx Standard, Rookie, Kort..."
                    />
                  </div>
                </div>

                <div>
                  <Label>Standard Score</Label>
                  <Select
                    value={editingTemplate.default_score?.toString() || ""}
                    onValueChange={v => setEditingTemplate(t => t ? { ...t, default_score: v ? parseInt(v) : null } : null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Ingen standard" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Ingen standard</SelectItem>
                      <SelectItem value="0">0 - Skal forbedres</SelectItem>
                      <SelectItem value="1">1 - Godkendt</SelectItem>
                      <SelectItem value="2">2 - Stærk præstation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Styrke (standard) *</Label>
                  <Textarea
                    value={editingTemplate.strength_default || ""}
                    onChange={e => setEditingTemplate(t => t ? { ...t, strength_default: e.target.value } : null)}
                    placeholder="Standard styrke-tekst..."
                    rows={2}
                  />
                </div>

                <div>
                  <Label>Næste Rep (standard) *</Label>
                  <Textarea
                    value={editingTemplate.next_rep_default || ""}
                    onChange={e => setEditingTemplate(t => t ? { ...t, next_rep_default: e.target.value } : null)}
                    placeholder="Standard forbedring-tekst..."
                    rows={2}
                  />
                </div>

                <div>
                  <Label>"Sig denne sætning" (standard)</Label>
                  <Textarea
                    value={editingTemplate.say_this_default || ""}
                    onChange={e => setEditingTemplate(t => t ? { ...t, say_this_default: e.target.value } : null)}
                    placeholder="Standard forslag til sætning..."
                    rows={2}
                  />
                </div>

                <div>
                  <Label>Success-kriterie (standard)</Label>
                  <Input
                    value={editingTemplate.success_criteria_default || ""}
                    onChange={e => setEditingTemplate(t => t ? { ...t, success_criteria_default: e.target.value } : null)}
                    placeholder="Det er lykkedes når..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Drill</Label>
                    <Select
                      value={editingTemplate.drill_id || ""}
                      onValueChange={v => setEditingTemplate(t => t ? { ...t, drill_id: v || null } : null)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Vælg drill..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Ingen drill</SelectItem>
                        {drills.map(drill => (
                          <SelectItem key={drill.id} value={drill.id}>
                            {drill.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Reps (standard)</Label>
                    <Input
                      type="number"
                      value={editingTemplate.reps_default ?? 5}
                      onChange={e => setEditingTemplate(t => t ? { ...t, reps_default: parseInt(e.target.value) || 5 } : null)}
                      min={1}
                    />
                  </div>
                </div>

                <div>
                  <Label>Tags (kommasepareret)</Label>
                  <Input
                    value={(editingTemplate.tags || []).join(", ")}
                    onChange={e => setEditingTemplate(t => t ? { ...t, tags: e.target.value.split(",").map(s => s.trim()).filter(Boolean) } : null)}
                    placeholder="fx Top12, Onboarding Uge2..."
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingTemplate.is_active ?? true}
                    onCheckedChange={v => setEditingTemplate(t => t ? { ...t, is_active: v } : null)}
                  />
                  <Label>Aktiv</Label>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Annuller
              </Button>
              <Button onClick={handleSave} disabled={createTemplate.isPending || updateTemplate.isPending}>
                {(createTemplate.isPending || updateTemplate.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {isCreating ? "Opret" : "Gem"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
