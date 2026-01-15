-- Slet forældede Boards permissions fra role_page_permissions
DELETE FROM role_page_permissions 
WHERE permission_key IN ('menu_section_boards', 'menu_sales');