import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Link } from "react-router-dom";

interface UpcomingHire {
  id: string;
  first_name: string;
  last_name: string;
  applied_position: string | null;
  interview_date: string;
}

interface GroupedHire {
  date: string;
  count: number;
  hires: UpcomingHire[];
}

export default function UpcomingHires() {
  const { data: upcomingHires = [], isLoading } = useQuery({
    queryKey: ["upcoming-hires"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];

      // Fetch all candidates with status "hired" 
      const { data: candidates, error } = await supabase
        .from("candidates")
        .select("id, first_name, last_name, applied_position, interview_date, created_at")
        .eq("status", "hired")
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Group by date (using created_at as hire date if interview_date isn't available)
      const grouped = new Map<string, GroupedHire>();

      candidates?.forEach((candidate) => {
        const dateKey = candidate.interview_date 
          ? candidate.interview_date.split("T")[0]
          : candidate.created_at.split("T")[0];

        if (!grouped.has(dateKey)) {
          grouped.set(dateKey, {
            date: dateKey,
            count: 0,
            hires: [],
          });
        }

        const group = grouped.get(dateKey)!;
        group.count++;
        group.hires.push({
          id: candidate.id,
          first_name: candidate.first_name,
          last_name: candidate.last_name,
          applied_position: candidate.applied_position,
          interview_date: candidate.interview_date || candidate.created_at,
        });
      });

      return Array.from(grouped.values()).sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    },
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Indlæser kommende ansættelser...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Kommende ansættelser</h1>
          <p className="text-muted-foreground">
            Oversigt over ansatte kandidater
          </p>
        </div>

        {upcomingHires.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Ingen ansættelser registreret
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {upcomingHires.map((group, index) => (
              <Card key={`${group.date}_${index}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">
                        {format(new Date(group.date), "EEEE d. MMMM yyyy", {
                          locale: da,
                        })}
                      </CardTitle>
                    </div>
                    <Badge variant="outline" className="text-sm">
                      {group.count} {group.count === 1 ? "ansættelse" : "ansættelser"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {group.count} {group.count === 1 ? "ansættelse" : "ansættelser"}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {group.hires.map((hire) => (
                      <div
                        key={hire.id}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                      >
                        <div className="flex-1">
                          <Link 
                            to={`/recruitment/candidates/${hire.id}`}
                            className="font-medium hover:text-primary hover:underline transition-colors"
                          >
                            {hire.first_name} {hire.last_name}
                          </Link>
                          {hire.applied_position && (
                            <p className="text-sm text-muted-foreground">
                              {hire.applied_position}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
