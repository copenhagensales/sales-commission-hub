import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWeekExpectations, useUpdateWeekExpectation, WeekExpectation } from "@/hooks/useWeekExpectations";
import { Pencil, X, Plus } from "lucide-react";
import { toast } from "sonner";

export function WeekExpectationsEditor() {
  const { data: weeks = [], isLoading } = useWeekExpectations();
  const updateWeek = useUpdateWeekExpectation();
  const [editingWeek, setEditingWeek] = useState<WeekExpectation | null>(null);

  if (isLoading) {
    return <div className="text-muted-foreground">Indlæser...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Ugeforventninger</CardTitle>
        <CardDescription>Rediger forventninger for hver onboarding-uge</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {weeks.map((week) => (
          <div
            key={week.id}
            className="flex items-center justify-between p-4 rounded-lg border"
            style={{ borderLeftColor: week.color, borderLeftWidth: 4 }}
          >
            <div>
              <p className="font-medium">{week.title}</p>
              <p className="text-sm text-muted-foreground">{week.good_day_definition}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setEditingWeek(week)}>
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={!!editingWeek} onOpenChange={(open) => !open && setEditingWeek(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rediger {editingWeek?.title}</DialogTitle>
          </DialogHeader>
          {editingWeek && (
            <WeekEditForm
              week={editingWeek}
              onSave={async (updates) => {
                await updateWeek.mutateAsync({ id: editingWeek.id, updates });
                toast.success("Uge opdateret");
                setEditingWeek(null);
              }}
              onCancel={() => setEditingWeek(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

interface WeekEditFormProps {
  week: WeekExpectation;
  onSave: (updates: Partial<WeekExpectation>) => Promise<void>;
  onCancel: () => void;
}

function WeekEditForm({ week, onSave, onCancel }: WeekEditFormProps) {
  const [formData, setFormData] = useState({
    title: week.title,
    color: week.color,
    good_day_definition: week.good_day_definition,
    note: week.note || "",
    daily_message: week.daily_message,
    progression_text: week.progression_text,
    we_expect: week.we_expect,
    we_dont_expect: week.we_dont_expect,
    good_week_criteria: week.good_week_criteria,
    measure_on: week.measure_on,
    do_not_measure_on: week.do_not_measure_on,
  });
  const [saving, setSaving] = useState(false);

  const handleArrayChange = (field: keyof typeof formData, index: number, value: string) => {
    const arr = [...(formData[field] as string[])];
    arr[index] = value;
    setFormData({ ...formData, [field]: arr });
  };

  const handleArrayAdd = (field: keyof typeof formData) => {
    setFormData({ ...formData, [field]: [...(formData[field] as string[]), ""] });
  };

  const handleArrayRemove = (field: keyof typeof formData, index: number) => {
    const arr = [...(formData[field] as string[])];
    arr.splice(index, 1);
    setFormData({ ...formData, [field]: arr });
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Titel</Label>
          <Input
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Farve</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              className="w-14 h-10 p-1"
            />
            <Input
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              className="flex-1"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>God dag definition</Label>
        <Textarea
          value={formData.good_day_definition}
          onChange={(e) => setFormData({ ...formData, good_day_definition: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Daglig besked</Label>
        <Textarea
          value={formData.daily_message}
          onChange={(e) => setFormData({ ...formData, daily_message: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Progressions-tekst</Label>
        <Textarea
          value={formData.progression_text}
          onChange={(e) => setFormData({ ...formData, progression_text: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Note (vigtigt)</Label>
        <Textarea
          value={formData.note}
          onChange={(e) => setFormData({ ...formData, note: e.target.value })}
        />
      </div>

      <ArrayEditor
        label="Det forventer vi"
        items={formData.we_expect}
        onChange={(index, value) => handleArrayChange("we_expect", index, value)}
        onAdd={() => handleArrayAdd("we_expect")}
        onRemove={(index) => handleArrayRemove("we_expect", index)}
      />

      <ArrayEditor
        label="Det forventer vi ikke"
        items={formData.we_dont_expect}
        onChange={(index, value) => handleArrayChange("we_dont_expect", index, value)}
        onAdd={() => handleArrayAdd("we_dont_expect")}
        onRemove={(index) => handleArrayRemove("we_dont_expect", index)}
      />

      <ArrayEditor
        label="Kriterier for god uge"
        items={formData.good_week_criteria}
        onChange={(index, value) => handleArrayChange("good_week_criteria", index, value)}
        onAdd={() => handleArrayAdd("good_week_criteria")}
        onRemove={(index) => handleArrayRemove("good_week_criteria", index)}
      />

      <ArrayEditor
        label="Vi måler på"
        items={formData.measure_on}
        onChange={(index, value) => handleArrayChange("measure_on", index, value)}
        onAdd={() => handleArrayAdd("measure_on")}
        onRemove={(index) => handleArrayRemove("measure_on", index)}
      />

      <ArrayEditor
        label="Vi måler IKKE på"
        items={formData.do_not_measure_on}
        onChange={(index, value) => handleArrayChange("do_not_measure_on", index, value)}
        onAdd={() => handleArrayAdd("do_not_measure_on")}
        onRemove={(index) => handleArrayRemove("do_not_measure_on", index)}
      />

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>Annuller</Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? "Gemmer..." : "Gem ændringer"}
        </Button>
      </div>
    </div>
  );
}

interface ArrayEditorProps {
  label: string;
  items: string[];
  onChange: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

function ArrayEditor({ label, items, onChange, onAdd, onRemove }: ArrayEditorProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-2">
            <Input
              value={item}
              onChange={(e) => onChange(idx, e.target.value)}
              className="flex-1"
            />
            <Button variant="ghost" size="icon" onClick={() => onRemove(idx)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="h-4 w-4 mr-1" />
          Tilføj
        </Button>
      </div>
    </div>
  );
}
