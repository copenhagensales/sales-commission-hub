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
  CheckCircle2,
  Clock,
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
  useSendDispatch,
  useSupplierReportDispatches,
  useSupplierReportSubscriptions,
  useUpdateSupplierReportSubscription,
  type SupplierReportDispatch,
  type SupplierReportSubscription,
} from "@/hooks/useSupplierReportDispatch";

function periodLabel(periodStart: string): string {
  return format(new Date(`${periodStart}T00:00:00`), "LLLL yyyy", { locale: da });
}

function StatusBadge({ status }: { status: string }) {
  if (status === "sent") {
    return (
      <Badge className="gap-1 bg-emerald-100 text-emerald-900 hover:bg-emerald-100">
        <CheckCircle2 className="h-3 w-3" /> Sendt
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
  const { data: report } = useApprovedReportForPeriod(
    sub?.location_type,
    dispatch.period_start,
  );
  const approve = useApproveDispatch();
  const send = useSendDispatch();

  const reportApproved = report?.status === "approved";
  const canApprove =
    dispatch.status === "pending_approval" && reportApproved && !!report?.id;
  const canSend =
    (dispatch.status === "approved" || dispatch.status === "failed") &&
    !!sub?.is_active &&
    !!sub?.recipient_email;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{sub?.name || sub?.location_type}</span>
            <StatusBadge status={dispatch.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Periode: {periodLabel(dispatch.period_start)} &middot; Modtager:{" "}
            {sub?.recipient_email || "ikke udfyldt"}
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
          {dispatch.status === "pending_approval" && !reportApproved && (
            <p className="text-sm text-amber-700">
              Rapporten for perioden er ikke godkendt endnu. Godkend rapporten nedenfor
              først.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {dispatch.status === "pending_approval" && (
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
  const update = useUpdateSupplierReportSubscription();
  const create = useCreateSupplierReportSubscription();
  const remove = useDeleteSupplierReportSubscription();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState({
    location_type: subscription?.location_type ?? "",
    name: subscription?.name ?? "",
    recipient_name: subscription?.recipient_name ?? "",
    recipient_email: subscription?.recipient_email ?? "",
    cc: (subscription?.cc_emails ?? []).join(", "),
    approver_employee_id: subscription?.approver_employee_id ?? "",
    send_day: String(subscription?.send_day ?? 1),
    attach_xlsx: subscription?.attach_xlsx ?? true,
    include_surcharge_summary: subscription?.include_surcharge_summary ?? true,
    is_active: subscription?.is_active ?? false,
  });

  const isPending = update.isPending || create.isPending;

  const save = () => {
    const email = form.recipient_email.trim();
    if (form.is_active && !email.includes("@")) {
      toast.error("Udfyld en gyldig modtager før abonnementet aktiveres");
      return;
    }
    const day = Number(form.send_day);
    if (!Number.isInteger(day) || day < 1 || day > 28) {
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
      send_day: day,
      attach_xlsx: form.attach_xlsx,
      include_surcharge_summary: form.include_surcharge_summary,
      is_active: form.is_active,
    };

    if (isNew) {
      const locationType = form.location_type.trim();
      if (!locationType) {
        toast.error("Vælg en lokationstype");
        return;
      }
      create.mutate(
        { ...values, location_type: locationType, is_active: false },
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
              : `Automatisk udsendelse - ${subscription.location_type}`}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {isNew ? (
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
              <Label>Godkender</Label>
              <Select
                value={form.approver_employee_id || "none"}
                onValueChange={(v) =>
                  setForm({ ...form, approver_employee_id: v === "none" ? "" : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vælg godkender" />
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
          </div>
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
              onCheckedChange={(v) => setForm({ ...form, include_surcharge_summary: v })}
            />
          </div>
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

export function SupplierDispatchPanel({ locationType }: { locationType?: string }) {
  const { data: subscriptions } = useSupplierReportSubscriptions();
  const { data: dispatches } = useSupplierReportDispatches({ pendingOnly: false });
  const [editing, setEditing] = useState<SupplierReportSubscription | null>(null);
  const [creating, setCreating] = useState(false);

  // Uden valgt lokationstype vises alle abonnementer, så man ser hele billedet.
  const relevantSubscriptions = useMemo(
    () =>
      (subscriptions ?? []).filter(
        (s) => !locationType || s.location_type === locationType,
      ),
    [subscriptions, locationType],
  );

  const relevantDispatches = useMemo(() => {
    const ids = new Set(relevantSubscriptions.map((s) => s.id));
    return (dispatches ?? [])
      .filter((d) => ids.has(d.subscription_id))
      .slice(0, 6);
  }, [dispatches, relevantSubscriptions]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Automatisk udsendelse</CardTitle>
        <div className="flex flex-wrap gap-2">
          {relevantSubscriptions.map((s) => (
            <Button
              key={s.id}
              variant="outline"
              size="sm"
              onClick={() => setEditing(s)}
            >
              <Settings className="mr-2 h-4 w-4" />
              <span className="flex flex-col items-start leading-tight">
                <span>{s.name || s.location_type}</span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  {s.location_type}
                </span>
              </span>
              {!s.is_active && (
                <Badge variant="secondary" className="ml-2">
                  Inaktiv
                </Badge>
              )}
            </Button>
          ))}
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nyt abonnement
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {relevantSubscriptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ingen abonnementer endnu. Opret et abonnement for at sende rapporten
            automatisk til en leverandør eller kunde.
          </p>
        ) : relevantDispatches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ingen udsendelser oprettet endnu. Jobbet opretter en udsendelse til
            godkendelse på den valgte dag i måneden.
          </p>
        ) : (
          relevantDispatches.map((d) => <DispatchRow key={d.id} dispatch={d} />)
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

