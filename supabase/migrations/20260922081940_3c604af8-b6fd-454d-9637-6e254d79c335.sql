DELETE FROM public.ingestion_known_fields
WHERE integration = 'adversus'
  AND container = 'lead_meta'
  AND field_label IN ('contactAttempts', 'active');