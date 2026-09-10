import { useMemo, useState } from "react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  Mail,
  Plus,
  Send,
  Settings,
  Trash2,
} from "lucide-react";
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
  useApproveDispatch,
  useCreateSupplierReportSubscription,
  useDeleteSupplierReportSubscription,
  useSupplierLocationTypes,
  useApprovedReportForPeriod,
  useApproverCandidates,
  useReportClients,
  useSendDispatch,
  useSupplierReportDispatches,
  useSupplierReportSubscriptions,
  useUpdateSupplierReportSubscription,
  WEEKDAY_LABELS,
  type ReportType,
  type SupplierReportDispatch,
  type SupplierReportSubscription,
} from "@/hooks/useSupplierReportDispatch";

function periodLabel(periodStart: string): string {
  return format(new Date(`${periodStart}T00:00:00`), "LLLL yyyy", { locale: da });
}

function weekPeriodLabel(periodStart: string): string {
  const start = new Date(`${periodStart}T00:00:00`);
  return `uge ${format(start, "I", { locale: da })} (${format(start, "dd/MM")})`;
}

function dayPeriodLabel(periodStart: string): string {
  return format(new Date(`${periodStart}T00:00:00`), "EEEE d. MMMM yyyy", { locale: da });
}

function isWeekPlan(sub: SupplierReportSubscription | null | undefined): boolean {
  return sub?.report_type === "client_week_plan";
}

function isDailySales(sub: SupplierReportSubscription | null | undefined): boolean {
  return sub?.report_type === "client_daily_sales";
}

/** Kundevendte rapporttyper godkendes ikke og sendes ikke manuelt herfra. */
function isClientReport(sub: SupplierReportSubscription | null | undefined): boolean {
  return isWeekPlan(sub) || isDailySales(sub);
}

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  supplier_invoice: "Leverandørrapport",
  client_week_plan: "Ugeplan til kunde",
  client_daily_sales: "Daglig salgsrapport til kunde",
};

