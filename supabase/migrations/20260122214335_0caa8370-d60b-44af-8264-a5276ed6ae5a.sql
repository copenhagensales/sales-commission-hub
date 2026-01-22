-- Drop and recreate posteringer_enriched view with is_balance_account column
DROP VIEW IF EXISTS posteringer_enriched;

CREATE VIEW posteringer_enriched AS
WITH regel_matches AS (
  SELECT DISTINCT ON (p.loebe_nr) 
    p.loebe_nr,
    r.kategori_id AS regel_kategori_id,
    r.team_id AS regel_team_id,
    r.priority
  FROM economic_posteringer p
  CROSS JOIN economic_fordelingsregler r
  WHERE r.is_active = true 
    AND p.dato >= r.active_from 
    AND p.dato <= r.active_to 
    AND (
      (r.match_field = 'tekst' AND r.match_operator = 'contains' AND lower(COALESCE(p.tekst, '')) LIKE '%' || lower(r.match_value) || '%')
      OR (r.match_field = 'tekst' AND r.match_operator = 'equals' AND lower(COALESCE(p.tekst, '')) = lower(r.match_value))
      OR (r.match_field = 'tekst' AND r.match_operator = 'starts_with' AND lower(COALESCE(p.tekst, '')) LIKE lower(r.match_value) || '%')
      OR (r.match_field = 'tekst' AND r.match_operator = 'ends_with' AND lower(COALESCE(p.tekst, '')) LIKE '%' || lower(r.match_value))
      OR (r.match_field = 'leverandoer_nr' AND r.match_operator = 'equals' AND p.leverandoer_nr::text = r.match_value)
      OR (r.match_field = 'kunde_nr' AND r.match_operator = 'equals' AND p.kunde_nr::text = r.match_value)
      OR (r.match_field = 'konto_nr' AND r.match_operator = 'equals' AND p.konto_nr::text = r.match_value)
    )
  ORDER BY p.loebe_nr, r.priority DESC
)
SELECT 
  p.loebe_nr,
  to_char(p.dato, 'YYYY-MM') AS maaned,
  p.dato,
  p.konto_nr,
  k.navn AS kontonavn,
  p.tekst,
  p.beloeb_dkk,
  p.leverandoer_nr,
  p.kunde_nr,
  p.bilags_nr,
  COALESCE(rkat.navn, mkat.navn, 'Øvrige') AS kategori,
  COALESCE(rm.regel_kategori_id, m.kategori_id, (SELECT id FROM economic_kategorier WHERE navn = 'Øvrige')) AS kategori_id,
  COALESCE(rt.name, mt.name, mkat_default_t.name, 'Stab') AS team,
  COALESCE(rm.regel_team_id, m.team_id, mkat.default_team_id, '09012ce9-e307-4f6d-a51e-f72af7200d74'::uuid) AS team_id,
  CASE 
    WHEN rm.loebe_nr IS NOT NULL THEN 'regel'
    WHEN m.id IS NOT NULL THEN 'mapping'
    ELSE 'fallback'
  END AS klassificering_kilde,
  COALESCE(m.needs_review, rm.loebe_nr IS NULL AND m.id IS NULL) AS needs_review,
  p.import_id,
  -- NEW: Mark balance accounts (konto_nr >= 5000)
  (p.konto_nr >= 5000) AS is_balance_account
FROM economic_posteringer p
LEFT JOIN economic_kontoplan k ON k.konto_nr = p.konto_nr
LEFT JOIN regel_matches rm ON rm.loebe_nr = p.loebe_nr
LEFT JOIN economic_konto_mapping m ON m.konto_nr = p.konto_nr AND p.dato >= m.active_from AND p.dato <= m.active_to
LEFT JOIN economic_kategorier rkat ON rkat.id = rm.regel_kategori_id
LEFT JOIN economic_kategorier mkat ON mkat.id = m.kategori_id
LEFT JOIN teams rt ON rt.id = rm.regel_team_id
LEFT JOIN teams mt ON mt.id = m.team_id
LEFT JOIN teams mkat_default_t ON mkat_default_t.id = mkat.default_team_id;