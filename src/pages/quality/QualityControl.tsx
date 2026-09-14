import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  Copy,
  Loader2,
  MessageSquare,
  Settings2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  QUALITY_RESULT_LABEL,
  useFinishQualityDay,
  useQualityAccess,
  useQualityChecklistResolver,
  useQualityDailyCompletion,
  useQualityErrorCodes,
  useQualityOverview,
  useQualityQueue,
  useQualityReviewerStats,
  useQualitySettings,
  useSaveQualityReview,
  useVoidQualityReview,
  type QualityItemState,
  type QualityQueueRow,
} from "@/hooks/useQualityControl";
import {
  datesForQualityDay,
  defaultQualityDate,
  formatDanishDate,
  formatDanishTime,
} from "@/lib/qualityDates";
import { QualityScorePanel } from "@/components/quality/QualityScorePanel";

type QualitySortKey =
  | "saelger"
  | "team"
  | "kampagne"
  | "tidspunkt"
  | "soegenoegle"
  | "status";

/** Sammenligningsværdi pr. kolonne. Kun til visning — ingen data ændres. */
function sortValue(row: QualityQueueRow, key: QualitySortKey): string {
  switch (key) {
    case "saelger":
      return row.seller_name ?? "";
    case "team":
      return row.team_name ?? "";
    case "kampagne":
      return (
        row.dialer_campaign_label ?? row.product_label ?? row.campaign_name ?? ""
      );
    case "tidspunkt":
      return row.sale_datetime ?? "";
    case "soegenoegle":
      return row.search_key ?? "";
    case "status":
      return QUALITY_RESULT_LABEL[row.status] ?? row.status ?? "";
  }
}



