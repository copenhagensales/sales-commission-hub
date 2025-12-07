import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Phone, 
  Mail, 
  MessageSquare, 
  Calendar,
  Star,
  Clock,
  Edit2,
  Save,
  X
} from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";

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

interface CandidateDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: Candidate;
  statusLabels: Record<string, string>;
  statusColors: Record<string, string>;
}

export function CandidateDetailDialog({ 
  open, 
  onOpenChange, 
  candidate,
  statusLabels,
  statusColors
}: CandidateDetailDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    first_name: candidate.first_name,
    last_name: candidate.last_name,
    email: candidate.email || "",
    phone: candidate.phone || "",
    status: candidate.status,
    rating: candidate.rating || 0,
    notes: candidate.notes || "",
    interview_date: candidate.interview_date || "",
  });

  const queryClient = useQueryClient();

  const { data: communications = [] } = useQuery({
    queryKey: ["candidate-communications", candidate.id],
    queryFn: async () => {
      // In a real app, this would filter by candidate
      const { data, error } = await supabase
        .from("communication_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("candidates")
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email || null,
          phone: formData.phone || null,
          status: formData.status,
          rating: formData.rating || null,
          notes: formData.notes || null,
          interview_date: formData.interview_date || null,
        })
        .eq("id", candidate.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      toast.success("Kandidat opdateret");
      setIsEditing(false);
    },
    onError: () => {
      toast.error("Kunne ikke opdatere kandidat");
    },
  });

  const handleSave = () => {
    updateMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-foreground text-xl">
              {candidate.first_name} {candidate.last_name}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                    <X className="h-4 w-4 mr-1" />
                    Annuller
                  </Button>
                  <Button size="sm" onClick={handleSave}>
                    <Save className="h-4 w-4 mr-1" />
                    Gem
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit2 className="h-4 w-4 mr-1" />
                  Rediger
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="info" className="mt-4">
          <TabsList className="bg-muted/50 border border-border">
            <TabsTrigger value="info" className="data-[state=active]:bg-background">
              Information
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-background">
              Historik
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {/* Status */}
                <div className="space-y-2">
                  <Label>Status</Label>
                  {isEditing ? (
                    <Select
                      value={formData.status}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}
                    >
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className={statusColors[candidate.status]}>
                      {statusLabels[candidate.status] || candidate.status}
                    </Badge>
                  )}
                </div>

                {/* Name */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Fornavn</Label>
                    {isEditing ? (
                      <Input
                        value={formData.first_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                        className="bg-background border-border"
                      />
                    ) : (
                      <p className="text-foreground">{candidate.first_name}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Efternavn</Label>
                    {isEditing ? (
                      <Input
                        value={formData.last_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                        className="bg-background border-border"
                      />
                    ) : (
                      <p className="text-foreground">{candidate.last_name}</p>
                    )}
                  </div>
                </div>

                {/* Contact */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Mail className="h-3 w-3" /> Email
                    </Label>
                    {isEditing ? (
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        className="bg-background border-border"
                      />
                    ) : (
                      <p className="text-foreground">{candidate.email || "-"}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> Telefon
                    </Label>
                    {isEditing ? (
                      <Input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                        className="bg-background border-border"
                      />
                    ) : (
                      <p className="text-foreground">{candidate.phone || "-"}</p>
                    )}
                  </div>
                </div>

                {/* Rating */}
                <div className="space-y-2">
                  <Label>Vurdering</Label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-5 w-5 cursor-pointer transition-colors ${
                          star <= (isEditing ? formData.rating : (candidate.rating || 0))
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-muted"
                        }`}
                        onClick={() => {
                          if (isEditing) {
                            setFormData(prev => ({ ...prev, rating: star }));
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Interview Date */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Samtale dato
                  </Label>
                  {isEditing ? (
                    <Input
                      type="datetime-local"
                      value={formData.interview_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, interview_date: e.target.value }))}
                      className="bg-background border-border"
                    />
                  ) : (
                    <p className="text-foreground">
                      {candidate.interview_date 
                        ? format(new Date(candidate.interview_date), "d. MMMM yyyy HH:mm", { locale: da })
                        : "-"
                      }
                    </p>
                  )}
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label>Noter</Label>
                  {isEditing ? (
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      className="bg-background border-border"
                      rows={4}
                    />
                  ) : (
                    <p className="text-foreground whitespace-pre-wrap">
                      {candidate.notes || "Ingen noter"}
                    </p>
                  )}
                </div>

                {/* Meta info */}
                <div className="pt-4 border-t border-border text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Oprettet: {format(new Date(candidate.created_at), "d. MMMM yyyy", { locale: da })}
                  </div>
                  {candidate.source && (
                    <p className="mt-1">Kilde: {candidate.source}</p>
                  )}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <ScrollArea className="h-[400px]">
              {communications.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Ingen kommunikationshistorik
                </p>
              ) : (
                <div className="space-y-3">
                  {communications.map((comm: any) => (
                    <div key={comm.id} className="p-3 rounded-lg bg-muted/30 border border-border">
                      <div className="flex items-center gap-2 mb-1">
                        {comm.type === "sms" && <MessageSquare className="h-4 w-4 text-blue-400" />}
                        {comm.type === "email" && <Mail className="h-4 w-4 text-purple-400" />}
                        {comm.type === "call" && <Phone className="h-4 w-4 text-green-400" />}
                        <Badge variant="outline" className="text-xs">
                          {comm.type.toUpperCase()}
                        </Badge>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {format(new Date(comm.created_at), "d. MMM HH:mm", { locale: da })}
                        </span>
                      </div>
                      <p className="text-sm text-foreground line-clamp-2">
                        {comm.content || "Ingen indhold"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
