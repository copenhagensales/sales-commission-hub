import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Mail, MessageSquare, Pencil, Loader2, Plus, Trash2 } from "lucide-react";

interface FlowStep {
  id: string;
  day: number;
  channel: string;
  template_key: string;
  subject: string;
  content: string;
  offset_hours: number;
  sort_order: number;
  is_active: boolean;
  phase: string;
}

const PHASE_GROUPS = [
  { phase: "active", label: "Aktiv booking — Dag 0–10", color: "text-foreground" },
  { phase: "confirmation", label: "Bekræftelse — Ved booking", color: "text-foreground" },
  { phase: "reengagement", label: "Re-engagement — Dag 45+", color: "text-foreground" },
];

function channelIcon(channel: string) {
  switch (channel) {
    case "email": return <Mail className="h-4 w-4 text-blue-500" />;
    case "sms": return <MessageSquare className="h-4 w-4 text-green-500" />;
    default: return null;
  }
}

function highlightMergeTags(text: string) {
  return text.split(/({{[^}]+}})/).map((part, i) =>
    part.match(/^{{.+}}$/)
      ? <Badge key={i} variant="secondary" className="text-[10px] px-1 py-0 mx-0.5 font-mono">{part}</Badge>
      : <span key={i}>{part}</span>
  );
}

