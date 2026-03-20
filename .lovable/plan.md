

# Seed permission for Kundehenvendelser

## Ændring
Indsæt `menu_customer_inquiries` permission for `ejer`-rollen i `role_page_permissions`-tabellen, så menupunktet bliver synligt under Ledelse.

## SQL
```sql
INSERT INTO role_page_permissions (role_key, permission_key, parent_key, permission_type, can_view, can_edit, description)
VALUES ('ejer', 'menu_customer_inquiries', 'menu_section_ledelse', 'page', true, true, 'Kundehenvendelser');
```

## Resultat
Efter insert vil ejer-rollen kunne se "Kundehenvendelser" under Ledelse i sidebaren.

