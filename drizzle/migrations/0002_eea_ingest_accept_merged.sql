CREATE OR REPLACE FUNCTION public.geo_eea_ingest_chunk(_batch text, _csv text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  INSERT INTO public.eea_ip_ranges (ip_start, ip_end, country, batch)
  SELECT split_part(l,',',1)::inet, split_part(l,',',2)::inet, split_part(l,',',3), _batch
  FROM string_to_table(_csv, E'\n') AS l
  WHERE split_part(l,',',3) = ANY (ARRAY['EEA','AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','IS','LI','NO']);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.geo_eea_ingest_chunk(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.geo_eea_ingest_chunk(text, text) TO service_role;
SELECT cron.unschedule('refresh-eea-ip-ranges');