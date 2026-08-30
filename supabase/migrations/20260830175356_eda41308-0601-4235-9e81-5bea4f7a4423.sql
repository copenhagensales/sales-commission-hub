-- Triggerfunktioner må kun kaldes af triggeren, ikke direkte via API'et
REVOKE ALL ON FUNCTION public.log_calculation_settings_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_calculation_settings_change() FROM anon;
REVOKE ALL ON FUNCTION public.log_calculation_settings_change() FROM authenticated;

REVOKE ALL ON FUNCTION public.set_calculation_settings_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_calculation_settings_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.set_calculation_settings_updated_at() FROM authenticated;