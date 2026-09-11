CREATE TABLE public.ingestion_filter_settings (
  id text PRIMARY KEY DEFAULT 'default',
  phone_filter_enabled boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by text
);

GRANT SELECT ON public.ingestion_filter_settings TO authenticated;
GRANT ALL ON public.ingestion_filter_settings TO service_role;

ALTER TABLE public.ingestion_filter_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alle indloggede kan se indtagsfilterets indstillinger"
ON public.ingestion_filter_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Kun superadmin kan rette indtagsfilterets indstillinger"
ON public.ingestion_filter_settings FOR UPDATE TO authenticated
USING (am_i_superadmin()) WITH CHECK (am_i_superadmin());

CREATE POLICY "Kun superadmin kan oprette indtagsfilterets indstillinger"
ON public.ingestion_filter_settings FOR INSERT TO authenticated
WITH CHECK (am_i_superadmin());

CREATE TRIGGER update_ingestion_filter_settings_updated_at
BEFORE UPDATE ON public.ingestion_filter_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.ingestion_filter_settings (id, phone_filter_enabled)
VALUES ('default', false)
ON CONFLICT (id) DO NOTHING;