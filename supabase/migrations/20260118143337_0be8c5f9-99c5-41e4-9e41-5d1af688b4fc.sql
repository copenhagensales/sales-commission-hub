-- Fase 1: Synkroniser permission key fra 'tab_employees_dialer' til 'tab_employees_dialer_mapping'
UPDATE role_page_permissions 
SET permission_key = 'tab_employees_dialer_mapping'
WHERE permission_key = 'tab_employees_dialer';