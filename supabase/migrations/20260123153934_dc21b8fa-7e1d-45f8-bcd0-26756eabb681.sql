-- Cleanup: Remove e-conomic API integration components

-- Delete economic entry from api_integrations
DELETE FROM api_integrations WHERE type = 'economic';

-- Drop economic_invoices table (empty, never used)
DROP TABLE IF EXISTS economic_invoices;

-- Drop economic_events table (webhook events, empty)
DROP TABLE IF EXISTS economic_events;