INSERT INTO cancellation_upload_configs (
  client_id, name, phone_column, opp_column, member_number_column,
  company_column, product_columns, product_match_mode,
  is_default, filter_column, filter_value
) VALUES (
  '81993a7b-ff24-46b8-8ffb-37a83138ddba',
  'Eesy TM Standard',
  'Phone Number', NULL, NULL, NULL,
  '{}', 'strip_percent_suffix',
  true, 'Annulled Sales', '1'
);