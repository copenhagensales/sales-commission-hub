-- Slet ubrugt menu_clients permission
DELETE FROM role_page_permissions 
WHERE permission_key = 'menu_clients';