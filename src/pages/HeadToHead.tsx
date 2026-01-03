import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { HeadToHeadComparison } from "@/components/home/HeadToHeadComparison";
import { Skeleton } from "@/components/ui/skeleton";

export default function HeadToHead() {
  const { user } = useAuth();

  const { data: currentEmployee, isLoading } = useQuery({
    queryKey: ["current-employee-h2h", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      
      const lowerEmail = user.email.toLowerCase();
      const { data } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .eq("is_active", true)
        .maybeSingle();
      
      return data;
    },
    enabled: !!user?.email,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Skeleton className="h-[600px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <HeadToHeadComparison
        currentEmployeeId={currentEmployee?.id}
        currentEmployeeName={currentEmployee ? `${currentEmployee.first_name} ${currentEmployee.last_name}` : undefined}
      />
    </div>
  );
}
