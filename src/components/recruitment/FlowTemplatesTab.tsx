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
import { toast } from "sonner";
import { Mail, MessageSquare, Pencil, Loader2 } from "lucide-react";

const FLOW_TEMPLATES: Record<string, { subject: string; content: string; channel: string }> = {
  flow_a_dag0_email: {
    subject: "Book en tid til en snak om din ansøgning",
    content: "Hej {{fornavn}},\n\nTak for din ansøgning til stillingen som {{rolle}} hos Copenhagen Sales.\n\nVi vil gerne invitere dig til en uforpligtende snak på 5–10 minutter over telefonen med Oscar, som er ansvarlig for rekruttering.\n\nBook selv den tid der passer dig bedst her:\n{{booking_link}}\n\nIkke interesseret længere? Klik her – det er helt okay:\n{{afmeld_link}}\n\nMed venlig hilsen\nCopenhagen Sales",
    channel: "email",
  },
  flow_a_dag0_sms: {
    subject: "",
    content: "Hej {{fornavn}}! Tak for din ansøgning til {{rolle}}. Vi vil gerne tage en uforpligtende snak på 5–10 min over telefonen. Book selv en tid med Oscar her: {{booking_link}} – Afmeld: {{afmeld_link}}",
    channel: "sms",
  },
  flow_a_dag1_sms: {
    subject: "",
    content: "Hej {{fornavn}} 👋 Har du set vores besked? Vi vil stadig gerne snakke med dig om {{rolle}}. Book en tid her: {{booking_link}} – Afmeld: {{afmeld_link}}",
    channel: "sms",
  },
  flow_a_dag3_email: {
    subject: "Lidt mere om stillingen som {{rolle}}",
    content: "Hej {{fornavn}},\n\nVi ville lige følge op på din ansøgning til {{rolle}} hos Copenhagen Sales.\n\nHos os får du:\n• Grundig oplæring og sparring fra dag ét\n• Et ungt, ambitiøst team\n• Mulighed for at udvikle dig hurtigt\n\nBook en kort snak med Oscar her – det tager kun 5–10 min:\n{{booking_link}}\n\nIkke interesseret længere? Klik her – det er helt okay:\n{{afmeld_link}}\n\nMed venlig hilsen\nCopenhagen Sales",
    channel: "email",
  },
  flow_a_dag6_sms: {
    subject: "",
    content: "Hej {{fornavn}}, vi har stadig en plads åben til {{rolle}} 🙌 Book en tid inden fredag: {{booking_link}} – Afmeld: {{afmeld_link}}",
    channel: "sms",
  },
  flow_a_dag6_email: {
    subject: "Pladsen er stadig åben – book inden fredag",
    content: "Hej {{fornavn}},\n\nVi har stadig en plads åben til stillingen som {{rolle}}, og vi vil rigtig gerne høre fra dig.\n\nBook en tid til en kort snak her – det tager kun 5–10 min:\n{{booking_link}}\n\nVi holder pladsen åben til fredag.\n\nIkke interesseret længere? Klik her – det er helt okay:\n{{afmeld_link}}\n\nMed venlig hilsen\nCopenhagen Sales",
    channel: "email",
  },
  flow_a_dag10_email: {
    subject: "Vi lukker din ansøgning – men døren er åben",
    content: "Hej {{fornavn}},\n\nVi har forsøgt at nå dig angående din ansøgning til {{rolle}} hos Copenhagen Sales, men har desværre ikke hørt fra dig.\n\nVi lukker derfor din ansøgning for nu – men døren er altid åben, hvis du får lyst til at tage en snak på et senere tidspunkt.\n\nDu er velkommen til at booke en tid her:\n{{booking_link}}\n\nVi ønsker dig alt det bedste!\n\nMed venlig hilsen\nCopenhagen Sales",
    channel: "email",
  },
  flow_a_dag45_sms: {
    subject: "",
    content: "Hej {{fornavn}} 😊 Det er et stykke tid siden du søgte {{rolle}} hos Copenhagen Sales. Vi leder stadig – har du lyst til en uforpligtende snak? Book her: {{booking_link}} – Afmeld: {{afmeld_link}}",
    channel: "sms",
  },
  flow_a_dag120_email: {
    subject: "Vi har en ny mulighed til dig",
    content: "Hej {{fornavn}},\n\nDet er et stykke tid siden, men vi tænkte på dig – vi søger lige nu en {{rolle}} hos Copenhagen Sales, og din profil passer godt.\n\nHar du lyst til en helt uforpligtende snak? Det tager kun 5–10 min:\n{{booking_link}}\n\nIngen pres – vi vil bare gerne høre, om det kunne have interesse.\n\nIkke interesseret? Klik her – det er helt okay:\n{{afmeld_link}}\n\nMed venlig hilsen\nCopenhagen Sales",
    channel: "email",
  },
};

