import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MainLayout } from "@/components/layout/MainLayout";
import { HeadToHeadComparison } from "@/components/home/HeadToHeadComparison";
import { Skeleton } from "@/components/ui/skeleton";

export default function HeadToHead() {
  const { user } = useAuth();

  const { data: currentEmployee, isLoading } = useQuery({
    queryKey: ["current-employee-h2h", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      
      const lowerEmail = user.email.toLowerCase();
      // Try work_email first, then private_email
      const { data: byWorkEmail } = await supabase
        .from("employee_basic_info")
        .select("id, first_name, last_name, work_email")
        .eq("work_email", lowerEmail)
        .maybeSingle();
      
      if (byWorkEmail) return byWorkEmail;
      
      // Fallback to private_email via employee_master_data
      const { data: byPrivateEmail } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, work_email")
        .ilike("private_email", lowerEmail)
        .eq("is_active", true)
        .maybeSingle();
      
      return byPrivateEmail;
    },
    enabled: !!user?.email,
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6 max-w-4xl">
          <Skeleton className="h-[600px] w-full rounded-xl" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-6 max-w-4xl">
        <HeadToHeadComparison
          currentEmployeeId={currentEmployee?.id}
          currentEmployeeName={currentEmployee ? `${currentEmployee.first_name} ${currentEmployee.last_name}` : undefined}
        />
      </div>
    </MainLayout>
  );
}
