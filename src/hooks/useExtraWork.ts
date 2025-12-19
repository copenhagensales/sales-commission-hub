import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface ExtraWork {
  id: string;
  employee_id: string;
  shift_id: string | null;
  date: string;
  from_time: string;
  to_time: string;
  hours: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  approved_by: string | null;
  approved_at: string | null;
}

export interface ExtraWorkWithEmployee extends ExtraWork {
  employee?: {
    first_name: string;
    last_name: string;
  };
}

export interface CreateExtraWorkInput {
  shift_id?: string | null;
  date: string;
  from_time: string;
  to_time: string;
  reason?: string;
}

// Hook for employees to get their own extra work
export function useMyExtraWork() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-extra-work", user?.email],
    queryFn: async () => {
      if (!user?.email) return [];

      // Get employee id first
      const lowerEmail = user.email.toLowerCase();
      const { data: employee } = await supabase
        .from("employee_master_data")
        .select("id")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .maybeSingle();

      if (!employee) return [];

      const { data, error } = await supabase
        .from("extra_work")
        .select("*")
        .eq("employee_id", employee.id)
        .order("date", { ascending: false })
        .order("from_time", { ascending: false });

      if (error) throw error;
      return data as ExtraWork[];
    },
    enabled: !!user?.email,
  });
}

// Hook for managers to get team extra work
export function useTeamExtraWork(filters?: {
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ["team-extra-work", filters],
    queryFn: async () => {
      let query = supabase
        .from("extra_work")
        .select(`
          *,
          employee:employee_master_data!extra_work_employee_id_fkey(first_name, last_name)
        `)
        .order("date", { ascending: false })
        .order("from_time", { ascending: false });

      if (filters?.employeeId) {
        query = query.eq("employee_id", filters.employeeId);
      }
      if (filters?.startDate) {
        query = query.gte("date", filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte("date", filters.endDate);
      }
      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ExtraWorkWithEmployee[];
    },
  });
}

// Create extra work entry
export function useCreateExtraWork() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateExtraWorkInput) => {
      if (!user?.email) throw new Error("Ikke logget ind");

      // Get employee id
      const lowerEmail = user.email.toLowerCase();
      const { data: employee } = await supabase
        .from("employee_master_data")
        .select("id")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .maybeSingle();

      if (!employee) throw new Error("Medarbejder ikke fundet");

      // Validate times
      if (input.from_time >= input.to_time) {
        throw new Error("Sluttid skal være efter starttid");
      }

      // Check for overlapping extra work on same day
      const { data: existing } = await supabase
        .from("extra_work")
        .select("id, from_time, to_time")
        .eq("employee_id", employee.id)
        .eq("date", input.date);

      if (existing && existing.length > 0) {
        for (const entry of existing) {
          const existingFrom = entry.from_time;
          const existingTo = entry.to_time;
          // Check overlap
          if (
            (input.from_time >= existingFrom && input.from_time < existingTo) ||
            (input.to_time > existingFrom && input.to_time <= existingTo) ||
            (input.from_time <= existingFrom && input.to_time >= existingTo)
          ) {
            throw new Error("Tidsrummet overlapper med eksisterende ekstra arbejde");
          }
        }
      }

      const { data, error } = await supabase
        .from("extra_work")
        .insert({
          employee_id: employee.id,
          shift_id: input.shift_id || null,
          date: input.date,
          from_time: input.from_time,
          to_time: input.to_time,
          reason: input.reason || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-extra-work"] });
      queryClient.invalidateQueries({ queryKey: ["team-extra-work"] });
      toast({
        title: "Ekstra arbejde tilføjet",
        description: "Din registrering afventer godkendelse",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Update extra work (for managers)
export function useUpdateExtraWork() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<{
        from_time: string;
        to_time: string;
        reason: string;
        status: "pending" | "approved" | "rejected";
        rejection_reason: string;
      }>;
    }) => {
      if (!user?.email) throw new Error("Ikke logget ind");

      // Get manager employee id for approved_by
      const lowerEmail = user.email.toLowerCase();
      const { data: manager } = await supabase
        .from("employee_master_data")
        .select("id")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .maybeSingle();

      const updateData: Record<string, unknown> = { ...updates };
      
      if (updates.status === "approved" || updates.status === "rejected") {
        updateData.approved_by = manager?.id;
        updateData.approved_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from("extra_work")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["my-extra-work"] });
      queryClient.invalidateQueries({ queryKey: ["team-extra-work"] });
      
      const statusMsg = variables.updates.status === "approved" 
        ? "Godkendt" 
        : variables.updates.status === "rejected" 
          ? "Afvist" 
          : "Opdateret";
      
      toast({
        title: statusMsg,
        description: "Ekstra arbejde er blevet " + statusMsg.toLowerCase(),
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Delete extra work (for employees - only pending)
export function useDeleteExtraWork() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("extra_work")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-extra-work"] });
      queryClient.invalidateQueries({ queryKey: ["team-extra-work"] });
      toast({
        title: "Slettet",
        description: "Ekstra arbejde er blevet slettet",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
