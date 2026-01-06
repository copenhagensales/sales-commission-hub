import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Referral {
  id: string;
  referrer_employee_id: string;
  referral_code: string;
  candidate_first_name: string;
  candidate_last_name: string;
  candidate_email: string;
  candidate_phone: string | null;
  referrer_name_provided: string;
  message: string | null;
  status: 'pending' | 'contacted' | 'hired' | 'eligible_for_bonus' | 'bonus_paid' | 'rejected';
  hired_date: string | null;
  bonus_eligible_date: string | null;
  bonus_paid_date: string | null;
  bonus_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  referrer?: {
    first_name: string;
    last_name: string;
    private_email: string;
  };
}

// Hook for employees to see their own referrals
export function useMyReferrals() {
  return useQuery({
    queryKey: ['my-referrals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_referrals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Referral[];
    },
  });
}

// Hook for admins to see all referrals
export function useAllReferrals() {
  return useQuery({
    queryKey: ['all-referrals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_referrals')
        .select(`
          *,
          referrer:employee_master_data!referrer_employee_id (
            first_name,
            last_name,
            private_email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Referral[];
    },
  });
}

// Hook to get referrer info by referral code (uses secure function for anon access)
export function useReferrerByCode(code: string | undefined) {
  return useQuery({
    queryKey: ['referrer-by-code', code],
    queryFn: async () => {
      if (!code) return null;
      
      // Use secure function that only exposes necessary fields
      const { data, error } = await supabase
        .rpc('get_referrer_by_code', { p_referral_code: code });

      if (error) throw error;
      
      // Function returns array, get first result
      const result = Array.isArray(data) ? data[0] : data;
      return result || null;
    },
    enabled: !!code,
  });
}

// Hook to submit a referral (public form) - uses secure edge function
export function useSubmitReferral() {
  return useMutation({
    mutationFn: async (data: {
      referral_code: string;
      referrer_employee_id: string;
      candidate_first_name: string;
      candidate_last_name: string;
      candidate_email: string;
      candidate_phone?: string;
      referrer_name_provided: string;
      message?: string;
    }) => {
      // Use edge function for secure submission (bypasses anon RLS restrictions)
      const { data: result, error } = await supabase.functions.invoke('submit-referral', {
        body: {
          referral_code: data.referral_code,
          candidate_first_name: data.candidate_first_name,
          candidate_last_name: data.candidate_last_name,
          candidate_email: data.candidate_email,
          candidate_phone: data.candidate_phone,
          referrer_name_provided: data.referrer_name_provided,
          message: data.message,
        },
      });

      if (error) {
        throw new Error(error.message || 'Kunne ikke sende henvisning');
      }

      if (result.error) {
        throw new Error(result.error);
      }

      return result.referral;
    },
  });
}

// Hook to update referral status (admin)
export function useUpdateReferralStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      hired_date,
      notes 
    }: { 
      id: string; 
      status: Referral['status'];
      hired_date?: string;
      notes?: string;
    }) => {
      const updates: Record<string, unknown> = { status };
      
      if (hired_date) {
        updates.hired_date = hired_date;
        // Calculate bonus eligible date (2 months after hired)
        const eligibleDate = new Date(hired_date);
        eligibleDate.setMonth(eligibleDate.getMonth() + 2);
        updates.bonus_eligible_date = eligibleDate.toISOString();
      }
      
      if (notes !== undefined) {
        updates.notes = notes;
      }

      const { data, error } = await supabase
        .from('employee_referrals')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-referrals'] });
      queryClient.invalidateQueries({ queryKey: ['my-referrals'] });
      toast.success('Status opdateret');
    },
    onError: (error) => {
      console.error('Error updating referral:', error);
      toast.error('Kunne ikke opdatere status');
    },
  });
}

// Hook to mark bonus as paid
export function useMarkBonusPaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('employee_referrals')
        .update({ 
          status: 'bonus_paid',
          bonus_paid_date: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-referrals'] });
      queryClient.invalidateQueries({ queryKey: ['my-referrals'] });
      toast.success('Bonus markeret som udbetalt');
    },
    onError: (error) => {
      console.error('Error marking bonus paid:', error);
      toast.error('Kunne ikke markere bonus som udbetalt');
    },
  });
}

// Hook to delete a referral
export function useDeleteReferral() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('employee_referrals')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-referrals'] });
      toast.success('Henvisning slettet');
    },
    onError: (error) => {
      console.error('Error deleting referral:', error);
      toast.error('Kunne ikke slette henvisning');
    },
  });
}

// Hook to get current employee's referral code
export function useMyReferralCode() {
  return useQuery({
    queryKey: ['my-referral-code'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('employee_master_data')
        .select('referral_code, first_name, last_name')
        .eq('auth_user_id', user.id)
        .single();

      if (error) {
        // Try by email as fallback
        const { data: dataByEmail, error: errorByEmail } = await supabase
          .from('employee_master_data')
          .select('referral_code, first_name, last_name')
          .eq('private_email', user.email)
          .single();

        if (errorByEmail) throw errorByEmail;
        return dataByEmail;
      }
      return data;
    },
  });
}
