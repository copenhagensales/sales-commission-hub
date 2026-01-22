-- Opdater alle eksisterende Tilskud-regler til at inkludere de to problematiske kampagner
-- og sæt højere prioritet så de matcher før basis-pris

UPDATE product_pricing_rules
SET 
  campaign_mapping_ids = CASE 
    WHEN campaign_mapping_ids IS NULL THEN 
      ARRAY['7b58a1e9-55f6-4869-8825-e0edda40a72b', '1282c7d7-ef6e-4411-8b0a-815c1a46b60c']::uuid[]
    WHEN NOT ('7b58a1e9-55f6-4869-8825-e0edda40a72b'::uuid = ANY(campaign_mapping_ids)) THEN
      campaign_mapping_ids || ARRAY['7b58a1e9-55f6-4869-8825-e0edda40a72b', '1282c7d7-ef6e-4411-8b0a-815c1a46b60c']::uuid[]
    ELSE 
      campaign_mapping_ids
  END,
  priority = GREATEST(COALESCE(priority, 0), 5)
WHERE is_active = true
  AND conditions::text LIKE '%Tilskud%';