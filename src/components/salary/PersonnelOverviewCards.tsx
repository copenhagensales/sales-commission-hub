import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, UserCheck, Building2, ArrowRight, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { TeamLeaderSalary } from "./TeamLeaderSalary";
import { AssistantSalary } from "./AssistantSalary";
import { StaffSalary } from "./StaffSalary";
import { formatPlayerName } from "@/lib/formatPlayerName";

type PersonnelType = "team_leader" | "assistant" | "staff" | null;

interface PersonnelCardData {
  count: number;
  latestName: string | null;
}

interface PersonnelCardProps {
  title: string;
  icon: React.ReactNode;
  data: PersonnelCardData | undefined;
  isLoading: boolean;
  onClick: () => void;
  colorClass: string;
}

function PersonnelCard({ title, icon, data, isLoading, onClick, colorClass }: PersonnelCardProps) {
  return (
    <Card 
      className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30 group"
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${colorClass}`}>
            {icon}
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div className="mt-4">
          <h3 className="font-semibold text-lg">{title}</h3>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-2" />
          ) : (
            <>
              <p className="text-2xl font-bold mt-1">
                {data?.count || 0} <span className="text-sm font-normal text-muted-foreground">aktive</span>
              </p>
              {data?.latestName && (
                <p className="text-xs text-muted-foreground mt-1">
                  Senest tilføjet: {data.latestName}
                </p>
              )}
            </>
          )}
        </div>
        <Button variant="ghost" size="sm" className="mt-3 -ml-2 text-primary">
          Se alle →
        </Button>
      </CardContent>
    </Card>
  );
}

export function PersonnelOverviewCards() {
  const [selectedType, setSelectedType] = useState<PersonnelType>(null);

  // Fetch summary data for all personnel types
  const { data: personnelSummary, isLoading } = useQuery({
    queryKey: ["personnel-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnel_salaries")
        .select(`
          id,
          salary_type,
          is_active,
          created_at,
          employee:employee_master_data(first_name, last_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const summary: Record<string, PersonnelCardData> = {
        team_leader: { count: 0, latestName: null },
        assistant: { count: 0, latestName: null },
        staff: { count: 0, latestName: null },
      };

      data?.forEach((item) => {
        const type = item.salary_type as string;
        if (summary[type]) {
          if (item.is_active) {
            summary[type].count++;
          }
          if (!summary[type].latestName && item.employee) {
            summary[type].latestName = formatPlayerName(item.employee);
          }
        }
      });

      return summary;
    },
    staleTime: 60000,
  });

  const handleClose = () => setSelectedType(null);

  const getSheetTitle = () => {
    switch (selectedType) {
      case "team_leader": return "Teamledere";
      case "assistant": return "Assistenter";
      case "staff": return "Stabslønninger";
      default: return "";
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PersonnelCard
          title="Teamledere"
          icon={<Users className="h-6 w-6 text-primary" />}
          data={personnelSummary?.team_leader}
          isLoading={isLoading}
          onClick={() => setSelectedType("team_leader")}
          colorClass="bg-primary/10"
        />
        <PersonnelCard
          title="Assistenter"
          icon={<UserCheck className="h-6 w-6 text-accent-foreground" />}
          data={personnelSummary?.assistant}
          isLoading={isLoading}
          onClick={() => setSelectedType("assistant")}
          colorClass="bg-accent"
        />
        <PersonnelCard
          title="Stabslønninger"
          icon={<Building2 className="h-6 w-6 text-secondary-foreground" />}
          data={personnelSummary?.staff}
          isLoading={isLoading}
          onClick={() => setSelectedType("staff")}
          colorClass="bg-secondary"
        />
      </div>

      <Sheet open={selectedType !== null} onOpenChange={(open) => !open && handleClose()}>
        <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-4xl overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>{getSheetTitle()}</SheetTitle>
            <SheetDescription>
              Administrer {getSheetTitle().toLowerCase()} og deres lønninger
            </SheetDescription>
          </SheetHeader>
          
          {selectedType === "team_leader" && <TeamLeaderSalary />}
          {selectedType === "assistant" && <AssistantSalary />}
          {selectedType === "staff" && <StaffSalary />}
        </SheetContent>
      </Sheet>
    </>
  );
}
