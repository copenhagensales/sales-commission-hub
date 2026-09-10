ALTER TABLE public.failed_login_attempts ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.failed_login_attempts ADD COLUMN IF NOT EXISTS origin text;