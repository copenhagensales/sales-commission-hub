import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Shield, Plus, ArrowLeft, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSecurityIncidents, useCreateSecurityIncident, useUpdateSecurityIncident } from "@/hooks/useSecurityIncidents";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { da } from "date-fns/locale";

export default function SecurityIncidents() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: incidents = [], isLoading } = useSecurityIncidents();
  const createIncident = useCreateSecurityIncident();
  const updateIncident = useUpdateSecurityIncident();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    incident_date: new Date().toISOString().slice(0, 16),
    affected_categories: "",
    affected_count: "",
    severity: "medium",
    remedial_actions: "",
    reported_to_authority: false,
    reported_at: "",
  });

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast({ title: "Fejl", description: "Titel er påkrævet", variant: "destructive" });
      return;
    }
    try {
      await createIncident.mutateAsync({
        title: form.title,
        description: form.description || undefined,
        incident_date: new Date(form.incident_date).toISOString(),
        affected_categories: form.affected_categories ? form.affected_categories.split(",").map(s => s.trim()) : [],
        affected_count: form.affected_count ? parseInt(form.affected_count) : undefined,
        severity: form.severity,
        remedial_actions: form.remedial_actions || undefined,
        reported_to_authority: form.reported_to_authority,
        reported_at: form.reported_to_authority && form.reported_at ? new Date(form.reported_at).toISOString() : undefined,
      });
      toast({ title: "Hændelse registreret" });
      setOpen(false);
      setForm({
        title: "", description: "", incident_date: new Date().toISOString().slice(0, 16),
        affected_categories: "", affected_count: "", severity: "medium",
        remedial_actions: "", reported_to_authority: false, reported_at: "",
      });
    } catch {
      toast({ title: "Fejl", description: "Kunne ikke oprette hændelse", variant: "destructive" });
    }
  };

  const severityColor = (s: string) => {
    switch (s) {
      case "critical": return "bg-red-500/10 text-red-700 border-red-500/30";
      case "high": return "bg-orange-500/10 text-orange-700 border-orange-500/30";
      case "medium": return "bg-yellow-500/10 text-yellow-700 border-yellow-500/30";
      default: return "bg-green-500/10 text-green-700 border-green-500/30";
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "open": return "bg-red-500/10 text-red-700";
      case "investigating": return "bg-yellow-500/10 text-yellow-700";
      case "resolved": return "bg-green-500/10 text-green-700";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case "open": return "Åben";
      case "investigating": return "Undersøges";
      case "resolved": return "Løst";
      case "closed": return "Lukket";
      default: return s;
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateIncident.mutateAsync({ id, status: newStatus });
      toast({ title: "Status opdateret" });
    } catch {
      toast({ title: "Fejl", variant: "destructive" });
    }
  };

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/compliance")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <AlertTriangle className="h-7 w-7 text-destructive" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Sikkerhedsbrud-log</h1>
              <p className="text-sm text-muted-foreground">GDPR Artikel 33 – Registrering af databrud</p>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Registrer hændelse</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Registrer sikkerhedshændelse</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div><Label>Titel *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
                <div><Label>Beskrivelse</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
                <div><Label>Tidspunkt</Label><Input type="datetime-local" value={form.incident_date} onChange={e => setForm(f => ({ ...f, incident_date: e.target.value }))} /></div>
                <div><Label>Berørte kategorier (kommasepareret)</Label><Input value={form.affected_categories} onChange={e => setForm(f => ({ ...f, affected_categories: e.target.value }))} placeholder="f.eks. medarbejdere, kunder" /></div>
                <div><Label>Antal berørte personer</Label><Input type="number" value={form.affected_count} onChange={e => setForm(f => ({ ...f, affected_count: e.target.value }))} /></div>
                <div><Label>Alvorlighed</Label>
                  <Select value={form.severity} onValueChange={v => setForm(f => ({ ...f, severity: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Lav</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">Høj</SelectItem>
                      <SelectItem value="critical">Kritisk</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Afhjælpende foranstaltninger</Label><Textarea value={form.remedial_actions} onChange={e => setForm(f => ({ ...f, remedial_actions: e.target.value }))} rows={2} /></div>
                <div className="flex items-center gap-3">
                  <Switch checked={form.reported_to_authority} onCheckedChange={v => setForm(f => ({ ...f, reported_to_authority: v }))} />
                  <Label>Indberettet til Datatilsynet</Label>
                </div>
                {form.reported_to_authority && (
                  <div><Label>Indberettet dato</Label><Input type="datetime-local" value={form.reported_at} onChange={e => setForm(f => ({ ...f, reported_at: e.target.value }))} /></div>
                )}
                <Button onClick={handleSubmit} disabled={createIncident.isPending} className="w-full">
                  {createIncident.isPending ? "Opretter..." : "Registrer hændelse"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="p-4 text-sm text-foreground">
            <p>
              <strong>Vigtigt:</strong> Alle sikkerhedsbrud der involverer persondata skal registreres her inden for 72 timer. 
              Brud med høj risiko for de registrerede skal indberettes til Datatilsynet.
            </p>
          </CardContent>
        </Card>

        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Indlæser...</p>
        ) : incidents.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Ingen hændelser registreret</p>
              <p className="text-sm">Det er positivt! Brug knappen ovenfor hvis en hændelse opstår.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {incidents.map(incident => (
              <Card key={incident.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{incident.title}</h3>
                        <Badge variant="outline" className={severityColor(incident.severity)}>
                          {incident.severity === "critical" ? "Kritisk" : incident.severity === "high" ? "Høj" : incident.severity === "medium" ? "Medium" : "Lav"}
                        </Badge>
                        <Badge variant="secondary" className={statusColor(incident.status)}>
                          {statusLabel(incident.status)}
                        </Badge>
                        {incident.reported_to_authority && (
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-500/30">
                            Indberettet
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(incident.incident_date), "d. MMMM yyyy 'kl.' HH:mm", { locale: da })}
                        {incident.affected_count && ` · ${incident.affected_count} berørte`}
                        {incident.affected_categories?.length > 0 && ` · ${incident.affected_categories.join(", ")}`}
                      </p>
                      {incident.description && <p className="text-sm mt-2">{incident.description}</p>}
                      {incident.remedial_actions && (
                        <p className="text-sm text-muted-foreground mt-1"><strong>Afhjælpning:</strong> {incident.remedial_actions}</p>
                      )}
                    </div>
                    <Select value={incident.status} onValueChange={v => handleStatusChange(incident.id, v)}>
                      <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Åben</SelectItem>
                        <SelectItem value="investigating">Undersøges</SelectItem>
                        <SelectItem value="resolved">Løst</SelectItem>
                        <SelectItem value="closed">Lukket</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
