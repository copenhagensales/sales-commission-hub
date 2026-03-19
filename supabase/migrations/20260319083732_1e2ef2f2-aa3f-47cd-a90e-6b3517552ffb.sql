ALTER TABLE public.employee_referrals
  DROP CONSTRAINT employee_referrals_converted_to_candidate_id_fkey,
  ADD CONSTRAINT employee_referrals_converted_to_candidate_id_fkey
    FOREIGN KEY (converted_to_candidate_id)
    REFERENCES public.candidates(id)
    ON DELETE SET NULL;