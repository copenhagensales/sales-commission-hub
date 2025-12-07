import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  UserPlus, 
  Calendar, 
  CheckCircle2, 
  TrendingUp,
  Phone,
  MessageSquare,
  Mail,
  ArrowRight
} from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Link } from "react-router-dom";

export default function RecruitmentDashboard() {
  const { data: candidates = [] } = useQuery({
    queryKey: ["candidates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: recentApplications = [] } = useQuery({
    queryKey: ["recent-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("*, candidates(*)")
        .order("created_at", { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data;
    },
  });

  const { data: communicationStats } = useQuery({
    queryKey: ["communication-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communication_logs")
        .select("type")
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      
      if (error) throw error;
      
      const stats = {
        sms: data.filter(c => c.type === "sms").length,
        email: data.filter(c => c.type === "email").length,
        call: data.filter(c => c.type === "call").length,
      };
      return stats;
    },
  });

  const statusCounts = candidates.reduce((acc, candidate) => {
    acc[candidate.status] = (acc[candidate.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const newThisWeek = candidates.filter(c => {
    const created = new Date(c.created_at);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return created > weekAgo;
  }).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Rekruttering Dashboard</h1>
        <p className="text-muted-foreground">Overblik over rekrutteringsaktiviteter</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total kandidater</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{candidates.length}</div>
            <p className="text-xs text-muted-foreground">
              +{newThisWeek} denne uge
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Nye ansøgninger</CardTitle>
            <UserPlus className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">{statusCounts.new || 0}</div>
            <p className="text-xs text-muted-foreground">Afventer kontakt</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Planlagte samtaler</CardTitle>
            <Calendar className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-400">{statusCounts.interview_scheduled || 0}</div>
            <p className="text-xs text-muted-foreground">Kommende interviews</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ansat i år</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">{statusCounts.hired || 0}</div>
            <p className="text-xs text-muted-foreground">Succesfulde ansættelser</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Communication Stats */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground flex items-center justify-between">
              Kommunikation (7 dage)
              <Link to="/recruitment/messages">
                <Button variant="ghost" size="sm">
                  Se alle <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <MessageSquare className="h-6 w-6 text-blue-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-blue-400">{communicationStats?.sms || 0}</div>
                <p className="text-xs text-muted-foreground">SMS</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <Mail className="h-6 w-6 text-purple-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-purple-400">{communicationStats?.email || 0}</div>
                <p className="text-xs text-muted-foreground">Emails</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <Phone className="h-6 w-6 text-green-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-400">{communicationStats?.call || 0}</div>
                <p className="text-xs text-muted-foreground">Opkald</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Applications */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground flex items-center justify-between">
              Seneste ansøgninger
              <Link to="/recruitment/candidates">
                <Button variant="ghost" size="sm">
                  Se alle <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentApplications.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Ingen ansøgninger endnu</p>
            ) : (
              <div className="space-y-3">
                {recentApplications.map((app: any) => (
                  <div key={app.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div>
                      <p className="font-medium text-foreground">
                        {app.candidates?.first_name} {app.candidates?.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">{app.role}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-xs">
                        {app.status}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(app.created_at), "d. MMM", { locale: da })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Overview */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Rekrutteringspipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-2">
            {[
              { status: "new", label: "Ny", color: "bg-blue-500" },
              { status: "contacted", label: "Kontaktet", color: "bg-yellow-500" },
              { status: "interview_scheduled", label: "Samtale planlagt", color: "bg-purple-500" },
              { status: "interviewed", label: "Samtale afholdt", color: "bg-cyan-500" },
              { status: "offer_sent", label: "Tilbud sendt", color: "bg-orange-500" },
              { status: "hired", label: "Ansat", color: "bg-green-500" },
            ].map((stage, idx) => (
              <div key={stage.status} className="flex-1 text-center">
                <div className={`h-2 ${stage.color} rounded-full mb-2`} />
                <div className="text-2xl font-bold text-foreground">
                  {statusCounts[stage.status] || 0}
                </div>
                <p className="text-xs text-muted-foreground">{stage.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