export default function QualityControl() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasAccess, isController, isSuperadmin, isLoading: accessLoading } = useQualityAccess();

  const [date, setDate] = useState(defaultQualityDate());
  const [activeTeam, setActiveTeam] = useState<string>("all");
  const [commentRow, setCommentRow] = useState<QualityQueueRow | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentCodeId, setCommentCodeId] = useState("");
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [quickSavingId, setQuickSavingId] = useState<string | null>(null);

  const dates = useMemo(() => datesForQualityDay(date), [date]);
  const queue = useQualityQueue(dates, hasAccess);
  const overview = useQualityOverview(date, hasAccess);
  const reviewerStats = useQualityReviewerStats(date, isController || isSuperadmin);
  const { data: settings } = useQualitySettings();
  const { data: completion } = useQualityDailyCompletion(date);
  const finishDay = useFinishQualityDay();
  const saveReview = useSaveQualityReview();
  const voidReview = useVoidQualityReview();
  const { resolve: resolveChecklist } = useQualityChecklistResolver();
  const { data: errorCodes = [] } = useQualityErrorCodes();

  const rows = queue.data ?? [];

  const teams = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) {
      if (row.team_id) map.set(row.team_id, row.team_name ?? "Team");
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], "da"));
  }, [rows]);

  const filteredRows = useMemo(
    () => (activeTeam === "all" ? rows : rows.filter((r) => r.team_id === activeTeam)),
    [rows, activeTeam],
  );

  /**
   * Sortering er rent visuel. Den ændrer ingen data og påvirker hverken
   * kontroller, løn eller provision.
   */
  const [sortKey, setSortKey] = useState<QualitySortKey>("tidspunkt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const toggleSort = (key: QualitySortKey) => {
    if (key === sortKey) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedRows = useMemo(() => {
    const factor = sortDir === "asc" ? 1 : -1;
    return [...filteredRows].sort(
      (a, b) => factor * sortValue(a, sortKey).localeCompare(sortValue(b, sortKey), "da", { numeric: true }),
    );
  }, [filteredRows, sortKey, sortDir]);


  /**
   * Kommentar-dialogen: giver feedback til teamlederen med eller uden
   * anmærkning. Godkendt med kommentar giver ingen fejlkode.
   */
  const requiredCodes = useMemo(
    () => errorCodes.filter((c) => c.item_type === "obligatorisk" && c.is_active),
    [errorCodes],
  );

  const openComment = (row: QualityQueueRow) => {
    setCommentRow(row);
    setCommentText("");
    setCommentCodeId(
      requiredCodes.find((c) => c.code === "OA_IKKE_GODKENDT")?.id ??
        requiredCodes[0]?.id ??
        "",
    );
  };

  const runCommentReview = async (approve: boolean) => {
    const row = commentRow;
    if (!row) return;

    const resolved = resolveChecklist(row.client_campaign_id);
    if (!resolved || resolved.items.length === 0) {
      toast({ title: "Ingen tjekliste fundet for kampagnen", variant: "destructive" });
      return;
    }

    const requiredItem =
      resolved.items.find((i) => i.item_type === "obligatorisk" && i.label.startsWith("OA")) ??
      resolved.items.find((i) => i.item_type === "obligatorisk");

    if (!approve && !requiredItem) {
      toast({ title: "Tjeklisten har ingen obligatoriske punkter", variant: "destructive" });
      return;
    }
    if (!approve && !commentCodeId) {
      toast({ title: "Vælg en fejlkode", variant: "destructive" });
      return;
    }

    const items = resolved.items.map((item) => {
      let state: QualityItemState = "ok";
      if (!approve) {
        state = item.id === requiredItem!.id ? "mangler" : "ikke_relevant";
      }
      return { checklist_item_id: item.id, item_type: item.item_type, state };
    });

    setQuickSavingId(row.sale_id);
    try {
      const saved = await saveReview.mutateAsync({
        sale: row,
        checklistId: resolved.checklist.id,
        checklistVersion: resolved.checklist.version,
        items,
        errorCodeIds: approve ? [] : [commentCodeId],
        comment: commentText,
        startedAt: new Date().toISOString(),
        sendFeedbackMail: approve,
      });
      toast({
        title:
          saved.result === "afvist"
            ? "Afvist og teamlederen har fået kommentaren"
            : "Godkendt og feedback sendt til teamlederen",
      });
      setCommentRow(null);
      void queue.refetch();
    } catch (error) {
      toast({
        title: "Kunne ikke gemme kontrollen",
        description: error instanceof Error ? error.message : "Ukendt fejl",
        variant: "destructive",
      });
    } finally {
      setQuickSavingId(null);
    }
  };


  /**
   * Fortryd: trækker kontrollen tilbage, så linjens markering fjernes og salget
   * igen kan kontrolleres. Kontrollen slettes ikke — historikken bevares.
   */
  const runUndoReview = async (row: QualityQueueRow) => {
    setQuickSavingId(row.sale_id);
    try {
      await voidReview.mutateAsync(row.sale_id);
      toast({ title: "Kontrollen er fortrudt" });
      void queue.refetch();
    } catch (error) {
      toast({
        title: "Kunne ikke fortryde kontrollen",
        description: error instanceof Error ? error.message : "Ukendt fejl",
        variant: "destructive",
      });
    } finally {
      setQuickSavingId(null);
    }
  };

  /**
   * Hurtigknapper: gemmer en kontrol med ét klik ud fra den samme tjekliste og
   * det samme gemme-flow som sidepanelet. Resultatet udledes i databasen.
   */
  const runQuickReview = async (
    row: QualityQueueRow,
    action: "godkendt" | "oa_mangler" | "oa_ikke_godkendt",
  ) => {
    const resolved = resolveChecklist(row.client_campaign_id);
    if (!resolved || resolved.items.length === 0) {
      toast({ title: "Ingen tjekliste fundet for kampagnen", variant: "destructive" });
      return;
    }

    const requiredItem =
      resolved.items.find((i) => i.item_type === "obligatorisk" && i.label.startsWith("OA")) ??
      resolved.items.find((i) => i.item_type === "obligatorisk");

    if (action !== "godkendt" && !requiredItem) {
      toast({ title: "Tjeklisten har ingen obligatoriske punkter", variant: "destructive" });
      return;
    }

    const errorCode =
      action === "oa_mangler"
        ? errorCodes.find((c) => c.code === "OA_MANGLER")
        : action === "oa_ikke_godkendt"
        ? errorCodes.find((c) => c.code === "OA_IKKE_GODKENDT")
        : undefined;

    if (action !== "godkendt" && !errorCode) {
      toast({ title: "Fejlkoden mangler i administrationen", variant: "destructive" });
      return;
    }

    const items = resolved.items.map((item) => {
      let state: QualityItemState = "ok";
      if (action !== "godkendt") {
        state = item.id === requiredItem!.id ? "mangler" : "ikke_relevant";
      }
      return { checklist_item_id: item.id, item_type: item.item_type, state };
    });

    setQuickSavingId(row.sale_id);
    try {
      const saved = await saveReview.mutateAsync({
        sale: row,
        checklistId: resolved.checklist.id,
        checklistVersion: resolved.checklist.version,
        items,
        errorCodeIds: errorCode ? [errorCode.id] : [],
        comment: "",
        startedAt: new Date().toISOString(),
      });
      toast({
        title:
          saved.result === "afvist"
            ? "Afvist og teamlederen er underrettet"
            : "Kontrol gemt som godkendt",
      });
      void queue.refetch();
    } catch (error) {
      toast({
        title: "Kunne ikke gemme kontrollen",
        description: error instanceof Error ? error.message : "Ukendt fejl",
        variant: "destructive",
      });
    } finally {
      setQuickSavingId(null);
    }
  };


  const copyKey = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast({ title: "Søgenøgle kopieret" });
  };

  const handleFinish = async () => {
    try {
      const result = await finishDay.mutateAsync(date);
      toast({
        title: result?.already_done ? "Dagen er allerede afsluttet" : "Mails er sendt",
        description: result?.already_done
          ? undefined
          : `${result?.leaders ?? 0} til teamledere og ${result?.management ?? 0} til ledelsen.`,
      });
    } catch (error) {
      toast({
        title: "Kunne ikke sende mails",
        description: error instanceof Error ? error.message : "Ukendt fejl",
        variant: "destructive",
      });
    } finally {
      setConfirmFinish(false);
    }
  };

  if (accessLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Ingen adgang</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Kvalitetskontrol er kun for kvalitetskontrollanter, teamledere og superadmin.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const goal = reviewerStats.data?.daily_goal ?? 40;
  const myToday = reviewerStats.data?.me?.today_count ?? 0;
  const avgToday = reviewerStats.data?.me?.avg_secs_today ?? null;
  const avg30 = reviewerStats.data?.me?.avg_secs_30d ?? null;
  const myDaily = reviewerStats.data?.my_daily ?? [];
  const maxDaily = Math.max(1, ...myDaily.map((d) => d.count));

  const formatSecs = (secs: number | null) =>
    secs === null ? "–" : `${Math.round(secs / 6) / 10} min`.replace(".", ",");

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-1 -ml-2 text-muted-foreground"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Tilbage til menu
          </Button>
          <h1 className="text-2xl font-semibold">Kvalitetskontrol</h1>
          <p className="text-sm text-muted-foreground">
            {formatDanishDate(date)}
            {dates.length > 1 ? " (weekend samlet med fredag)" : ""} ·{" "}
            {rows.length} salg i køen
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="w-[170px]"
          />
          {isSuperadmin && (
            <Button variant="outline" onClick={() => navigate("/kvalitetskontrol/administration")}>
              <Settings2 className="mr-2 h-4 w-4" />
              Administration
            </Button>
          )}
          {isController && (
            <Button
              onClick={() => setConfirmFinish(true)}
              disabled={!!completion || finishDay.isPending}
            >
              {finishDay.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              {completion ? "Afsluttet for i dag" : "Færdig for i dag"}
            </Button>
          )}
        </div>
      </div>

      {(isController || isSuperadmin) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Mine kontroller</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-4">
            <div>
              <div className="text-2xl font-semibold">
                {myToday} <span className="text-sm text-muted-foreground">/ {goal}</span>
              </div>
              <p className="text-sm text-muted-foreground">Kontroller i dag mod dagsmål</p>
            </div>
            <div>
              <div className="text-2xl font-semibold">{formatSecs(avgToday)}</div>
              <p className="text-sm text-muted-foreground">Gennemsnit pr. kontrol i dag</p>
            </div>
            <div>
              <div className="text-2xl font-semibold">{formatSecs(avg30)}</div>
              <p className="text-sm text-muted-foreground">Gennemsnit 30 dage</p>
            </div>
            <div className="flex items-end gap-1">
              {myDaily.map((d) => (
                <div
                  key={d.date}
                  title={`${d.date}: ${d.count}`}
                  className="w-2 rounded-sm bg-primary/70"
                  style={{ height: `${Math.max(4, (d.count / maxDaily) * 48)}px` }}
                />
              ))}
              {myDaily.length === 0 && (
                <p className="text-sm text-muted-foreground">Ingen kontroller endnu</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTeam} onValueChange={setActiveTeam}>
        <TabsList className="h-auto flex-wrap gap-1 p-1">
          <TabsTrigger
            value="all"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
          >
            Alle
          </TabsTrigger>
          {teams.map(([id, name]) => (
            <TabsTrigger
              key={id}
              value={id}
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
            >
              {name}
            </TabsTrigger>
          ))}
        </TabsList>
        <p className="mt-2 text-sm text-muted-foreground">
          Viser:{" "}
          <span className="font-semibold text-foreground">
            {activeTeam === "all"
              ? "Alle kampagner"
              : teams.find(([id]) => id === activeTeam)?.[1] ?? "Ukendt"}
          </span>
        </p>

        <TabsContent value={activeTeam} className="space-y-6">
          <QualityScorePanel
            overview={overview.data}
            teamId={activeTeam === "all" ? null : activeTeam}
            minReviewsForPercentage={settings?.min_reviews_for_percentage ?? 15}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Salg til kontrol</CardTitle>
            </CardHeader>
            <CardContent>
              {queue.isLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ingen salg på den valgte dag.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {(
                        [
                          ["saelger", "Sælger"],
                          ["team", "Team"],
                          ["kampagne", "Kampagne"],
                          ["tidspunkt", "Tidspunkt"],
                          ["soegenoegle", "Søgenøgle"],
                          ["status", "Status"],
                        ] as Array<[QualitySortKey, string]>
                      ).map(([key, label]) => (
                        <TableHead key={key}>
                          <button
                            type="button"
                            onClick={() => toggleSort(key)}
                            className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                            title={`Sortér efter ${label.toLowerCase()}`}
                          >
                            {label}
                            {sortKey === key ? (
                              sortDir === "asc" ? (
                                <ArrowUp className="h-3.5 w-3.5" />
                              ) : (
                                <ArrowDown className="h-3.5 w-3.5" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                            )}
                          </button>
                        </TableHead>
                      ))}
                      <TableHead className="text-right">Hurtig</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRows.map((row) => (

                      <TableRow
                        key={row.sale_id}
                        className={
                          row.status === "afvist"
                            ? "bg-destructive/10 hover:bg-destructive/15"
                            : row.status === "godkendt"
                            ? "bg-success/10 hover:bg-success/15"
                            : row.status === "godkendt_med_bemaerkning"
                            ? "bg-warning/10 hover:bg-warning/15"
                            : ""
                        }
                      >
                        <TableCell>
                          <div className="font-medium">{row.seller_name ?? "Ukendt"}</div>
                          {row.is_cancelled && (
                            <Badge variant="destructive" className="mt-1">
                              Annulleret
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{row.team_name ?? "Uden team"}</TableCell>
                        <TableCell>
                          {(() => {
                            const primary =
                              row.dialer_campaign_label ??
                              row.product_label ??
                              row.campaign_name ??
                              "Ukendt";
                            const secondary =
                              row.campaign_name && row.campaign_name !== primary
                                ? row.campaign_name
                                : null;
                            return (
                              <div className="min-w-0">
                                <p className="truncate">{primary}</p>
                                {secondary && (
                                  <p className="truncate text-xs text-muted-foreground">
                                    {secondary}
                                  </p>
                                )}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell>{formatDanishTime(row.sale_datetime)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="min-w-0">
                              <p className="font-mono text-xs">{row.search_key ?? "–"}</p>
                              {row.search_key_type && row.search_key_type !== "telefon" && (
                                <p className="text-xs text-muted-foreground">
                                  {row.search_key_type === "lead-id"
                                    ? "Lead-id (intet tlf.)"
                                    : row.search_key_type === "salgsnr."
                                    ? "Salgsnr. (intet tlf.)"
                                    : row.search_key_type}
                                </p>
                              )}
                            </div>
                            {row.search_key && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void copyKey(row.search_key!);
                                }}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              row.status === "afvist"
                                ? "destructive"
                                : row.status === "ikke_kontrolleret"
                                ? "outline"
                                : "secondary"
                            }
                          >
                            {QUALITY_RESULT_LABEL[row.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {quickSavingId === row.sale_id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 border-success/40 px-2 text-xs text-success hover:bg-success/10"
                                  onClick={() => void runQuickReview(row, "godkendt")}
                                >
                                  Godkendt
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 border-destructive/40 px-2 text-xs text-destructive hover:bg-destructive/10"
                                  onClick={() => void runQuickReview(row, "oa_mangler")}
                                >
                                  OA mangler
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 border-destructive/40 px-2 text-xs text-destructive hover:bg-destructive/10"
                                  onClick={() => void runQuickReview(row, "oa_ikke_godkendt")}
                                >
                                  OA ikke godkendt
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => openComment(row)}
                                >
                                  <MessageSquare className="mr-1 h-3.5 w-3.5" />
                                  Kommentar
                                </Button>
                                {row.status !== "ikke_kontrolleret" && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs text-muted-foreground"
                                    onClick={() => void runUndoReview(row)}
                                  >
                                    Fortryd
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!commentRow} onOpenChange={(open) => !open && setCommentRow(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Kommentar til teamlederen</DialogTitle>
            <DialogDescription>
              {commentRow
                ? `${commentRow.seller_name ?? "Ukendt sælger"} · ${
                    commentRow.team_name ?? "Uden team"
                  } · ${formatDanishTime(commentRow.sale_datetime)}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="kvalitet-kommentar">
                Kommentar (max 500 tegn)
              </label>
              <Textarea
                id="kvalitet-kommentar"
                value={commentText}
                maxLength={500}
                rows={5}
                placeholder="Skriv feedback til teamlederen …"
                onChange={(e) => setCommentText(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Fejlkode ved "Send og ikke godkend"</p>
              <Select value={commentCodeId} onValueChange={setCommentCodeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Vælg fejlkode" />
                </SelectTrigger>
                <SelectContent>
                  {requiredCodes.map((code) => (
                    <SelectItem key={code.id} value={code.id}>
                      {code.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Bruges kun hvis salget ikke godkendes. Ved "Send men godkend" gives ingen
                anmærkning.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="outline"
              className="border-success/40 text-success hover:bg-success/10"
              disabled={saveReview.isPending}
              onClick={() => void runCommentReview(true)}
            >
              {saveReview.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send men godkend
            </Button>
            <Button
              variant="destructive"
              disabled={saveReview.isPending}
              onClick={() => void runCommentReview(false)}
            >
              {saveReview.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send og ikke godkend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmFinish} onOpenChange={setConfirmFinish}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Færdig for i dag?</AlertDialogTitle>
            <AlertDialogDescription>
              Der sendes en sammenfatning til hver teamleder med kontrollerede salg i dag og en
              samlet mail til ledelsen. Det kan kun gøres én gang pr. dag.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annullér</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinish}>Send mails</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
