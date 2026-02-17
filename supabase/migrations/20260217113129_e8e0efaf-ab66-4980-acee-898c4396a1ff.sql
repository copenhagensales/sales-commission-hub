UPDATE role_page_permissions 
SET parent_key = 'menu_section_reports' 
WHERE permission_key = 'menu_cancellations' 
AND (parent_key IS NULL OR parent_key != 'menu_section_reports');