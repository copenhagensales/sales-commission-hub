-- First delete duplicates that would conflict
-- Keep the one with the most recent updated_at (or id if no updated_at difference)
DELETE FROM role_page_permissions a
USING role_page_permissions b
WHERE a.role_key = b.role_key
  AND a.permission_key = 'menu_email_templates'
  AND b.permission_key = 'menu_email_templates_recruitment'
  AND a.id < b.id;

-- Now safely update the remaining menu_email_templates_recruitment to menu_email_templates
UPDATE role_page_permissions
SET permission_key = 'menu_email_templates'
WHERE permission_key = 'menu_email_templates_recruitment'
  AND NOT EXISTS (
    SELECT 1 FROM role_page_permissions rpp2
    WHERE rpp2.role_key = role_page_permissions.role_key
      AND rpp2.permission_key = 'menu_email_templates'
  );

-- Delete any remaining duplicates
DELETE FROM role_page_permissions 
WHERE permission_key = 'menu_email_templates_recruitment';

-- Same for menu_messages_recruitment (handling duplicates first)
DELETE FROM role_page_permissions a
USING role_page_permissions b
WHERE a.role_key = b.role_key
  AND a.permission_key = 'menu_messages'
  AND b.permission_key = 'menu_messages_recruitment'
  AND a.id < b.id;

UPDATE role_page_permissions
SET permission_key = 'menu_messages'
WHERE permission_key = 'menu_messages_recruitment'
  AND NOT EXISTS (
    SELECT 1 FROM role_page_permissions rpp2
    WHERE rpp2.role_key = role_page_permissions.role_key
      AND rpp2.permission_key = 'menu_messages'
  );

DELETE FROM role_page_permissions 
WHERE permission_key = 'menu_messages_recruitment';