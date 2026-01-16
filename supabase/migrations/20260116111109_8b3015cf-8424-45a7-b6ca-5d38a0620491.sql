-- Tilføj nye permissions med default 'true' for alle eksisterende roller
-- Disse permissions blev tilføjet til permission-systemet og skal have default-værdier

-- Hent alle unikke role_keys fra eksisterende permissions
INSERT INTO public.role_page_permissions (role_key, permission_key, can_view, can_edit, visibility)
SELECT DISTINCT
  rpp.role_key,
  perm.key,
  true,  -- Default: alle kan se
  false, -- Default: ingen kan redigere
  'self' -- Default visibility
FROM public.role_page_permissions rpp
CROSS JOIN (
  VALUES 
    ('menu_home'),
    ('menu_h2h'),
    ('menu_commission_league'),
    ('menu_my_goals'),
    ('menu_my_feedback'),
    ('menu_my_schedule'),
    ('menu_my_profile'),
    ('menu_my_contracts'),
    ('menu_career_wishes'),
    ('menu_refer_a_friend'),
    ('menu_messages_personal'),
    ('menu_time_stamp')
) AS perm(key)
ON CONFLICT (role_key, permission_key) DO NOTHING;