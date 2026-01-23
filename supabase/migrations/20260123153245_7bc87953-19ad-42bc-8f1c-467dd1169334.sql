-- Slet CRM Excel import tabeller
DROP TABLE IF EXISTS crm_excel_import_rows;
DROP TABLE IF EXISTS crm_excel_imports;

-- Slet customer integrations tabel
DROP TABLE IF EXISTS customer_integrations;

-- Slet tilhørende RPC functions hvis de eksisterer
DROP FUNCTION IF EXISTS save_customer_integration(uuid, text, text, text, jsonb, jsonb);
DROP FUNCTION IF EXISTS get_customer_integration(uuid);
DROP FUNCTION IF EXISTS schedule_integration_sync(text, text, text);
DROP FUNCTION IF EXISTS unschedule_integration_sync(text);
DROP FUNCTION IF EXISTS create_customer_integration(uuid, text, text, text, jsonb, jsonb);