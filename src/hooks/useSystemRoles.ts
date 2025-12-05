import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type SystemRole = "medarbejder" | "teamleder" | "ejer";

export interface SystemRoleRecord {
  id: string;
  user_id: string;
  role: SystemRole;
  created_at: string | null;
  updated_at: string | null;
}

export function useCurrentUserRole() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["system-role", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("system_roles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data as SystemRoleRecord | null;
    },
    enabled: !!user,
    staleTime: 0, // Always refetch
    gcTime: 0, // Don't cache across sessions
  });
}

export function useAllSystemRoles() {
  return useQuery({
    queryKey: ["all-system-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_roles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as SystemRoleRecord[];
    },
  });
}

export function useUsersWithRoles() {
  return useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      // Get all employees with their emails
      const { data: employees, error: empError } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, private_email, job_title, is_active")
        .eq("is_active", true)
        .order("first_name");

      if (empError) throw empError;

      // Get all system roles
      const { data: roles, error: roleError } = await supabase
        .from("system_roles")
        .select("*");

      if (roleError) throw roleError;

      // Get auth users to match emails
      // Note: We can't directly query auth.users, so we match via email in employee_master_data
      return employees.map((emp) => {
        const role = roles?.find((r) => {
          // We need to match via a different method since we can't access auth.users
          return false; // Will be matched differently
        });
        return {
          ...emp,
          full_name: `${emp.first_name} ${emp.last_name}`,
          system_role: role?.role || null,
          role_record: role || null,
        };
      });
    },
  });
}

export function useAssignRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      role,
    }: {
      userId: string;
      role: SystemRole;
    }) => {
      // Upsert the role
      const { data, error } = await supabase
        .from("system_roles")
        .upsert(
          { user_id: userId, role },
          { onConflict: "user_id" }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-system-roles"] });
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      queryClient.invalidateQueries({ queryKey: ["system-role"] });
    },
  });
}

export function useRemoveRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("system_roles")
        .delete()
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-system-roles"] });
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      queryClient.invalidateQueries({ queryKey: ["system-role"] });
    },
  });
}

// Helper to check permissions
export function useCanAccess() {
  const { user } = useAuth();
  const { data: roleData, isPending, isLoading, isFetching } = useCurrentUserRole();

  // Show loading if no user yet, or if query is still loading
  const isRoleLoading = !user || isPending || isLoading;

  // Only trust the role data if we have a user and the data's user_id matches
  const isValidData = roleData && user && roleData.user_id === user.id;
  
  const isOwner = isValidData && roleData.role === "ejer";
  const isTeamleder = isValidData && roleData.role === "teamleder";
  const isMedarbejder = !isValidData || roleData?.role === "medarbejder";

  return {
    isLoading: isRoleLoading,
    role: isValidData ? roleData.role : "medarbejder",
    isOwner,
    isTeamleder,
    isTeamlederOrAbove: isTeamleder || isOwner,
    isMedarbejder,
    canManageTeam: isTeamleder || isOwner,
    canSeeAllData: isOwner,
    canManageRoles: isOwner,
  };
}
