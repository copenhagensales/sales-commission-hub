import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import {
  useDeactivationNotificationLog,
  useDeactivationNotificationSettings,
  useDeactivationRecipientPreview,
  useUpdateDeactivationNotificationSettings,
  type DeactivationNotificationSettings,
} from "@/hooks/useDeactivationNotificationSettings";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  Plus,
  Save,
  Send,
  Users,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";

const PLACEHOLDERS = [
  { token: "{{employee_name}}", label: "Medarbejderens navn" },
  { token: "{{team_name}}", label: "Team" },
  { token: "{{employee_email}}", label: "Medarbejderens mail" },
  { token: "{{deactivation_date}}", label: "Deaktiveringsdato" },
  { token: "{{actor_name}}", label: "Hvem der deaktiverede" },
];

const SOURCE_LABELS: Record<string, string> = {
  "employee-list": "Alle medarbejdere",
  "staff-list": "Backoffice",
  "employee-profile": "Medarbejderprofil",
  "employee-form": "Rediger medarbejder",
  manual: "Manuelt",
  unknown: "Ukendt",
};

const STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  sent: { label: "Sendt", variant: "default" },
  failed: { label: "Fejlet", variant: "destructive" },
  no_recipients: { label: "Ingen modtagere", variant: "destructive" },
};

interface EmailListEditorProps {
  label: string;
  description: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}

function EmailListEditor({ label, description, values, onChange, placeholder }: EmailListEditorProps) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const candidates = draft
      .split(/[,\s;]+/)
      .map((v) => v.trim())
      .filter(Boolean);
    const invalid = candidates.filter((c) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c));
    if (invalid.length > 0) {
      toast({ title: "Ugyldig mailadresse", description: invalid.join(", "), variant: "destructive" });
      return;
    }
    const next = [...values];
    candidates.forEach((c) => {
      if (!next.some((v) => v.toLowerCase() === c.toLowerCase())) next.push(c);
    });
    onChange(next);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <div>
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder={placeholder ?? "navn@copenhagensales.dk"}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="secondary" onClick={add} disabled={!draft.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {values.map((email) => (
            <Badge key={email} variant="secondary" className="gap-1 pr-1 font-normal">
              {email}
              <button
                type="button"
                aria-label={`Fjern ${email}`}
                className="rounded-sm p-0.5 hover:bg-muted"
                onClick={() => onChange(values.filter((v) => v !== email))}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">Ingen tilføjet</p>
      )}
    </div>
  );
}

