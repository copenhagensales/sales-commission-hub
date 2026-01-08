import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface CreateReferralDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateReferralDialog({ open, onOpenChange }: CreateReferralDialogProps) {
  const queryClient = useQueryClient();
  const [candidateFirstName, setCandidateFirstName] = useState("");
  const [candidateLastName, setCandidateLastName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [candidatePhone, setCandidatePhone] = useState("");
  const [selectedReferrerId, setSelectedReferrerId] = useState("");
  const [message, setMessage] = useState("");

  // Fetch active employees for the referrer dropdown
  const { data: employees = [] } = useQuery({
    queryKey: ["active-employees-for-referral"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, referral_code")
        .eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const createReferralMutation = useMutation({
    mutationFn: async () => {
      const selectedEmployee = employees.find(e => e.id === selectedReferrerId);
      if (!selectedEmployee) throw new Error("Vælg en medarbejder");

      const { error } = await supabase
        .from("employee_referrals")
        .insert({
          referrer_employee_id: selectedReferrerId,
          referral_code: selectedEmployee.referral_code || "MANUAL",
          candidate_first_name: candidateFirstName.trim(),
          candidate_last_name: candidateLastName.trim(),
          candidate_email: candidateEmail.toLowerCase().trim(),
          candidate_phone: candidatePhone.trim() || null,
          referrer_name_provided: `${selectedEmployee.first_name} ${selectedEmployee.last_name}`,
          message: message.trim() || null,
          status: "pending",
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-referrals"] });
      toast.success("Henvisning oprettet");
      handleClose();
    },
    onError: (error: any) => {
      toast.error(error.message || "Kunne ikke oprette henvisning");
    },
  });

  const handleClose = () => {
    setCandidateFirstName("");
    setCandidateLastName("");
    setCandidateEmail("");
    setCandidatePhone("");
    setSelectedReferrerId("");
    setMessage("");
    onOpenChange(false);
  };

  const canSave = candidateFirstName.trim() && candidateLastName.trim() && candidateEmail.trim() && selectedReferrerId;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Opret henvisning manuelt</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Henvist af (medarbejder) *</Label>
            <Select value={selectedReferrerId} onValueChange={setSelectedReferrerId}>
              <SelectTrigger>
                <SelectValue placeholder="Vælg medarbejder" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Kandidat fornavn *</Label>
              <Input
                value={candidateFirstName}
                onChange={(e) => setCandidateFirstName(e.target.value)}
                placeholder="Fornavn"
              />
            </div>
            <div className="space-y-2">
              <Label>Kandidat efternavn *</Label>
              <Input
                value={candidateLastName}
                onChange={(e) => setCandidateLastName(e.target.value)}
                placeholder="Efternavn"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Email *</Label>
            <Input
              type="email"
              value={candidateEmail}
              onChange={(e) => setCandidateEmail(e.target.value)}
              placeholder="kandidat@email.dk"
            />
          </div>

          <div className="space-y-2">
            <Label>Telefon</Label>
            <Input
              type="tel"
              value={candidatePhone}
              onChange={(e) => setCandidatePhone(e.target.value)}
              placeholder="+45 12345678"
            />
          </div>

          <div className="space-y-2">
            <Label>Besked / noter</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Valgfri besked om kandidaten..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Annuller
          </Button>
          <Button 
            onClick={() => createReferralMutation.mutate()} 
            disabled={!canSave || createReferralMutation.isPending}
          >
            {createReferralMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Opret henvisning
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
