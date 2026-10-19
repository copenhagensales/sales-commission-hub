CREATE UNIQUE INDEX IF NOT EXISTS employee_master_data_active_auth_user_uniq
  ON public.employee_master_data (auth_user_id)
  WHERE is_active = true AND auth_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS employee_master_data_active_work_email_uniq
  ON public.employee_master_data (lower(work_email))
  WHERE is_active = true AND work_email IS NOT NULL;

COMMENT ON INDEX public.employee_master_data_active_auth_user_uniq IS 'Højst ét aktivt medarbejderkort pr. login-konto (login-fejl okt 2026).';
COMMENT ON INDEX public.employee_master_data_active_work_email_uniq IS 'Højst ét aktivt medarbejderkort pr. arbejdsmail, uafhængigt af store/små bogstaver.';