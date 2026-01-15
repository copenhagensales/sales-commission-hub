-- Slet helt ubrugte permissions (ingen sidebar/route)
DELETE FROM role_page_permissions 
WHERE permission_key IN (
  'menu_integrations',
  'menu_content',
  'menu_coaching',
  'menu_economy',
  'menu_chat'
);

-- Omdøb fejlmappede permissions til korrekte sidebar keys
UPDATE role_page_permissions 
SET permission_key = 'menu_onboarding_admin'
WHERE permission_key = 'menu_onboarding';

UPDATE role_page_permissions 
SET permission_key = 'menu_recruitment_dashboard'
WHERE permission_key = 'menu_recruitment';

UPDATE role_page_permissions 
SET permission_key = 'menu_shift_overview'
WHERE permission_key = 'menu_shifts';