-- Fjern effective_from datoer fra prisreglerne så de gælder for alle salg
UPDATE product_pricing_rules 
SET effective_from = NULL
WHERE id IN (
  'edafbf2e-54f3-41a1-a96c-9a819392c31b',  -- A-kasse over 6000 lønsikring
  'c3296963-0c24-4977-9f16-8882a77d2db7',  -- A-kasse under 6000 lønsikring
  '2da06203-6dcb-4b07-ae79-4ad072300a17',  -- Ung Under Uddannelse med FF
  'dcd1bbaf-be1d-45af-83e7-16b5adf75322',  -- Ung Under Uddannelse uden FF
  '5b3b49f6-83b6-4fa2-ab3d-33542b7c9f02'   -- A-kasse uden straksbetaling (generel)
);