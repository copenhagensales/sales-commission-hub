import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useRef } from "react";

export type SystemRole = "medarbejder" | "teamleder" | "ejer" | "rekruttering" | "some";

export interface SystemRoleRecord {
  id: string;
  user_id: string;
  role: SystemRole;
  created_at: string | null;
  updated_at: string | null;
}

export function useCurrentUserRoles() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const previousUserId = useRef<string | undefined>();

  // Clear role cache only when user actually changes (not on every render)
  useEffect(() => {
    if (previousUserId.current && previousUserId.current !== user?.id) {
      queryClient.removeQueries({ queryKey: ["system-roles"] });
    }
    previousUserId.current = user?.id;
  }, [user?.id, queryClient]);

  return useQuery({
    queryKey: ["system-roles", user?.id],
    queryFn: async () => {
      if (!user) return [];

      try {
        const { data, error } = await supabase
          .from("system_roles")
          .select("*")
          .eq("user_id", user.id);

        if (error) {
          console.error("Error fetching system roles:", error);
          return [];
        }
        return (data as SystemRoleRecord[]) || [];
      } catch (error) {
        console.error("Error in useCurrentUserRoles:", error);
        return [];
      }
    },
    enabled: !!user && !authLoading,
    staleTime: 1000 * 30, // Cache for 30 seconds only
    gcTime: 1000 * 60 * 5, // Keep in cache for 5 minutes
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    retry: 1,
  });
}

// Keep legacy hook for backwards compatibility
export function useCurrentUserRole() {
  const { data: roles, isPending, isLoading } = useCurrentUserRoles();
  // Return the first role for backwards compatibility
  return {
    data: roles && roles.length > 0 ? roles[0] : null,
    isPending,
    isLoading,
  };
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
      queryClient.invalidateQueries({ queryKey: ["system-roles"] });
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
      queryClient.invalidateQueries({ queryKey: ["system-roles"] });
    },
  });
}

// Helper to check permissions
export function useCanAccess() {
  const { user, loading: authLoading } = useAuth();
  const { data: rolesData, isPending, isLoading: queryLoading } = useCurrentUserRoles();

  // Show loading if no user yet, or if query is still loading
  const isRoleLoading = authLoading || (!user ? false : (isPending || queryLoading));

  // Get all roles for the user
  const roles = rolesData || [];
  const roleNames = roles.map(r => r.role);
  
  // Check for each role type - check array for multi-role support
  const isOwner = roleNames.includes("ejer");
  const isTeamleder = roleNames.includes("teamleder");
  const isRekruttering = roleNames.includes("rekruttering");
  const isSome = roleNames.includes("some");
  const isMedarbejder = roleNames.includes("medarbejder") || roles.length === 0;
  
  // Debug logging for role detection
  console.log("useCanAccess - roles:", roleNames, "isRekruttering:", isRekruttering, "isTeamleder:", isTeamleder);

  // Primary role for display purposes (prioritize higher roles)
  const primaryRole = isOwner ? "ejer" : isTeamleder ? "teamleder" : isRekruttering ? "rekruttering" : isSome ? "some" : "medarbejder";

  return {
    isLoading: isRoleLoading,
    role: primaryRole,
    roles: roleNames,
    isOwner,
    isTeamleder,
    isRekruttering,
    isSome,
    isTeamlederOrAbove: isTeamleder || isOwner,
    isRekrutteringOrAbove: isRekruttering || isTeamleder || isOwner,
    isMedarbejder,
    canManageTeam: isTeamleder || isOwner,
    canSeeAllData: isOwner,
    canManageRoles: isOwner,
    canCreateEmployees: isRekruttering || isTeamleder || isOwner,
    canSendContracts: isRekruttering || isTeamleder || isOwner,
    // User has multiple roles
    hasMultipleRoles: roles.length > 1,
  };
}
