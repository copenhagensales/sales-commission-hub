UPDATE public.data_field_definitions
SET is_pii = true,
    description = 'Ekstern kundereference hos klienten (TDC/Relatel). Personoplysning: kan slås op i klientens system. Anonymiseres på kampagnens retention-frist, samme frist som telefonnummer.',
    updated_at = now()
WHERE field_key = 'opp_number';

INSERT INTO public.data_field_definitions (field_key, display_name, category, data_type, is_pii, retention_days, description)
SELECT 'sales_id', 'Sales ID / CVR', 'sale', 'string', true, NULL,
       'Ekstern reference (Sales ID/CVR) hos klienten. Personoplysning: kan slås op i klientens system. Anonymiseres på kampagnens retention-frist, samme frist som telefonnummer.'
WHERE NOT EXISTS (SELECT 1 FROM public.data_field_definitions WHERE field_key = 'sales_id');