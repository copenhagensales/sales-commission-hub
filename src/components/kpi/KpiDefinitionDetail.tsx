import { useState } from "react";
import { KpiDefinition, useUpdateKpiDefinition, useDeleteKpiDefinition } from "@/hooks/useKpiDefinitions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Edit2, Save, X, Trash2, AlertTriangle, Code, Database, FileText } from "lucide-react";
import { KpiLiveTest } from "./KpiLiveTest";

interface KpiDefinitionDetailProps {
  definition: KpiDefinition;
  onClose: () => void;
}

export function KpiDefinitionDetail({ definition, onClose }: KpiDefinitionDetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(definition);
  const updateMutation = useUpdateKpiDefinition();
  const deleteMutation = useDeleteKpiDefinition();

  const handleSave = async () => {
    await updateMutation.mutateAsync({
      id: definition.id,
      data: {
        name: editData.name,
        description: editData.description,
        calculation_formula: editData.calculation_formula,
        sql_query: editData.sql_query,
        data_sources: editData.data_sources,
        important_notes: editData.important_notes,
        example_value: editData.example_value,
      },
    });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(definition.id);
    onClose();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <Input
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                className="text-xl font-bold"
              />
            ) : (
              <h2 className="text-xl font-bold">{definition.name}</h2>
            )}
            <Badge variant="outline" className="font-mono">
              {definition.slug}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                <X className="h-4 w-4 mr-1" />
                Annuller
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                <Save className="h-4 w-4 mr-1" />
                Gem
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit2 className="h-4 w-4 mr-1" />
                Rediger
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Slet KPI-definition</AlertDialogTitle>
                    <AlertDialogDescription>
                      Er du sikker på, at du vil slette "{definition.name}"? Denne handling kan ikke fortrydes.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuller</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Slet</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {/* Description */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">Beskrivelse</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <Textarea
              value={editData.description || ""}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              placeholder="Beskriv hvad denne KPI måler..."
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {definition.description || "Ingen beskrivelse"}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Calculation formula */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">Beregningsformel</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <Textarea
              value={editData.calculation_formula || ""}
              onChange={(e) => setEditData({ ...editData, calculation_formula: e.target.value })}
              placeholder="Beskriv beregningslogikken..."
              className="font-mono text-sm"
            />
          ) : (
            <pre className="text-sm bg-muted p-3 rounded-lg overflow-x-auto font-mono">
              {definition.calculation_formula || "Ikke defineret"}
            </pre>
          )}
        </CardContent>
      </Card>

      {/* SQL Query */}
      {(definition.sql_query || isEditing) && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">SQL Query (reference)</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <Textarea
                value={editData.sql_query || ""}
                onChange={(e) => setEditData({ ...editData, sql_query: e.target.value })}
                placeholder="SELECT ... FROM ..."
                className="font-mono text-sm"
              />
            ) : (
              <pre className="text-sm bg-muted p-3 rounded-lg overflow-x-auto font-mono">
                {definition.sql_query}
              </pre>
            )}
          </CardContent>
        </Card>
      )}

      {/* Data sources */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Datakilder</CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Kommasepareret liste af tabeller
              </Label>
              <Input
                value={editData.data_sources?.join(", ") || ""}
                onChange={(e) =>
                  setEditData({
                    ...editData,
                    data_sources: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  })
                }
                placeholder="sales, sale_items, products"
              />
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {definition.data_sources?.map((source) => (
                <Badge key={source} variant="secondary" className="font-mono">
                  {source}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Important notes */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-sm">Vigtige noter</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Én note per linje
              </Label>
              <Textarea
                value={editData.important_notes?.join("\n") || ""}
                onChange={(e) =>
                  setEditData({
                    ...editData,
                    important_notes: e.target.value.split("\n").filter(Boolean),
                  })
                }
                placeholder="Vigtige kanttilfælde..."
                rows={4}
              />
            </div>
          ) : (
            <ul className="list-disc list-inside space-y-1">
              {definition.important_notes?.map((note, i) => (
                <li key={i} className="text-sm text-muted-foreground">
                  {note}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Example value */}
      {(definition.example_value || isEditing) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Eksempelværdi</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <Input
                value={editData.example_value || ""}
                onChange={(e) => setEditData({ ...editData, example_value: e.target.value })}
                placeholder="f.eks. 127 salg"
              />
            ) : (
              <Badge variant="outline" className="text-lg">
                {definition.example_value}
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      {/* Live test */}
      {!isEditing && (
        <KpiLiveTest slug={definition.slug} name={definition.name} />
      )}
    </div>
  );
}
