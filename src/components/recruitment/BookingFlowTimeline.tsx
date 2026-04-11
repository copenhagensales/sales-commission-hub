import { Badge } from "@/components/ui/badge";
import { Mail, MessageSquare, CheckCircle, Clock, XCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";

interface Touchpoint {
  id: string;
  day: number;
  channel: string;
  template_key: string;
  scheduled_at: string;
  sent_at: string | null;
  status: string;
  error_message: string | null;
}

const channelConfig: Record<string, { icon: typeof Mail; label: string }> = {
  email: { icon: Mail, label: "Email" },
  sms: { icon: MessageSquare, label: "SMS" },
};

const statusConfig: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  pending: { icon: Clock, color: "text-amber-500", label: "Afventer" },
  sent: { icon: CheckCircle, color: "text-emerald-500", label: "Sendt" },
  skipped: { icon: XCircle, color: "text-gray-400", label: "Sprunget over" },
  cancelled: { icon: XCircle, color: "text-red-500", label: "Annulleret" },
  failed: { icon: AlertTriangle, color: "text-red-500", label: "Fejlet" },
};

interface Props {
  touchpoints: Touchpoint[];
}

export function BookingFlowTimeline({ touchpoints }: Props) {
  if (!touchpoints.length) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Ingen touchpoints fundet
      </div>
    );
  }

  // Group by day
  const days = new Map<number, Touchpoint[]>();
  touchpoints.forEach(tp => {
    const existing = days.get(tp.day) || [];
    existing.push(tp);
    days.set(tp.day, existing);
  });

  return (
    <div className="space-y-6">
      {Array.from(days.entries())
        .sort(([a], [b]) => a - b)
        .map(([day, tps]) => (
          <div key={day}>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                {day}
              </div>
              <span className="text-sm font-medium">Dag {day}</span>
            </div>

            <div className="ml-3 border-l-2 border-muted pl-6 space-y-3">
              {tps.map(tp => {
                const channel = channelConfig[tp.channel] || channelConfig.email;
                const status = statusConfig[tp.status] || statusConfig.pending;
                const ChannelIcon = channel.icon;
                const StatusIcon = status.icon;

                return (
                  <div key={tp.id} className="flex items-start gap-3 py-2">
                    <div className="mt-0.5">
                      <ChannelIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{channel.label}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {tp.template_key.replace(/^flow_[abc]_/, "").replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusIcon className={`h-3 w-3 ${status.color}`} />
                        <span className={`text-xs ${status.color}`}>{status.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {tp.sent_at
                            ? `Sendt ${format(new Date(tp.sent_at), "d. MMM HH:mm", { locale: da })}`
                            : `Planlagt ${format(new Date(tp.scheduled_at), "d. MMM HH:mm", { locale: da })}`
                          }
                        </span>
                      </div>
                      {tp.error_message && (
                        <p className="text-xs text-destructive mt-1">{tp.error_message}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}