export function DeactivationSettingsTab({ canEdit }: { canEdit: boolean }) {
  const { data: settings, isLoading } = useDeactivationNotificationSettings();
  const updateSettings = useUpdateDeactivationNotificationSettings();
  const { data: log = [], isLoading: logLoading, refetch: refetchLog } = useDeactivationNotificationLog(25);

  const [draft, setDraft] = useState<DeactivationNotificationSettings | null>(null);
  const [previewTeamId, setPreviewTeamId] = useState<string>("none");
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    if (settings) setDraft(settings);
  }, [settings]);

  const { data: teams = [] } = useQuery({
    queryKey: ["teams-for-deactivation-settings"],
    queryFn: async () => {
      const sel = (s: string): string => s;
      const { data, error } = await supabase
        .from("teams")
        .select(sel("id, name"))
        .order("name")
        .returns<{ id: string; name: string }[]>();
      if (error) throw error;
      return data ?? [];
    },
  });

  const preview = useDeactivationRecipientPreview(
    previewTeamId === "none" ? null : previewTeamId,
    canEdit && !!settings,
  );

  const isDirty = useMemo(() => {
    if (!draft || !settings) return false;
    return JSON.stringify(draft as unknown) !== JSON.stringify(settings as unknown);
  }, [draft, settings]);

  const patch = (updates: Partial<DeactivationNotificationSettings>) =>
    setDraft((prev) => (prev ? { ...prev, ...updates } : prev));

  const handleSave = async () => {
    if (!draft) return;
    try {
      await updateSettings.mutateAsync(draft);
      toast({ title: "Indstillinger gemt", description: "Reglerne gælder med øjeblikkelig virkning." });
      preview.refetch();
    } catch (error) {
      toast({
        title: "Kunne ikke gemme",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleTestSend = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail.trim())) {
      toast({ title: "Angiv en gyldig mailadresse", variant: "destructive" });
      return;
    }
    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-deactivation-reminder", {
        body: {
          test_recipients: [testEmail.trim()],
          team_id: previewTeamId === "none" ? null : previewTeamId,
          source: "manual",
          employee_name: "Test Medarbejder",
          employee_email: "test@copenhagensales.dk",
        },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      toast({ title: "Testmail sendt", description: `Sendt til ${testEmail.trim()}` });
    } catch (error) {
      toast({ title: "Testmail fejlede", description: (error as Error).message, variant: "destructive" });
    } finally {
      setSendingTest(false);
    }
  };

  if (isLoading || !draft) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Indlæser indstillinger…
      </div>
    );
  }

  const failedCount = log.filter((l) => l.status !== "sent").length;

  return (
    <div className="space-y-6">
      {/* Status header */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BellRing className="h-5 w-5 text-primary" />
                Deaktiveringsnotifikationer
              </CardTitle>
              <CardDescription>
                Én central regel for hvem der får mail, når en medarbejder deaktiveres — uanset om det sker fra
                medarbejderlisten, backoffice, profilen eller redigeringsdialogen.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={draft.is_enabled ? "default" : "destructive"} className="gap-1">
                {draft.is_enabled ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                {draft.is_enabled ? "Aktiv" : "Slået fra"}
              </Badge>
              <Switch
                checked={draft.is_enabled}
                disabled={!canEdit}
                onCheckedChange={(v) => patch({ is_enabled: v })}
                aria-label="Slå notifikationer til eller fra"
              />
            </div>
          </div>
        </CardHeader>
        {!draft.is_enabled && (
          <CardContent>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Ingen mails sendes</AlertTitle>
              <AlertDescription>
                Deaktiveringer registreres stadig i loggen, men der udsendes ingen notifikationer.
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recipients */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" /> Modtagere
            </CardTitle>
            <CardDescription>Grupper udledes automatisk fra stamdata — ingen navne i koden.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {[
              { key: "include_team_leaders" as const, label: "Teamleder på medarbejderens team" },
              { key: "include_assistant_leaders" as const, label: "Assisterende teamleder" },
              { key: "include_recruitment" as const, label: "Rekruttering" },
              { key: "include_owners" as const, label: "Ejere" },
            ].map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-4">
                <Label className="text-sm font-normal">{row.label}</Label>
                <Switch
                  checked={draft[row.key]}
                  disabled={!canEdit}
                  onCheckedChange={(v) => patch({ [row.key]: v } as Partial<DeactivationNotificationSettings>)}
                />
              </div>
            ))}

            <Separator />

            <EmailListEditor
              label="Faste ekstra modtagere"
              description="Får altid mail, uanset team."
              values={draft.extra_recipients}
              onChange={(next) => canEdit && patch({ extra_recipients: next })}
            />

            <EmailListEditor
              label="Udelukkede modtagere"
              description="Får aldrig mail, selv om de indgår i en gruppe ovenfor."
              values={draft.excluded_emails}
              onChange={(next) => canEdit && patch({ excluded_emails: next })}
            />

            <div className="space-y-2">
              <Label className="text-sm font-medium">Ekstra stillinger som modtager</Label>
              <p className="text-xs text-muted-foreground">
                Fx “Backoffice”. Alle aktive medarbejdere med stillingen får mail.
              </p>
              <Input
                value={draft.recipient_job_titles.join(", ")}
                disabled={!canEdit}
                placeholder="Backoffice, HR"
                onChange={(e) =>
                  patch({
                    recipient_job_titles: e.target.value
                      .split(",")
                      .map((v) => v.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Template + followup */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" /> Mailskabelon
            </CardTitle>
            <CardDescription>Bruges til både første mail og opfølgning.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Emne</Label>
              <Input
                value={draft.email_subject}
                disabled={!canEdit}
                onChange={(e) => patch({ email_subject: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Brødtekst</Label>
              <Textarea
                value={draft.email_body}
                disabled={!canEdit}
                rows={12}
                className="font-mono text-xs leading-relaxed"
                onChange={(e) => patch({ email_body: e.target.value })}
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {PLACEHOLDERS.map((p) => (
                  <Badge key={p.token} variant="outline" className="font-mono text-[11px] font-normal">
                    {p.token}
                    <span className="ml-1 font-sans text-muted-foreground">{p.label}</span>
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-sm font-normal">Send opfølgning hvis intet er gjort</Label>
                  <p className="text-xs text-muted-foreground">Kører automatisk som baggrundsjob.</p>
                </div>
                <Switch
                  checked={draft.followup_enabled}
                  disabled={!canEdit}
                  onCheckedChange={(v) => patch({ followup_enabled: v })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Forsinkelse (timer)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={168}
                    value={draft.followup_delay_hours}
                    disabled={!canEdit || !draft.followup_enabled}
                    onChange={(e) =>
                      patch({ followup_delay_hours: Math.max(1, Math.min(168, Number(e.target.value) || 1)) })
                    }
                  />
                </div>
                <div className="flex items-end justify-between gap-2">
                  <Label className="text-sm font-normal">Undtag ejere fra opfølgning</Label>
                  <Switch
                    checked={draft.followup_exclude_owners}
                    disabled={!canEdit || !draft.followup_enabled}
                    onCheckedChange={(v) => patch({ followup_exclude_owners: v })}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live preview + test */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kontrol: hvem får mailen?</CardTitle>
          <CardDescription>
            Modtagerne udregnes på serveren ud fra de gemte indstillinger — vælg et team for at se resultatet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Team</Label>
              <Select value={previewTeamId} onValueChange={setPreviewTeamId}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uden team</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Send testmail til</Label>
              <div className="flex gap-2">
                <Input
                  value={testEmail}
                  placeholder="dig@copenhagensales.dk"
                  className="w-[240px]"
                  onChange={(e) => setTestEmail(e.target.value)}
                />
                <Button variant="secondary" onClick={handleTestSend} disabled={!canEdit || sendingTest}>
                  {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            {isDirty && (
              <Badge variant="outline" className="mb-2 gap-1 text-amber-600 border-amber-300">
                <AlertTriangle className="h-3 w-3" /> Ikke-gemte ændringer vises ikke i kontrollen
              </Badge>
            )}
          </div>

          <div className="rounded-lg border bg-muted/30 p-4">
            {preview.isLoading ? (
              <p className="flex items-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Udregner modtagere…
              </p>
            ) : preview.error ? (
              <p className="text-sm text-destructive">{(preview.error as Error).message}</p>
            ) : preview.data?.recipients?.length ? (
              <div className="flex flex-wrap gap-2">
                {preview.data.recipients.map((email) => (
                  <Badge key={email} variant="secondary" className="font-normal">
                    {email}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-destructive">
                Ingen modtagere udledt — ingen mail vil blive sendt for dette team.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Log */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Seneste notifikationer</CardTitle>
              <CardDescription>
                Fuldt spor af hver deaktivering: kilde, modtagere, status og opfølgning.
              </CardDescription>
            </div>
            {failedCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> {failedCount} kræver opmærksomhed
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {logLoading ? (
            <p className="flex items-center py-6 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Indlæser log…
            </p>
          ) : log.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">Ingen notifikationer registreret endnu.</p>
          ) : (
            <div className="divide-y">
              {log.map((entry) => {
                const meta = STATUS_META[entry.status] ?? { label: entry.status, variant: "secondary" as const };
                const name = `${entry.employee_master_data?.first_name ?? ""} ${
                  entry.employee_master_data?.last_name ?? ""
                }`.trim();
                return (
                  <div key={entry.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{name || "Ukendt medarbejder"}</span>
                        <Badge variant={meta.variant} className="text-[11px]">
                          {meta.label}
                        </Badge>
                        <Badge variant="outline" className="text-[11px] font-normal">
                          {SOURCE_LABELS[entry.source ?? "unknown"] ?? entry.source}
                        </Badge>
                        {entry.followup_sent_at && (
                          <Badge variant="outline" className="gap-1 text-[11px] font-normal">
                            <Clock className="h-3 w-3" /> Opfølgning sendt
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {entry.teams?.name ?? "Uden team"} ·{" "}
                        {entry.recipients?.length
                          ? entry.recipients.join(", ")
                          : "ingen modtagere"}
                      </p>
                      {entry.error_message && (
                        <p className="text-xs text-destructive">{entry.error_message}</p>
                      )}
                    </div>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {format(new Date(entry.initial_sent_at), "d. MMM yyyy HH:mm", { locale: da })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sticky save bar */}
      {canEdit && (
        <div className="sticky bottom-4 flex items-center justify-between gap-4 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur">
          <p className="text-sm text-muted-foreground">
            {isDirty ? "Du har ændringer, der ikke er gemt." : "Alt er gemt."}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => settings && setDraft(settings)} disabled={!isDirty}>
              Fortryd
            </Button>
            <Button onClick={handleSave} disabled={!isDirty || updateSettings.isPending}>
              {updateSettings.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Gem indstillinger
            </Button>
          </div>
        </div>
      )}
      {!canEdit && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Kun læseadgang</AlertTitle>
          <AlertDescription>Kun ejere kan ændre reglerne for deaktiveringsnotifikationer.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export default DeactivationSettingsTab;
