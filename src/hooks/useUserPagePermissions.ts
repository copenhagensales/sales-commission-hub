import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Per-bruger undtagelser til rettighedssystemet (`user_page_permissions`).
 *
 * Resolutionsrækkefølge — identisk i frontend (`usePositionPermissions`)
 * og database (`has_page_permission`):
 *   personlig deny > personlig grant > rollens rettighed > ejer-bypass.
 */
export type UserPermissionMode = "grant" | "deny";

export interface UserPagePermission {
  id: string;
  user_id: string;
  permission_key: string;
  can_view: boolean;
  can_edit: boolean;
  mode: UserPermissionMode;
  created_at: string;
}

export interface UserPagePermissionWithEmployee extends UserPagePermission {
  employeeName: string;
  employeeEmail: string | null;
}

export function useAllUserPagePermissions() {
  return useQuery({
    queryKey: ["user-page-permissions"],
    queryFn: async (): Promise<UserPagePermissionWithEmployee[]> => {
      const { data, error } = await supabase
        .from("user_page_permissions")
        .select("id, user_id, permission_key, can_view, can_edit, mode, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const rows = (data || []) as UserPagePermission[];
      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
      const nameById = new Map<string, { name: string; email: string | null }>();

      if (userIds.length > 0) {
        const { data: employees } = await supabase
          .from("employee_master_data")
          .select("auth_user_id, first_name, last_name, work_email")
          .in("auth_user_id", userIds);
        for (const e of employees || []) {
          if (!e.auth_user_id) continue;
          nameById.set(e.auth_user_id, {
            name: [e.first_name, e.last_name].filter(Boolean).join(" ").trim(),
            email: e.work_email ?? null,
          });
        }
      }

      return rows.map((r) => ({
        ...r,
        mode: r.mode as UserPermissionMode,
        employeeName: nameById.get(r.user_id)?.name || "Ukendt bruger",
        employeeEmail: nameById.get(r.user_id)?.email ?? null,
      }));
    },
  });
}

export interface EmployeeOption {
  authUserId: string;
  name: string;
  email: string | null;
  jobTitle: string | null;
}

/** Aktive medarbejdere med login, til valg af person. */
export function useEmployeeAuthOptions(enabled = true) {
  return useQuery({
    queryKey: ["employee-auth-options"],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<EmployeeOption[]> => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("auth_user_id, first_name, last_name, work_email, job_title")
        .eq("is_active", true)
        .not("auth_user_id", "is", null)
        .order("first_name");
      if (error) throw error;
      return (data || [])
        .filter((e) => !!e.auth_user_id)
        .map((e) => ({
          authUserId: e.auth_user_id as string,
          name: [e.first_name, e.last_name].filter(Boolean).join(" ").trim(),
          email: e.work_email ?? null,
          jobTitle: e.job_title ?? null,
        }));
    },
  });
}

export interface UpsertUserPagePermissionInput {
  userId: string;
  permissionKey: string;
  mode: UserPermissionMode;
  canEdit: boolean;
}

export function useUpsertUserPagePermission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertUserPagePermissionInput) => {
      const { error } = await supabase.from("user_page_permissions").upsert(
        {
          user_id: input.userId,
          permission_key: input.permissionKey,
          mode: input.mode,
          can_view: input.mode === "grant",
          can_edit: input.mode === "grant" ? input.canEdit : false,
        },
        { onConflict: "user_id,permission_key" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-page-permissions"] });
    },
  });
}

export function useDeleteUserPagePermission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_page_permissions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-page-permissions"] });
    },
  });
}