export function FlowTemplatesTab() {
  const queryClient = useQueryClient();
  const [editStep, setEditStep] = useState<FlowStep | null>(null);
  const [addPhase, setAddPhase] = useState<string | null>(null);

  // Add/Edit form state
  const [formDay, setFormDay] = useState(0);
  const [formChannel, setFormChannel] = useState("email");
  const [formSubject, setFormSubject] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formOffsetHours, setFormOffsetHours] = useState(10);

  const { data: steps, isLoading } = useQuery({
    queryKey: ["booking-flow-steps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_flow_steps")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as FlowStep[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (step: FlowStep) => {
      const { error } = await supabase
        .from("booking_flow_steps")
        .update({
          subject: step.subject,
          content: step.content,
          day: step.day,
          channel: step.channel,
          offset_hours: step.offset_hours,
        })
        .eq("id", step.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-flow-steps"] });
      setEditStep(null);
      toast.success("Skabelon gemt");
    },
    onError: (err: any) => toast.error("Fejl: " + err.message),
  });

  const addMutation = useMutation({
    mutationFn: async ({ phase, day, channel, subject, content, offset_hours }: {
      phase: string; day: number; channel: string; subject: string; content: string; offset_hours: number;
    }) => {
      const maxSort = (steps || []).filter(s => s.phase === phase).reduce((max, s) => Math.max(max, s.sort_order), 0);
      const templateKey = `flow_custom_dag${day}_${channel}_${Date.now()}`;
      const { error } = await supabase.from("booking_flow_steps").insert({
        day,
        channel,
        template_key: templateKey,
        subject,
        content,
        offset_hours,
        sort_order: maxSort + 1,
        is_active: true,
        phase,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-flow-steps"] });
      setAddPhase(null);
      toast.success("Trin tilføjet");
    },
    onError: (err: any) => toast.error("Fejl: " + err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("booking_flow_steps").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-flow-steps"] });
      toast.success("Trin slettet");
    },
    onError: (err: any) => toast.error("Fejl: " + err.message),
  });

  function openEdit(step: FlowStep) {
    setEditStep(step);
    setFormDay(step.day);
    setFormChannel(step.channel);
    setFormSubject(step.subject);
    setFormContent(step.content);
    setFormOffsetHours(step.offset_hours);
  }

  function openAdd(phase: string) {
    setAddPhase(phase);
    setFormDay(0);
    setFormChannel("email");
    setFormSubject("");
    setFormContent("");
    setFormOffsetHours(10);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Rediger de beskeder der sendes i hvert trin af booking-flowet. Brug <Badge variant="secondary" className="text-[10px] px-1 py-0 font-mono">{"{{fornavn}}"}</Badge>, <Badge variant="secondary" className="text-[10px] px-1 py-0 font-mono">{"{{rolle}}"}</Badge>, <Badge variant="secondary" className="text-[10px] px-1 py-0 font-mono">{"{{booking_link}}"}</Badge>, <Badge variant="secondary" className="text-[10px] px-1 py-0 font-mono">{"{{afmeld_link}}"}</Badge>, <Badge variant="secondary" className="text-[10px] px-1 py-0 font-mono">{"{{ringetidspunkt}}"}</Badge>, <Badge variant="secondary" className="text-[10px] px-1 py-0 font-mono">{"{{telefonnummer}}"}</Badge>, <Badge variant="secondary" className="text-[10px] px-1 py-0 font-mono">{"{{dato}}"}</Badge> og <Badge variant="secondary" className="text-[10px] px-1 py-0 font-mono">{"{{tidspunkt}}"}</Badge> som merge-tags.
      </p>

      {PHASE_GROUPS.map(group => {
        const groupSteps = (steps || []).filter(s => s.phase === group.phase);
        return (
          <Card key={group.phase}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className={`text-base ${group.color}`}>
                  {group.label}
                </CardTitle>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => openAdd(group.phase)}>
                  <Plus className="h-3.5 w-3.5" />
                  Tilføj trin
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {groupSteps.length === 0 && (
                <p className="text-xs text-muted-foreground py-4 text-center">Ingen trin i denne fase</p>
              )}
              {groupSteps.map(step => (
                <div key={step.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                  <div className="mt-0.5">{channelIcon(step.channel)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-muted-foreground">Dag {step.day}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {step.channel === "email" ? "Email" : "SMS"}
                      </Badge>
                    </div>
                    {step.channel === "email" && step.subject && (
                      <p className="text-xs font-medium mb-1 truncate">{step.subject}</p>
                    )}
                    <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-line">
                      {highlightMergeTags(step.content)}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Slet trin?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Er du sikker på at du vil slette dette trin (Dag {step.day} — {step.channel === "email" ? "Email" : "SMS"})? Eksisterende flows påvirkes ikke.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuller</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(step.id)}>Slet</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(step)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {/* Edit Dialog */}
      <Dialog open={!!editStep} onOpenChange={(open) => !open && setEditStep(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Rediger trin</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Dag</Label>
                <Input type="number" min={0} value={formDay} onChange={e => setFormDay(parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <Label>Kanal</Label>
                <Select value={formChannel} onValueChange={setFormChannel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tidspunkt (time)</Label>
                <Input type="number" min={0} max={23} step={0.5} value={formOffsetHours} onChange={e => setFormOffsetHours(parseFloat(e.target.value) || 0)} />
              </div>
            </div>
            {formChannel === "email" && (
              <div>
                <Label>Emne</Label>
                <Input value={formSubject} onChange={e => setFormSubject(e.target.value)} />
              </div>
            )}
            <div>
              <Label>Indhold</Label>
              <Textarea
                value={formContent}
                onChange={e => setFormContent(e.target.value)}
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Merge-tags: {"{{fornavn}}"}, {"{{rolle}}"}, {"{{booking_link}}"}, {"{{afmeld_link}}"}, {"{{ringetidspunkt}}"}, {"{{telefonnummer}}"}, {"{{dato}}"}, {"{{tidspunkt}}"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditStep(null)}>Annuller</Button>
            <Button
              onClick={() => editStep && saveMutation.mutate({
                ...editStep,
                day: formDay,
                channel: formChannel,
                subject: formSubject,
                content: formContent,
                offset_hours: formOffsetHours,
              })}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Gem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={!!addPhase} onOpenChange={(open) => !open && setAddPhase(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tilføj nyt trin</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Dag</Label>
                <Input type="number" min={0} value={formDay} onChange={e => setFormDay(parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <Label>Kanal</Label>
                <Select value={formChannel} onValueChange={setFormChannel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tidspunkt (time)</Label>
                <Input type="number" min={0} max={23} step={0.5} value={formOffsetHours} onChange={e => setFormOffsetHours(parseFloat(e.target.value) || 0)} />
              </div>
            </div>
            {formChannel === "email" && (
              <div>
                <Label>Emne</Label>
                <Input value={formSubject} onChange={e => setFormSubject(e.target.value)} placeholder="Emne til emailen..." />
              </div>
            )}
            <div>
              <Label>Indhold</Label>
              <Textarea
                value={formContent}
                onChange={e => setFormContent(e.target.value)}
                rows={8}
                className="font-mono text-sm"
                placeholder="Skriv beskedens indhold her..."
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Merge-tags: {"{{fornavn}}"}, {"{{rolle}}"}, {"{{booking_link}}"}, {"{{afmeld_link}}"}, {"{{ringetidspunkt}}"}, {"{{telefonnummer}}"}, {"{{dato}}"}, {"{{tidspunkt}}"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPhase(null)}>Annuller</Button>
            <Button
              onClick={() => addPhase && addMutation.mutate({
                phase: addPhase,
                day: formDay,
                channel: formChannel,
                subject: formSubject,
                content: formContent,
                offset_hours: formOffsetHours,
              })}
              disabled={addMutation.isPending || !formContent.trim()}
            >
              {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Tilføj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
