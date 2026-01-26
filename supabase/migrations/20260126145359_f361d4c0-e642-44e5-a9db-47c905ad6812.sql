-- Drop market_application table and related objects
DROP TABLE IF EXISTS market_application CASCADE;

-- Drop the status type
DROP TYPE IF EXISTS market_application_status;

-- Remove application-related columns from booking table
ALTER TABLE booking DROP COLUMN IF EXISTS open_for_applications;
ALTER TABLE booking DROP COLUMN IF EXISTS application_deadline;
ALTER TABLE booking DROP COLUMN IF EXISTS visible_from;