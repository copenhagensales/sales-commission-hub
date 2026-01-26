
-- Først: Fjern alle duplikerede system_roles (behold kun den nyeste per bruger)
DELETE FROM system_roles 
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id 
  FROM system_roles 
  ORDER BY user_id, created_at DESC
);

-- Derefter: Tilføj unique constraint så hver bruger kun kan have én rolle
ALTER TABLE system_roles 
DROP CONSTRAINT IF EXISTS system_roles_user_id_key;

ALTER TABLE system_roles 
ADD CONSTRAINT system_roles_user_id_unique UNIQUE (user_id);
