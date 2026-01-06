import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Phone, 
  PhoneCall, 
  PhoneIncoming, 
  PhoneOutgoing, 
  PhoneMissed,
  Clock,
  User
} from "lucide-react";
import { format, formatDuration, intervalToDuration } from "date-fns";
import { da } from "date-fns/locale";

interface CandidateCallLogsProps {
  candidatePhone: string | null;
  candidateId: string;
  maxHeight?: string;
}

export function CandidateCallLogs({ candidatePhone, candidateId, maxHeight = "400px" }: CandidateCallLogsProps) {
  // Normalize phone number for matching
  const normalizePhone = (phone: string | null) => {
    if (!phone) return null;
    return phone.replace(/\D/g, '').replace(/^45/, '').replace(/^\+45/, '');
  };

  const normalizedPhone = normalizePhone(candidatePhone);

  const { data: calls = [], isLoading } = useQuery({
    queryKey: ["candidate-calls", candidateId, normalizedPhone],
    queryFn: async (): Promise<any[]> => {
      if (!normalizedPhone && !candidateId) return [];
      
      // Get calls from communication_logs
      // @ts-ignore - Supabase type chain too deep
      const commResult = await supabase
        .from("communication_logs")
        .select("*")
        .eq("candidate_id", candidateId)
        .eq("type", "call")
        .order("created_at", { ascending: false });

      let commCalls = commResult.data || [];
      
      // Also get by phone if available
      if (normalizedPhone) {
        // @ts-ignore - Supabase type chain too deep
        const phoneResult = await supabase
          .from("communication_logs")
          .select("*")
          .ilike("phone_number", `%${normalizedPhone}%`)
          .eq("type", "call")
          .order("created_at", { ascending: false });
        
        const phoneCalls = phoneResult.data || [];
        commCalls = [...commCalls, ...phoneCalls].filter((item: any, index: number, self: any[]) => 
          index === self.findIndex((t: any) => t.id === item.id)
        );
      }

      // Also get from call_records if exists
      let callRecords: any[] = [];
      if (candidateId) {
        const { data } = await supabase
          .from("call_records")
          .select("*")
          .eq("candidate_id", candidateId)
          .order("started_at", { ascending: false });
        callRecords = data || [];
      }

      // Combine and dedupe
      const allCalls = [
        ...(commCalls || []).map(c => ({
          id: c.id,
          direction: c.direction,
          status: c.outcome || 'completed',
          duration: null,
          created_at: c.created_at,
          notes: c.content,
          source: 'communication_logs'
        })),
        ...callRecords.map(c => ({
          id: c.id,
          direction: c.direction,
          status: c.status || 'completed',
          duration: c.duration_seconds,
          created_at: c.started_at,
          notes: c.notes,
          source: 'call_records'
        }))
      ];

      // Sort by date descending
      return allCalls.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    enabled: !!normalizedPhone || !!candidateId,
  });

  const formatCallDuration = (seconds: number | null) => {
    if (!seconds) return null;
    const duration = intervalToDuration({ start: 0, end: seconds * 1000 });
    if (duration.hours) {
      return `${duration.hours}t ${duration.minutes}m ${duration.seconds}s`;
    }
    if (duration.minutes) {
      return `${duration.minutes}m ${duration.seconds}s`;
    }
    return `${duration.seconds}s`;
  };

  const getCallIcon = (direction: string, status: string) => {
    if (status === 'missed' || status === 'no-answer' || status === 'busy') {
      return <PhoneMissed className="h-5 w-5 text-destructive" />;
    }
    if (direction === 'incoming' || direction === 'inbound') {
      return <PhoneIncoming className="h-5 w-5 text-green-500" />;
    }
    return <PhoneOutgoing className="h-5 w-5 text-blue-500" />;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'completed': 'Gennemført',
      'answered': 'Besvaret',
      'missed': 'Mistet',
      'no-answer': 'Intet svar',
      'busy': 'Optaget',
      'failed': 'Fejlet',
      'ringing': 'Ringer',
      'in-progress': 'I gang'
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    if (status === 'completed' || status === 'answered') {
      return 'bg-green-500/10 text-green-600 border-green-500/20';
    }
    if (status === 'missed' || status === 'no-answer' || status === 'busy' || status === 'failed') {
      return 'bg-red-500/10 text-red-600 border-red-500/20';
    }
    return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-pulse text-muted-foreground">Indlæser opkald...</div>
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Phone className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">Ingen opkald registreret</p>
        <p className="text-sm text-muted-foreground mt-1">Ring til kandidaten for at starte</p>
      </div>
    );
  }

  return (
    <ScrollArea className="pr-4" style={{ maxHeight }}>
      <div className="space-y-2">
        {calls.map((call: any) => (
          <div
            key={call.id}
            className="flex items-start gap-4 p-4 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors border border-border/50"
          >
            {/* Phone icon with status */}
            <div className="flex-shrink-0 relative">
              <div className="h-12 w-12 rounded-full bg-background border-2 border-border flex items-center justify-center">
                {getCallIcon(call.direction, call.status)}
              </div>
            </div>

            {/* Call details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={getStatusColor(call.status)}>
                  {getStatusLabel(call.status)}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {call.direction === 'outgoing' || call.direction === 'outbound' 
                    ? 'Udgående' 
                    : 'Indgående'}
                </span>
              </div>
              
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {format(new Date(call.created_at), "d. MMM yyyy 'kl.' HH:mm", { locale: da })}
                </div>
                {call.duration && (
                  <div className="flex items-center gap-1">
                    <PhoneCall className="h-3.5 w-3.5" />
                    {formatCallDuration(call.duration)}
                  </div>
                )}
              </div>

              {call.notes && (
                <p className="mt-2 text-sm text-foreground bg-background/50 rounded p-2 border border-border/30">
                  {call.notes}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
