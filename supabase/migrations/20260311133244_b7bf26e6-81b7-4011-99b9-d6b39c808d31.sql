
-- Remap sale_items from duplicate products (created Feb 28) to originals (created Dec 2025)
-- Then deactivate the duplicates

UPDATE sale_items SET product_id = 'a638c296-c7e4-48de-a0aa-d2a2a047e693' WHERE product_id = '79589dc7-3292-4705-affe-e7c3a298cbf1';
UPDATE sale_items SET product_id = '4ee2c0c6-7f47-4a2c-a9c5-9c917ab3aa95' WHERE product_id = '855990ad-d192-462e-9be6-697f4aa0fac7';
UPDATE sale_items SET product_id = 'be72946a-8404-4620-acc7-78cdcb60e06b' WHERE product_id = 'caf53dd6-642d-4313-aff2-af0509499b41';
UPDATE sale_items SET product_id = 'e555195d-b956-4ac1-9fb0-cdc0fee142f8' WHERE product_id = '98d8a5b2-7e42-4dde-86bf-156bbe0bf293';
UPDATE sale_items SET product_id = '67fd55c3-03f2-45bc-97fa-4a9c653e8bd4' WHERE product_id = 'b58713c7-ed32-41e5-a0b5-59b22da9aa30';
UPDATE sale_items SET product_id = '73198b7d-37d7-4959-9b75-47928b0cc82d' WHERE product_id = '566766a5-dd7a-471b-bd3c-7dbec05c872b';
UPDATE sale_items SET product_id = '6fdc5b77-1278-404c-af94-eb46778c39d7' WHERE product_id = '2eab321a-50fd-4c79-a7b4-f294cb8d3df7';
UPDATE sale_items SET product_id = '1dd6a683-42f4-43e5-96a5-adb6dc02da8a' WHERE product_id = '2d284130-f732-4f5d-911a-16a825c5f601';

UPDATE products SET is_active = false WHERE id IN (
  '79589dc7-3292-4705-affe-e7c3a298cbf1',
  '855990ad-d192-462e-9be6-697f4aa0fac7',
  'caf53dd6-642d-4313-aff2-af0509499b41',
  '98d8a5b2-7e42-4dde-86bf-156bbe0bf293',
  'b58713c7-ed32-41e5-a0b5-59b22da9aa30',
  '566766a5-dd7a-471b-bd3c-7dbec05c872b',
  '2eab321a-50fd-4c79-a7b4-f294cb8d3df7',
  '2d284130-f732-4f5d-911a-16a825c5f601'
)
