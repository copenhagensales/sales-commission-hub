import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Zap, Mail, MessageSquare, Phone, Loader2, CheckCircle } from "lucide-react";
import { addHours, addDays, setHours, setMinutes } from "date-fns";

interface SegmentationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnrolled: () => void;
  candidateId?: string;
  applicationId?: string;
}

const tierInfo = {
  A: {
    label: "Tier A — Høj prioritet",
    color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
    description: "Intensivt outreach: Email + SMS dag 0, opkald dag 1-2, reminder dag 3",
  },
  B: {
    label: "Tier B — Medium",
    color: "bg-violet-500/10 text-violet-700 border-violet-500/30",
    description: "Standard outreach: Email dag 0, SMS dag 1, opkald dag 2",
  },
  C: {
    label: "Tier C — Lav",
    color: "bg-gray-500/10 text-gray-600 border-gray-500/30",
    description: "Let outreach: Bekræftelsesmail dag 0, venligt afslag dag 3-5",
  },
};

// Flow definitions per tier
const FLOW_DEFINITIONS: Record<string, Array<{ day: number; channel: string; template_key: string; offsetHours: number }>> = {
  A: [
    { day: 0, channel: "email", template_key: "flow_a_dag0_email", offsetHours: 0 },
    { day: 0, channel: "sms", template_key: "flow_a_dag0_sms", offsetHours: 0.15 },
    { day: 1, channel: "sms", template_key: "flow_a_dag1_precall_sms", offsetHours: 9 },
    { day: 1, channel: "call_reminder", template_key: "flow_a_dag1_call", offsetHours: 10 },
    { day: 1, channel: "sms", template_key: "flow_a_dag1_followup_sms", offsetHours: 15 },
    { day: 2, channel: "email", template_key: "flow_a_dag2_reminder_email", offsetHours: 9 },
    { day: 2, channel: "call_reminder", template_key: "flow_a_dag2_call", offsetHours: 11 },
    { day: 3, channel: "email", template_key: "flow_a_dag3_last_attempt", offsetHours: 10 },
  ],
  B: [
    { day: 0, channel: "email", template_key: "flow_b_dag0_email", offsetHours: 0 },
    { day: 1, channel: "sms", template_key: "flow_b_dag1_sms", offsetHours: 10 },
    { day: 2, channel: "call_reminder", template_key: "flow_b_dag2_call", offsetHours: 10 },
  ],
  C: [
    { day: 0, channel: "email", template_key: "flow_c_dag0_email", offsetHours: 0 },
    { day: 4, channel: "email", template_key: "flow_c_dag4_afslag", offsetHours: 10 },
  ],
};

function calculateTier(criteriaMet: number): "A" | "B" | "C" {
  if (criteriaMet >= 4) return "A";
  if (criteriaMet >= 2) return "B";
  return "C";
}

export function SegmentationModal({ open, onOpenChange, onEnrolled, candidateId: propCandidateId, applicationId: propApplicationId }: SegmentationModalProps) {
  const [criteriaChecks, setCriteriaChecks] = useState<Record<string, boolean>>({});

  const { data: criteria, isLoading } = useQuery({
    queryKey: ["booking-flow-criteria"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_flow_criteria")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const criteriaMet = Object.values(criteriaChecks).filter(Boolean).length;
  const tier = calculateTier(criteriaMet);
  const info = tierInfo[tier];

  const enrollMutation = useMutation({
    mutationFn: async () => {
      // Get candidate from temp storage or props
      const candidate = (window as any).__selectedCandidateForFlow;
      const candidateId = propCandidateId || candidate?.id;
      if (!candidateId) throw new Error("Ingen kandidat valgt");

      // Get latest application for candidate
      let applicationId = propApplicationId;
      if (!applicationId) {
        const { data: app } = await supabase
          .from("applications")
          .select("id")
          .eq("candidate_id", candidateId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        applicationId = app?.id;
      }

      // Create enrollment
      const metCriteria = criteria?.filter(c => criteriaChecks[c.id]).map(c => ({ id: c.id, name: c.name })) || [];
      
      const { data: enrollment, error: enrollError } = await supabase
        .from("booking_flow_enrollments")
        .insert({
          candidate_id: candidateId,
          application_id: applicationId || null,
          tier,
          criteria_met: metCriteria,
          status: "active",
        })
        .select("id")
        .single();

      if (enrollError) throw enrollError;

      // Create touchpoints based on tier flow
      const flowSteps = FLOW_DEFINITIONS[tier];
      const now = new Date();
      const touchpoints = flowSteps.map(step => {
        let scheduledAt: Date;
        if (step.day === 0 && step.offsetHours < 1) {
          // Immediate or near-immediate
          scheduledAt = addHours(now, step.offsetHours);
        } else {
          // Future days: schedule at offsetHours (as hour of day, Danish business hours)
          const dayDate = addDays(now, step.day);
          scheduledAt = setMinutes(setHours(dayDate, Math.floor(step.offsetHours)), (step.offsetHours % 1) * 60);
        }

        return {
          enrollment_id: enrollment.id,
          day: step.day,
          channel: step.channel,
          template_key: step.template_key,
          scheduled_at: scheduledAt.toISOString(),
          status: "pending",
        };
      });

      const { error: tpError } = await supabase
        .from("booking_flow_touchpoints")
        .insert(touchpoints);

      if (tpError) throw tpError;

      // Update candidate tier
      await supabase
        .from("candidates")
        .update({ tier })
        .eq("id", candidateId);

      // Clean up temp storage
      delete (window as any).__selectedCandidateForFlow;
    },
    onSuccess: () => {
      toast.success(`Kandidat tilføjet til Tier ${tier} flow`);
      setCriteriaChecks({});
      onOpenChange(false);
      onEnrolled();
    },
    onError: (err: any) => {
      toast.error("Fejl: " + err.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (!o) {
        setCriteriaChecks({});
        delete (window as any).__selectedCandidateForFlow;
      }
      onOpenChange(o);
    }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Segmentering — Booking Flow</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Criteria checklist */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Must-have kriterier</p>
              {criteria?.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label className="text-sm font-medium">{c.name}</Label>
                    {c.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>
                    )}
                  </div>
                  <Switch
                    checked={criteriaChecks[c.id] || false}
                    onCheckedChange={(checked) =>
                      setCriteriaChecks(prev => ({ ...prev, [c.id]: checked }))
                    }
                  />
                </div>
              ))}
            </div>

            <Separator />

            {/* Tier result */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Resultat</p>
                <Badge variant="outline" className={info.color}>
                  {criteriaMet} af {criteria?.length || 5} kriterier opfyldt
                </Badge>
              </div>

              <div className={`p-4 rounded-lg border ${info.color}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4" />
                  <span className="font-semibold text-sm">{info.label}</span>
                </div>
                <p className="text-xs opacity-80">{info.description}</p>
              </div>

              {/* Flow preview */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Planlagte touchpoints</p>
                {FLOW_DEFINITIONS[tier].map((step, i) => {
                  const Icon = step.channel === "email" ? Mail : step.channel === "sms" ? MessageSquare : Phone;
                  return (
                    <div key={i} className="flex items-center gap-3 text-xs py-1">
                      <span className="w-12 text-muted-foreground">Dag {step.day}</span>
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="capitalize">{step.channel === "call_reminder" ? "Opkaldspåmindelse" : step.channel.toUpperCase()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuller
          </Button>
          <Button
            onClick={() => enrollMutation.mutate()}
            disabled={enrollMutation.isPending}
          >
            {enrollMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Start Tier {tier} flow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
