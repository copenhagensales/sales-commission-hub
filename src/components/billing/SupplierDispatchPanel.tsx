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
import { AlertCircle, CheckCircle2, Clock, Mail, Send, Settings } from "lucide-react";
import {
  useApproveDispatch,
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
  subscription: SupplierReportSubscription;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: approvers } = useApproverCandidates();
  const update = useUpdateSupplierReportSubscription();
  const [form, setForm] = useState({
    name: subscription.name ?? "",
    recipient_name: subscription.recipient_name ?? "",
    recipient_email: subscription.recipient_email ?? "",
    cc: (subscription.cc_emails ?? []).join(", "),
    approver_employee_id: subscription.approver_employee_id ?? "",
    send_day: String(subscription.send_day),
    attach_xlsx: subscription.attach_xlsx,
    include_surcharge_summary: subscription.include_surcharge_summary,
    is_active: subscription.is_active,
  });

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
    update.mutate(
      {
        id: subscription.id,
        values: {
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
        },
      },
      {
        onSuccess: () => {
          toast.success("Abonnement gemt");
          onOpenChange(false);
        },
        onError: (e: Error) => toast.error("Fejl: " + e.message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Automatisk udsendelse - {subscription.location_type}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Navn på abonnement</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuller
          </Button>
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending ? "Gemmer..." : "Gem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SupplierDispatchPanel({ locationType }: { locationType?: string }) {
  const { data: subscriptions } = useSupplierReportSubscriptions();
  const { data: dispatches } = useSupplierReportDispatches({ pendingOnly: false });
  const [editing, setEditing] = useState<SupplierReportSubscription | null>(null);

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

  if (relevantSubscriptions.length === 0) return null;

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
              {s.name || s.location_type}
              {!s.is_active && (
                <Badge variant="secondary" className="ml-2">
                  Inaktiv
                </Badge>
              )}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {relevantDispatches.length === 0 ? (
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
    </Card>
  );
}
