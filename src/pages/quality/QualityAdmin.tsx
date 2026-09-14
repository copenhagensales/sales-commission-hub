import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useCreateChecklistVersion,
  useQualityAccess,
  useQualityChecklistsAdmin,
  useQualityControllers,
  useQualityErrorCodes,
  useQualityReviewerStats,
  useQualitySettings,
  useSetQualityController,
  useUpdateQualitySettings,
  useUpsertQualityErrorCode,
  type QualityItemType,
} from "@/hooks/useQualityControl";
import { defaultQualityDate } from "@/lib/qualityDates";

interface DraftItem {
  label: string;
  guidance: string | null;
  item_type: QualityItemType;
  sort_order: number;
  is_active: boolean;
}

export default function QualityAdmin() {
  const { toast } = useToast();
  const { isSuperadmin, isLoading: accessLoading } = useQualityAccess();

  const { data: settings } = useQualitySettings();
  const { data: controllers } = useQualityControllers();
  const { data: errorCodes } = useQualityErrorCodes();
  const { data: checklistData, isLoading: checklistsLoading } = useQualityChecklistsAdmin();
  const reviewerStats = useQualityReviewerStats(defaultQualityDate(), isSuperadmin);

  const updateSettings = useUpdateQualitySettings();
  const setController = useSetQualityController();
  const upsertCode = useUpsertQualityErrorCode();
  const createVersion = useCreateChecklistVersion();

  const [goalInput, setGoalInput] = useState<string>("");
  const [newCode, setNewCode] = useState({ code: "", label: "", item_type: "obligatorisk" as QualityItemType });
  const [selectedChecklistId, setSelectedChecklistId] = useState<string>("");
  const [draftItems, setDraftItems] = useState<DraftItem[] | null>(null);

  const { data: employees } = useQualityAdminEmployees(isSuperadmin);

  const activeChecklists = useMemo(
    () => (checklistData?.lists ?? []).filter((l) => l.is_active),
    [checklistData],
  );

  const selectedChecklist = activeChecklists.find((l) => l.id === selectedChecklistId);
  const selectedItems = (checklistData?.items ?? []).filter(
    (i) => i.checklist_id === selectedChecklistId,
  );

  const campaignName = (id: string | null) =>
    id
      ? checklistData?.campaigns.find((c) => c.id === id)?.name ?? "Ukendt kampagne"
      : "Generel tjekliste (fallback)";

  const startEditing = (checklistId: string) => {
    setSelectedChecklistId(checklistId);
    const items = (checklistData?.items ?? [])
      .filter((i) => i.checklist_id === checklistId)
      .map((i) => ({
        label: i.label,
        guidance: i.guidance,
        item_type: i.item_type,
        sort_order: i.sort_order,
        is_active: i.is_active,
      }));
    setDraftItems(items);
  };

  const saveNewVersion = async () => {
    if (!selectedChecklist || !draftItems) return;
    try {
      await createVersion.mutateAsync({
        previousChecklistId: selectedChecklist.id,
        clientCampaignId: selectedChecklist.client_campaign_id,
        name: selectedChecklist.name,
        items: draftItems.map((item, index) => ({ ...item, sort_order: index + 1 })),
      });
      toast({
        title: "Ny version oprettet",
        description: "Tidligere kontroller peger fortsat på deres egen version.",
      });
      setDraftItems(null);
      setSelectedChecklistId("");
    } catch (error) {
      toast({
        title: "Kunne ikke oprette ny version",
        description: error instanceof Error ? error.message : "Ukendt fejl",
        variant: "destructive",
      });
    }
  };

  const saveGoal = async () => {
    if (!settings) return;
    const value = Number(goalInput);
    if (!Number.isFinite(value) || value <= 0) {
      toast({ title: "Angiv et dagsmål større end 0", variant: "destructive" });
      return;
    }
    await updateSettings.mutateAsync({ id: settings.id, daily_goal: Math.round(value) });
    toast({ title: "Dagsmål gemt" });
  };

  const addCode = async () => {
    if (!newCode.code.trim() || !newCode.label.trim()) {
      toast({ title: "Kode og tekst skal udfyldes", variant: "destructive" });
      return;
    }
    await upsertCode.mutateAsync({
      code: newCode.code.trim(),
      label: newCode.label.trim(),
      item_type: newCode.item_type,
      is_active: true,
      sort_order: (errorCodes?.length ?? 0) + 1,
    });
    setNewCode({ code: "", label: "", item_type: "obligatorisk" });
    toast({ title: "Fejlkode oprettet" });
  };

  if (accessLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSuperadmin) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Ingen adgang</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Administration af kvalitetsmodulet er forbeholdt superadmin.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const employeeName = (id: string) => {
    const e = employees?.find((x) => x.id === id);
    return e ? `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim() : id;
  };

  const formatSecs = (secs: number | null) =>
    secs === null ? "–" : `${Math.round(secs / 6) / 10} min`.replace(".", ",");

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Kvalitetskontrol · administration</h1>
        <p className="text-sm text-muted-foreground">
          Kontrollanter, tjeklister, fejlkoder og dagsmål. Kvalitetsresultater påvirker ikke løn,
          provision eller annulleringer.
        </p>
      </div>

      <Tabs defaultValue="controllers">
        <TabsList className="flex-wrap">
          <TabsTrigger value="controllers">Kontrollanter</TabsTrigger>
          <TabsTrigger value="checklists">Tjeklister</TabsTrigger>
          <TabsTrigger value="codes">Fejlkoder</TabsTrigger>
          <TabsTrigger value="stats">Kontrollanternes tal</TabsTrigger>
        </TabsList>

        <TabsContent value="controllers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dagsmål</CardTitle>
              <CardDescription>Antal kontroller pr. dag pr. kontrollant.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="daily-goal">Dagsmål</Label>
                <Input
                  id="daily-goal"
                  type="number"
                  min={1}
                  className="w-32"
                  value={goalInput || String(settings?.daily_goal ?? 40)}
                  onChange={(e) => setGoalInput(e.target.value)}
                />
              </div>
              <Button onClick={saveGoal} disabled={updateSettings.isPending}>
                <Save className="mr-2 h-4 w-4" />
                Gem
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Kvalitetskontrollanter</CardTitle>
              <CardDescription>
                Kun tildelte kontrollanter og superadmin kan registrere kontroller.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {(controllers ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Ingen er tildelt rollen endnu. Vælg en medarbejder nedenfor.
                  </p>
                )}
                {(controllers ?? []).map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div>
                      <div className="text-sm font-medium">{employeeName(c.employee_id)}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.is_active ? "Aktiv" : "Inaktiv"}
                      </div>
                    </div>
                    <Switch
                      checked={c.is_active}
                      onCheckedChange={(checked) =>
                        setController.mutate({ employee_id: c.employee_id, is_active: checked })
                      }
                    />
                  </div>
                ))}
              </div>

              <Separator />

              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label>Tilføj kontrollant</Label>
                  <Select
                    onValueChange={(value) =>
                      setController.mutate(
                        { employee_id: value, is_active: true },
                        { onSuccess: () => toast({ title: "Kontrollant tilføjet" }) },
                      )
                    }
                  >
                    <SelectTrigger className="w-[280px]">
                      <SelectValue placeholder="Vælg medarbejder" />
                    </SelectTrigger>
                    <SelectContent>
                      {(employees ?? []).map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {`${e.first_name ?? ""} ${e.last_name ?? ""}`.trim()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="checklists" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Aktive tjeklister</CardTitle>
              <CardDescription>
                En ændring opretter en ny version. Gamle kontroller beholder deres egen version.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {checklistsLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kampagne</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Gyldig fra</TableHead>
                      <TableHead>Punkter</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeChecklists.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>{campaignName(l.client_campaign_id)}</TableCell>
                        <TableCell>v{l.version}</TableCell>
                        <TableCell>{l.valid_from}</TableCell>
                        <TableCell>
                          {(checklistData?.items ?? []).filter((i) => i.checklist_id === l.id).length}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => startEditing(l.id)}>
                            Redigér
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {selectedChecklist && draftItems && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Ny version af {campaignName(selectedChecklist.client_campaign_id)}
                </CardTitle>
                <CardDescription>
                  Gemmes som version {selectedChecklist.version + 1}. Nuværende version deaktiveres.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {draftItems.map((item, index) => (
                  <div key={index} className="space-y-2 rounded-md border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        value={item.label}
                        onChange={(e) =>
                          setDraftItems((prev) =>
                            prev!.map((it, i) => (i === index ? { ...it, label: e.target.value } : it)),
                          )
                        }
                        className="min-w-[240px] flex-1"
                      />
                      <Select
                        value={item.item_type}
                        onValueChange={(value) =>
                          setDraftItems((prev) =>
                            prev!.map((it, i) =>
                              i === index ? { ...it, item_type: value as QualityItemType } : it,
                            ),
                          )
                        }
                      >
                        <SelectTrigger className="w-[170px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="obligatorisk">Obligatorisk</SelectItem>
                          <SelectItem value="kvalitet">Kvalitet</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setDraftItems((prev) => prev!.filter((_, i) => i !== index))
                        }
                      >
                        Fjern
                      </Button>
                    </div>
                    <Input
                      value={item.guidance ?? ""}
                      placeholder="Vejledningstekst"
                      onChange={(e) =>
                        setDraftItems((prev) =>
                          prev!.map((it, i) =>
                            i === index ? { ...it, guidance: e.target.value || null } : it,
                          ),
                        )
                      }
                    />
                  </div>
                ))}

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setDraftItems((prev) => [
                        ...prev!,
                        {
                          label: "",
                          guidance: null,
                          item_type: "kvalitet",
                          sort_order: prev!.length + 1,
                          is_active: true,
                        },
                      ])
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Tilføj punkt
                  </Button>
                  <Button
                    onClick={saveNewVersion}
                    disabled={createVersion.isPending || draftItems.some((i) => !i.label.trim())}
                  >
                    {createVersion.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Gem som ny version
                  </Button>
                  <Button variant="ghost" onClick={() => setDraftItems(null)}>
                    Annullér
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {selectedChecklistId && !draftItems && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Punkter</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {selectedItems.map((i) => (
                  <div key={i.id} className="flex items-center gap-2 text-sm">
                    <Badge variant={i.item_type === "obligatorisk" ? "default" : "secondary"}>
                      {i.item_type === "obligatorisk" ? "Obligatorisk" : "Kvalitet"}
                    </Badge>
                    {i.label}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="codes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fejlkoder</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kode</TableHead>
                    <TableHead>Tekst</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Aktiv</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(errorCodes ?? []).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.code}</TableCell>
                      <TableCell>{c.label}</TableCell>
                      <TableCell>
                        {c.item_type === "obligatorisk" ? "Obligatorisk" : "Kvalitet"}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={c.is_active}
                          onCheckedChange={(checked) =>
                            upsertCode.mutate({
                              id: c.id,
                              code: c.code,
                              label: c.label,
                              item_type: c.item_type,
                              is_active: checked,
                              sort_order: c.sort_order,
                            })
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Separator />

              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label>Kode</Label>
                  <Input
                    className="w-40"
                    value={newCode.code}
                    onChange={(e) => setNewCode((p) => ({ ...p, code: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Tekst</Label>
                  <Input
                    className="w-72"
                    value={newCode.label}
                    onChange={(e) => setNewCode((p) => ({ ...p, label: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Type</Label>
                  <Select
                    value={newCode.item_type}
                    onValueChange={(value) =>
                      setNewCode((p) => ({ ...p, item_type: value as QualityItemType }))
                    }
                  >
                    <SelectTrigger className="w-[170px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="obligatorisk">Obligatorisk</SelectItem>
                      <SelectItem value="kvalitet">Kvalitet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={addCode} disabled={upsertCode.isPending}>
                  <Plus className="mr-2 h-4 w-4" />
                  Tilføj
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pr. kontrollant</CardTitle>
              <CardDescription>Kontroller i dag og gennemsnitlig tid pr. kontrol.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kontrollant</TableHead>
                    <TableHead className="text-right">I dag</TableHead>
                    <TableHead className="text-right">Tid i dag</TableHead>
                    <TableHead className="text-right">Tid 30 dage</TableHead>
                    <TableHead className="text-right">30 dage i alt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(reviewerStats.data?.reviewers ?? []).map((r) => (
                    <TableRow key={r.employee_id}>
                      <TableCell>{r.name ?? "Ukendt"}</TableCell>
                      <TableCell className="text-right">{r.today_count}</TableCell>
                      <TableCell className="text-right">{formatSecs(r.avg_secs_today)}</TableCell>
                      <TableCell className="text-right">{formatSecs(r.avg_secs_30d)}</TableCell>
                      <TableCell className="text-right">{r.count_30d}</TableCell>
                    </TableRow>
                  ))}
                  {(reviewerStats.data?.reviewers ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-sm text-muted-foreground">
                        Ingen kontroller registreret endnu.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
