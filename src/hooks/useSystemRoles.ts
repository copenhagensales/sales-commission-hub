import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useRef } from "react";
import { useRolePreview } from "@/contexts/RolePreviewContext";

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
  const { isPreviewMode, previewRole } = useRolePreview();

  // Note: positions table was removed - rely solely on system_roles table now
  const employeeLoading = false;
  const employeeData = null;

  // Show loading if no user yet, or if query is still loading
  const isRoleLoading = authLoading || (!user ? false : (isPending || queryLoading || employeeLoading));

  // IN PREVIEW MODE: Use preview role instead of actual roles
  if (isPreviewMode && previewRole) {
    const previewRoleLower = previewRole.toLowerCase();
    const isOwner = previewRoleLower === "ejer";
    const isTeamleder = previewRoleLower === "teamleder";
    const isRekruttering = previewRoleLower === "rekruttering";
    const isSome = previewRoleLower === "some";
    const isMedarbejder = !isOwner && !isTeamleder && !isRekruttering && !isSome;

    return {
      isLoading: false,
      role: previewRoleLower as SystemRole,
      roles: [previewRoleLower],
      isOwner,
      isTeamleder,
      isRekruttering,
      isSome,
      isTeamlederOrAbove: isTeamleder || isOwner,
      isRekrutteringOrAbove: isRekruttering || isTeamleder || isOwner,
      isMedarbejder,
      canManageTeam: isTeamleder || isOwner,
      canManageRoles: isOwner,
      canCreateEmployees: isRekruttering || isTeamleder || isOwner,
      canSendContracts: isRekruttering || isTeamleder || isOwner,
      hasMultipleRoles: false,
    };
  }

  // NORMAL MODE: Primary source is positions.system_role, fallback to system_roles table
  const positionData = employeeData?.positions as { name?: string; system_role?: string } | null;
  const positionSystemRole = positionData?.system_role?.toLowerCase();
  
  // Fallback roles from system_roles table
  const fallbackRoles = rolesData || [];
  const fallbackRoleNames = fallbackRoles.map(r => r.role);
  
  // Determine effective role: position takes priority, then system_roles table
  const effectiveRole = positionSystemRole || (fallbackRoleNames.length > 0 ? fallbackRoleNames[0] : "medarbejder");
  
  // Check for each role type using position's system_role OR fallback
  const isOwner = effectiveRole === "ejer" || fallbackRoleNames.includes("ejer");
  const isTeamleder = effectiveRole === "teamleder" || fallbackRoleNames.includes("teamleder");
  const isRekruttering = effectiveRole === "rekruttering" || fallbackRoleNames.includes("rekruttering");
  const isSome = effectiveRole === "some" || fallbackRoleNames.includes("some");
  const isMedarbejder = effectiveRole === "medarbejder" || (!isOwner && !isTeamleder && !isRekruttering && !isSome);

  // Primary role for display purposes (prioritize higher roles)
  const primaryRole = isOwner ? "ejer" : isTeamleder ? "teamleder" : isRekruttering ? "rekruttering" : isSome ? "some" : "medarbejder";

  // Collect all effective roles for display
  const allRoles = positionSystemRole 
    ? [positionSystemRole, ...fallbackRoleNames.filter(r => r !== positionSystemRole)]
    : fallbackRoleNames;

  return {
    isLoading: isRoleLoading,
    role: primaryRole,
    roles: allRoles.length > 0 ? allRoles : ["medarbejder"],
    isOwner,
    isTeamleder,
    isRekruttering,
    isSome,
    isTeamlederOrAbove: isTeamleder || isOwner,
    isRekrutteringOrAbove: isRekruttering || isTeamleder || isOwner,
    isMedarbejder,
    canManageTeam: isTeamleder || isOwner,
    canManageRoles: isOwner,
    canCreateEmployees: isRekruttering || isTeamleder || isOwner,
    canSendContracts: isRekruttering || isTeamleder || isOwner,
    hasMultipleRoles: allRoles.length > 1,
  };
}
