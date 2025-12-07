import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Phone, 
  Mail, 
  MessageSquare, 
  MoreVertical, 
  Calendar,
  Star,
  User,
  Trash2
} from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";
import { SendSmsDialog } from "./SendSmsDialog";
import { SendEmailDialog } from "./SendEmailDialog";
import { CandidateDetailDialog } from "./CandidateDetailDialog";

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  rating: number | null;
  interview_date: string | null;
  created_at: string;
  source: string | null;
  notes: string | null;
  applied_position: string | null;
}

interface CandidateCardProps {
  candidate: Candidate;
  statusLabels: Record<string, string>;
  statusColors: Record<string, string>;
}

export function CandidateCard({ candidate, statusLabels, statusColors }: CandidateCardProps) {
  const [isSmsDialogOpen, setIsSmsDialogOpen] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase
        .from("candidates")
        .update({ status: newStatus })
        .eq("id", candidate.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      toast.success("Status opdateret");
    },
    onError: () => {
      toast.error("Kunne ikke opdatere status");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("candidates")
        .delete()
        .eq("id", candidate.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      toast.success("Kandidat slettet");
    },
    onError: () => {
      toast.error("Kunne ikke slette kandidat");
    },
  });

  const initials = `${candidate.first_name?.[0] || ""}${candidate.last_name?.[0] || ""}`.toUpperCase();

  const handleCall = () => {
    if (candidate.phone) {
      window.location.href = `tel:${candidate.phone}`;
    } else {
      toast.error("Ingen telefonnummer registreret");
    }
  };

  return (
    <>
      <Card 
        className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer"
        onClick={() => setIsDetailDialogOpen(true)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/20 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-foreground">
                  {candidate.first_name} {candidate.last_name}
                </h3>
                {candidate.applied_position && (
                  <p className="text-sm text-muted-foreground">{candidate.applied_position}</p>
                )}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border-border">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setIsDetailDialogOpen(true); }}>
                  <User className="mr-2 h-4 w-4" />
                  Se detaljer
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {Object.entries(statusLabels).map(([status, label]) => (
                  <DropdownMenuItem 
                    key={status}
                    onClick={(e) => { e.stopPropagation(); updateStatusMutation.mutate(status); }}
                  >
                    Sæt til: {label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-destructive"
                  onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(); }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Slet kandidat
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Badge 
            variant="outline" 
            className={`mb-3 ${statusColors[candidate.status] || ""}`}
          >
            {statusLabels[candidate.status] || candidate.status}
          </Badge>

          <div className="space-y-2 text-sm text-muted-foreground mb-4">
            {candidate.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-3 w-3" />
                <span className="truncate">{candidate.email}</span>
              </div>
            )}
            {candidate.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-3 w-3" />
                <span>{candidate.phone}</span>
              </div>
            )}
            {candidate.interview_date && (
              <div className="flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                <span>{format(new Date(candidate.interview_date), "d. MMM yyyy HH:mm", { locale: da })}</span>
              </div>
            )}
            {candidate.rating && (
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star 
                    key={i} 
                    className={`h-3 w-3 ${i < candidate.rating! ? "fill-yellow-400 text-yellow-400" : "text-muted"}`} 
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={handleCall}
              disabled={!candidate.phone}
            >
              <Phone className="h-3 w-3 mr-1" />
              Ring
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => setIsSmsDialogOpen(true)}
              disabled={!candidate.phone}
            >
              <MessageSquare className="h-3 w-3 mr-1" />
              SMS
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => setIsEmailDialogOpen(true)}
              disabled={!candidate.email}
            >
              <Mail className="h-3 w-3 mr-1" />
              Email
            </Button>
          </div>
        </CardContent>
      </Card>

      <SendSmsDialog
        open={isSmsDialogOpen}
        onOpenChange={setIsSmsDialogOpen}
        candidate={candidate}
      />

      <SendEmailDialog
        open={isEmailDialogOpen}
        onOpenChange={setIsEmailDialogOpen}
        candidate={candidate}
      />

      <CandidateDetailDialog
        open={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        candidate={candidate}
        statusLabels={statusLabels}
        statusColors={statusColors}
      />
    </>
  );
}