function ReportTypeBadge({ reportType }: { reportType: ReportType }) {
  const Icon = reportType === "supplier_invoice" ? FileText : CalendarDays;
  return (
    <Badge variant="outline" className="gap-1">
      <Icon className="h-3 w-3" /> {REPORT_TYPE_LABELS[reportType]}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "sent") {
    return (
      <Badge className="gap-1 bg-emerald-100 text-emerald-900 hover:bg-emerald-100">
        <CheckCircle2 className="h-3 w-3" /> Sendt
      </Badge>
    );
  }
  if (status === "skipped") {
    return (
      <Badge variant="secondary" className="gap-1">
        <AlertCircle className="h-3 w-3" /> Sprunget over
      </Badge>
    );
  }
  if (status === "approved") {
    return (
      <Badge variant="outline" className="gap-1">
        <Mail className="h-3 w-3" /> Godkendt - klar til afsendelse
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertCircle className="h-3 w-3" /> Fejlede
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Clock className="h-3 w-3" /> Afventer godkendelse
    </Badge>
  );
}

function DispatchRow({ dispatch }: { dispatch: SupplierReportDispatch }) {
  const sub = dispatch.supplier_report_subscriptions;
  const clientReport = isClientReport(sub);
  const { data: report } = useApprovedReportForPeriod(
    clientReport ? undefined : sub?.location_type ?? undefined,
    dispatch.period_start,
  );
  const approve = useApproveDispatch();
  const send = useSendDispatch();

  const reportApproved = report?.status === "approved";
  // Kundevendte rapporter godkendes ikke og sendes ikke manuelt herfra.
  const canApprove =
    !clientReport &&
    dispatch.status === "pending_approval" &&
    reportApproved &&
    !!report?.id;
  const canSend =
    !clientReport &&
    (dispatch.status === "approved" || dispatch.status === "failed") &&
    !!sub?.is_active &&
    !!sub?.recipient_email;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{sub?.name || sub?.location_type}</span>
            {sub?.report_type && <ReportTypeBadge reportType={sub.report_type} />}
            <StatusBadge status={dispatch.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Periode:{" "}
            {isDailySales(sub)
              ? dayPeriodLabel(dispatch.period_start)
              : isWeekPlan(sub)
                ? weekPeriodLabel(dispatch.period_start)
                : periodLabel(dispatch.period_start)}{" "}
            &middot; Modtager: {sub?.recipient_email || "ikke udfyldt"}
          </p>
          {dispatch.reminder_count > 0 && dispatch.status === "pending_approval" && (
            <p className="text-sm text-muted-foreground">
              {dispatch.reminder_count} påmindelse(r) sendt
            </p>
          )}
          {dispatch.sent_at && (
            <p className="text-sm text-muted-foreground">
              Sendt {format(new Date(dispatch.sent_at), "dd/MM/yyyy HH:mm")} til{" "}
              {(dispatch.sent_to ?? []).join(", ")}
            </p>
          )}
          {dispatch.error_message && (
            <p className="text-sm text-destructive">{dispatch.error_message}</p>
          )}
          {!clientReport && dispatch.status === "pending_approval" && !reportApproved && (
            <p className="text-sm text-amber-700">
              Rapporten for perioden er ikke godkendt endnu. Godkend rapporten nedenfor
              først.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {!clientReport && dispatch.status === "pending_approval" && (
            <Button
              size="sm"
              disabled={!canApprove || approve.isPending}
              onClick={() =>
                approve.mutate(
                  { dispatchId: dispatch.id, reportId: report!.id },
                  {
                    onSuccess: () => toast.success("Udsendelse godkendt"),
                    onError: (e: Error) => toast.error("Fejl: " + e.message),
                  },
                )
              }
            >
              Godkend
            </Button>
          )}
          {canSend && (
            <Button
              size="sm"
              disabled={send.isPending}
              onClick={() =>
                send.mutate(dispatch.id, {
                  onSuccess: (d) =>
                    toast.success(`Rapport sendt til ${d.recipients.join(", ")}`),
                  onError: (e: Error) => toast.error("Fejl ved afsendelse: " + e.message),
                })
              }
            >
              <Send className="mr-2 h-4 w-4" />
              {send.isPending ? "Sender..." : "Send nu"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SubscriptionDialog({
  subscription,
  open,
  onOpenChange,
}: {
  /** null = opret nyt abonnement */
  subscription: SupplierReportSubscription | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isNew = subscription === null;
  const { data: approvers } = useApproverCandidates();
  const { data: locationTypes } = useSupplierLocationTypes();
  const { data: clients } = useReportClients();
  const update = useUpdateSupplierReportSubscription();
  const create = useCreateSupplierReportSubscription();
  const remove = useDeleteSupplierReportSubscription();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState({
    report_type: (subscription?.report_type ?? "supplier_invoice") as ReportType,
    location_type: subscription?.location_type ?? "",
    client_id: subscription?.client_id ?? "",
    weekday: String(subscription?.weekday ?? 1),
    name: subscription?.name ?? "",
    recipient_name: subscription?.recipient_name ?? "",
    recipient_email: subscription?.recipient_email ?? "",
    cc: (subscription?.cc_emails ?? []).join(", "),
    approver_employee_id: subscription?.approver_employee_id ?? "",
    send_day: String(subscription?.send_day ?? 1),
    send_hour: String(subscription?.send_hour ?? 8),
    attach_xlsx: subscription?.attach_xlsx ?? true,
    include_surcharge_summary: subscription?.include_surcharge_summary ?? true,
    is_active: subscription?.is_active ?? false,
  });
  const weekPlanForm = form.report_type === "client_week_plan";
  const dailySalesForm = form.report_type === "client_daily_sales";
  const clientForm = weekPlanForm || dailySalesForm;

  const isPending = update.isPending || create.isPending;

  const save = () => {
    const email = form.recipient_email.trim();
    if (form.is_active && !email.includes("@")) {
      toast.error("Udfyld en gyldig modtager før abonnementet aktiveres");
      return;
    }
    const day = Number(form.send_day);
    const weekday = Number(form.weekday);
    const hour = Number(form.send_hour);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      toast.error("Klokketime skal være mellem 0 og 23");
      return;
    }
    if (weekPlanForm) {
      if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
        toast.error("Vælg en ugedag");
        return;
      }
    } else if (!dailySalesForm && (!Number.isInteger(day) || day < 1 || day > 28)) {
      toast.error("Sendedag skal være mellem 1 og 28");
      return;
    }
    const values = {
      name: form.name.trim() || null,
      recipient_name: form.recipient_name.trim() || null,
      recipient_email: email || null,
      cc_emails: form.cc
        .split(",")
        .map((e) => e.trim())
        .filter((e) => e.includes("@")),
      approver_employee_id: form.approver_employee_id || null,
      send_day: clientForm ? 1 : day,
      send_hour: hour,
      weekday: weekPlanForm ? weekday : null,
      attach_xlsx: clientForm ? false : form.attach_xlsx,
      include_surcharge_summary: form.include_surcharge_summary,
      is_active: form.is_active,
    };

    if (isNew) {
      if (clientForm) {
        if (!form.client_id) {
          toast.error("Vælg en kunde");
          return;
        }
      } else if (!form.location_type.trim()) {
        toast.error("Vælg en lokationstype");
        return;
      }
      create.mutate(
        {
          ...values,
          report_type: form.report_type,
          location_type: clientForm ? null : form.location_type.trim(),
          client_id: clientForm ? form.client_id : null,
          is_active: false,
        },
        {
          onSuccess: () => {
            toast.success("Abonnement oprettet - det er inaktivt indtil du aktiverer det");
            onOpenChange(false);
          },
          onError: (e: Error) => toast.error("Fejl: " + e.message),
        },
      );
      return;
    }

    update.mutate(
      { id: subscription.id, values },
      {
        onSuccess: () => {
          toast.success("Abonnement gemt");
          onOpenChange(false);
        },
        onError: (e: Error) => toast.error("Fejl: " + e.message),
      },
    );
  };

  const handleDelete = () => {
    if (!subscription) return;
    remove.mutate(subscription.id, {
      onSuccess: (result) => {
        if (result.deactivated) {
          toast.warning(
            `Abonnementet er deaktiveret i stedet for slettet: der findes ${result.sentCount} afsendt rapport(er), og afsendelseshistorikken skal bevares.`,
          );
        } else {
          toast.success("Abonnement slettet");
        }
        setConfirmDelete(false);
        onOpenChange(false);
      },
      onError: (e: Error) => toast.error("Fejl: " + e.message),
    });
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isNew
              ? "Nyt abonnement"
              : `Automatisk udsendelse - ${subscription.name || subscription.location_type}`}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {isNew ? (
            <div className="space-y-2">
              <Label>Rapporttype</Label>
              <Select
                value={form.report_type}
                onValueChange={(v) =>
                  setForm({ ...form, report_type: v as ReportType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="supplier_invoice">
                    Leverandørrapport (månedlig)
                  </SelectItem>
                  <SelectItem value="client_week_plan">
                    Ugeplan til kunde (ugentlig)
                  </SelectItem>
                  <SelectItem value="client_daily_sales">
                    Daglig salgsrapport til kunde (dagligt)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Rapporttype</Label>
              <div>
                <ReportTypeBadge reportType={form.report_type} />
              </div>
            </div>
          )}
          {clientForm ? (
            isNew ? (
              <div className="space-y-2">
                <Label>Kunde</Label>
                <Select
                  value={form.client_id}
                  onValueChange={(v) => setForm({ ...form, client_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg kunde" />
                  </SelectTrigger>
                  <SelectContent>
                    {(clients ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Kunde</Label>
                <p className="text-sm font-medium">
                  {(clients ?? []).find((c) => c.id === subscription.client_id)?.name ??
                    "ukendt"}
                </p>
              </div>
            )
          ) : isNew ? (
            <div className="space-y-2">
              <Label>Lokationstype</Label>
              <Select
                value={form.location_type}
                onValueChange={(v) => setForm({ ...form, location_type: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vælg lokationstype" />
                </SelectTrigger>
                <SelectContent>
                  {(locationTypes ?? []).map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Lokationstype</Label>
              <p className="text-sm font-medium">{subscription.location_type}</p>
            </div>
          )}
          <div className="space-y-2">
            <Label>Navn på abonnement</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Navnet står i mailens overskrift hos modtageren - skriv det, som modtageren
              skal læse det.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Modtager (navn)</Label>
              <Input
                value={form.recipient_name}
                onChange={(e) => setForm({ ...form, recipient_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Modtager (e-mail)</Label>
              <Input
                value={form.recipient_email}
                onChange={(e) => setForm({ ...form, recipient_email: e.target.value })}
                placeholder="navn@kunde.dk"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>CC (komma-separeret)</Label>
            <Input
              value={form.cc}
              onChange={(e) => setForm({ ...form, cc: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{clientForm ? "Modtager af interne advarsler" : "Godkender"}</Label>
              <Select
                value={form.approver_employee_id || "none"}
                onValueChange={(v) =>
                  setForm({ ...form, approver_employee_id: v === "none" ? "" : v })
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={clientForm ? "Vælg modtager" : "Vælg godkender"}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ingen</SelectItem>
                  {approvers?.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} {a.email ? `(${a.email})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {weekPlanForm ? (
              <div className="space-y-2">
                <Label>Ugedag</Label>
                <Select
                  value={form.weekday}
                  onValueChange={(v) => setForm({ ...form, weekday: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg ugedag" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(WEEKDAY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : dailySalesForm ? (
              <div className="space-y-2">
                <Label>Klokketime (0-23)</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={form.send_hour}
                  onChange={(e) => setForm({ ...form, send_hour: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Dansk tid. Rapporten dækker altid dagen før.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Dag i måneden (1-28)</Label>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={form.send_day}
                  onChange={(e) => setForm({ ...form, send_day: e.target.value })}
                />
              </div>
            )}
          </div>
          {!clientForm && (
            <>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Vedhæft Excel-ark</p>
                  <p className="text-xs text-muted-foreground">
                    Kun lokation, butiksnr, by, dage og beløb
                  </p>
                </div>
                <Switch
                  checked={form.attach_xlsx}
                  onCheckedChange={(v) => setForm({ ...form, attach_xlsx: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Vis merpris/refusion i mailteksten</p>
                  <p className="text-xs text-muted-foreground">
                    Kommer aldrig med i Excel-bilaget
                  </p>
                </div>
                <Switch
                  checked={form.include_surcharge_summary}
                  onCheckedChange={(v) =>
                    setForm({ ...form, include_surcharge_summary: v })
                  }
                />
              </div>
            </>
          )}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Aktiv</p>
              <p className="text-xs text-muted-foreground">
                Der sendes aldrig mail uden modtager og aktivering
              </p>
            </div>
            <Switch
              checked={form.is_active}
              onCheckedChange={(v) => setForm({ ...form, is_active: v })}
            />
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          {!isNew ? (
            <Button
              variant="destructive"
              onClick={() => setConfirmDelete(true)}
              disabled={remove.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Slet
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuller
            </Button>
            <Button onClick={save} disabled={isPending}>
              {isPending ? "Gemmer..." : isNew ? "Opret" : "Gem"}
            </Button>
          </div>
        </DialogFooter>
        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Slet "{subscription?.name || subscription?.location_type}"?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Abonnementet fjernes, så der ikke længere oprettes udsendelser. Har
                abonnementet allerede sendt rapporter, bliver det i stedet deaktiveret,
                så afsendelseshistorikken bevares.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuller</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                }}
                disabled={remove.isPending}
              >
                {remove.isPending ? "Arbejder..." : "Slet"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </DialogContent>
    </Dialog>
  );
}

const REPORT_TYPE_ORDER: ReportType[] = [
  "supplier_invoice",
  "client_week_plan",
  "client_daily_sales",
];

const REPORT_GROUP_TITLES: Record<ReportType, string> = {
  supplier_invoice: "Leverandørrapporter (månedligt)",
  client_week_plan: "Ugeplaner til kunder (ugentligt)",
  client_daily_sales: "Daglige salgsrapporter til kunder",
};

function scheduleLabel(s: SupplierReportSubscription): string {
  if (s.report_type === "client_week_plan") {
    return `${WEEKDAY_LABELS[s.weekday ?? 1]} kl. ${s.send_hour}`;
  }
  if (s.report_type === "client_daily_sales") {
    return `Hver dag kl. ${s.send_hour}`;
  }
  return `Den ${s.send_day}. i måneden kl. ${s.send_hour}`;
}

function SubscriptionCard({
  subscription,
  clientName,
  dispatches,
  onEdit,
}: {
  subscription: SupplierReportSubscription;
  clientName: string | null;
  dispatches: SupplierReportDispatch[];
  onEdit: () => void;
}) {
  const s = subscription;
  const target =
    s.report_type === "supplier_invoice" ? s.location_type : clientName;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{s.name || target || "Uden navn"}</span>
            {s.is_active ? (
              <Badge className="gap-1 bg-emerald-100 text-emerald-900 hover:bg-emerald-100">
                <CheckCircle2 className="h-3 w-3" /> Aktiv
              </Badge>
            ) : (
              <Badge variant="secondary">Inaktiv</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {s.report_type === "supplier_invoice" ? "Leverandør" : "Kunde"}:{" "}
            {target || "ikke valgt"} &middot; {scheduleLabel(s)} &middot; Modtager:{" "}
            {s.recipient_email || "ikke udfyldt"}
          </p>
          {!s.is_active && !s.recipient_email && (
            <p className="text-sm text-amber-700">
              Kan ikke aktiveres før der er udfyldt en modtagermail.
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Settings className="mr-2 h-4 w-4" /> Indstil
        </Button>
      </div>
      {dispatches.length > 0 && (
        <div className="space-y-2">
          {dispatches.map((d) => (
            <DispatchRow key={d.id} dispatch={d} />
          ))}
        </div>
      )}
    </div>
  );
}

export function SupplierDispatchPanel({ locationType }: { locationType?: string }) {
  const { data: subscriptions } = useSupplierReportSubscriptions();
  const { data: dispatches } = useSupplierReportDispatches({ pendingOnly: false });
  const { data: clients } = useReportClients();
  const [editing, setEditing] = useState<SupplierReportSubscription | null>(null);
  const [creating, setCreating] = useState(false);

  // Uden valgt lokationstype vises alle abonnementer, så man ser hele billedet.
  // Kundevendte rapporter hænger ikke på lokationstype og vises altid.
  const relevantSubscriptions = useMemo(
    () =>
      (subscriptions ?? []).filter(
        (s) =>
          !locationType ||
          s.report_type !== "supplier_invoice" ||
          s.location_type === locationType,
      ),
    [subscriptions, locationType],
  );

  const dispatchesBySubscription = useMemo(() => {
    const map = new Map<string, SupplierReportDispatch[]>();
    for (const d of dispatches ?? []) {
      const list = map.get(d.subscription_id) ?? [];
      if (list.length < 3) list.push(d);
      map.set(d.subscription_id, list);
    }
    return map;
  }, [dispatches]);

  const clientNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clients ?? []) map.set(c.id, c.name);
    return map;
  }, [clients]);

  /** Øverste niveau = kunde (eller leverandørens lokationstype), så man ser hvem der modtager hvad. */
  const ownerGroups = useMemo(() => {
    const map = new Map<
      string,
      { label: string; isClient: boolean; rows: SupplierReportSubscription[] }
    >();
    for (const s of relevantSubscriptions) {
      const isClient = s.report_type !== "supplier_invoice";
      const label = isClient
        ? (s.client_id ? clientNameById.get(s.client_id) : null) ?? "Ukendt kunde"
        : s.location_type || "Ukendt leverandør";
      const key = `${isClient ? "client" : "supplier"}:${label}`;
      const entry = map.get(key) ?? { label, isClient, rows: [] };
      entry.rows.push(s);
      map.set(key, entry);
    }
    return [...map.values()]
      .map((g) => ({
        ...g,
        activeCount: g.rows.filter((r) => r.is_active).length,
        types: REPORT_TYPE_ORDER.map((type) => ({
          type,
          active: g.rows.filter((r) => r.report_type === type && r.is_active),
          inactive: g.rows.filter((r) => r.report_type === type && !r.is_active),
        })).filter((t) => t.active.length + t.inactive.length > 0),
      }))
      .sort(
        (a, b) =>
          Number(a.isClient) - Number(b.isClient) ||
          a.label.localeCompare(b.label, "da"),
      );
  }, [relevantSubscriptions, clientNameById]);

  const renderRows = (rows: SupplierReportSubscription[]) =>
    rows.map((s) => (
      <SubscriptionCard
        key={s.id}
        subscription={s}
        clientName={s.client_id ? clientNameById.get(s.client_id) ?? null : null}
        dispatches={dispatchesBySubscription.get(s.id) ?? []}
        onEdit={() => setEditing(s)}
      />
    ));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Automatisk udsendelse</CardTitle>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nyt abonnement
        </Button>
      </CardHeader>
      <CardContent className="space-y-8">
        {ownerGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ingen abonnementer endnu. Opret et abonnement for at sende rapporten
            automatisk til en leverandør eller kunde.
          </p>
        ) : (
          ownerGroups.map((g) => (
            <div key={`${g.isClient}-${g.label}`} className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 border-b pb-2">
                <span className="text-base font-semibold">{g.label}</span>
                <Badge variant="outline">{g.isClient ? "Kunde" : "Leverandør"}</Badge>
                <span className="text-sm text-muted-foreground">
                  {g.rows.length} rapport(er) &middot; {g.activeCount} aktiv(e)
                </span>
              </div>
              {g.types.map((t) => (
                <div key={t.type} className="space-y-2 pl-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <ReportTypeBadge reportType={t.type} />
                    <span className="text-sm text-muted-foreground">
                      {REPORT_GROUP_TITLES[t.type]}
                    </span>
                  </div>
                  {t.active.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase text-muted-foreground">
                        Aktive
                      </p>
                      {renderRows(t.active)}
                    </div>
                  )}
                  {t.inactive.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase text-muted-foreground">
                        Ikke aktive
                      </p>
                      {renderRows(t.inactive)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </CardContent>
      {editing && (
        <SubscriptionDialog
          subscription={editing}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
      {creating && (
        <SubscriptionDialog
          subscription={null}
          open={creating}
          onOpenChange={(o) => !o && setCreating(false)}
        />
      )}
    </Card>
  );
}


