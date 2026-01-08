-- Add column to track if referral has been converted to a candidate
ALTER TABLE public.employee_referrals 
ADD COLUMN converted_to_candidate_id UUID REFERENCES public.candidates(id);