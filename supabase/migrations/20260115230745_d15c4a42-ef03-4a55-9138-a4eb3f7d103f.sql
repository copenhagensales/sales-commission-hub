-- Add visibility column to role_page_permissions
ALTER TABLE role_page_permissions 
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'self' 
CHECK (visibility IN ('all', 'team', 'self'));

-- Update existing rows: ejer gets 'all'
UPDATE role_page_permissions 
SET visibility = 'all' 
WHERE role_key = 'ejer';

-- Update teamleder to 'team'
UPDATE role_page_permissions 
SET visibility = 'team' 
WHERE role_key = 'teamleder';