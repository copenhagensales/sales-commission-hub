import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

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
  const queryClient = useQueryClient();

  // Clear role cache when user changes
  useEffect(() => {
    queryClient.removeQueries({ queryKey: ["system-role"] });
  }, [user?.id, queryClient]);

  return useQuery({
    queryKey: ["system-role", user?.id],
    queryFn: async () => {
      if (!user) return null;

      console.log("[useCurrentUserRole] Fetching role for user:", user.id, user.email);

      const { data, error } = await supabase
        .from("system_roles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("[useCurrentUserRole] Error:", error);
        throw error;
      }
      
      console.log("[useCurrentUserRole] Role data:", data);
      return data as SystemRoleRecord | null;
    },
    enabled: !!user,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
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
  const { data: roleData, isPending, isLoading } = useCurrentUserRole();

  // Show loading if no user yet, or if query is still loading
  const isRoleLoading = !user || isPending || isLoading;

  // Only trust the role data if we have a user and the data's user_id matches
  const isValidData = roleData && user && roleData.user_id === user.id;
  
  // Explicitly check for elevated roles - default to medarbejder if no valid data
  const actualRole = isValidData ? roleData.role : "medarbejder";
  const isOwner = actualRole === "ejer";
  const isTeamleder = actualRole === "teamleder";
  const isMedarbejder = actualRole === "medarbejder";

  console.log("[useCanAccess] State:", {
    userId: user?.id,
    userEmail: user?.email,
    roleData,
    isValidData,
    actualRole,
    isOwner,
    isTeamleder,
    isTeamlederOrAbove: isTeamleder || isOwner,
    isLoading: isRoleLoading,
  });

  return {
    isLoading: isRoleLoading,
    role: actualRole,
    isOwner,
    isTeamleder,
    isTeamlederOrAbove: isTeamleder || isOwner,
    isMedarbejder,
    canManageTeam: isTeamleder || isOwner,
    canSeeAllData: isOwner,
    canManageRoles: isOwner,
  };
}
