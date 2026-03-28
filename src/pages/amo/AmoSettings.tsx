import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Settings, Shield, Bell, Edit, Plus, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type ComplianceRule = Database["public"]["Tables"]["amo_compliance_rules"]["Row"];
type RuleType = Database["public"]["Enums"]["amo_rule_type"];

const ruleTypeLabels: Record<RuleType, string> = {
  lovpligtigt: "Lovpligtigt",
  anbefalet: "Anbefalet",
  intern: "Intern",
};

export default function AmoSettings() {
  const [rules, setRules] = useState<ComplianceRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ComplianceRule | null>(null);
  const [form, setForm] = useState({
    rule_name: "",
    description: "",
    rule_type: "deadline" as RuleType,
    interval_months: "",
    check_logic_key: "",
    active: true,
  });

  // Notification settings (local state - could be persisted)
  const [notifications, setNotifications] = useState({
    emailReminders: true,
    overdueAlerts: true,
    reminderDays: 30,
  });

  const fetchRules = async () => {
    setLoading(true);
    const { data } = await supabase.from("amo_compliance_rules").select("*").order("rule_name");
    if (data) setRules(data);
    setLoading(false);
  };

  useEffect(() => { fetchRules(); }, []);

  const openCreate = () => {
    setEditingRule(null);
    setForm({ rule_name: "", description: "", rule_type: "lovpligtigt", interval_months: "", check_logic_key: "", active: true });
    setDialogOpen(true);
  };

  const openEdit = (rule: ComplianceRule) => {
    setEditingRule(rule);
    setForm({
      rule_name: rule.rule_name,
      description: rule.description || "",
      rule_type: rule.rule_type,
      interval_months: rule.interval_months?.toString() || "",
      check_logic_key: rule.check_logic_key || "",
      active: rule.active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.rule_name.trim()) { toast.error("Regelnavn er påkrævet"); return; }
    const payload = {
      rule_name: form.rule_name,
      description: form.description || null,
      rule_type: form.rule_type,
      interval_months: form.interval_months ? parseInt(form.interval_months) : null,
      check_logic_key: form.check_logic_key || null,
      active: form.active,
    };

    if (editingRule) {
      const { error } = await supabase.from("amo_compliance_rules").update(payload).eq("id", editingRule.id);
      if (error) { toast.error("Fejl ved opdatering"); return; }
      toast.success("Regel opdateret");
    } else {
      const { error } = await supabase.from("amo_compliance_rules").insert(payload);
      if (error) { toast.error("Fejl ved oprettelse"); return; }
      toast.success("Regel oprettet");
    }
    setDialogOpen(false);
    fetchRules();
  };

  const toggleActive = async (rule: ComplianceRule) => {
    await supabase.from("amo_compliance_rules").update({ active: !rule.active }).eq("id", rule.id);
    fetchRules();
  };

  return (
    <MainLayout>
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          AMO Indstillinger
        </h1>
        <p className="text-muted-foreground text-sm">Konfigurer compliance-regler og notifikationer</p>
      </div>

      {/* Notification Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifikationer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Deadline-påmindelser</p>
              <p className="text-xs text-muted-foreground">Vis advarsler når deadlines nærmer sig</p>
            </div>
            <Switch
              checked={notifications.emailReminders}
              onCheckedChange={(v) => setNotifications({ ...notifications, emailReminders: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Overdue-alerts</p>
              <p className="text-xs text-muted-foreground">Fremhæv overskredne frister i dashboard</p>
            </div>
            <Switch
              checked={notifications.overdueAlerts}
              onCheckedChange={(v) => setNotifications({ ...notifications, overdueAlerts: v })}
            />
          </div>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm font-medium">Påmindelse (dage før deadline)</p>
              <p className="text-xs text-muted-foreground">Standard antal dage før advarsel vises</p>
            </div>
            <Input
              type="number"
              className="w-20"
              value={notifications.reminderDays}
              onChange={(e) => setNotifications({ ...notifications, reminderDays: parseInt(e.target.value) || 30 })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Compliance Rules */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Compliance-regler
          </CardTitle>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Ny regel
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Regel</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Interval</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Handlinger</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Indlæser...</TableCell></TableRow>
              ) : rules.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Ingen regler konfigureret</TableCell></TableRow>
              ) : (
                rules.map((rule) => (
                  <TableRow key={rule.id} className={!rule.active ? "opacity-50" : ""}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{rule.rule_name}</p>
                        {rule.description && <p className="text-xs text-muted-foreground">{rule.description}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{ruleTypeLabels[rule.rule_type]}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {rule.interval_months ? `${rule.interval_months} mdr.` : "–"}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${rule.active ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-muted text-muted-foreground"}`}>
                        {rule.active ? "Aktiv" : "Inaktiv"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toggleActive(rule)}>
                          {rule.active ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEdit(rule)}>
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Rediger regel" : "Ny compliance-regel"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Regelnavn *</Label>
              <Input value={form.rule_name} onChange={(e) => setForm({ ...form, rule_name: e.target.value })} />
            </div>
            <div>
              <Label>Beskrivelse</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Regeltype</Label>
                <Select value={form.rule_type} onValueChange={(v) => setForm({ ...form, rule_type: v as RuleType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ruleTypeLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Interval (måneder)</Label>
                <Input type="number" value={form.interval_months} onChange={(e) => setForm({ ...form, interval_months: e.target.value })} placeholder="f.eks. 12" />
              </div>
            </div>
            <div>
              <Label>Check Logic Key</Label>
              <Input value={form.check_logic_key} onChange={(e) => setForm({ ...form, check_logic_key: e.target.value })} placeholder="f.eks. apv_3year_cycle" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              <Label>Aktiv</Label>
            </div>
            <Button className="w-full" onClick={handleSave}>
              {editingRule ? "Gem ændringer" : "Opret regel"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </MainLayout>
  );
}
