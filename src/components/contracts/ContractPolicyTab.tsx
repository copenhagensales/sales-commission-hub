import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Info, Save } from "lucide-react";
import { format, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";
import {
  useContractPolicy,
  useContractPolicyAudit,
  clampPolicyNumber,
  POLICY_LIMITS,
  type ContractPolicyKey,
} from "@/hooks/useContractPolicy";

const RULE_LABELS: Record<string, string> = {
  employee_reminder: "Mail-påmindelse til medarbejder",
  pending_lock: "Systemlås ved manglende underskrift",
  rejected_lock: "Spærring ved afvist kontrakt",
  management_digest: "Ledelses-notifikation",
  ui_warning: "Advarsel i systemet",
};

interface RuleCardProps {
  ruleKey: ContractPolicyKey;
  description: string;
  canEdit: boolean;
  children?: React.ReactNode;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  dirty?: boolean;
  onSave?: () => void;
  saving?: boolean;
}

function RuleCard({ ruleKey, description, canEdit, children, enabled, onToggle, dirty, onSave, saving }: RuleCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">{RULE_LABELS[ruleKey]}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-muted-foreground">{enabled ? "Til" : "Fra"}</span>
          <Switch checked={enabled} onCheckedChange={onToggle} disabled={!canEdit} />
        </div>
      </CardHeader>
      {(children || dirty) && (
        <CardContent className="space-y-4">
          {children}
          {dirty && onSave && (
            <Button size="sm" onClick={onSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" /> Gem ændringer
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export function ContractPolicyTab({ canEdit }: { canEdit: boolean }) {
  const {
    policy,
    isLoading,
    isFallback,
    reminder,
    reminderEnabled,
    pendingLockDays,
    pendingLockEnabled,
    rejectedLockEnabled,
    digest,
    digestEnabled,
    uiWarning,
    uiWarningEnabled,
    updatePolicy,
  } = useContractPolicy();
  const { data: auditRows = [] } = useContractPolicyAudit();

  // Local draft state per rule
  const [firstAfter, setFirstAfter] = useState(String(reminder.first_after_days));
  const [interval, setInterval] = useState(String(reminder.interval_days));
  const [maxReminders, setMaxReminders] = useState(String(reminder.max_reminders));
  const [lockDays, setLockDays] = useState(String(pendingLockDays));
  const [recipients, setRecipients] = useState((digest.recipients ?? []).join(", "));
  const [warnDays, setWarnDays] = useState(String(uiWarning.warn_days_before_start));

  useEffect(() => {
    if (isLoading) return;
    setFirstAfter(String(reminder.first_after_days));
    setInterval(String(reminder.interval_days));
    setMaxReminders(String(reminder.max_reminders));
    setLockDays(String(pendingLockDays));
    setRecipients((digest.recipients ?? []).join(", "));
    setWarnDays(String(uiWarning.warn_days_before_start));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, policy]);

  const save = (key: ContractPolicyKey, enabled: boolean, config: Record<string, unknown>) => {
    updatePolicy.mutate(
      { key, enabled, config },
      {
        onSuccess: () => toast.success(`${RULE_LABELS[key]} opdateret`),
        onError: (e) =>
          toast.error(
            e instanceof Error && e.message.includes("policy")
              ? "Du har ikke rettigheder til at ændre kontraktregler"
              : "Kunne ikke gemme ændringen"
          ),
      }
    );
  };

  const reminderConfig = () => ({
    first_after_days: clampPolicyNumber(Number(firstAfter), POLICY_LIMITS.first_after_days, reminder.first_after_days),
    interval_days: clampPolicyNumber(Number(interval), POLICY_LIMITS.interval_days, reminder.interval_days),
    max_reminders: clampPolicyNumber(Number(maxReminders), POLICY_LIMITS.max_reminders, reminder.max_reminders),
  });

  const lockConfig = () => ({
    days: clampPolicyNumber(Number(lockDays), POLICY_LIMITS.pending_lock_days, pendingLockDays),
  });

  const reminderDirty =
    Number(firstAfter) !== reminder.first_after_days ||
    Number(interval) !== reminder.interval_days ||
    Number(maxReminders) !== reminder.max_reminders;
  const lockDirty = Number(lockDays) !== pendingLockDays;
  const digestDirty = recipients !== (digest.recipients ?? []).join(", ");
  const warnDirty = Number(warnDays) !== uiWarning.warn_days_before_start;

  return (
    <div className="space-y-4">
      {isFallback && (
        <Card className="border-amber-500">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <p className="text-sm">
              Indstillingerne kunne ikke indlæses. Systemet kører videre på standardværdierne (3/3/3 dage på påmindelser
              og 5 dage på systemlås) — præcis som før dette modul blev indført.
            </p>
          </CardContent>
        </Card>
      )}

      {!canEdit && (
        <Card>
          <CardContent className="pt-6 flex items-start gap-3">
            <Info className="h-5 w-5 text-muted-foreground shrink-0" />
            <p className="text-sm text-muted-foreground">
              Du kan se reglerne, men kun ejer kan ændre dem.
            </p>
          </CardContent>
        </Card>
      )}

      <RuleCard
        ruleKey="employee_reminder"
        description="Sender automatisk mail til medarbejderens privatmail, når en kontrakt ikke er underskrevet."
        canEdit={canEdit}
        enabled={reminderEnabled}
        onToggle={(v) => save("employee_reminder", v, reminderConfig())}
        dirty={reminderDirty && canEdit}
        onSave={() => save("employee_reminder", reminderEnabled, reminderConfig())}
        saving={updatePolicy.isPending}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Første påmindelse efter (dage)</Label>
            <Input type="number" min={1} max={60} value={firstAfter} onChange={(e) => setFirstAfter(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="space-y-2">
            <Label>Dage mellem påmindelser</Label>
            <Input type="number" min={1} max={60} value={interval} onChange={(e) => setInterval(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="space-y-2">
            <Label>Maks antal påmindelser</Label>
            <Input type="number" min={1} max={20} value={maxReminders} onChange={(e) => setMaxReminders(e.target.value)} disabled={!canEdit} />
          </div>
        </div>
      </RuleCard>

      <RuleCard
        ruleKey="pending_lock"
        description="Låser hele systemet for medarbejderen, indtil kontrakten er underskrevet. Ejer rammes aldrig."
        canEdit={canEdit}
        enabled={pendingLockEnabled}
        onToggle={(v) => save("pending_lock", v, lockConfig())}
        dirty={lockDirty && canEdit}
        onSave={() => save("pending_lock", pendingLockEnabled, lockConfig())}
        saving={updatePolicy.isPending}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Lås efter (dage uden underskrift)</Label>
            <Input type="number" min={1} max={90} value={lockDays} onChange={(e) => setLockDays(e.target.value)} disabled={!canEdit} />
            <p className="text-xs text-muted-foreground">Minimum 1 dag — 0 er ikke muligt.</p>
          </div>
        </div>
      </RuleCard>

      <RuleCard
        ruleKey="rejected_lock"
        description="Spærrer adgang for medarbejdere, der har afvist en kontrakt, indtil en ny kontrakt er sendt."
        canEdit={canEdit}
        enabled={rejectedLockEnabled}
        onToggle={(v) => save("rejected_lock", v, {})}
      />

      <RuleCard
        ruleKey="management_digest"
        description="Daglig mail til ledelsen med listen over ansatte uden kontrakt og ansatte, der er startet uden underskrift."
        canEdit={canEdit}
        enabled={digestEnabled}
        onToggle={(v) =>
          save("management_digest", v, {
            recipients: recipients.split(",").map((s) => s.trim()).filter(Boolean),
            weekdays_only: digest.weekdays_only ?? true,
          })
        }
        dirty={digestDirty && canEdit}
        onSave={() =>
          save("management_digest", digestEnabled, {
            recipients: recipients.split(",").map((s) => s.trim()).filter(Boolean),
            weekdays_only: digest.weekdays_only ?? true,
          })
        }
        saving={updatePolicy.isPending}
      >
        <div className="space-y-2">
          <Label>Modtagere (mails adskilt af komma)</Label>
          <Input value={recipients} onChange={(e) => setRecipients(e.target.value)} disabled={!canEdit} placeholder="mdg@copenhagensales.dk, km@copenhagensales.dk" />
          <p className="text-xs text-muted-foreground">Sendes kun på hverdage. Mailen udsendes ikke, hvis der ikke er noget at rapportere.</p>
        </div>
      </RuleCard>

      <RuleCard
        ruleKey="ui_warning"
        description="Viser rødt banner og markering i medarbejderlisten, når en kommende opstart mangler kontrakt."
        canEdit={canEdit}
        enabled={uiWarningEnabled}
        onToggle={(v) => save("ui_warning", v, { warn_days_before_start: Number(warnDays) || 7 })}
        dirty={warnDirty && canEdit}
        onSave={() => save("ui_warning", uiWarningEnabled, { warn_days_before_start: Number(warnDays) || 7 })}
        saving={updatePolicy.isPending}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Advar dage før opstart</Label>
            <Input type="number" min={0} max={60} value={warnDays} onChange={(e) => setWarnDays(e.target.value)} disabled={!canEdit} />
          </div>
        </div>
      </RuleCard>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ændringslog</CardTitle>
          <CardDescription>Hvem har ændret hvilke regler — kan ikke redigeres eller slettes.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tidspunkt</TableHead>
                <TableHead>Regel</TableHead>
                <TableHead>Til/fra</TableHead>
                <TableHead>Indstillinger</TableHead>
                <TableHead>Ændret af</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    Ingen ændringer registreret endnu.
                  </TableCell>
                </TableRow>
              ) : (
                auditRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{format(parseISO(row.created_at), "dd. MMM yyyy HH:mm", { locale: da })}</TableCell>
                    <TableCell>{RULE_LABELS[row.key] ?? row.key}</TableCell>
                    <TableCell>
                      {row.old_enabled === row.new_enabled ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Badge variant={row.new_enabled ? "default" : "secondary"}>{row.new_enabled ? "Til" : "Fra"}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate">
                      {JSON.stringify(row.new_config ?? {})}
                    </TableCell>
                    <TableCell>{row.changed_by_email ?? "System"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