const TIER_GROUPS = [
  {
    tier: "active",
    label: "Aktiv booking — Dag 0–10",
    keys: ["flow_a_dag0_email", "flow_a_dag0_sms", "flow_a_dag1_sms", "flow_a_dag3_email", "flow_a_dag6_sms", "flow_a_dag6_email", "flow_a_dag10_email"],
    color: "text-foreground",
  },
  {
    tier: "reengagement",
    label: "Re-engagement — Dag 45 & 120",
    keys: ["flow_a_dag45_sms", "flow_a_dag120_email"],
    color: "text-foreground",
  },
];

function extractDay(key: string): string {
  const match = key.match(/dag(\d+)/);
  return match ? `Dag ${match[1]}` : "—";
}

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
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editContent, setEditContent] = useState("");

  const { data: overrides, isLoading } = useQuery({
    queryKey: ["flow-template-overrides"],
    queryFn: async () => {
      const allKeys = Object.keys(FLOW_TEMPLATES);
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .in("template_key", allKeys);
      if (error) throw error;
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ key, subject, content }: { key: string; subject: string; content: string }) => {
      const existing = overrides?.find(o => o.template_key === key);
      if (existing) {
        const { error } = await supabase
          .from("email_templates")
          .update({ subject, content, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("email_templates")
          .insert({ template_key: key, name: key, subject, content });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flow-template-overrides"] });
      setEditKey(null);
      toast.success("Skabelon gemt");
    },
    onError: (err: any) => toast.error("Fejl: " + err.message),
  });

  const resetMutation = useMutation({
    mutationFn: async (key: string) => {
      const existing = overrides?.find(o => o.template_key === key);
      if (existing) {
        const { error } = await supabase.from("email_templates").delete().eq("id", existing.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flow-template-overrides"] });
      toast.success("Nulstillet til standard");
    },
  });

  function getEffective(key: string) {
    const override = overrides?.find(o => o.template_key === key);
    const def = FLOW_TEMPLATES[key];
    return {
      subject: override?.subject ?? def.subject,
      content: override?.content ?? def.content,
      isCustom: !!override,
    };
  }

  function openEdit(key: string) {
    const eff = getEffective(key);
    setEditSubject(eff.subject);
    setEditContent(eff.content);
    setEditKey(key);
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
        Rediger de beskeder der sendes i hvert trin af booking-flowet. Brug <Badge variant="secondary" className="text-[10px] px-1 py-0 font-mono">{"{{fornavn}}"}</Badge>, <Badge variant="secondary" className="text-[10px] px-1 py-0 font-mono">{"{{rolle}}"}</Badge>, <Badge variant="secondary" className="text-[10px] px-1 py-0 font-mono">{"{{booking_link}}"}</Badge> og <Badge variant="secondary" className="text-[10px] px-1 py-0 font-mono">{"{{afmeld_link}}"}</Badge> som merge-tags.
      </p>

      {TIER_GROUPS.map(group => (
        <Card key={group.tier}>
          <CardHeader className="pb-3">
            <CardTitle className={`text-base ${group.color}`}>
              {group.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {group.keys.map(key => {
              const def = FLOW_TEMPLATES[key];
              const eff = getEffective(key);
              return (
                <div key={key} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                  <div className="mt-0.5">{channelIcon(def.channel)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-muted-foreground">{extractDay(key)}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {def.channel === "email" ? "Email" : "SMS"}
                      </Badge>
                      {eff.isCustom && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700">
                          Tilpasset
                        </Badge>
                      )}
                    </div>
                    {def.channel === "email" && eff.subject && (
                      <p className="text-xs font-medium mb-1 truncate">{eff.subject}</p>
                    )}
                    <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-line">
                      {highlightMergeTags(eff.content)}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {eff.isCustom && (
                      <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => resetMutation.mutate(key)}>
                        Nulstil
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(key)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!editKey} onOpenChange={(open) => !open && setEditKey(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Rediger skabelon</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editKey && FLOW_TEMPLATES[editKey]?.channel === "email" && (
              <div>
                <Label>Emne</Label>
                <Input value={editSubject} onChange={e => setEditSubject(e.target.value)} />
              </div>
            )}
            <div>
              <Label>Indhold</Label>
              <Textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Merge-tags: {"{{fornavn}}"}, {"{{rolle}}"}, {"{{booking_link}}"}, {"{{afmeld_link}}"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditKey(null)}>Annuller</Button>
            <Button
              onClick={() => editKey && saveMutation.mutate({ key: editKey, subject: editSubject, content: editContent })}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Gem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
