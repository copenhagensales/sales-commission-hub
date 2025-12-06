import { useMyExtraWork, useDeleteExtraWork } from "@/hooks/useExtraWork";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Clock, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";
import { da } from "date-fns/locale";

const STATUS_CONFIG = {
  pending: { label: "Afventer godkendelse", variant: "secondary" as const },
  approved: { label: "Godkendt", variant: "default" as const },
  rejected: { label: "Afvist", variant: "destructive" as const },
};

export function ExtraWorkHistory() {
  const { data: extraWork, isLoading } = useMyExtraWork();
  const deleteMutation = useDeleteExtraWork();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Mit ekstra arbejde</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse text-muted-foreground">Indlæser...</div>
        </CardContent>
      </Card>
    );
  }

  if (!extraWork || extraWork.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Mit ekstra arbejde</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Ingen ekstra arbejde registreret endnu.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mit ekstra arbejde</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {extraWork.map((entry) => {
            const statusConfig = STATUS_CONFIG[entry.status];
            const canDelete = entry.status === "pending";

            return (
              <div
                key={entry.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {format(parseISO(entry.date), "EEEE d. MMMM yyyy", { locale: da })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      {entry.from_time.slice(0, 5)} - {entry.to_time.slice(0, 5)} 
                      ({Number(entry.hours).toFixed(1)} timer)
                    </span>
                  </div>
                  {entry.reason && (
                    <p className="text-sm text-muted-foreground">{entry.reason}</p>
                  )}
                  {entry.status === "rejected" && entry.rejection_reason && (
                    <p className="text-sm text-destructive">
                      Afvist: {entry.rejection_reason}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(entry.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
