import { useQuery } from "@tanstack/react-query";
import ClientDashboard from "@/components/dashboard/ClientDashboard";
import { supabase } from "@/integrations/supabase/client";
import { RouteSkeleton } from "@/components/mobile";

/** Hiper-teamets board: alle salg fra medarbejderne på teamet Hiper (team-scope). */
function useHiperTeamId() {
  return useQuery({
    queryKey: ["team-id-by-name", "Hiper"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("id").eq("name", "Hiper").maybeSingle();
      if (error) throw error;
      return (data?.id as string | undefined) ?? null;
    },
    staleTime: 60 * 60 * 1000,
  });
}

export default function HiperDashboard() {
  const { data: teamId, isLoading } = useHiperTeamId();
  if (isLoading) return <RouteSkeleton />;
  if (!teamId) return null;
  return (
    <ClientDashboard
      config={{
        slug: "hiper",
        teamId,
        title: "Hiper – Overblik",
        features: { theme: "cph", showMonth: false },
      }}
    />
  );
}
