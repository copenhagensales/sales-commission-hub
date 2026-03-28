import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Plus, Pencil, Trash2, Users, Building2, Vote } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { da } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const roleLabels: Record<string, string> = {
  admin: "Admin",
  ledelsesrepresentant: "Ledelsesrepræsentant",
  arbejdsleder: "Arbejdsleder",
  amr: "Arbejdsmiljørepræsentant",
  readonly: "Læseadgang",
};

const roleTypes = ["admin", "ledelsesrepresentant", "arbejdsleder", "amr", "readonly"] as const;

type WorkplaceForm = { name: string; address: string; employee_count: number; notes: string };
type MemberForm = { full_name: string; email: string; role_type: string; workplace_id: string; notes: string; training_required: boolean; prior_valid_training: boolean };

export default function AmoOrganisation() {
  const qc = useQueryClient();
  const today = new Date();

  const [wpDialog, setWpDialog] = useState(false);
  const [editWp, setEditWp] = useState<any>(null);
  const [wpForm, setWpForm] = useState<WorkplaceForm>({ name: "", address: "", employee_count: 0, notes: "" });

  const [memberDialog, setMemberDialog] = useState(false);
  const [editMember, setEditMember] = useState<any>(null);
  const [memberForm, setMemberForm] = useState<MemberForm>({ full_name: "", email: "", role_type: "amr", workplace_id: "", notes: "", training_required: true, prior_valid_training: false });

  const { data: workplaces } = useQuery({
    queryKey: ["amo-workplaces"],
    queryFn: async () => {
      const { data } = await supabase.from("amo_workplaces").select("*").order("name");
      return data || [];
    },
  });

  const { data: members } = useQuery({
    queryKey: ["amo-members-all"],
    queryFn: async () => {
      const { data } = await supabase.from("amo_members").select("*").order("full_name");
      return data || [];
    },
  });

  const { data: elections } = useQuery({
    queryKey: ["amo-amr-elections"],
    queryFn: async () => {
      const { data } = await supabase.from("amo_amr_elections").select("*, amo_members(full_name)").order("next_election_due");
      return data || [];
    },
  });

  // Workplace mutations
  const saveWp = useMutation({
    mutationFn: async (form: WorkplaceForm) => {
      if (editWp) {
        const { error } = await supabase.from("amo_workplaces").update(form).eq("id", editWp.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("amo_workplaces").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["amo-workplaces"] });
      setWpDialog(false);
      toast.success(editWp ? "Arbejdsplads opdateret" : "Arbejdsplads oprettet");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteWp = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("amo_workplaces").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["amo-workplaces"] });
      toast.success("Arbejdsplads slettet");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Member mutations
  const saveMember = useMutation({
    mutationFn: async (form: MemberForm) => {
      const payload = {
        ...form,
        workplace_id: form.workplace_id || null,
        role_type: form.role_type as any,
      };
      if (editMember) {
        const { error } = await supabase.from("amo_members").update(payload).eq("id", editMember.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("amo_members").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["amo-members-all"] });
      qc.invalidateQueries({ queryKey: ["amo-members"] });
      setMemberDialog(false);
      toast.success(editMember ? "Medlem opdateret" : "Medlem oprettet");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("amo_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["amo-members-all"] });
      qc.invalidateQueries({ queryKey: ["amo-members"] });
      toast.success("Medlem slettet");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openNewWp = () => {
    setEditWp(null);
    setWpForm({ name: "", address: "", employee_count: 0, notes: "" });
    setWpDialog(true);
  };

  const openEditWp = (wp: any) => {
    setEditWp(wp);
    setWpForm({ name: wp.name, address: wp.address || "", employee_count: wp.employee_count, notes: wp.notes || "" });
    setWpDialog(true);
  };

  const openNewMember = () => {
    setEditMember(null);
    setMemberForm({ full_name: "", email: "", role_type: "amr", workplace_id: "", notes: "", training_required: true, prior_valid_training: false });
    setMemberDialog(true);
  };

  const openEditMember = (m: any) => {
    setEditMember(m);
    setMemberForm({
      full_name: m.full_name,
      email: m.email || "",
      role_type: m.role_type,
      workplace_id: m.workplace_id || "",
      notes: m.notes || "",
      training_required: m.training_required,
      prior_valid_training: m.prior_valid_training,
    });
    setMemberDialog(true);
  };

  // Compliance info
  const totalEmployees = workplaces?.reduce((sum, wp) => sum + wp.employee_count, 0) || 0;
  const complianceNote = totalEmployees < 10
    ? "Under 10 ansatte: AMO kan organiseres uformelt, men der skal stadig gennemføres APV."
    : totalEmployees < 35
    ? "10-34 ansatte: Der skal oprettes en AMO-gruppe med mindst 1 AMR og 1 arbejdsleder."
    : "35+ ansatte: Der skal oprettes AMO med udvalg. Flere AMR-grupper kan være nødvendige.";

  const activeMembers = members?.filter(m => m.active) || [];

  return (
    <MainLayout>
    <div className="min-h-screen bg-background p-4 md:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-emerald-500/20">
          <Shield className="h-6 w-6 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">AMO Organisation</h1>
          <p className="text-sm text-muted-foreground">Arbejdspladser, medlemmer og AMR-valg</p>
        </div>
      </div>

      {/* Compliance requirement info */}
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-blue-200">
        <strong>{totalEmployees} ansatte i alt.</strong> {complianceNote}
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Medlemmer ({activeMembers.length})</TabsTrigger>
          <TabsTrigger value="workplaces">Arbejdspladser ({workplaces?.length || 0})</TabsTrigger>
          <TabsTrigger value="elections">AMR-valg ({elections?.length || 0})</TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openNewMember} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Tilføj medlem
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Navn</TableHead>
                    <TableHead>Rolle</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Arbejdsplads</TableHead>
                    <TableHead>Uddannelse</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members?.map(m => {
                    const wp = workplaces?.find(w => w.id === m.workplace_id);
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.full_name}</TableCell>
                        <TableCell>{roleLabels[m.role_type] || m.role_type}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{m.email || "–"}</TableCell>
                        <TableCell className="text-xs">{wp?.name || "–"}</TableCell>
                        <TableCell>
                          {m.training_required ? (
                            m.prior_valid_training ? (
                              <span className="text-xs text-emerald-400">Gyldig</span>
                            ) : (
                              <span className="text-xs text-yellow-400">Mangler</span>
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground">Ikke påkrævet</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={cn("text-xs px-1.5 py-0.5 rounded", m.active ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground")}>
                            {m.active ? "Aktiv" : "Inaktiv"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditMember(m)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => {
                              if (confirm("Slet dette medlem?")) deleteMember.mutate(m.id);
                            }}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!members || members.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Ingen medlemmer registreret endnu
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Workplaces Tab */}
        <TabsContent value="workplaces" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openNewWp} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Tilføj arbejdsplads
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workplaces?.map(wp => (
              <Card key={wp.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {wp.name}
                    </CardTitle>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditWp(wp)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                        if (confirm("Slet denne arbejdsplads?")) deleteWp.mutate(wp.id);
                      }}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1">
                  {wp.address && <p className="text-xs text-muted-foreground">{wp.address}</p>}
                  <p className="text-sm"><Users className="h-3.5 w-3.5 inline mr-1" />{wp.employee_count} ansatte</p>
                  {wp.notes && <p className="text-xs text-muted-foreground">{wp.notes}</p>}
                  <div className="pt-1">
                    <span className="text-xs text-muted-foreground">
                      {members?.filter(m => m.workplace_id === wp.id && m.active).length || 0} AMO-medlemmer
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!workplaces || workplaces.length === 0) && (
              <p className="text-sm text-muted-foreground col-span-full text-center py-8">Ingen arbejdspladser registreret</p>
            )}
          </div>
        </TabsContent>

        {/* Elections Tab */}
        <TabsContent value="elections" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medlem</TableHead>
                    <TableHead>Valgt</TableHead>
                    <TableHead>Periode</TableHead>
                    <TableHead>Næste valg</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {elections?.map((el: any) => {
                    const daysUntil = differenceInDays(new Date(el.next_election_due), today);
                    const status = daysUntil < 0 ? "red" : daysUntil <= 60 ? "yellow" : "green";
                    return (
                      <TableRow key={el.id}>
                        <TableCell className="font-medium">{el.amo_members?.full_name || "–"}</TableCell>
                        <TableCell>{format(new Date(el.elected_date), "d. MMM yyyy", { locale: da })}</TableCell>
                        <TableCell>{el.election_period_months} mdr.</TableCell>
                        <TableCell>{format(new Date(el.next_election_due), "d. MMM yyyy", { locale: da })}</TableCell>
                        <TableCell>
                          <span className={cn(
                            "text-xs px-1.5 py-0.5 rounded",
                            status === "green" ? "bg-emerald-500/20 text-emerald-400" :
                            status === "yellow" ? "bg-yellow-500/20 text-yellow-400" :
                            "bg-red-500/20 text-red-400"
                          )}>
                            {status === "red" ? "Overskredet" : status === "yellow" ? "Snart" : "OK"}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!elections || elections.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Ingen AMR-valg registreret
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Workplace Dialog */}
      <Dialog open={wpDialog} onOpenChange={setWpDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editWp ? "Rediger arbejdsplads" : "Ny arbejdsplads"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Navn *</Label>
              <Input value={wpForm.name} onChange={e => setWpForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Adresse</Label>
              <Input value={wpForm.address} onChange={e => setWpForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div>
              <Label>Antal ansatte</Label>
              <Input type="number" value={wpForm.employee_count} onChange={e => setWpForm(f => ({ ...f, employee_count: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <Label>Noter</Label>
              <Textarea value={wpForm.notes} onChange={e => setWpForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWpDialog(false)}>Annuller</Button>
            <Button onClick={() => saveWp.mutate(wpForm)} disabled={!wpForm.name || saveWp.isPending}>
              {saveWp.isPending ? "Gemmer..." : "Gem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member Dialog */}
      <Dialog open={memberDialog} onOpenChange={setMemberDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editMember ? "Rediger medlem" : "Nyt AMO-medlem"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Fulde navn *</Label>
              <Input value={memberForm.full_name} onChange={e => setMemberForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={memberForm.email} onChange={e => setMemberForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <Label>Rolle *</Label>
              <Select value={memberForm.role_type} onValueChange={v => setMemberForm(f => ({ ...f, role_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roleTypes.map(r => (
                    <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Arbejdsplads</Label>
              <Select value={memberForm.workplace_id} onValueChange={v => setMemberForm(f => ({ ...f, workplace_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Vælg arbejdsplads" /></SelectTrigger>
                <SelectContent>
                  {workplaces?.map(wp => (
                    <SelectItem key={wp.id} value={wp.id}>{wp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={memberForm.training_required} onChange={e => setMemberForm(f => ({ ...f, training_required: e.target.checked }))} className="rounded" />
                Uddannelse påkrævet
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={memberForm.prior_valid_training} onChange={e => setMemberForm(f => ({ ...f, prior_valid_training: e.target.checked }))} className="rounded" />
                Har gyldig uddannelse
              </label>
            </div>
            <div>
              <Label>Noter</Label>
              <Textarea value={memberForm.notes} onChange={e => setMemberForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMemberDialog(false)}>Annuller</Button>
            <Button onClick={() => saveMember.mutate(memberForm)} disabled={!memberForm.full_name || saveMember.isPending}>
              {saveMember.isPending ? "Gemmer..." : "Gem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </MainLayout>
  );
}
