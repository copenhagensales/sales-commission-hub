import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TeamLeaderSalary } from "./TeamLeaderSalary";
import { AssistantSalary } from "./AssistantSalary";
import { StaffSalary } from "./StaffSalary";

export function PersonnelSalaryTab() {
  return (
    <Tabs defaultValue="team-leaders" className="mt-4">
      <TabsList>
        <TabsTrigger value="team-leaders">Teamledere</TabsTrigger>
        <TabsTrigger value="assistants">Assistenter</TabsTrigger>
        <TabsTrigger value="staff">Stabslønninger</TabsTrigger>
      </TabsList>

      <TabsContent value="team-leaders" className="mt-4">
        <TeamLeaderSalary />
      </TabsContent>

      <TabsContent value="assistants" className="mt-4">
        <AssistantSalary />
      </TabsContent>

      <TabsContent value="staff" className="mt-4">
        <StaffSalary />
      </TabsContent>
    </Tabs>
  );
}
